import { describe, expect, it } from "vitest";
import { buildAgencyPulse } from "../agency-pulse.ts";

const now = "2026-06-11T10:00:00.000Z";

describe("buildAgencyPulse", () => {
  it("returns an empty all-zero pulse for an empty agency", () => {
    const pulse = buildAgencyPulse({
      clients: [],
      blockerSnapshots: [],
      gradings: [],
      strategyStates: [],
      reportStates: [],
      now,
    });

    expect(pulse.summary).toEqual({
      clients_total: 0,
      on_track: 0,
      at_risk: 0,
      blocked: 0,
    });
    expect(pulse.attention).toEqual([]);
    expect(pulse.counts_by_type).toEqual({
      blocker: 0,
      flagged_content: 0,
      strategy_missing: 0,
      strategy_stale: 0,
      approval_stalled: 0,
      report_due: 0,
    });
    expect(pulse.counts_by_owner).toEqual({
      agency: 0,
      client: 0,
      owner: 0,
    });
  });

  it("aggregates blockers, flagged gradings, and missing strategies without any AI provider", () => {
    const pulse = buildAgencyPulse({
      now,
      clients: [
        { id: "client-blocked", name: "Blocked Co", status: "active" },
        { id: "client-flagged", name: "Flagged Co", status: "active" },
        { id: "client-strategy", name: "Strategy Co", status: "active" },
      ],
      blockerSnapshots: [
        {
          client_id: "client-blocked",
          delivery_state: "blocked",
          scanned_at: "2026-06-11T09:30:00.000Z",
          blockers: [
            {
              code: "approval_stalled",
              severity: "high",
              title: "Client approval is stalled",
              detail: "One project has been in client review for more than 48 hours.",
              owner: "client",
              recommended_next_action: "Send an approval follow-up and escalate if there is no response.",
              deep_link: "/clients/client-blocked?tab=pipeline&focus=client_review",
              signal_source: "projects.client_review",
            },
            {
              code: "pipeline_stalled",
              severity: "med",
              title: "Pipeline stage is stalled",
              detail: "One project is stuck in production.",
              owner: "agency",
              recommended_next_action: "Reassign the project.",
              deep_link: "/clients/client-blocked?tab=pipeline&focus=stalled",
              signal_source: "projects.pipeline",
            },
          ],
        },
      ],
      gradings: [
        {
          id: "grading-1",
          client_id: "client-flagged",
          content_type: "caption",
          surface: "generate-ai-content",
          score: 42,
          accepted: false,
          hard_violations: [{ code: "banned_claim" }],
          created_at: "2026-06-11T09:45:00.000Z",
        },
      ],
      strategyStates: [
        {
          client_id: "client-strategy",
          onboarding_complete: true,
          onboarding_completed_at: "2026-06-10T12:00:00.000Z",
          has_approved_strategy: false,
        },
      ],
      reportStates: [
        { client_id: "client-blocked", current_period: "2026-06", current_period_report_generated: true },
        { client_id: "client-flagged", current_period: "2026-06", current_period_report_generated: true },
        { client_id: "client-strategy", current_period: "2026-06", current_period_report_generated: true },
      ],
    });

    expect(pulse.summary).toEqual({
      clients_total: 3,
      on_track: 0,
      at_risk: 2,
      blocked: 1,
    });
    expect(pulse.attention.map((item) => item.signal_type)).toEqual([
      "flagged_content",
      "approval_stalled",
      "strategy_missing",
    ]);
    expect(pulse.attention[0]).toMatchObject({
      client_id: "client-flagged",
      severity: "high",
      responsible_agent: "grading",
      owner: "agency",
    });
    expect(pulse.attention[1]).toMatchObject({
      client_id: "client-blocked",
      signal_type: "approval_stalled",
      responsible_agent: "blocker",
      owner: "client",
    });
    expect(pulse.counts_by_type).toMatchObject({
      approval_stalled: 1,
      flagged_content: 1,
      strategy_missing: 1,
    });
    expect(pulse.counts_by_owner).toMatchObject({
      agency: 2,
      client: 1,
      owner: 0,
    });
  });

  it("returns all-clear clients as on track and dedupes to one top item per client", () => {
    const pulse = buildAgencyPulse({
      now,
      clients: [
        { id: "client-clear", name: "Clear Co", status: "active" },
        { id: "client-noisy", name: "Noisy Co", status: "active" },
      ],
      blockerSnapshots: [
        {
          client_id: "client-clear",
          delivery_state: "on_track",
          scanned_at: "2026-06-11T09:00:00.000Z",
          blockers: [],
        },
      ],
      gradings: [
        {
          client_id: "client-noisy",
          accepted: false,
          hard_violations: [],
          content_type: "caption",
          surface: "calendar",
          created_at: "2026-06-11T08:00:00.000Z",
        },
      ],
      strategyStates: [
        {
          client_id: "client-noisy",
          onboarding_complete: true,
          has_approved_strategy: false,
          onboarding_completed_at: "2026-06-11T07:00:00.000Z",
        },
      ],
      reportStates: [
        { client_id: "client-clear", current_period: "2026-06", current_period_report_generated: true },
        { client_id: "client-noisy", current_period: "2026-06", current_period_report_generated: true },
      ],
    });

    expect(pulse.summary).toEqual({
      clients_total: 2,
      on_track: 1,
      at_risk: 1,
      blocked: 0,
    });
    expect(pulse.attention).toHaveLength(1);
    expect(pulse.attention[0].client_id).toBe("client-noisy");
    expect(pulse.attention[0].signal_type).toBe("strategy_missing");
  });

  it("surfaces report_due only when the current period report is missing", () => {
    const pulse = buildAgencyPulse({
      now,
      clients: [
        { id: "client-due", name: "Due Co", status: "active" },
        { id: "client-done", name: "Done Co", status: "active" },
      ],
      reportStates: [
        {
          client_id: "client-due",
          current_period: "2026-06",
          current_period_report_generated: false,
          latest_report_month: "2026-05",
          latest_report_generated_at: "2026-05-31T10:00:00.000Z",
        },
        { client_id: "client-done", current_period: "2026-06", current_period_report_generated: true },
      ],
    });

    expect(pulse.summary).toEqual({
      clients_total: 2,
      on_track: 1,
      at_risk: 1,
      blocked: 0,
    });
    expect(pulse.attention).toHaveLength(1);
    expect(pulse.attention[0]).toMatchObject({
      client_id: "client-due",
      signal_type: "report_due",
      severity: "low",
      responsible_agent: "reporting",
    });
  });
});
