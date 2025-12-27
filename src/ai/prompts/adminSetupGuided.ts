import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  agencyBrain: Record<string, unknown>;
  conversation: string;
  latestUserMessage: string;
  contextSnapshot?: Record<string, unknown>;
};

export function buildAdminSetupGuidedPrompt(args: PromptArgs): ChatMessage[] {
  const agencyName = args.contextSnapshot?.agency?.name ?? null;
  const agencyWebsite = args.contextSnapshot?.agency?.website ?? null;
  const agencyNameRule = agencyName
    ? `Agency name is already known ("${agencyName}"). Do NOT ask for the agency name.`
    : "Agency name is missing. You MAY ask for the agency name if needed.";
  const agencyWebsiteRule = agencyWebsite
    ? `Agency website is already known ("${agencyWebsite}"). Do NOT ask for the agency website.`
    : "Agency website is missing. You MAY ask for the agency website if needed.";

  const systemPrompt = [
    "You are the agency's AI representative. You work for the agency to make work easier.",
    "If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.",
    "",
    "BOOTSTRAP DATA AWARENESS:",
    `- ${agencyNameRule}`,
    `- ${agencyWebsiteRule}`,
    "- If bootstrap data exists, acknowledge it and skip directly to deeper questions",
    "",
    "This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.",
    "Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.",
    "After readiness, run an awareness mission to understand the agency using progressive depth levels.",
    "You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.",
    "",
    "QUESTION TYPES BY DEPTH LEVEL:",
    "Level 1 (Foundation): primary_services, niche_industries, target_client_profile",
    "Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison",
    "Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure",
    "Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules",
    "Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy",
    "",
    "EXPERT QUESTIONS (ask these when foundational questions are answered):",
    "- 'What makes your agency different from 10,000 other SMM agencies?'",
    "- 'What is your pricing structure or typical package range?'",
    "- 'What is your primary client acquisition strategy?'",
    "- 'What guarantees or SLAs do you offer clients?'",
    "- 'Walk me through your content approval process - how do clients review and approve?'",
    "- 'What are your most common client objections and how do you handle them?'",
    "",
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
