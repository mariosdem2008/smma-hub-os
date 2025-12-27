import { describe, expect, it, vi } from "vitest"
import { calculateCost, checkBudget, incrementBudget } from "./budgets.ts"

describe("calculateCost", () => {
  it("calculates gpt-5-nano costs", () => {
    const cost = calculateCost("openai", "gpt-5-nano", 1000, 500)
    expect(cost).toBeCloseTo(0.0045, 6)
  })

  it("calculates gpt-5-mini costs", () => {
    const cost = calculateCost("openai", "gpt-5-mini", 1000, 500)
    expect(cost).toBeCloseTo(0.0075, 6)
  })

  it("calculates embedding costs", () => {
    const cost = calculateCost("openai", "text-embedding-3-small", 1000, 0)
    expect(cost).toBeCloseTo(0.00002, 8)
  })

  it("matches pricing with model suffixes", () => {
    const cost = calculateCost("openai", "gpt-5-mini-2025-01-01", 1000, 0)
    expect(cost).toBeCloseTo(0.0025, 6)
  })
})

describe("budget rpc wrappers", () => {
  it("checkBudget uses rpc with zero delta", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          allowed: true,
          budget_id: "budget-1",
          spent_usd: 1,
          budget_usd: 10,
          hard_stop: true,
        },
      ],
      error: null,
    })
    const supabase = { rpc }
    const result = await checkBudget(supabase, "agency-1", "2025-01")

    expect(rpc).toHaveBeenCalledWith("ai_budget_apply_delta", {
      p_agency_id: "agency-1",
      p_month_yyyy_mm: "2025-01",
      p_delta_usd: 0,
      p_enforce: true,
    })
    expect(result.remainingUsd).toBe(9)
    expect(result.allowed).toBe(true)
  })

  it("incrementBudget passes delta to rpc", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          allowed: true,
          budget_id: "budget-1",
          spent_usd: 2,
          budget_usd: 10,
          hard_stop: true,
        },
      ],
      error: null,
    })
    const supabase = { rpc }
    const result = await incrementBudget(supabase, "agency-1", "2025-01", 1)

    expect(rpc).toHaveBeenCalledWith("ai_budget_apply_delta", {
      p_agency_id: "agency-1",
      p_month_yyyy_mm: "2025-01",
      p_delta_usd: 1,
      p_enforce: true,
    })
    expect(result.spentUsd).toBe(2)
  })
})
