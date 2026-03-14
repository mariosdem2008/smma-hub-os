import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  context: string;
};

export function buildStrategyDiagnosisPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are a senior SMMA strategy diagnosis agent. Diagnose the client's situation before recommending tactics. Use only the provided context. Be specific, practical, and non-generic. Return strict JSON only.";

  const schemaGuide = `Return STRICT JSON only with keys:
{
  "artifact_meta": {
    "artifact_type": "strategy_diagnosis",
    "version": number,
    "brief_version": number,
    "agency_module_versions": object
  },
  "summary": string,
  "body": {
    "current_state_summary": string,
    "business_objective_tree": [{ "objective": string, "drivers": string[] }],
    "offer_diagnosis": {
      "primary_offer_fit": string,
      "issues": string[],
      "notes": string[]
    },
    "funnel_diagnosis": {
      "current_path": string,
      "strengths": string[],
      "weaknesses": string[]
    },
    "audience_clarity": {
      "score_0_100": number,
      "strengths": string[],
      "gaps": string[]
    },
    "channel_fit": [{ "channel": string, "fit": string, "why": string }],
    "risk_summary": string[],
    "top_opportunities": string[]
  },
  "assumptions": string[],
  "open_questions": string[],
  "citations": object[],
  "confidence": number
}
Rules:
- This is diagnosis, not final recommendation.
- Do not invent metrics.
- Tie analysis to offer, audience, funnel, approval, and operations realities.
- Use empty arrays if unknown.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `${args.context}\n\n${schemaGuide}` },
  ];
}
