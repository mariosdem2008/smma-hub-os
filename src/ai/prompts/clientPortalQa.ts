import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  question: string;
  context: string;
};

export function buildClientPortalQaPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are an AI assistant. Answer strictly using the provided context. If context is insufficient, respond with UNKNOWN.";
  const userPrompt = `Question: ${args.question}\n\nContext:\n${args.context}\n\nReturn JSON: {"answer":"", "unknown": false, "questions": [], "confidence": 0-100}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
