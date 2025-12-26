import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
};

export function buildChatGeneralPrompt(args: PromptArgs): ChatMessage[] {
  return [
    { role: "system", content: "You are an AI assistant helping an agency team." },
    { role: "user", content: args.input },
  ];
}
