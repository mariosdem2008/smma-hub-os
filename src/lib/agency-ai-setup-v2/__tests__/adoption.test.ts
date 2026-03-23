import { describe, expect, it } from "vitest";
import { buildSuggestedAgencyOperatingModuleDraft } from "@/lib/agency-ai-setup-v2/adoption";

describe("buildSuggestedAgencyOperatingModuleDraft", () => {
  const meta = {
    imports: {
      imported_at: "2026-03-21T05:39:03.475Z",
      accepted_sources: ["agency_profile"],
      accepted_document_count: 0,
    },
    foundations: {
      agency_summary: "Codex Agency helps local service businesses generate trackable local leads.",
      niche_focus: "Local service marketing",
      service_model: "Monthly retainer with 90-day initial commitment.",
      market_position: "Local specialization and lead transparency.",
      primary_services: ["Local SEO", "Google Ads"],
      primary_offer: "Local Lead Engine retainer",
      secondary_offers: ["Reputation Rescue"],
      icp_segments: ["Owner-operated local service business"],
    },
    guardrails: {
      quality_review_standard: "Reject generic claims and require specific service-area context.",
      creative_rules: ["Always include city or metro name in headlines."],
      banned_claims: ["Guaranteed #1 ranking on Google"],
      required_disclaimers: ["Results vary by market and competition level"],
      escalation_triggers: ["Client requests content that claims licensing without proof"],
      client_facing_restrictions: ["Do not publish anything client-facing without human review."],
    },
    workflow: {},
  } as any;

  it("seeds hidden guided proof for quality and approval modules even without approved docs", () => {
    const qualityBarDraft = buildSuggestedAgencyOperatingModuleDraft("quality_bar", meta, []);
    const approvalMatrixDraft = buildSuggestedAgencyOperatingModuleDraft("approval_matrix", meta, []);

    expect(qualityBarDraft.evidence_sources.length).toBeGreaterThan(0);
    expect(approvalMatrixDraft.evidence_sources.length).toBeGreaterThan(0);
  });

  it("includes anti-pattern proof for offer strategy", () => {
    const offerStrategyDraft = buildSuggestedAgencyOperatingModuleDraft("offer_strategy", meta, []);

    expect(offerStrategyDraft.anti_patterns.length).toBeGreaterThan(0);
    expect(offerStrategyDraft.examples.length).toBeGreaterThan(0);
  });
});
