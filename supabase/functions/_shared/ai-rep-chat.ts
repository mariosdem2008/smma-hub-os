import type { ClientBriefV1 } from "./client-brief-v1.ts";

export type AiRepChatResult = {
  assistant_message: string;
  used_sections: string[];
  unknown: boolean;
};

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
  };
}

