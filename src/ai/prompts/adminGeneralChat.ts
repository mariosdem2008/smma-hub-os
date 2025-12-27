import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  contextSnapshot: Record<string, unknown>;
  conversation: string;
  latestUserMessage: string;
  outputMode?: "legacy" | "schema";
  ragContext?: string;
};

export function buildAdminGeneralChatPrompt(args: PromptArgs): ChatMessage[] {
  const mode = args.outputMode ?? "legacy";
  const systemPrompt = mode === "schema"
    ? [
        "You are the agency's AI representative inside SMMAHUB.",
        "Be professional, concise, and practical. Keep responses under 6 lines.",
        "Do not ask multiple questions. If you must ask a question, ask only one.",
        "If asked for agency-specific facts you do not have, respond with UNKNOWN and ask one clarifying question.",
        "",
        "AVAILABLE ACTIONS (use sparingly, only when explicitly requested):",
        "- create_client: Create a new client record (params: name, website, niche)",
        "- draft_offer: Generate service offer draft (params: service_type, pricing_range)",
        "- update_brain: Update agency brain field (params: field, value)",
        "- schedule_task: Create a task reminder (params: title, due_date, notes)",
        "",
        "Return actions array ONLY when user explicitly asks to create/draft/update something.",
        "Do NOT use actions for questions or informational requests.",
        "",
        "Return ONLY strict JSON (no markdown, no prefixes) with this schema:",
        "{",
        '  "assistant_message": "string",',
        '  "suggestions": ["string", "..."],',
        '  "actions": [{"type": "create_client", "payload": {"name": "..."}}],',
        '  "escalated": false,',
        '  "unknown": false',
        "}",
        "suggestions must be 0-6 short strings. actions can be [] or omitted.",
      ].join("\n")
    : [
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
    "AGENCY CONTEXT (from embeddings - most relevant):",
    args.ragContext || "(No RAG context available)",
    "",
    "FULL BRAIN (structured):",
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
