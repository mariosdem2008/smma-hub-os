import { describe, expect, it } from "vitest";
import {
  buildDefaultDiagnosisInputSummary,
  evaluateDiagnosisArtifact,
  evaluateRecommendationArtifact,
  normalizeAgencyOperatingModuleFromBrainDocument,
} from "@/lib/strategy/v2/agents";
import { allowsRecommendationFromReadiness, buildFallbackTrace, getReadinessDeepLinkStage } from "@/lib/strategy/v2/workflow";

describe("strategy v2 agents", () => {
  it("normalizes approved brain documents into operating modules", () => {
    const module = normalizeAgencyOperatingModuleFromBrainDocument({
      id: "doc-1",
      module: "quality_bar",
      title: "Quality Bar",
      status: "approved",
      content_json: {
        definition: "How this agency reviews work.",
        rules: [{ id: "r1", statement: "Hooks must be specific." }],
      },
      updated_at: "2026-03-13T00:00:00Z",
    });

    expect(module.module_key).toBe("quality_bar");
    expect(module.rules.length).toBeGreaterThan(0);
    expect(module.approval.status).toBe("approved");
  });

  it("passes diagnosis evaluation for a coherent diagnosis artifact", () => {
    const result = evaluateDiagnosisArtifact({
      artifact_meta: {
        artifact_type: "strategy_diagnosis",
        version: 1,
        brief_version: 1,
        agency_module_versions: {},
      },
      summary: "Diagnosis summary",
      body: {
        current_state_summary: "Client has strong proof but weak follow-up consistency.",
        business_objective_tree: [{ objective: "Generate leads", drivers: ["Proof", "Speed"] }],
        offer_diagnosis: { primary_offer_fit: "strong", issues: [], notes: [] },
        funnel_diagnosis: { current_path: "dm", strengths: ["Low friction"], weaknesses: ["No baseline"] },
        audience_clarity: { score_0_100: 80, strengths: ["Clear audience"], gaps: [] },
        channel_fit: [{ channel: "instagram", fit: "high", why: "Visual proof fit" }],
        risk_summary: ["Slow approvals"],
        top_opportunities: ["Proof-led acquisition"],
      },
      assumptions: [],
      open_questions: [],
      citations: [],
      confidence: 84,
    });

    expect(result.result).not.toBe("fail");
  });

  it("fails recommendation evaluation when core strategic choices are missing", () => {
    const result = evaluateRecommendationArtifact({
      artifact_meta: {
        artifact_type: "strategy_recommendation",
        version: 1,
        brief_version: 1,
        agency_module_versions: {},
      },
      summary: "Recommendation summary",
      body: {
        strategic_direction: "",
        chosen_offer_priority: { primary_offer: "", why: "" },
        chosen_funnel: { path: "", why: "" },
        channel_priorities: [],
        pillar_recommendations: [],
        messaging_direction: { core_message: "", dos: [], donts: [] },
        risks_and_tradeoffs: [],
        decision_rationale: [],
      },
      assumptions: [],
      open_questions: [],
      citations: [],
      confidence: 40,
    });

    expect(result.result).toBe("fail");
  });

  it("builds compact diagnosis input summary", () => {
    const summary = buildDefaultDiagnosisInputSummary(
      {
        client_id: "client-1",
        agency_id: "agency-1",
        business_model: { category: "local_service", summary: "summary" },
        offer_priority: { primary_offer: "offer", secondary_offers: [], offer_constraints: [] },
        audience_segments: [{ id: "a1", name: "aud", jobs_to_be_done: [], pain_points: [] }],
        conversion_path: { primary_path: "dm", secondary_paths: [], handoff_notes: [] },
        sales_process: { summary: "sales", response_time_expectation_hours: null, known_drop_off_points: [] },
        pricing_and_budget: { price_positioning: "premium", media_budget_monthly: null, commercial_constraints: [] },
        proof_and_differentiators: { proof_assets: [], differentiators: [], claims_limits: [] },
        goals_baselines_success_thresholds: { primary_goal: "goal", baselines: [], success_thresholds: [] },
        channel_state_and_history: { active_channels: ["instagram"], historical_notes: [], performance_context: [] },
        stakeholder_and_approval_map: { primary_contact: "c", final_approver: "a", approval_turnaround_hours: null },
        launch_windows_and_deadlines: { next_launch_window: null, hard_deadlines: [] },
        access_and_asset_readiness: { platform_access_ready: false, missing_assets: [] },
        constraints_and_compliance: { regulated_industry: false, restricted_claims: [], required_disclaimers: [] },
        internal_capacity_and_dependencies: { client_capacity_notes: [], dependencies: [] },
        known_blockers: [],
        open_questions: [],
      },
      [
        {
          module_key: "quality_bar",
          title: "Quality bar",
          definition: "definition",
          rules: [{ id: "r1", statement: "rule" }],
          examples: [],
          anti_patterns: [],
          edge_cases: [],
          downstream_usage: [],
          approval: { owner_role: "owner", required: true, status: "approved" },
          evidence_sources: [],
          confidence: 80,
        },
      ],
    );

    expect(summary.agency_context).toHaveLength(1);
  });

  it("gates recommendation until readiness is above diagnosis_ready", () => {
    expect(allowsRecommendationFromReadiness("diagnosis_ready")).toBe(false);
    expect(allowsRecommendationFromReadiness("strategy_ready_with_caveats")).toBe(true);
    expect(allowsRecommendationFromReadiness("execution_ready")).toBe(true);
  });

  it("maps readiness states to follow-up stages", () => {
    expect(getReadinessDeepLinkStage("insufficient")).toBe("essential_intake");
    expect(getReadinessDeepLinkStage("diagnosis_ready")).toBe("progressive_enrichment");
    expect(getReadinessDeepLinkStage("strategy_ready")).toBe("operations_setup");
  });

  it("captures fallback provenance for audit trails", () => {
    expect(buildFallbackTrace("diagnosis_agent", "diagnosis_unknown")).toEqual({
      used_fallback: true,
      fallback_reason: "diagnosis_unknown",
      output_mode: "deterministic_fallback",
      agent_key: "diagnosis_agent",
    });
    expect(buildFallbackTrace("strategy_architect_agent", null).output_mode).toBe("model_output");
  });
});
