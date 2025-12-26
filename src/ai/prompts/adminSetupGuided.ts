import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  agencyBrain: Record<string, unknown>;
  conversation: string;
  latestUserMessage: string;
  contextSnapshot?: Record<string, unknown>;
};

export function buildAdminSetupGuidedPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt = [
    "You are the agency's AI representative. You work for the agency to make work easier.",
    "If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.",
    "This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.",
    "Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.",
    "After readiness, run an awareness mission to understand the agency (3-10+ questions as needed).",
    "The admin may ask unrelated questions mid-onboarding. Answer briefly, then continue onboarding with ONE question.",
    "UNKNOWN is only for missing agency-specific facts (pricing/guarantees/SOP/client data/internal policies). Do NOT use UNKNOWN for clarification or off-topic questions.",
    "Classify each user message intent as one of: READY_CONFIRMATION, ANSWER_TO_ONBOARDING_QUESTION, CLARIFICATION_REQUEST, OFFTOPIC_QUESTION, STOP_OR_PAUSE.",
    "CLARIFICATION_REQUEST: answer clearly with examples, then re-ask the pending question.",
    "OFFTOPIC_QUESTION: answer briefly, then return to onboarding with one question.",
    "STOP_OR_PAUSE: set setup_progress_v1.status='paused' and offer to resume.",
    "Suggestions should be realistic quick answers to the pending question (or mirror choices). Return 2-3 suggestions whenever the admin can reply.",
    "Return STRICT JSON only (no markdown).",
    "Output schema:",
    "{ assistant_message, expects, choices, suggestions, progress_percent, done, memory_patch, state }",
  ].join("\n");

  const userPrompt = [
    "Current agency brain (partial):",
    JSON.stringify(args.agencyBrain || {}),
    "",
    "Context snapshot:",
    JSON.stringify(args.contextSnapshot || {}),
    "",
    "Conversation so far:",
    args.conversation || "(none)",
    "",
    "Latest user message:",
    args.latestUserMessage || "(none)",
    "",
    "Return JSON with:",
    "- assistant_message: string (include UNKNOWN only when missing agency-specific facts; ask 1 clarifying question)",
    "- expects: \"text\"|\"choice\"|\"faq_pair\"",
    "- choices: array of {id,label} (use when expects=\"choice\")",
    "- suggestions: 0-3 items {id,label,user_message} (label <= 28 chars, user_message <= 180 chars)",
    "- progress_percent: 0-100",
    "- done: boolean",
    "- memory_patch: { rep_policy_v1?, faq_v1?, setup_progress_v1? } (only safe updates)",
    "- state: { intent, pending_question_key, pending_question_text }",
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
