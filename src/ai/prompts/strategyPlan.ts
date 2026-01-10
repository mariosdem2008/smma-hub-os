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
  )}\n\nContext:\n${args.context}${instruction}\n\nReturn STRICT JSON only with this shape:\n{\n  "modules": {\n    "positioning": { ...module schema... },\n    "pillars": { ...module schema... },\n    "campaign_plan": { ...module schema... },\n    "weekly_plan": { ...module schema... },\n    "channel_adaptations": { ...module schema... },\n    "rules_constraints": { ...module schema... }\n  },\n  "document": {\n    "markdown": "Full strategy document in markdown."\n  },\n  "decisions": [ { "module": "...", "decision_key": "...", "value": {}, "locked": false } ],\n  "tasks": [ { "module": "...", "title": "...", "description": "...", "priority": "medium" } ]\n}\n\nEach module MUST include fields:\n- facts_used: string[]\n- assumptions: string[]\n- open_questions: string[] (max 5)\n- confidence_0_100: number (0-100)\n\nEnsure decisions/tasks arrays are optional and may be omitted if none.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
