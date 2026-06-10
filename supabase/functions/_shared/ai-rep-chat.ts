import type { ClientBriefV1 } from "./client-brief-v1.ts";
import type { ChatMessage } from "../../../src/ai/providers/types.ts";
import type { GradingResult } from "./answer-grading.ts";

export type AiRepChatResult = {
  assistant_message: string;
  suggestions: Array<{ id: string; label: string; user_message: string }>;
  used_sections: string[];
  unknown: boolean;
};

export type AiRepChatTurn = { role: "user" | "assistant"; content: string };

export const AI_REP_SUGGESTIONS_MARKER = "SUGGESTIONS:";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 600;

function formatBriefList(values: unknown): string {
  const items = (Array.isArray(values) ? values : [])
    .map((value) => String(value).trim())
    .filter(Boolean);
  return items.length > 0 ? items.join("; ") : "(not provided)";
}

export function buildAiRepSystemPrompt(opts: {
  brief: ClientBriefV1;
  retrievedSnippets?: string[];
}): string {
  const { brief } = opts;
  const snippets = (opts.retrievedSnippets ?? []).map((snippet) => snippet.trim()).filter(Boolean);
  const docsBlock = snippets.length > 0
    ? snippets.map((snippet, idx) => `[doc ${idx + 1}] ${snippet}`).join("\n\n")
    : "(no documents retrieved for this question)";

  return [
    "You are the AI account representative for one specific client of a social media marketing agency.",
    "You support the account team operationally: concrete next actions, content angles grounded in the pillars, and interpretation of performance the user shares. You are not a generic assistant.",
    "",
    "CLIENT CONTEXT (client_brief_v1 — the only source of truth about this client):",
    `- Positioning: ${brief.positioning?.trim() || "(not provided)"}`,
    `- Core offer: ${brief.offers?.core?.trim() || "(not provided)"}`,
    `- Supporting offers: ${formatBriefList(brief.offers?.supporting)}`,
    `- Primary audience: ${brief.audience?.primary?.trim() || "(not provided)"}`,
    `- Audience pains: ${formatBriefList(brief.audience?.pains)}`,
    `- Audience desires: ${formatBriefList(brief.audience?.desires)}`,
    `- Content pillars: ${formatBriefList(brief.pillars)}`,
    `- Tone rules (do): ${formatBriefList(brief.tone_rules?.do)}`,
    `- Tone rules (don't): ${formatBriefList(brief.tone_rules?.dont)}`,
    `- CTA styles: ${formatBriefList(brief.cta_styles)}`,
    `- Taboo topics (never write about or recommend these): ${formatBriefList(brief.taboo_topics)}`,
    "",
    "RETRIEVED CONTEXT (approved client documents; reference them as [doc N] when you rely on them):",
    docsBlock,
    "",
    "RULES:",
    "1. Answer only from the client context and retrieved documents above. Never invent client facts, metrics, results, or history.",
    "2. If the question needs context you do not have, say so explicitly and ask one focused follow-up question instead of guessing.",
    "3. Respect the taboo topics and tone rules in every answer. Only suggest CTAs drawn from the listed CTA styles.",
    "4. Keep answers operational and specific to this client: next actions, content angles, or performance interpretation.",
    "5. Keep replies under roughly 250 words, formatted for a busy account manager.",
    "",
    `After the answer, finish with one final line in exactly this format (2-4 short follow-up messages the user could send next, separated by " | "):`,
    `${AI_REP_SUGGESTIONS_MARKER} <follow-up 1> | <follow-up 2> | <follow-up 3>`,
  ].join("\n");
}

export function buildAiRepChatMessages(opts: {
  brief: ClientBriefV1;
  message: string;
  retrievedSnippets?: string[];
  history?: AiRepChatTurn[];
}): ChatMessage[] {
  const historyMessages: ChatMessage[] = (opts.history ?? [])
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && String(turn.content ?? "").trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((turn) => ({ role: turn.role, content: String(turn.content).slice(0, MAX_HISTORY_CHARS) }));

  return [
    { role: "system", content: buildAiRepSystemPrompt({ brief: opts.brief, retrievedSnippets: opts.retrievedSnippets }) },
    ...historyMessages,
    { role: "user", content: opts.message },
  ];
}

