import type { ChatMessage } from "../providers/types.ts";
import { loadPromptText } from "../promptRegistry.ts";

type PromptArgs = {
  contextSnapshot: Record<string, unknown>;
  conversation: string;
  latestUserMessage: string;
  outputMode?: "legacy" | "schema" | "strategic";
  ragContext?: string;
  contextBlob?: Record<string, unknown>;
  playbook?: "core_offer" | "strategy" | "copywriting";
};

export function buildAdminGeneralChatPrompt(args: PromptArgs): ChatMessage[] {
  const mode = args.outputMode ?? "legacy";
  const isStrategic = mode === "strategic";
  const systemRegistry = isStrategic ? loadPromptText("admin_chat/system_v1.md") : "";
  const developerRegistry = isStrategic ? loadPromptText("admin_chat/developer_v1.md") : "";
  const contractsRegistry = isStrategic ? loadPromptText("admin_chat/output_contracts_v1.md") : "";
  const PLAYBOOK_FILES: Record<NonNullable<PromptArgs["playbook"]>, string> = {
    core_offer: "admin_chat/playbooks/offer_core_offer_v1.md",
    strategy: "admin_chat/playbooks/strategy_v1.md",
    copywriting: "admin_chat/playbooks/copywriting_v1.md",
  };
  const selectedPlaybook = args.playbook ?? "core_offer";
  const playbookRegistry = isStrategic ? loadPromptText(PLAYBOOK_FILES[selectedPlaybook]) : "";

  if (isStrategic) {
    const contextBlob = JSON.stringify(args.contextBlob ?? {}, null, 2);
    const playbook = selectedPlaybook;
    const systemPrompt = [systemRegistry, contractsRegistry, playbookRegistry].filter(Boolean).join("\n\n");
    const developerPrompt = developerRegistry;
    const userPrompt = [
      "context_blob:",
      contextBlob,
      "",
      "playbook:",
      playbook,
      "",
      "latest_user_message:",
      args.latestUserMessage || "(none)",
      "",
      "Return JSON only.",
    ].join("\n");

    return [
      { role: "system", content: systemPrompt },
      { role: "developer", content: developerPrompt },
      { role: "user", content: userPrompt },
    ];
  }
  const persona = (args.contextSnapshot?.persona as Record<string, unknown> | undefined) ?? {};
  const assistantName =
    typeof persona.assistant_name === "string" && persona.assistant_name.trim().length > 0
      ? persona.assistant_name.trim()
      : "Alex";
  const toneTraits = Array.isArray(persona.tone_traits)
    ? persona.tone_traits.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
  const expertiseTraits = Array.isArray(persona.expertise_traits)
    ? persona.expertise_traits.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];

  const systemPrompt = mode === "schema"
    ? [
        `You are ${assistantName}, the agency's AI representative inside SMMAHUB.`,
        "Be professional, concise, and practical. Keep responses under 6 lines.",
        toneTraits.length > 0 ? `Tone traits: ${toneTraits.join(", ")}.` : "Tone traits: clear, practical, professional.",
        expertiseTraits.length > 0
          ? `Expertise traits: ${expertiseTraits.join(", ")}.`
          : "Expertise traits: agency operations, strategy, and execution.",
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
      `You are ${assistantName}, the agency's AI representative inside SMMAHUB.`,
      "Be professional, concise, and practical. Keep responses under 6 lines.",
      toneTraits.length > 0 ? `Tone traits: ${toneTraits.join(", ")}.` : "Tone traits: clear, practical, professional.",
      expertiseTraits.length > 0
        ? `Expertise traits: ${expertiseTraits.join(", ")}.`
        : "Expertise traits: agency operations, strategy, and execution.",
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
