import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  candidateText: string;
  contentType: string;
  surface?: string;
  governanceSummary: unknown;
  clientContext?: string;
};

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function buildAnswerQualityPrompt(args: PromptArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are SMMAHUB's local governed-output grader.",
        "You are judging a draft that may become client-facing agency output.",
        "Compliance, banned claims, restricted topics, required disclaimers, and forbidden words are already checked deterministically by code. Do not override hard violations.",
        "Your job is to judge soft quality only: tone adherence, specificity vs generic filler, unsupported performance claims, and groundedness in the supplied agency/client context.",
        "Be strict. A senior agency operator should not find the answer shallow, generic, off-brand, or invented.",
        "Return JSON only. No markdown, no prose before or after the JSON.",
        "",
        "Required JSON shape:",
        JSON.stringify({
          score: 0,
          soft_issues: [
            {
              code: "weak_generic|off_tone|unsupported_claim|ungrounded|too_vague|other",
              message: "specific actionable issue",
              severity: "low|medium|high",
            },
          ],
          requires_human_approval: false,
          suggested_revision: "optional concrete revision that fixes the issues",
        }),
        "",
        "Scoring rubric:",
        "- 90-100: specific, grounded, on-tone, useful to an expert operator.",
        "- 75-89: usable but has minor clarity, tone, or specificity issues.",
        "- 60-74: weak or generic; should be revised before important client use.",
        "- 0-59: shallow, unsupported, off-tone, or likely to mislead; human approval required.",
        "",
        "Rules:",
        "- Penalize invented client facts, metrics, performance promises, timelines, or guarantees unless the provided context supports them.",
        "- Penalize broad filler such as 'boost your brand', 'drive results', or advice that could fit any client.",
        "- If context is thin, reward answers that clearly ask for missing specifics instead of guessing.",
        "- Keep soft_issues actionable and non-duplicative.",
        "- suggested_revision must not add new facts not present in the context.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Content type: ${args.contentType || "unknown"}`,
        `Surface: ${args.surface || "unknown"}`,
        "",
        "GOVERNANCE SUMMARY:",
        compactJson(args.governanceSummary),
        "",
        "CLIENT CONTEXT:",
        args.clientContext?.trim() || "(no client context supplied)",
        "",
        "CANDIDATE TEXT:",
        args.candidateText,
      ].join("\n"),
    },
  ];
}
