import { describe, expect, it } from "vitest";
import { deterministicGradeAgainstGovernance } from "../answer-grading.ts";
import { extractStrategyGovernanceText } from "../strategy-output-grading.ts";

describe("strategy output governance extraction", () => {
  it("extracts client-facing strategy text and flags banned claims deterministically", () => {
    const extracted = extractStrategyGovernanceText({
      document: {
        markdown:
          "This strategy focuses on proof-led positioning, authority content, and a clear consultative conversion path for the next ninety days.",
      },
      modules: {
        positioning: {
          finalSentence: "For premium clinics, this plan creates guaranteed bookings through proof-led content.",
          proofPoints: [{ claim: "guaranteed bookings from the launch campaign" }],
          differentiators: [{ approvedPhrasing: "senior strategist review on every campaign" }],
        },
        pillars: {
          pillars: [{ coreMessage: "Show real client decision moments and documented service outcomes." }],
        },
        campaign_plan: {
          campaigns: [{ name: "Consultation authority sprint", cta: "Book a fit call", angle: "Turn existing proof into a safer offer story." }],
        },
        channel_adaptations: {
          translationTable: [{ coreMessage: "Use evidence before promises.", variants: { linkedin: "Lead with the documented client problem." } }],
          channels: [{ dos: ["Cite the source of each proof point."] }],
        },
        rules_constraints: {
          claimsPolicy: [{ claim: "Only use measurable proof that the client has approved." }],
        },
      },
    });

    expect(extracted.text).toContain("guaranteed bookings");
    expect(extracted.sections.map((section) => section.surface)).toEqual([
      "document.markdown",
      "modules.positioning",
      "modules.pillars",
      "modules.campaign_plan",
      "modules.channel_adaptations",
      "modules.rules_constraints",
    ]);

    const grading = deterministicGradeAgainstGovernance({
      text: extracted.text,
      governance: { client: { banned_claims: ["guaranteed bookings"] } },
      contentType: "strategy",
    });

    expect(grading.accepted).toBe(false);
    expect(grading.hard_violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "banned_claim" })]),
    );
  });

  it("accepts clean extracted strategy text without a model call", () => {
    const extracted = extractStrategyGovernanceText({
      document: {
        markdown:
          "This strategy uses approved proof, specific audience language, and a measured weekly review process before any client-facing claim is shipped.",
      },
      modules: {
        positioning: {
          finalSentence: "For founder-led firms, the plan turns documented expertise into consistent demand signals.",
          proofPoints: [{ claim: "client-approved proof assets support the authority angle" }],
          differentiators: [{ approvedPhrasing: "operator-led strategy with documented review gates" }],
        },
        pillars: {
          pillars: [{ coreMessage: "Translate approved proof into practical posts that help buyers compare options." }],
        },
        campaign_plan: {
          campaigns: [{ name: "Authority evidence sprint", cta: "Request the audit checklist", angle: "Show the decision criteria before selling the service." }],
        },
        channel_adaptations: {
          translationTable: [{ coreMessage: "Make the proof specific.", variants: { instagram: "Lead with a visible before-state and the approved method." } }],
          channels: [{ dos: ["Use approved source material in every proof post."] }],
        },
        rules_constraints: {
          claimsPolicy: [{ claim: "Performance language needs a linked proof point before approval." }],
        },
      },
    });

    const grading = deterministicGradeAgainstGovernance({
      text: extracted.text,
      governance: { client: { banned_claims: ["guaranteed bookings"] } },
      contentType: "strategy",
    });

    expect(grading.accepted).toBe(true);
    expect(grading.hard_violations).toEqual([]);
  });
});