export function parseAiRepLlmReply(text: string): {
  assistant_message: string;
  suggestions: AiRepChatResult["suggestions"];
} {
  const trimmed = text.trim();
  const markerIdx = trimmed.toUpperCase().lastIndexOf(AI_REP_SUGGESTIONS_MARKER);
  if (markerIdx === -1) {
    return { assistant_message: trimmed, suggestions: [] };
  }

  const assistantMessage = trimmed.slice(0, markerIdx).trim();
  const suggestions = trimmed
    .slice(markerIdx + AI_REP_SUGGESTIONS_MARKER.length)
    .trim()
    .split("|")
    .map((item) => item.trim().replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((item, idx) => ({
      id: `followup-${idx + 1}`,
      label: item.length > 60 ? `${item.slice(0, 57)}...` : item,
      user_message: item,
    }));

  return {
    assistant_message: assistantMessage.length > 0 ? assistantMessage : trimmed,
    suggestions,
  };
}

export function applyAiRepChatGradingGate(args: {
  assistantMessage: string;
  suggestions: AiRepChatResult["suggestions"];
  unknown: boolean;
  grading: GradingResult;
}): {
  assistantMessage: string;
  suggestions: AiRepChatResult["suggestions"];
  unknown: boolean;
  blocked: boolean;
  fallbackReason: string | null;
} {
  if (args.grading.hard_violations.length === 0) {
    return {
      assistantMessage: args.assistantMessage,
      suggestions: args.suggestions,
      unknown: args.unknown,
      blocked: false,
      fallbackReason: null,
    };
  }

  const fallback =
    "I need a safer, evidence-backed version before I can answer that. Please share the approved proof point or claim we can use.";

  return {
    assistantMessage: fallback,
    suggestions: [
      {
        id: "provide-proof",
        label: "Add proof point",
        user_message: "Use this approved proof point: ",
      },
      {
        id: "revise-safely",
        label: "Revise safely",
        user_message: "Rewrite this without unsupported or restricted claims.",
      },
    ],
    unknown: true,
    blocked: true,
    fallbackReason: args.grading.hard_violations.map((issue) => issue.code).join(",") || "hard_violation",
  };
}

function missingBriefField(brief: ClientBriefV1 | null): { missing: string; question: string } | null {
  if (!brief) {
    return {
      missing: "client_brief_v1",
      question: "What product/service should we focus on for this client?",
    };
  }
  if (!brief.offers?.core || brief.offers.core.trim().length === 0) {
    return {
      missing: "client_brief_v1.offers.core",
      question: "What is the single core offer we should sell (1 short line)?",
    };
  }
  if (!brief.audience?.primary || brief.audience.primary.trim().length === 0) {
    return {
      missing: "client_brief_v1.audience.primary",
      question: "Who is the primary audience segment we should target (1 short line)?",
    };
  }
  if (!Array.isArray(brief.pillars) || brief.pillars.length < 3) {
    return {
      missing: "client_brief_v1.pillars",
      question: "List 3-6 content pillars for this client (comma or newline separated).",
    };
  }
  return null;
}

export function decideAiRepResponse(opts: {
  brief: ClientBriefV1 | null;
  message: string;
  retrievedSnippets?: string[];
}): AiRepChatResult {
  const used_sections: string[] = [];
  if (opts.brief) used_sections.push("client_brief_v1");
  if (opts.retrievedSnippets && opts.retrievedSnippets.length > 0) used_sections.push("retrieved_context");

  const missing = missingBriefField(opts.brief);
  if (missing) {
    return {
      unknown: true,
      used_sections,
      assistant_message: `UNKNOWN\n\n${missing.question}`,
      suggestions: [
        { id: "core-offer", label: "Core offer", user_message: "Core offer: " },
        { id: "primary-audience", label: "Primary audience", user_message: "Primary audience: " },
      ],
    };
  }

  const brief = opts.brief as ClientBriefV1;
  const offer = brief.offers.core;
  const audience = brief.audience.primary;
  const pillars = brief.pillars.slice(0, 6).join(", ");

  return {
    unknown: false,
    used_sections,
    assistant_message:
      `Got it. For ${audience}, we’ll focus on ${offer}. ` +
      `Key pillars: ${pillars}. What would you like to do next?`,
    suggestions: [
      { id: "content-ideas", label: "Content ideas", user_message: "Generate 10 content ideas based on the pillars." },
      { id: "weekly-plan", label: "Weekly plan", user_message: "Draft a 7-day content plan for this client." },
      { id: "positioning", label: "Positioning recap", user_message: "Summarize the client's positioning in 3 bullets." },
    ],
  };
}
