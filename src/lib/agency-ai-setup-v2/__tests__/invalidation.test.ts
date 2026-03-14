import { describe, expect, it } from "vitest";
import { deriveAgencyAiSetupInvalidationState } from "@/lib/agency-ai-setup-v2/invalidation";

describe("deriveAgencyAiSetupInvalidationState", () => {
  it("marks certifications as stale when relevant setup evidence changed after certification", () => {
    const result = deriveAgencyAiSetupInvalidationState({
      status: {
        agency_id: "agency-1",
        current_stage: "readiness",
        current_step: "readiness",
        setup_state: "ready_for_review",
        started_at: "2026-03-14T06:00:00.000Z",
        last_active_at: "2026-03-14T10:00:00.000Z",
        completed_foundations_at: "2026-03-14T07:00:00.000Z",
        completed_readiness_review_at: null,
        activated_at: null,
        control_center_enabled_at: null,
        meta_json: {
          foundations: { updated_at: "2026-03-14T08:00:00.000Z" },
          guardrails: { updated_at: "2026-03-14T08:30:00.000Z" },
          workflow: { updated_at: "2026-03-14T09:00:00.000Z" },
        },
        created_at: "2026-03-14T06:00:00.000Z",
        updated_at: "2026-03-14T10:00:00.000Z",
      },
      certifications: [
        {
          id: "cert-1",
          agency_id: "agency-1",
          agent_class: "strategy",
          scenario_key: "strategy_readiness_certification",
          scenario_title: "Strategy readiness certification",
          certification_state: "certified",
          latest_simulation_id: "sim-1",
          latest_result: "pass",
          latest_dimension_scores: {},
          latest_findings: [],
          recommended_next_action: null,
          certified_at: "2026-03-14T07:00:00.000Z",
          certified_by: "user-1",
          revoked_at: null,
          revoked_by: null,
          note: null,
          created_at: "2026-03-14T07:00:00.000Z",
          updated_at: "2026-03-14T07:00:00.000Z",
        },
      ],
      unlocks: [
        {
          agency_id: "agency-1",
          agent_class: "strategy",
          unlock_state: "operational",
          blocked_reasons: [],
          required_modules: ["quality_bar"],
          minimum_scores_json: {},
          activation_mode: "operational",
          activation_policy_json: {},
          last_evaluated_at: "2026-03-14T10:00:00.000Z",
          activated_at: "2026-03-14T10:00:00.000Z",
          activated_by: "user-1",
          created_at: "2026-03-14T06:00:00.000Z",
          updated_at: "2026-03-14T10:00:00.000Z",
        },
      ] as any,
      modules: [
        {
          id: "module-1",
          agency_id: "agency-1",
          module_key: "quality_bar",
          version: 1,
          status: "draft",
          source_document_id: null,
          content_json: {} as any,
          derived_snapshot_json: {},
          confidence: 50,
          evidence_sources: [],
          approved_by_user_id: null,
          approved_at: null,
          updated_at: "2026-03-14T09:30:00.000Z",
          created_at: "2026-03-14T06:00:00.000Z",
        },
      ] as any,
    });

    expect(result.strategy.staleCertifications).toHaveLength(1);
    expect(result.strategy.staleScenarioKeys).toEqual(["strategy_readiness_certification"]);
    expect(result.strategy.staleReasons).toContain("Foundations were updated");
    expect(result.strategy.staleReasons).toContain("quality bar module was updated");
  });
});
