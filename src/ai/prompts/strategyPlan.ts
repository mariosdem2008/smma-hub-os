import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  agencyBrain: Record<string, unknown>;
  clientBrain: Record<string, unknown>;
  context: string;
  instruction?: string;
};

export function buildStrategyPlanPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are a strategy assistant. Use only the provided brains and context. If missing, respond UNKNOWN.";
  const instruction = args.instruction?.trim()
    ? `\n\nInstruction:\n${args.instruction.trim()}`
    : "";
  const userPrompt = `Agency Brain:\n${JSON.stringify(args.agencyBrain)}\n\nClient Brain:\n${JSON.stringify(
    args.clientBrain,
  )}\n\nContext:\n${args.context}${instruction}\n\nReturn JSON with sections for the following headings in order: Executive summary; Business context; ICP + objections + triggers; Positioning + proof; Pillars; Channel strategy; Campaign plan; Weekly plan; Creative rules + claims policy; KPIs; Action checklist. Format: {"summary":"", "sections":[{"title":"", "content":""}], "confidence":0-100}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
