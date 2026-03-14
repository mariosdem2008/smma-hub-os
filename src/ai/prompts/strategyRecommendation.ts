import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  context: string;
};

export function buildStrategyRecommendationPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are a senior SMMA strategy architect agent. Make strategic choices from the provided diagnosis and context. Be concrete, commercially realistic, and aligned to agency playbooks. Return strict JSON only.";

  const schemaGuide = `Return STRICT JSON only with keys:
{
  "artifact_meta": {
    "artifact_type": "strategy_recommendation",
    "version": number,
    "brief_version": number,
    "agency_module_versions": object
  },
  "summary": string,
  "body": {
    "strategic_direction": string,
    "chosen_offer_priority": {
      "primary_offer": string,
      "why": string
    },
    "chosen_funnel": {
      "path": string,
      "why": string
    },
    "channel_priorities": [{ "channel": string, "priority": number, "role": string }],
    "pillar_recommendations": [{ "name": string, "purpose": string }],
    "messaging_direction": {
      "core_message": string,
      "dos": string[],
      "donts": string[]
    },
    "risks_and_tradeoffs": string[],
    "decision_rationale": [{ "decision": string, "why": string }]
  },
  "assumptions": string[],
  "open_questions": string[],
  "citations": object[],
  "confidence": number
}
Rules:
- Recommendation must follow the diagnosis, not contradict it.
- Channel choices must be justified.
- Do not prescribe unsupported guarantees or illegal/compliance-breaking claims.
- If information is missing, note caveats explicitly.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: `${args.context}\n\n${schemaGuide}` },
  ];
}
