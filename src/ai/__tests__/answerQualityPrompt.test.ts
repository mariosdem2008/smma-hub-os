import { describe, expect, it } from "vitest";
import { buildAnswerQualityPrompt } from "../prompts/answerQuality.ts";
import { getTaskConfig } from "../taskRegistry.ts";
import { TaskType } from "../taskTypes.ts";

describe("answer quality prompt", () => {
  it("builds a strict JSON grader prompt with governance and candidate text", () => {
    const messages = buildAnswerQualityPrompt({
      candidateText: "Draft answer for review.",
      contentType: "client_chat_reply",
      surface: "ai-rep-chat",
      governanceSummary: {
        banned_claims: [{ text: "guaranteed results", source: "compliance" }],
        tone_rules: ["calm, specific, evidence-led"],
      },
      clientContext: "Client sells local renovation services.",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Return JSON only");
    expect(messages[0].content).toContain("soft quality only");
    expect(messages[1].content).toContain("Content type: client_chat_reply");
    expect(messages[1].content).toContain("guaranteed results");
    expect(messages[1].content).toContain("CANDIDATE TEXT:");
    expect(messages[1].content).toContain("Draft answer for review.");
  });

  it("registers ANSWER_QUALITY_CHECK with the strict schema", () => {
    const config = getTaskConfig(TaskType.ANSWER_QUALITY_CHECK);
    expect(config.outputMode).toBe("json_schema");
    if (config.outputMode !== "json_schema") throw new Error("expected json schema task");
    const valid = config.schema.validate({
      score: 88,
      soft_issues: [{ code: "too_vague", message: "Add specifics.", severity: "medium" }],
      requires_human_approval: false,
      suggested_revision: "Use a more specific proof point.",
    });
    expect(valid.ok).toBe(true);
  });
});
