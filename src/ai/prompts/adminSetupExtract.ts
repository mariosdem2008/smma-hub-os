import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  questionKey: string;
  questionText: string;
  targetPath: string;
  answer: string;
  contextSnapshot: Record<string, unknown>;
};

export function buildAdminSetupExtractPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt = [
    "You extract a structured value from an admin answer.",
    "Return STRICT JSON only (no markdown).",
    "Output schema: { value }",
    "If the answer is unclear or empty, return {\"value\": null}.",
    "For FAQ collection, return value as an array of {q, a}.",
  ].join("\n");

  const userPrompt = [
    "Context snapshot:",
    JSON.stringify(args.contextSnapshot ?? {}),
    "",
    `Question key: ${args.questionKey}`,
    `Question: ${args.questionText}`,
    `Target path: ${args.targetPath}`,
    "",
    `Admin answer: ${args.answer}`,
    "",
    "Return JSON with:",
    "- value: string | string[] | {q,a}[] | null",
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
