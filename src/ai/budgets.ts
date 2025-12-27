import { PRICING } from "./pricing.ts"

type MinimalSupabase = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data?: any; error?: any }>
}

export type BudgetCheckResult = {
  allowed: boolean
  budgetId: string | null
  spentUsd: number
  budgetUsd: number
  hardStop: boolean
  remainingUsd: number
}

type BudgetRpcRow = {
  allowed: boolean
  budget_id: string | null
  spent_usd: number
  budget_usd: number
  hard_stop: boolean
}

function pickPricing(model: string) {
  if (PRICING[model]) return PRICING[model]
  const match = Object.keys(PRICING).find((key) => model.startsWith(key))
  return match ? PRICING[match] : undefined
}

export function calculateCost(
  provider: string,
  model: string,
  tokensIn: number = 0,
  tokensOut: number = 0,
) {
  if (provider !== "openai") return 0
  const pricing = pickPricing(model)
  if (!pricing) return 0
  const inputCost = Math.max(0, tokensIn) * pricing.inputPerToken
  const outputCost = Math.max(0, tokensOut) * pricing.outputPerToken
  return inputCost + outputCost
}

async function applyBudgetDelta(
  supabase: MinimalSupabase,
  agencyId: string,
  monthKey: string,
  deltaUsd: number,
  enforce: boolean,
): Promise<BudgetCheckResult> {
  const { data, error } = await supabase.rpc("ai_budget_apply_delta", {
    p_agency_id: agencyId,
    p_month_yyyy_mm: monthKey,
    p_delta_usd: deltaUsd,
    p_enforce: enforce,
  })

  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as BudgetRpcRow | null | undefined
  if (!row) {
    return {
      allowed: false,
      budgetId: null,
      spentUsd: 0,
      budgetUsd: 0,
      hardStop: true,
      remainingUsd: 0,
    }
  }

  const remainingUsd = Number(row.budget_usd) - Number(row.spent_usd)
  return {
    allowed: Boolean(row.allowed),
    budgetId: row.budget_id ?? null,
    spentUsd: Number(row.spent_usd),
    budgetUsd: Number(row.budget_usd),
    hardStop: Boolean(row.hard_stop),
    remainingUsd,
  }
}

export async function checkBudget(supabase: MinimalSupabase, agencyId: string, monthKey: string) {
  return await applyBudgetDelta(supabase, agencyId, monthKey, 0, true)
}

export async function incrementBudget(
  supabase: MinimalSupabase,
  agencyId: string,
  monthKey: string,
  costUsd: number,
  enforce: boolean = true,
) {
  return await applyBudgetDelta(supabase, agencyId, monthKey, costUsd, enforce)
}
