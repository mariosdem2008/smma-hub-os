import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  contextSnapshot: Record<string, unknown>;
  conversation: string;
  latestUserMessage: string;
};

export function buildAdminGeneralChatPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt = [
    "You are the agency's AI representative inside SMMAHUB.",
    "Be professional, concise, and practical. Keep responses under 6 lines.",
    "Do not ask multiple questions. If you must ask a question, ask only one.",
    "If asked for agency-specific facts you do not have, respond with UNKNOWN and ask one clarifying question.",
    "Return plain text with the exact format:",
    "ASSISTANT_MESSAGE:",
    "<your response>",
    "",
    "SUGGESTIONS_JSON:",
    "[{\"id\":\"...\",\"label\":\"...\",\"user_message\":\"...\"}]",
    "Suggestions must be 0-3 items (label <= 28 chars, user_message <= 180 chars).",
  ].join("\n");

  const userPrompt = [
    "Context snapshot (trusted):",
    JSON.stringify(args.contextSnapshot ?? {}),
    "",
    "Conversation so far:",
    args.conversation || "(none)",
    "",
    "Latest user message:",
    args.latestUserMessage || "(none)",
    "",
    "Return using the exact format defined above.",
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
