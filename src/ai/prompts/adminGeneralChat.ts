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
        "",
        "CLIENT & SETUP:",
        "- create_client: Create client (params: name, website, niche)",
        "- draft_offer: Draft offer (params: service_type, pricing_range)",
        "- update_brain: Update agency brain (params: field, value)",
        "",
        "PROJECTS:",
        "- create_project: New project (params: title, client_id, description, platforms)",
        "- update_project_status: Change status (params: project_id, status)",
        "- assign_project_asset: Link asset (params: project_id, asset_id, is_final_content)",
        "",
        "SCHEDULING & TASKS:",
        "- schedule_task: Create task (params: title, due_date, notes, client_id)",
        "- schedule_post: Schedule to platform (params: project_id, platform, scheduled_for, caption, hashtags)",
        "- update_task_status: Update status (params: task_id, status)",
        "- update_task_priority: Update priority (params: task_id, priority)",
        "",
        "APPROVALS & COMMUNICATION:",
        "- request_approval: Create approval (params: asset_version_id, approver_id, comments)",
        "- send_message: Send message (params: conversation_id, body, related_project_id)",
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
