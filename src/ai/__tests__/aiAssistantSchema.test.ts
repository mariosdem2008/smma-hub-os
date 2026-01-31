import { describe, expect, it } from "vitest";
import { aiAssistantSchema } from "../schema";

describe("aiAssistantSchema", () => {
  it("accepts minimal valid payload", () => {
    const schema = aiAssistantSchema();
    const result = schema.validate({
      assistant_message: "Hello!",
      proposals: [],
      unknown: false,
      confidence: 80,
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a context_request", () => {
    const schema = aiAssistantSchema();
    const result = schema.validate({
      assistant_message: "Let me pull that up.",
      proposals: [],
      unknown: false,
      confidence: 50,
      context_request: {
        requests: [{ type: "brain_module", module: "sop_strategy", reason: "Need the playbook." }],
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown context_request type", () => {
    const schema = aiAssistantSchema();
    const result = schema.validate({
      assistant_message: "x",
      proposals: [],
      unknown: false,
      confidence: 50,
      context_request: { requests: [{ type: "nope" }] },
    });
    expect(result.ok).toBe(false);
  });
});

