import { describe, expect, it } from "vitest";
import { deriveAgencyAiSetupReadiness } from "@/lib/agency-ai-setup-v2/readiness";

describe("deriveAgencyAiSetupReadiness", () => {
  it("returns low readiness with critical blockers when no imports or foundations exist", () => {
    const result = deriveAgencyAiSetupReadiness({
      agencyId: "agency-1",
      meta: {},
      approvedModuleKeys: [],
      approvedModuleCount: 0,
      legacyApprovedDocumentModules: [],
      legacyApprovedDocumentCount: 0,
    });

    expect(result.overall_label).toBe("Not Ready");
    expect(result.critical_blockers).toContain("Import agency context");
    expect(result.critical_blockers).toContain("Approve quality bar module");
    expect(result.unlocks.every((row) => row.unlock_state === "blocked" || row.unlock_state === "preview_only")).toBe(true);
  });

  it("raises readiness when foundations and core V2 modules exist", () => {
    const result = deriveAgencyAiSetupReadiness({
      agencyId: "agency-1",
      meta: {
        imports: {
          accepted_sources: ["agency_profile", "approved_brain_documents"],
          accepted_document_count: 4,
        },
        foundations: {
          agency_summary: "We help local service businesses grow through social media systems.",
          niche_focus: "local service businesses",
          service_model: "done-for-you retainer",
          market_position: "hands-on specialist",
          primary_services: ["strategy", "content", "reporting"],
          primary_offer: "Growth retainer",
          secondary_offers: ["Advisory sprint"],
          icp_segments: ["gyms", "dentists"],
        },
        guardrails: {
          quality_review_standard: "Every output must be specific, credible, and conversion-aware.",
          creative_rules: ["Lead with specificity", "Avoid generic hooks"],
          banned_claims: ["guaranteed results"],
          required_disclaimers: ["Results vary by market and offer."],
          client_facing_restrictions: ["Do not promise timelines without approval"],
          escalation_triggers: ["Compliance uncertainty", "Client escalation risk"],
        },
        workflow: {
          lifecycle_stages: ["brief", "strategy", "creation", "approval", "publish", "report"],
          approval_classes: ["strategy review", "client review"],
          delivery_sops: ["Use approved creator brief", "Log blockers to execution tasks"],
          reporting_expectations: ["Weekly summary", "Monthly KPI review"],
          escalation_rules: ["Escalate blocked approvals over 48 hours"],
          workflow_notes: "Use governed approvals before any client-facing publish step.",
        },
      },
      approvedModuleKeys: ["agency_identity", "service_catalog", "offer_strategy", "quality_bar", "approval_matrix"],
      approvedModuleCount: 5,
      legacyApprovedDocumentModules: ["rep_policy", "ai_permissions"],
      legacyApprovedDocumentCount: 2,
    });

    expect(result.knowledge_coverage).toBeGreaterThan(60);
    expect(result.quality_definition).toBeGreaterThan(60);
    expect(result.approval_governance).toBeGreaterThan(60);
    expect(result.critical_blockers).not.toContain("Import agency context");
    expect(result.unlocks.find((row) => row.agent_class === "strategy")?.unlock_state).toBe("operational");
  });

  it("keeps strategy in internal assist when only one score gate is still missing", () => {
    const result = deriveAgencyAiSetupReadiness({
      agencyId: "agency-1",
      meta: {
        imports: {
          accepted_sources: ["agency_profile"],
          accepted_document_count: 0,
        },
        foundations: {
          agency_summary: "We help local service businesses grow through lead generation systems.",
          niche_focus: "local service marketing",
          service_model: "monthly retainer",
          market_position: "local specialization and lead transparency",
          primary_services: ["Local SEO", "Google Ads", "Reporting"],
          primary_offer: "Local Lead Engine",
          secondary_offers: ["Reputation Rescue"],
          icp_segments: ["Owner-operated local service business"],
        },
        guardrails: {
          quality_review_standard: "Reject generic, unverifiable, or weak local-market claims.",
          creative_rules: ["Include city or metro context"],
          banned_claims: ["Guaranteed #1 ranking"],
          required_disclaimers: ["Results vary by market"],
          client_facing_restrictions: ["Do not publish anything client-facing without human review"],
          escalation_triggers: ["Compliance uncertainty"],
        },
      },
      approvedModuleKeys: ["agency_identity", "offer_strategy", "quality_bar", "approval_matrix"],
      approvedModuleCount: 4,
      legacyApprovedDocumentModules: [],
      legacyApprovedDocumentCount: 0,
    });

    expect(result.unlocks.find((row) => row.agent_class === "strategy")?.unlock_state).toBe("internal_assist_only");
  });
});
