import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
};

export function buildClassifyIntentPrompt(args: PromptArgs): ChatMessage[] {
  return [
    { role: "system", content: "Classify the user's intent into a short label. Return JSON: {\"intent\":\"\"}." },
    { role: "user", content: args.input },
  ];
}
