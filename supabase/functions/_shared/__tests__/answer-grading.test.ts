import { describe, expect, it, vi } from "vitest";
import {
  applyAiRepChatGradingGate,
} from "../ai-rep-chat.ts";
import {
  composeGovernance,
  deterministicGradeAgainstGovernance,
  gradeAgainstGovernance,
} from "../answer-grading.ts";
import { TaskType } from "../../../../src/ai/taskTypes.ts";

describe("answer grading", () => {
  it("blocks banned claims case-insensitively without substring false positives", () => {
    const governance = composeGovernance({
      compliance: {
        banned_claims: ["guaranteed results"],
        forbidden_words: ["pro"],
      },
    });

    const banned = deterministicGradeAgainstGovernance({
      text: "This plan delivers GUARANTEED results in the first week.",
      governance,
      contentType: "caption",
    });
    expect(banned.accepted).toBe(false);
    expect(banned.hard_violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "banned_claim" })]),
    );

    const boundary = deterministicGradeAgainstGovernance({
      text: "This improves momentum with a specific weekly review cadence.",
      governance,
      contentType: "caption",
    });
    expect(boundary.hard_violations.some((issue) => issue.code === "forbidden_word")).toBe(false);

    const exactWord = deterministicGradeAgainstGovernance({
      text: "Use the pro package wording here.",
      governance,
      contentType: "caption",
    });
    expect(exactWord.hard_violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "forbidden_word" })]),
    );
  });

  it("detects missing required disclaimers only for matching content types", () => {
    const governance = {
      compliance: {
        required_disclaimers: [
          { text: "Results vary by account.", applies_to: ["ad"] },
        ],
      },
    };

    const missing = deterministicGradeAgainstGovernance({
      text: "Try the new offer this week.",
      governance,
      contentType: "ad",
    });
    expect(missing.accepted).toBe(false);
    expect(missing.hard_violations[0]?.code).toBe("missing_required_disclaimer");

    const present = deterministicGradeAgainstGovernance({
      text: "Try the new offer this week. Results vary by account.",
      governance,
      contentType: "ad",
    });
    expect(present.hard_violations).toEqual([]);

    const otherType = deterministicGradeAgainstGovernance({
      text: "Try the new offer this week.",
      governance,
      contentType: "internal_note",
    });
    expect(otherType.hard_violations).toEqual([]);
  });

  it("flags restricted topics and generic shallow output without requiring a model", async () => {
    const governance = {
      compliance: {
        restricted_topics: ["medical claims"],
      },
    };

    const restricted = await gradeAgainstGovernance({
      text: "This draft leans into medical claims for the campaign.",
      governance,
      contentType: "caption",
      runLlmJudge: true,
    });
    expect(restricted.accepted).toBe(false);
    expect(restricted.hard_violations[0]?.code).toBe("restricted_topic");

    const generic = await gradeAgainstGovernance({
      text: "Boost your business and drive results.",
      governance,
      contentType: "caption",
      runLlmJudge: false,
    });
    expect(generic.soft_issues.map((issue) => issue.code)).toContain("weak_generic");
  });

  it("composes governance in compliance, client, agency, offer, channel, workflow order", () => {
    const governance = composeGovernance({
      agency: { banned_claims: ["world-class", "guaranteed results"] },
      client: { banned_claims: ["instant transformation", "guaranteed results"] },
      compliance: { banned_claims: ["guaranteed results"] },
    });

    expect(governance.sourceOrder).toEqual(["compliance", "client", "agency", "offer", "channel", "workflow"]);
    expect(governance.bannedClaims.map((rule) => rule.value)).toEqual([
      "guaranteed results",
      "instant transformation",
      "world-class",
    ]);
    expect(governance.bannedClaims[0]?.source).toBe("compliance");
  });

  it("uses the ANSWER_QUALITY_CHECK router task for the LLM judge when injected", async () => {
    const aiRunner = vi.fn(async () => ({
      text: "{\"score\":92,\"soft_issues\":[],\"requires_human_approval\":false}",
      output: { score: 92, soft_issues: [], requires_human_approval: false },
      schemaOk: true,
      unknown: false,
    }));

    const result = await gradeAgainstGovernance({
      text: "According to [doc 1], the best next step is to test two proof-led hooks against the approved core offer.",
      governance: { agency: { quality_bar: ["Specific, evidence-led, no hype."] } },
      contentType: "client_chat_reply",
      runLlmJudge: true,
      aiRunner,
      context: { agencyId: "agency-1", clientId: "client-1", userId: "user-1" },
    });

    expect(aiRunner).toHaveBeenCalledWith(expect.objectContaining({ taskType: TaskType.ANSWER_QUALITY_CHECK }));
    expect(result.accepted).toBe(true);
    expect(result.score).toBe(92);
  });

  it("rep-chat gate blocks hard violations while preserving response shape", () => {
    const gated = applyAiRepChatGradingGate({
      assistantMessage: "Raw answer with guaranteed results.",
      suggestions: [{ id: "x", label: "Next", user_message: "Next" }],
      unknown: false,
      grading: {
        accepted: false,
        score: 20,
        hard_violations: [{ code: "banned_claim", message: "Banned claim", evidence: "guaranteed results" }],
        soft_issues: [],
        requires_human_approval: true,
      },
    });

    expect(gated.blocked).toBe(true);
    expect(gated.assistantMessage).not.toContain("guaranteed results");
    expect(gated.suggestions.length).toBeGreaterThan(0);
    expect(gated.unknown).toBe(true);
  });
});
