import { describe, expect, it } from "vitest"
import { incrementBudget } from "../../../src/ai/budgets.ts"

type BudgetRow = {
  id: string
  spent_usd: number
  budget_usd: number
  hard_stop: boolean
}

function createBudgetRpc(initial: BudgetRow) {
  let budget = { ...initial }
  let chain = Promise.resolve()

  const rpc = async (_fn: string, args: Record<string, unknown>) => {
    const run = async () => {
      const delta = Number(args.p_delta_usd ?? 0)
      const enforce = Boolean(args.p_enforce ?? true)
      const newSpent = budget.spent_usd + delta
      if (
        enforce &&
        budget.hard_stop &&
        (budget.spent_usd >= budget.budget_usd || newSpent > budget.budget_usd)
      ) {
        return {
          allowed: false,
          budget_id: budget.id,
          spent_usd: budget.spent_usd,
          budget_usd: budget.budget_usd,
          hard_stop: budget.hard_stop,
        }
      }
      if (delta !== 0) {
        budget = { ...budget, spent_usd: newSpent }
      }
      return {
        allowed: true,
        budget_id: budget.id,
        spent_usd: budget.spent_usd,
        budget_usd: budget.budget_usd,
        hard_stop: budget.hard_stop,
      }
    }

    chain = chain.then(run, run)
    const result = await chain
    return { data: [result], error: null }
  }

  return {
    rpc,
    getBudget: () => budget,
  }
}

describe("budget enforcement integration", () => {
  it("increments spent_usd correctly", async () => {
    const state = createBudgetRpc({
      id: "budget-1",
      spent_usd: 0,
      budget_usd: 10,
      hard_stop: true,
    })
    const supabase = { rpc: state.rpc }

    const result = await incrementBudget(supabase, "agency-1", "2025-01", 1.5, true)
    expect(result.allowed).toBe(true)
    expect(state.getBudget().spent_usd).toBeCloseTo(1.5, 6)
  })

  it("denies when budget exceeded", async () => {
    const state = createBudgetRpc({
      id: "budget-1",
      spent_usd: 0.01,
      budget_usd: 0.01,
      hard_stop: true,
    })
    const supabase = { rpc: state.rpc }

    const result = await incrementBudget(supabase, "agency-1", "2025-01", 0.01, true)
    expect(result.allowed).toBe(false)
    expect(state.getBudget().spent_usd).toBeCloseTo(0.01, 6)
  })

  it("prevents concurrent overage", async () => {
    const state = createBudgetRpc({
      id: "budget-1",
      spent_usd: 0,
      budget_usd: 0.01,
      hard_stop: true,
    })
    const supabase = { rpc: state.rpc }

    const [first, second] = await Promise.all([
      incrementBudget(supabase, "agency-1", "2025-01", 0.01, true),
      incrementBudget(supabase, "agency-1", "2025-01", 0.01, true),
    ])

    const allowedCount = [first.allowed, second.allowed].filter(Boolean).length
    expect(allowedCount).toBe(1)
    expect(state.getBudget().spent_usd).toBeLessThanOrEqual(0.01)
  })
})
