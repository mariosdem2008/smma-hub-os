import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  context: unknown;
};

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function parseContext(value: unknown) {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value);
  } catch {
    return { raw_context: value };
  }
}

export function buildReportInsightPrompt(args: PromptArgs): ChatMessage[] {
  const context = parseContext(args.context);

  return [
    {
      role: "system",
      content: [
        "You are SMMAHUB's local monthly reporting insight agent for a social media agency.",
        "The report is client-facing. Write like an expert account manager: specific, calm, grounded, and operational.",
        "Return JSON only. No markdown, no prose before or after the JSON.",
        "",
        "Required JSON shape:",
        JSON.stringify({
          headline: "one-line performance story",
          performance_summary: "short client-facing summary grounded in KPIs",
          insights: [{ point: "specific insight", evidence: "copy one real KPI evidence phrase exactly" }],
          recommendations: [{ action: "specific next action", why: "tie to strategy, blockers, and/or KPIs", owner: "agency" }],
          risks_or_blockers: ["client-safe risk or blocker statement"],
        }),
        "",
        "Grounding rules:",
        "- Use only the metrics and context in the user message.",
        "- Every insights[].evidence value must copy at least one phrase from kpi_evidence_phrases exactly.",
        "- Do not invent metrics, dates, baselines, revenue, ad spend, attribution, client facts, or results.",
        "- If a metric is zero or missing, say that plainly instead of filling the gap.",
        "- Recommendations must connect to the approved strategy direction, the current blocker state, or a real KPI evidence phrase.",
        "- owner must be agency or client. Use client only when the blocker or next action clearly depends on the client.",
        "",
        "Governance rules:",
        "- Respect the supplied tone rules and quality bar.",
        "- Never use banned claims, restricted topics, or forbidden words.",
        "- Include required disclaimers when they apply to monthly reports.",
        "- Avoid hype and performance promises. No guarantees.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "REPORT INSIGHT CONTEXT:",
        compactJson(context),
      ].join("\n"),
    },
  ];
}
