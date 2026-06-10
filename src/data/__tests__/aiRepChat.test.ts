import { describe, it, expect } from "vitest";

import {
  buildAiRepChatMessages,
  buildAiRepSystemPrompt,
  decideAiRepResponse,
  parseAiRepLlmReply,
} from "../../../supabase/functions/_shared/ai-rep-chat";

const fullBrief = {
  positioning: "Acme offers onboarding for founders",
  offers: { core: "Onboarding", supporting: ["Consulting"] },
  audience: { primary: "Founders", pains: ["time"], desires: ["growth"] },
  pillars: ["Education", "Stories", "Proof"],
  tone_rules: { do: ["Be clear"], dont: ["No guarantees"] },
  cta_styles: ["Book a call"],
  taboo_topics: ["politics"],
};

describe("ai-rep-chat decision", () => {
  it("returns UNKNOWN when brief lacks core offer", () => {
    const brief = {
      positioning: "Acme offers services for founders",
      offers: { core: "", supporting: [] },
      audience: { primary: "Founders", pains: ["time"], desires: ["growth"] },
      pillars: ["A", "B", "C"],
      tone_rules: { do: ["Be clear"], dont: ["No guarantees"] },
      cta_styles: ["Book a call"],
      taboo_topics: ["none"],
    };

    const res = decideAiRepResponse({ brief: brief as any, message: "Help me" });
    expect(res.unknown).toBe(true);
    expect(res.assistant_message.startsWith("UNKNOWN")).toBe(true);
  });

  it("uses client_brief_v1 when present", () => {
    const brief = {
      positioning: "Acme offers onboarding for founders",
      offers: { core: "Onboarding", supporting: ["Consulting"] },
      audience: { primary: "Founders", pains: ["time"], desires: ["growth"] },
      pillars: ["Education", "Stories", "Proof"],
      tone_rules: { do: ["Be clear"], dont: ["No guarantees"] },
      cta_styles: ["Book a call"],
      taboo_topics: ["none"],
    };

    const res = decideAiRepResponse({ brief: brief as any, message: "What should we post?" });
    expect(res.unknown).toBe(false);
    expect(res.used_sections).toContain("client_brief_v1");
  });
});

describe("ai-rep-chat prompt building", () => {
  it("grounds the system prompt in brief fields and retrieved docs", () => {
    const prompt = buildAiRepSystemPrompt({
      brief: fullBrief as any,
      retrievedSnippets: ["Approved offer doc: Onboarding costs $500.", "Brand guide: avoid jargon."],
    });

    expect(prompt).toContain("Positioning: Acme offers onboarding for founders");
    expect(prompt).toContain("Core offer: Onboarding");
    expect(prompt).toContain("Primary audience: Founders");
    expect(prompt).toContain("Content pillars: Education; Stories; Proof");
    expect(prompt).toContain("Tone rules (do): Be clear");
    expect(prompt).toContain("Tone rules (don't): No guarantees");
    expect(prompt).toContain("CTA styles: Book a call");
    expect(prompt).toContain("Taboo topics (never write about or recommend these): politics");
    expect(prompt).toContain("[doc 1] Approved offer doc: Onboarding costs $500.");
    expect(prompt).toContain("[doc 2] Brand guide: avoid jargon.");
    expect(prompt).toContain("Never invent client facts");
    expect(prompt).toContain("SUGGESTIONS:");
  });

  it("notes when no documents were retrieved", () => {
    const prompt = buildAiRepSystemPrompt({ brief: fullBrief as any, retrievedSnippets: [] });
    expect(prompt).toContain("(no documents retrieved for this question)");
  });

  it("builds messages with system prompt first, history in order, and user message last", () => {
    const messages = buildAiRepChatMessages({
      brief: fullBrief as any,
      message: "What should we post next week?",
      retrievedSnippets: ["Doc snippet"],
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello, how can I help with this account?" },
      ],
    });

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("[doc 1] Doc snippet");
    expect(messages[1]).toEqual({ role: "user", content: "Hi" });
    expect(messages[2].role).toBe("assistant");
    expect(messages[3]).toEqual({ role: "user", content: "What should we post next week?" });
  });
});

describe("ai-rep-chat reply parsing", () => {
  it("splits the assistant message from the suggestions line", () => {
    const parsed = parseAiRepLlmReply(
      "Focus next week on the Education pillar.\n\nSUGGESTIONS: Draft 5 Reel hooks | Plan a proof post | Review last week's reach",
    );

    expect(parsed.assistant_message).toBe("Focus next week on the Education pillar.");
    expect(parsed.suggestions).toHaveLength(3);
    expect(parsed.suggestions[0]).toEqual({
      id: "followup-1",
      label: "Draft 5 Reel hooks",
      user_message: "Draft 5 Reel hooks",
    });
  });

  it("returns the full text with no suggestions when the marker is missing", () => {
    const parsed = parseAiRepLlmReply("Just an answer without a suggestions line.");
    expect(parsed.assistant_message).toBe("Just an answer without a suggestions line.");
    expect(parsed.suggestions).toEqual([]);
  });

  it("caps parsed suggestions at four", () => {
    const parsed = parseAiRepLlmReply("Answer.\nSUGGESTIONS: a | b | c | d | e");
    expect(parsed.suggestions).toHaveLength(4);
  });
});

