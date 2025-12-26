import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
  instructions?: string;
};

export function buildExtractStructuredPrompt(args: PromptArgs): ChatMessage[] {
  const instructions = args.instructions ? `\n\n${args.instructions}` : "";
  return [
    { role: "system", content: "Return only valid JSON. Do not include markdown." },
    { role: "user", content: `${args.input}${instructions}` },
  ];
}
