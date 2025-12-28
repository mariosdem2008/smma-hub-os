import { describe, it, expect } from "vitest";
import { validateStrategicOutput, type AdminChatStrategicOutput } from "../../ai/adminChatStrategic";

describe("admin chat strategic validator", () => {
  it("rejects multiple payloads", () => {
    const result = validateStrategicOutput({
      playbook: "core_offer",
      clarifying_questions: [],
      core_offer: {
        icp_primary: "Test",
        icp_secondary: ["A", "B"],
        pain_promise: "Promise",
        offer_mechanism: "Mechanism",
        tiers: [
          { name: "Starter", price_range: "$1", deliverables: ["a", "b", "c"], timeline_days: 10 },
          { name: "Growth", price_range: "$2", deliverables: ["a", "b", "c"], timeline_days: 10 },
          { name: "Scale", price_range: "$3", deliverables: ["a", "b", "c"], timeline_days: 10 },
        ],
        process_timeline: ["Step 1", "Step 2", "Step 3"],
        pricing_guidance: "Guide",
        risk_reversal: ["RR"],
        client_inputs: ["Input 1", "Input 2", "Input 3"],
        proof_options: ["Proof 1", "Proof 2"],
        proof_collection_7d: "Collect proof",
        next_action: "Next action",
      },
      strategy: { goal_metric: "bad" } as any,
    } as AdminChatStrategicOutput);
    expect(result.ok).toBe(false);
  });

  it("rejects too many clarifying questions", () => {
    const result = validateStrategicOutput({
      playbook: "strategy",
      clarifying_questions: ["q1", "q2", "q3", "q4"],
      strategy: null,
    } as AdminChatStrategicOutput);
    expect(result.ok).toBe(false);
  });

  it("rejects wrong item counts", () => {
    const result = validateStrategicOutput({
      playbook: "copywriting",
      clarifying_questions: [],
      copywriting: {
        hooks: ["h1"],
        ad_scripts: ["s1", "s2", "s3"],
        ctas: ["cta1", "cta2", "cta3"],
        next_action: "Next",
      },
    } as AdminChatStrategicOutput);
    expect(result.ok).toBe(false);
  });
});
