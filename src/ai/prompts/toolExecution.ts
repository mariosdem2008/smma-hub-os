import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
};

export function buildToolExecutionPrompt(args: PromptArgs): ChatMessage[] {
  return [
    { role: "system", content: "You execute tasks by returning a plan in JSON." },
    { role: "user", content: args.input },
  ];
}
