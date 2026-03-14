import { describe, expect, it } from "vitest";
import { buildCreatorBriefArtifact, evaluateCreatorBriefArtifact, renderCreatorBriefPromptContext } from "@/lib/strategy/v2/creatorBrief";
import type { ClientOperatingBriefV2, StrategyArtifactEnvelopeV2, StrategyRecommendationBody } from "@/lib/strategy/v2/contracts";

const brief: ClientOperatingBriefV2 = {
  client_id: "client-1",
  agency_id: "agency-1",
  business_model: { category: "agency", summary: "Performance-focused local service business." },
  offer_priority: { primary_offer: "Managed social growth", secondary_offers: [], offer_constraints: [] },
  audience_segments: [
    {
      id: "seg-1",
      name: "Local business owners",
      jobs_to_be_done: ["Get more qualified leads"],
      pain_points: ["Inconsistent lead flow"],
    },
  ],
  conversion_path: { primary_path: "Book a consult", secondary_paths: [], handoff_notes: [] },
  sales_process: { summary: "Inbound calls", response_time_expectation_hours: 4, known_drop_off_points: [] },
  pricing_and_budget: { price_positioning: "premium", media_budget_monthly: 3000, commercial_constraints: [] },
  proof_and_differentiators: {
    proof_assets: ["Case study: 4x inbound leads"],
    differentiators: ["Hands-on strategy and execution"],
    claims_limits: ["Do not promise guaranteed revenue"],
  },
  goals_baselines_success_thresholds: {
    primary_goal: "Increase qualified consultations",
    baselines: [],
    success_thresholds: [],
  },
  channel_state_and_history: { active_channels: ["instagram"], historical_notes: [], performance_context: [] },
  stakeholder_and_approval_map: { primary_contact: "Alex", final_approver: "Taylor", approval_turnaround_hours: 24 },
  launch_windows_and_deadlines: { next_launch_window: null, hard_deadlines: [] },
  access_and_asset_readiness: { platform_access_ready: true, missing_assets: [] },
  constraints_and_compliance: { regulated_industry: false, restricted_claims: [], required_disclaimers: [] },
  internal_capacity_and_dependencies: { client_capacity_notes: [], dependencies: [] },
  known_blockers: [],
  open_questions: [],
};

const recommendation: StrategyArtifactEnvelopeV2<StrategyRecommendationBody> = {
  artifact_meta: {
    artifact_type: "strategy_recommendation",
    version: 1,
    brief_version: 1,
    agency_module_versions: {},
  },
  summary: "Focus on proof-backed short-form content for consult bookings.",
  body: {
    strategic_direction: "Own the local authority position with proof-backed short-form content.",
    chosen_offer_priority: { primary_offer: "Managed social growth", why: "Best fit" },
    chosen_funnel: { path: "Book a consult", why: "Shortest path to qualified demand" },
    channel_priorities: [{ channel: "instagram", priority: 1, role: "Primary awareness and demand capture channel" }],
    pillar_recommendations: [
      { name: "Proof", purpose: "Show outcomes and trust signals" },
      { name: "Education", purpose: "Clarify why the approach works" },
    ],
    messaging_direction: {
      core_message: "Turn social attention into qualified consultations.",
      dos: ["Lead with proof", "Use direct language"],
      donts: ["Promise guaranteed results"],
    },
    risks_and_tradeoffs: [],
    decision_rationale: [{ decision: "Instagram first", why: "Best current fit" }],
  },
  assumptions: ["Client can support weekly approvals"],
  open_questions: ["Which offer angle closes best?"],
  citations: [],
  confidence: 84,
};

describe("creator brief v2 helpers", () => {
  it("builds a creator brief from approved recommendation and plan context", () => {
    const artifact = buildCreatorBriefArtifact({
      briefVersion: 2,
      agencyModuleVersions: { quality_bar: 3 },
      brief,
      recommendationArtifact: recommendation,
      strategyPlanArtifact: { assumptions: ["Plan assumption"], open_questions: ["Plan open question"] },
      mode: "caption",
      platform: "instagram",
    });

    expect(artifact.artifact_meta.artifact_type).toBe("creator_brief");
    expect(artifact.body.requested_output.mode).toBe("caption");
    expect(artifact.body.primary_offer).toBe("Managed social growth");
    expect(artifact.body.messaging_core.banned_phrases).toContain("Promise guaranteed results");
    expect(artifact.body.channel_execution.CTA).toBe("Book a consult");
  });

  it("renders creator brief prompt context with canonical guidance", () => {
    const artifact = buildCreatorBriefArtifact({
      briefVersion: 1,
      agencyModuleVersions: {},
      brief,
      recommendationArtifact: recommendation,
      strategyPlanArtifact: {},
      mode: "script",
      platform: "instagram",
    });

    const rendered = renderCreatorBriefPromptContext(artifact, "Need three variants.");
    expect(rendered).toContain("Creator brief");
    expect(rendered).toContain("Mode: script");
    expect(rendered).toContain("Need three variants.");
    expect(rendered).toContain("Core message:");
  });

  it("evaluates creator brief completeness", () => {
    const artifact = buildCreatorBriefArtifact({
      briefVersion: 1,
      agencyModuleVersions: {},
      brief,
      recommendationArtifact: recommendation,
      strategyPlanArtifact: {},
      mode: "ideas",
      platform: "instagram",
    });

    const evaluation = evaluateCreatorBriefArtifact(artifact);
    expect(["pass", "warn"]).toContain(evaluation.result);
    expect(evaluation.score).toBeGreaterThan(0);
  });
});
