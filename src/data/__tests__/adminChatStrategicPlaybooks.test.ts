import { describe, expect, it } from "vitest";
import {
  clampClarifyingQuestions,
  formatStrategicAssistantMessage,
  type AdminChatStrategicOutput,
} from "../../ai/adminChatStrategic";

describe("admin chat strategic playbooks", () => {
  it("caps clarifying questions at 3", () => {
    const capped = clampClarifyingQuestions(["q1", "q2", "q3", "q4"]);
    expect(capped).toHaveLength(3);
  });

  it("formats core offer with required sections and 3 tiers", () => {
    const output: AdminChatStrategicOutput = {
      playbook: "core_offer",
      clarifying_questions: ["What is the target niche?"],
      assumptions: ["ASSUMPTION: Average client budget $3k-$8k"],
      core_offer: {
        icp_primary: "Local service businesses, 5-20 staff",
        icp_secondary: ["Boutique ecommerce brands", "Early-stage SaaS"],
        pain_promise: "Turn inconsistent inbound into predictable leads in 90 days.",
        offer_mechanism: "Weekly content + paid amplification + lead capture.",
        tiers: [
          {
            name: "Starter",
            price_range: "$2k-$4k/mo",
            deliverables: ["12 posts/mo", "4 short videos/mo", "1 report/mo"],
            timeline_days: 30,
          },
          {
            name: "Growth",
            price_range: "$4k-$7k/mo",
            deliverables: ["20 posts/mo", "8 short videos/mo", "2 reports/mo"],
            timeline_days: 45,
          },
          {
            name: "Scale",
            price_range: "$7k-$12k/mo",
            deliverables: ["30 posts/mo", "12 short videos/mo", "4 ads/mo"],
            timeline_days: 60,
          },
        ],
        process_timeline: ["Audit (3 days)", "Launch (7 days)", "Optimize (weekly)"],
        pricing_guidance: "Anchor at $9k/mo with a $4k entry option.",
        risk_reversal: ["14-day opt-out", "Performance review at day 30"],
        client_inputs: ["Brand assets", "Access to ad accounts", "Offer details"],
        proof_options: ["Before/after metrics", "Client testimonial clips"],
        proof_collection_7d: "Collect 3 testimonials + baseline metrics within 7 days.",
        next_action: "Confirm target niche so I can tailor tier names.",
      },
      strategy: null,
      copywriting: null,
      unknown: null,
      suggestions: [],
    };

    const message = formatStrategicAssistantMessage(output);
    expect(message).toContain("ICP:");
    expect(message).toContain("Deliverables (3 tiers):");
    expect(message).toContain("Starter:");
    expect(message).toContain("Next Action:");
    expect(message.indexOf("Deliverables")).toBeLessThan(message.indexOf("Next Question:"));
  });

  it("formats strategy deliverable with required sections", () => {
    const output: AdminChatStrategicOutput = {
      playbook: "strategy",
      clarifying_questions: [],
      strategy: {
        goal_metric: "40 qualified leads/month",
        funnel_map: ["Awareness", "Consideration", "Conversion"],
        content_pillars: ["Authority", "Proof", "Education"],
        content_ideas: Array.from({ length: 12 }, (_, i) => `Idea ${i + 1} (Reel)`),
        experiments: ["UGC hook test", "Price anchoring", "CTA swap"],
        next_action: "Pick the primary goal metric for Q1.",
      },
      core_offer: null,
      copywriting: null,
      unknown: null,
      suggestions: [],
    };

    const message = formatStrategicAssistantMessage(output);
    expect(message).toContain("Goal Metric:");
    expect(message).toContain("12 Content Ideas:");
    expect(message).toContain("Experiments:");
    expect(message).toContain("Next Action:");
  });

  it("formats copywriting deliverable with required sections and UNKNOWN policy", () => {
    const output: AdminChatStrategicOutput = {
      playbook: "copywriting",
      clarifying_questions: [],
      copywriting: {
        hooks: Array.from({ length: 10 }, (_, i) => `Hook ${i + 1}`),
        ad_scripts: ["Script 1 (15s)", "Script 2 (20s)", "Script 3 (30s)"],
        ctas: ["Book a call", "Get the checklist", "Start now"],
        next_action: "Choose the best hook to deploy today.",
      },
      core_offer: null,
      strategy: null,
      unknown: null,
      suggestions: [],
    };

    const message = formatStrategicAssistantMessage(output);
    expect(message).toContain("Hooks:");
    expect(message).toContain("Ad Scripts (15-30s):");
    expect(message).toContain("CTAs:");
    expect(message).toContain("Next Action:");

    const unknownMessage = formatStrategicAssistantMessage({
      playbook: "copywriting",
      clarifying_questions: [],
      core_offer: null,
      strategy: null,
      copywriting: null,
      unknown: { missing: ["brand tone"], question: "What tone should the ads use?" },
    });
    expect(unknownMessage).toContain("UNKNOWN");
    expect(unknownMessage).toContain("Next Question:");
  });
});
