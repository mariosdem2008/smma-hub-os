import { describe, expect, it } from "vitest";
import { buildClientOperatingBriefV2, buildReadinessArtifact, evaluateReadinessArtifact } from "@/lib/strategy/v2/briefBuilder";

describe("strategy v2 brief builder", () => {
  it("builds a diagnosis-ready brief from onboarding and operations data", () => {
    const result = buildClientOperatingBriefV2({
      clientId: "client-1",
      agencyId: "agency-1",
      onboardingProfile: {
        q6_offer_name: "Lip filler consultations",
        primary_goal: "Increase qualified consultations",
        primary_customer: "Women 25-40",
        conversion_path: "instagram_dm_to_consultation",
        platforms: ["instagram"],
        q9_pain_points: ["Fear of unnatural results"],
      },
      operationsSetup: {
        operations_setup: {
          primary_contact_name: "Practice manager",
          main_approver_name: "Clinic owner",
          launch_window: "2026-04-01",
        },
      },
      clientBrain: {},
    });

    expect(result.brief.offer_priority.primary_offer).toBe("Lip filler consultations");
    expect(result.brief.goals_baselines_success_thresholds.primary_goal).toBe("Increase qualified consultations");
    expect(result.readinessState).toMatch(/diagnosis_ready|strategy_ready_with_caveats|strategy_ready|execution_ready/);
  });

  it("marks insufficient when critical strategy inputs are missing", () => {
    const result = buildClientOperatingBriefV2({
      clientId: "client-1",
      agencyId: "agency-1",
      onboardingProfile: {},
      operationsSetup: {},
      clientBrain: {},
    });

    expect(result.readinessState).toBe("insufficient");
    expect(result.missingItems).toContain("primary_offer");
    expect(result.missingItems).toContain("primary_goal");
  });

  it("creates a coherent readiness artifact and evaluation", () => {
    const briefBuild = buildClientOperatingBriefV2({
      clientId: "client-1",
      agencyId: "agency-1",
      onboardingProfile: {
        q6_offer_name: "Offer",
        primary_goal: "Goal",
        primary_customer: "Audience",
        conversion_path: "dm",
        platforms: ["instagram"],
        q9_pain_points: ["Pain"],
      },
      operationsSetup: {
        operations_setup: {
          primary_contact_name: "Contact",
          main_approver_name: "Approver",
          launch_window: "2026-04-01",
        },
      },
      clientBrain: {},
    });

    const artifact = buildReadinessArtifact({
      brief: briefBuild.brief,
      briefVersion: 1,
      agencyModuleVersions: { quality_bar: 1 },
      readinessState: briefBuild.readinessState,
      missingItems: briefBuild.missingItems,
      assumptions: briefBuild.assumptions,
      citations: briefBuild.citations,
      confidence: briefBuild.confidence,
    });

    const evaluation = evaluateReadinessArtifact(artifact);
    expect(artifact.body.allowed_scope.length).toBeGreaterThan(0);
    expect(evaluation.result).not.toBe("fail");
  });
});
