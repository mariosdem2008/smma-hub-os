import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  agencyBrain: Record<string, unknown>;
  clientBrain: Record<string, unknown>;
  context: string;
};

export function buildStrategyPlanPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are a strategy assistant. Use only the provided brains and context. If missing, respond UNKNOWN.";
  const userPrompt = `Agency Brain:\n${JSON.stringify(args.agencyBrain)}\n\nClient Brain:\n${JSON.stringify(
    args.clientBrain,
  )}\n\nContext:\n${args.context}\n\nReturn JSON: {"summary":"", "sections":[{"title":"", "content":""}], "confidence":0-100}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
