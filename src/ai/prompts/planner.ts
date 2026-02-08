import type { ChatMessage } from "../providers/types.ts";

export function buildPlannerPrompt(opts: { input: string; intent?: string }): ChatMessage[] {
  const userInput = opts.input?.trim() ?? "";
  const intent = opts.intent?.trim();

  const system = [
    "You are a planner. Produce a JSON plan that uses tool calls.",
    "Return only JSON and match PlanSchema_v1.",
  ].join(" ");

  const user = intent
    ? `User intent: ${intent}\nUser request: ${userInput}`
    : `User request: ${userInput}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
