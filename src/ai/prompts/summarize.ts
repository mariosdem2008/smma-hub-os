import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
  systemPrompt?: string;
};

export function buildSummarizePrompt(args: PromptArgs): ChatMessage[] {
  return [
    { role: "system", content: args.systemPrompt ?? "You are a concise summarizer. Keep the same tone and be accurate." },
    { role: "user", content: args.input },
  ];
}
