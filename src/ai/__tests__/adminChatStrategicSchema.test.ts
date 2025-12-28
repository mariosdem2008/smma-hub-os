import { describe, it, expect } from "vitest";
import { adminChatStrategicSchema } from "../schema.ts";

describe("admin chat strategic schema", () => {
  it("rejects invalid payloads", () => {
    const schema = adminChatStrategicSchema();
    const invalid = schema.validate({
      playbook: "core_offer",
      clarifying_questions: ["q1", "q2", "q3", "q4"],
      strategy: { goal_metric: "bad" },
      unknown: null,
    });
    expect(invalid.ok).toBe(false);
  });
});
