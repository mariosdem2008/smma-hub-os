import { runAiTask } from "./ai-router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import {
  SETUP_QUESTIONS,
  computeProgress,
  getFirstQuestion,
  getMissingKeys,
  getNextQuestion,
  getQuestionByKey,
} from "./agency-admin-setup-questions.ts";
import { buildAgencyContextSnapshot, buildAiContextSummary, fetchAgencyBrain, upsertAgencyBrain } from "./ai-context.ts";
import { runAdminGeneralChatAi } from "./agency-admin-general-ai.ts";

type MaybeSingleResult<T> = { data: T | null; error?: { message?: string } | null };

type InsertResult<T> = { data: T | null; error?: { message?: string } | null };

type MinimalSupabase = {
  from: (table: string) => any;
};

type SetupResponse = {
  thread_id: string;
  assistant_message: string;
  expects?: "choice" | "text" | "faq_pair";
  choices?: Array<{ id: string; label: string }>;
  suggestions?: Suggestion[];
  progress_percent?: number;
  done?: boolean;
  step_id?: string;
  state?: GuidedState;
};

type RepPolicy = {
  ai_name?: string;
  voice?: string;
  boundaries?: {
    can_do?: string[];
    cannot_do?: string[];
    escalation_rule?: string;
  };
  response_sla?: string;
  default_cta_style?: string[];
};

type SetupProgress = {
  status?: "not_started" | "in_progress" | "paused" | "completed";
  started_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  progress_percent?: number;
  missing_fields?: string[];
  current_step_key?: string | null;
  completed_keys?: string[];
};

type AgencyBrain = {
  rep_policy_v1?: RepPolicy | null;
  faq_v1?: Array<{ q: string; a: string; tags?: string[] }> | null;
  setup_progress_v1?: SetupProgress | null;
  setup_profile_v1?: Record<string, unknown> | null;
  ai_context_v1?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type GuidedOutput = {
  assistant_message: string;
  expects: "choice" | "text" | "faq_pair";
  choices: Array<{ id: string; label: string }>;
  suggestions?: Suggestion[];
  progress_percent: number;
  done: boolean;
  memory_patch: {
    rep_policy_v1?: RepPolicy;
    faq_v1?: Array<{ q: string; a: string; tags?: string[] }>;
    setup_progress_v1?: SetupProgress;
    setup_profile_v1?: Record<string, unknown>;
    ai_context_v1?: Record<string, unknown>;
  };
  state: GuidedState;
};

type GuidedIntent =
  | "READY_CONFIRMATION"
  | "ANSWER_TO_ONBOARDING_QUESTION"
  | "CLARIFICATION_REQUEST"
  | "OFFTOPIC_QUESTION"
  | "STOP_OR_PAUSE";

type GuidedState = {
  intent: GuidedIntent;
  pending_question_key: string | null;
  pending_question_text: string | null;
};

type Suggestion = {
  id: string;
  label: string;
  user_message: string;
};

const GUIDED_INTENTS: GuidedIntent[] = [
  "READY_CONFIRMATION",
  "ANSWER_TO_ONBOARDING_QUESTION",
  "CLARIFICATION_REQUEST",
  "OFFTOPIC_QUESTION",
  "STOP_OR_PAUSE",
];

export function nowIso() {
  return new Date().toISOString();
}

function logSetupEvent(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...payload }));
}

function jsonResponse(body: SetupResponse | { error: string }, status = 200): { status: number; body: SetupResponse | { error: string } } {
  return { status, body };
}

function normalizeForIntent(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

const READY_PHRASES = new Set([
  "ready",
  "im ready",
  "i am ready",
  "yes",
  "yeah",
  "yep",
  "ok",
  "okay",
  "sure",
  "yes sure",
  "lets go",
  "start",
  "resume",
  "continue",
]);

export function isReadyConfirmation(message: string) {
  const normalized = normalizeForIntent(message);
  return READY_PHRASES.has(normalized);
}

export function classifySetupIntent(opts: { message: string; pendingQuestionKey?: string | null }) {
  const normalized = normalizeForIntent(opts.message);
  if (normalized.includes("stop") || normalized.includes("pause")) return "STOP_OR_PAUSE" as const;
  if (isReadyConfirmation(normalized)) return "READY_CONFIRMATION" as const;
  if (
    normalized.includes("what do you mean") ||
    normalized.includes("meaning") ||
    normalized.includes("example") ||
    normalized.includes("examples") ||
    normalized.startsWith("what is")
  ) {
    return "CLARIFICATION_REQUEST" as const;
  }
  if (opts.pendingQuestionKey) return "ANSWER_TO_ONBOARDING_QUESTION" as const;
  return "OFFTOPIC_QUESTION" as const;
}

function isAgencySpecificFactQuestion(message: string) {
  const normalized = normalizeForIntent(message);
  const hits = ["pricing", "price", "rates", "rate", "guarantee", "guarantees", "sop", "process", "contract", "client data", "client list"].some(
    (k) => normalized.includes(k),
  );
  if (!hits) return false;

  const looksLikeQuestion =
    normalized.startsWith("what ") ||
    normalized.startsWith("whats ") ||
    normalized.startsWith("how ") ||
    normalized.startsWith("do ") ||
    normalized.startsWith("can ") ||
    normalized.startsWith("could ") ||
    normalized.startsWith("tell me ") ||
    normalized.includes("how much") ||
    normalized.includes("how many");

  return looksLikeQuestion;
}

function sanitizeAssistantMessage(message: string) {
  const indices = Array.from(message.matchAll(/\?/g))
    .map((m) => m.index ?? -1)
    .filter((n) => n >= 0);
  if (indices.length <= 1) return message;
  const first = indices[0]!;
  const before = message.slice(0, first + 1);
  const after = message.slice(first + 1).replace(/\?/g, "");
  return `${before}${after}`;
}

function buildSuggestionsForPendingQuestion(pendingKey: string | null, pendingText: string | null): Suggestion[] {
  const key = (pendingKey ?? "").toLowerCase();
  const text = (pendingText ?? "").toLowerCase();
  const byKey = getQuestionByKey(pendingKey);
  const byText = SETUP_QUESTIONS.find((q) => q.question_text.toLowerCase() === (pendingText ?? "").toLowerCase());
  const match = byKey ?? byText;
  if (match?.suggestions?.length) {
    return match.suggestions;
  }
  const isOffers = key.includes("offer") || key.includes("service") || text.includes("offer") || text.includes("service");
  if (isOffers) {
    return [
      { id: "smm", label: "SMM (Monthly)", user_message: "We offer social media management (monthly retainer)." },
      { id: "content", label: "Content creation", user_message: "We offer content creation (Reels + Posts + Stories)." },
      { id: "ads", label: "Paid ads (Meta)", user_message: "We offer paid ads management (Meta/Instagram)." },
    ];
  }
  return [
    { id: "short", label: "Quick answer", user_message: "Short answer: " },
    { id: "detailed", label: "Detailed answer", user_message: "Detailed answer: " },
  ];
}

export function buildClarificationForOffers(opts: {
  pending_question_key: string | null;
  pending_question_text: string | null;
}): GuidedOutput {
  const pendingText = opts.pending_question_text ?? "Which 3-6 offers/services do you provide today?";
  const assistant_message = sanitizeAssistantMessage(
    [
      'By "offer", I mean the specific service package you sell to clients (what they pay for and what you deliver).',
      "Examples for SMMA-style agencies:",
      "- Social media management (monthly retainer)",
      "- Content creation (Reels + Posts + Stories)",
      "- Paid ads management (Meta / Google)",
      "- Lead generation (DM / funnel + booking)",
      "- UGC sourcing + editing",
      "- Email/SMS marketing",
      "- Website/landing page optimization",
      "- Influencer outreach",
      "",
      pendingText.endsWith("?") ? pendingText : `${pendingText}?`,
    ].join("\n"),
  );

  return {
    assistant_message,
    expects: "text",
    choices: [],
    suggestions: buildSuggestionsForPendingQuestion(opts.pending_question_key, pendingText),
    progress_percent: 10,
    done: false,
    memory_patch: {},
    state: {
      intent: "CLARIFICATION_REQUEST",
      pending_question_key: opts.pending_question_key,
      pending_question_text: pendingText,
    },
  };
}

export function buildUnknownAgencyFactsResponse(opts?: { pending: GuidedState | null }): GuidedOutput {
  const assistant_message = sanitizeAssistantMessage(
    "UNKNOWN. I can't assume agency-specific facts like pricing or guarantees. Do you want to define that now (a range or package names)?",
  );
  return {
    assistant_message,
    expects: "text",
    choices: [],
    suggestions: [
      { id: "skip", label: "Skip for now", user_message: "Skip pricing for now." },
      { id: "range", label: "Add range", user_message: "Pricing range: " },
      { id: "packages", label: "Add packages", user_message: "Packages: " },
    ],
    progress_percent: 0,
    done: false,
    memory_patch: {},
    state: {
      intent: "OFFTOPIC_QUESTION",
      pending_question_key: opts?.pending?.pending_question_key ?? null,
      pending_question_text: opts?.pending?.pending_question_text ?? null,
    },
  };
}

async function insertAssistantMessage(
  supabase: MinimalSupabase,
  threadId: string,
  assistant_message: string,
  meta_json: Record<string, unknown>,
) {
  const res: InsertResult<{ id: string }> = await supabase
    .from("agency_ai_chat_messages")
    .insert({
      thread_id: threadId,
      role: "assistant",
      content: assistant_message,
      meta_json,
    })
    .select("id")
    .single();

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to store assistant message");
  }
}

async function insertUserMessage(supabase: MinimalSupabase, threadId: string, message: string) {
  const res: InsertResult<{ id: string }> = await supabase
    .from("agency_ai_chat_messages")
    .insert({
      thread_id: threadId,
      role: "user",
      content: message,
      meta_json: {},
    })
    .select("id")
    .single();

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to store user message");
  }
}

async function fetchThreadMessages(supabase: MinimalSupabase, threadId: string, limit = 16) {
  const res: MaybeSingleResult<Array<{ role: string; content: string; created_at: string }>> = await supabase
    .from("agency_ai_chat_messages")
    .select("role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to load chat messages");
  }
  return res?.data ?? [];
}

export function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>) {
  const output = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const existing = (output[key] ?? {}) as Record<string, unknown>;
      output[key] = deepMerge(existing, value as Record<string, unknown>);
    } else {
      output[key] = value as unknown;
    }
  }
  return output;
}

function setValueByPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return target;
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return target;
}

function getValueByPath(target: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let cursor: any = target;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function hasMeaningfulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.filter((v) => String(v ?? "").trim().length > 0).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function extractAnsweredKeys(brain: AgencyBrain) {
  const answered = new Set<string>();
  for (const q of SETUP_QUESTIONS) {
    if (q.target_path === "faq_v1") {
      if (Array.isArray(brain.faq_v1) && brain.faq_v1.length > 0) answered.add(q.key);
      continue;
    }
    const value = getValueByPath(brain as Record<string, unknown>, q.target_path);
    if (hasMeaningfulValue(value)) answered.add(q.key);
  }
  return answered;
}

function parseListAnswer(message: string) {
  return message
    .split(/\n|,|;|\u2022|-/g)
    .map((item) => item.replace(/^[-\u2022\s]+/, "").trim())
    .filter((item) => item.length > 0);
}

function parseFaqPairs(message: string) {
  const pairs: Array<{ q: string; a: string }> = [];
  const lines = message.split("\n").map((line) => line.trim()).filter(Boolean);
  let currentQ: string | null = null;
  for (const line of lines) {
    const qMatch = line.match(/^q[:-]\s*(.+)$/i);
    const aMatch = line.match(/^a[:-]\s*(.+)$/i);
    if (qMatch) {
      currentQ = qMatch[1].trim();
      continue;
    }
    if (aMatch && currentQ) {
      pairs.push({ q: currentQ, a: aMatch[1].trim() });
      currentQ = null;
      continue;
    }
  }
  if (pairs.length > 0) return pairs;

  const inline = message.split(/\n+/g).map((line) => line.trim()).filter(Boolean);
  for (const line of inline) {
    const parts = line.split(" - ");
    if (parts.length >= 2) {
      pairs.push({ q: parts[0].trim(), a: parts.slice(1).join(" - ").trim() });
    }
  }
  return pairs;
}

function buildMemoryPatchForAnswer(targetPath: string, answer: unknown) {
  if (targetPath === "faq_v1") {
    const pairs = Array.isArray(answer) ? answer : parseFaqPairs(String(answer ?? ""));
    return { faq_v1: pairs };
  }

  const normalizedValue = Array.isArray(answer)
    ? answer
    : targetPath.includes("primary_services") ||
        targetPath.includes("niche_industries") ||
        targetPath.includes("deliverables_standard") ||
        targetPath.includes("workflow_stages") ||
        targetPath.includes("voice_adjectives")
      ? parseListAnswer(String(answer ?? ""))
      : String(answer ?? "").trim();

  const patch: Record<string, unknown> = {};
  setValueByPath(patch, targetPath, normalizedValue);
  return { setup_profile_v1: patch };
}

export function applyMemoryPatch(existing: AgencyBrain, patch: GuidedOutput["memory_patch"] & { setup_profile_v1?: Record<string, unknown>; ai_context_v1?: Record<string, unknown> }, now = nowIso()) {
  const next: AgencyBrain = { ...existing };
  const updatedFields: string[] = [];

  if (patch.rep_policy_v1 && typeof patch.rep_policy_v1 === "object") {
    next.rep_policy_v1 = deepMerge((next.rep_policy_v1 ?? {}) as Record<string, unknown>, patch.rep_policy_v1);
    updatedFields.push("rep_policy_v1");
  }

  if (Array.isArray(patch.faq_v1) && patch.faq_v1.length > 0) {
    const existingFaq = Array.isArray(next.faq_v1) ? next.faq_v1 : [];
    const merged = [...existingFaq];
    for (const item of patch.faq_v1) {
      if (!item?.q || !item?.a) continue;
      const exists = merged.some((row) => row.q === item.q && row.a === item.a);
      if (!exists) merged.push(item);
    }
    next.faq_v1 = merged;
    updatedFields.push("faq_v1");
  }

  if (patch.setup_progress_v1 && typeof patch.setup_progress_v1 === "object") {
    const base = (next.setup_progress_v1 ?? {}) as Record<string, unknown>;
    const merged = deepMerge(base, patch.setup_progress_v1 as Record<string, unknown>) as SetupProgress;
    merged.updated_at = now;
    if (!merged.started_at) merged.started_at = now;
    merged.status = merged.status ?? "in_progress";
    next.setup_progress_v1 = merged;
    updatedFields.push("setup_progress_v1");
  }

  if (patch.setup_profile_v1 && typeof patch.setup_profile_v1 === "object") {
    const base = (next.setup_profile_v1 ?? {}) as Record<string, unknown>;
    next.setup_profile_v1 = deepMerge(base, patch.setup_profile_v1 as Record<string, unknown>);
    updatedFields.push("setup_profile_v1");
  }

  if (patch.ai_context_v1 && typeof patch.ai_context_v1 === "object") {
    const base = (next.ai_context_v1 ?? {}) as Record<string, unknown>;
    next.ai_context_v1 = deepMerge(base, patch.ai_context_v1 as Record<string, unknown>);
    updatedFields.push("ai_context_v1");
  }

  return { next, updatedFields };
}

export function applyCompletion(progress: SetupProgress | null | undefined, now = nowIso()) {
  const next = { ...(progress ?? {}) } as SetupProgress;
  next.status = "completed";
  next.progress_percent = 100;
  next.completed_at = now;
  next.updated_at = now;
  if (!next.started_at) next.started_at = now;
  return next;
}

function buildConversationText(messages: Array<{ role: string; content: string }>) {
  if (!messages.length) return "";
  return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
}

function extractPendingQuestionFromMessages(messages: Array<{ role: string; content: string }>) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const row = messages[i];
    if (row?.role !== "assistant") continue;
    const content = (row.content ?? "").trim();
    const qIndex = content.lastIndexOf("?");
    if (qIndex < 0) continue;
    const lineStart = content.lastIndexOf("\n", qIndex);
    const start = lineStart >= 0 ? lineStart + 1 : 0;
    const question = content.slice(start, qIndex + 1).trim();
    if (question.length > 0) return question;
  }
  return null;
}

function buildQuestionResponse(opts: {
  questionKey: string;
  questionText: string;
  progressPercent: number;
  intro?: string;
}) {
  const assistant_message = sanitizeAssistantMessage(
    `${opts.intro ? `${opts.intro}\n\n` : ""}${opts.questionText.endsWith("?") ? opts.questionText : `${opts.questionText}?`}`,
  );
  return {
    assistant_message,
    expects: "text" as const,
    choices: [],
    suggestions: buildSuggestionsForPendingQuestion(opts.questionKey, opts.questionText),
    progress_percent: opts.progressPercent,
    done: false,
    memory_patch: {},
    state: {
      intent: "ANSWER_TO_ONBOARDING_QUESTION" as const,
      pending_question_key: opts.questionKey,
      pending_question_text: opts.questionText,
    },
  };
}

function buildClarificationForQuestion(questionText: string, examples?: string[]) {
  const exampleLines = (examples ?? []).slice(0, 8).map((example) => `- ${example}`);
  const assistant_message = sanitizeAssistantMessage(
    [
      "Here is what I mean:",
      questionText.replace(/\?$/, "."),
      ...(exampleLines.length > 0 ? ["", "Examples:", ...exampleLines] : []),
      "",
      questionText.endsWith("?") ? questionText : `${questionText}?`,
    ].join("\n"),
  );
  return assistant_message;
}

function buildParseFailureResponse(questionKey: string | null, questionText: string | null) {
  const safeQuestion = questionText ?? "Can you answer the last onboarding question?";
  return {
    assistant_message: sanitizeAssistantMessage(
      `I couldn't parse that response. Let's continue: ${safeQuestion.endsWith("?") ? safeQuestion : `${safeQuestion}?`}`,
    ),
    expects: "text" as const,
    choices: [],
    suggestions: buildSuggestionsForPendingQuestion(questionKey, safeQuestion),
    progress_percent: 0,
    done: false,
    memory_patch: {},
    state: {
      intent: "CLARIFICATION_REQUEST" as const,
      pending_question_key: questionKey,
      pending_question_text: safeQuestion,
    },
  };
}

function getAiMode() {
  const env =
    typeof Deno !== "undefined" && typeof Deno.env?.get === "function"
      ? Deno.env.get("AI_MODE")
      : typeof process !== "undefined"
      ? process.env.AI_MODE
      : undefined;
  return env === "dev" ? "dev" : "prod";
}

export function buildIntroPayload(): GuidedOutput {
  return {
    assistant_message:
      "I'm your agency's AI representative inside SMMAHUB. My job is to make your work easier and smarter, help you scale faster, and build your Agency Brain so I can represent your agency consistently across the platform.\n\nI'll ask one question at a time, and you can ask clarifications anytime.\n\nAre you ready to start? Reply READY.",
    expects: "text",
    choices: [],
    suggestions: [
      { id: "ready", label: "READY", user_message: "READY" },
      { id: "lets_go", label: "Let's go", user_message: "Let's go" },
    ],
    progress_percent: 0,
    done: false,
    memory_patch: {},
    state: {
      intent: "READY_CONFIRMATION",
      pending_question_key: "readiness_confirmation",
      pending_question_text: "Are you ready to start? Reply READY.",
    },
  };
}

function deriveStateFromMeta(meta: Record<string, unknown> | null | undefined): GuidedState | null {
  if (!meta || typeof meta !== "object") return null;
  const metaAny = meta as any;

  const nestedState = metaAny.state as any;
  if (
    nestedState &&
    typeof nestedState === "object" &&
    GUIDED_INTENTS.includes(nestedState.intent) &&
    (nestedState.pending_question_key === null || typeof nestedState.pending_question_key === "string") &&
    (nestedState.pending_question_text === null || typeof nestedState.pending_question_text === "string")
  ) {
    return {
      intent: nestedState.intent as GuidedIntent,
      pending_question_key: nestedState.pending_question_key as string | null,
      pending_question_text: nestedState.pending_question_text as string | null,
    };
  }

  const intent = typeof metaAny.intent === "string" && GUIDED_INTENTS.includes(metaAny.intent) ? (metaAny.intent as GuidedIntent) : null;
  const pending_question_key = metaAny.pending_question_key;
  const pending_question_text = metaAny.pending_question_text;
  if (
    intent &&
    (pending_question_key === null || typeof pending_question_key === "string") &&
    (pending_question_text === null || typeof pending_question_text === "string")
  ) {
    return {
      intent,
      pending_question_key: pending_question_key as string | null,
      pending_question_text: pending_question_text as string | null,
    };
  }

  return null;
}

async function fetchLatestAssistantState(supabase: MinimalSupabase, threadId: string) {
  const res: MaybeSingleResult<{ meta_json: Record<string, unknown> | null; created_at: string } | null> = await supabase
    .from("agency_ai_chat_messages")
    .select("meta_json, created_at")
    .eq("thread_id", threadId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (res?.error) throw new Error(res.error.message ?? "Failed to load assistant state");
  return deriveStateFromMeta(res?.data?.meta_json ?? null);
}


export async function handleAgencyAdminSetup(opts: {
  supabase: MinimalSupabase;
  userId: string;
  agencyId: string;
  threadId: string;
  message: string;
}): Promise<{ status: number; body: SetupResponse | { error: string } }> {
  let brainId: string | null = null;
  let brain: AgencyBrain = {};

  try {
    const brainRes = await fetchAgencyBrain(opts.supabase, opts.agencyId);
    brainId = brainRes.id;
    brain = brainRes.brain;
  } catch (error: any) {
    return jsonResponse({ error: error.message ?? "Failed to load agency brain" }, 500);
  }

  const incomingMessage = (opts.message ?? "").trim();

  let messages: Array<{ role: string; content: string }> = [];
  try {
    const rows = await fetchThreadMessages(opts.supabase, opts.threadId);
    messages = rows.map((row) => ({ role: row.role, content: row.content }));
  } catch (error: any) {
    return jsonResponse({ error: error.message ?? "Failed to load messages" }, 500);
  }

  const conversation = buildConversationText(messages);
  const isFirstTurn = !incomingMessage && messages.length === 0;

  if (isFirstTurn) {
    const intro = buildIntroPayload();
    const responsePayload: SetupResponse = {
      thread_id: opts.threadId,
      assistant_message: intro.assistant_message,
      expects: intro.expects,
      choices: intro.choices,
      suggestions: intro.suggestions,
      progress_percent: intro.progress_percent,
      done: intro.done,
      step_id: intro.state.pending_question_key ?? undefined,
      state: intro.state,
    };

    try {
      await insertAssistantMessage(opts.supabase, opts.threadId, intro.assistant_message, {
        task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
        provider: null,
        model: null,
        progress_percent: intro.progress_percent,
        updated_fields: [],
        done: intro.done,
        intent: intro.state.intent,
        pending_question_key: intro.state.pending_question_key,
        pending_question_text: intro.state.pending_question_text,
        state: intro.state,
        suggestions: intro.suggestions ?? [],
      });
    } catch (error: any) {
      return jsonResponse({ error: error.message ?? "Failed to store assistant message" }, 500);
    }

    return jsonResponse(responsePayload, 200);
  }

  let latestState: GuidedState | null = null;
  try {
    latestState = await fetchLatestAssistantState(opts.supabase, opts.threadId);
  } catch {
    latestState = null;
  }
  if (!latestState) {
    const pendingText = extractPendingQuestionFromMessages(messages);
    if (pendingText) {
      latestState = { intent: "OFFTOPIC_QUESTION", pending_question_key: null, pending_question_text: pendingText };
    }
  }

  const setupStatus = brain.setup_progress_v1?.status ?? "not_started";
  const answeredKeys = extractAnsweredKeys(brain);
  const nextQuestion = getNextQuestion(answeredKeys);

  const readinessQuestionText = "Are you ready to start? Reply READY.";
  if (!latestState && setupStatus === "not_started") {
    latestState = {
      intent: "READY_CONFIRMATION",
      pending_question_key: "readiness_confirmation",
      pending_question_text: readinessQuestionText,
    };
  } else if (!latestState && nextQuestion) {
    latestState = {
      intent: "ANSWER_TO_ONBOARDING_QUESTION",
      pending_question_key: nextQuestion.key,
      pending_question_text: nextQuestion.question_text,
    };
  }

  const pendingKey = latestState?.pending_question_key ?? null;
  const pendingText = latestState?.pending_question_text ?? (nextQuestion?.question_text ?? null);
  const pendingQuestion =
    pendingKey && pendingKey !== "readiness_confirmation"
      ? getQuestionByKey(pendingKey) ??
        SETUP_QUESTIONS.find((q) => q.question_text.toLowerCase() === (pendingText ?? "").toLowerCase()) ??
        null
      : null;

  let intent = classifySetupIntent({ message: incomingMessage, pendingQuestionKey: pendingKey });
  if (intent === "READY_CONFIRMATION" && pendingKey !== "readiness_confirmation") {
    intent = "ANSWER_TO_ONBOARDING_QUESTION";
  }

  let snapshot;
  try {
    snapshot = await buildAgencyContextSnapshot({
      supabase: opts.supabase,
      agencyId: opts.agencyId,
      userId: opts.userId,
      agencyBrain: brain,
    });
  } catch {
    snapshot = {
      agency: null,
      admin: null,
      onboarding_known_facts: null,
      agency_brain_existing: brain,
    };
  }
  const contextSummary = buildAiContextSummary(snapshot);
  const contextChanged = JSON.stringify(contextSummary) !== JSON.stringify(brain.ai_context_v1 ?? {});
  const contextPatch = contextChanged ? { ai_context_v1: contextSummary } : null;

  if (!incomingMessage) {
    const responsePayload: SetupResponse = {
      thread_id: opts.threadId,
      assistant_message: pendingText ?? readinessQuestionText,
      expects: "text",
      choices: [],
      suggestions: buildSuggestionsForPendingQuestion(pendingKey, pendingText ?? readinessQuestionText),
      progress_percent: computeProgress(answeredKeys),
      done: false,
      step_id: pendingKey ?? undefined,
      state: {
        intent: "CLARIFICATION_REQUEST",
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      },
    };
    return jsonResponse(responsePayload, 200);
  }

  try {
    await insertUserMessage(opts.supabase, opts.threadId, incomingMessage);
  } catch (error: any) {
    return jsonResponse({ error: error.message ?? "Failed to store user message" }, 500);
  }

  if (isAgencySpecificFactQuestion(incomingMessage)) {
    const response = buildUnknownAgencyFactsResponse({
      pending: {
        intent: "OFFTOPIC_QUESTION",
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      },
    });
    await insertAssistantMessage(opts.supabase, opts.threadId, response.assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: response.progress_percent,
      updated_fields: [],
      done: response.done,
      intent: response.state.intent,
      pending_question_key: response.state.pending_question_key,
      pending_question_text: response.state.pending_question_text,
      state: response.state,
      suggestions: response.suggestions ?? [],
    });
    return jsonResponse(
      {
        thread_id: opts.threadId,
        assistant_message: response.assistant_message,
        expects: response.expects,
        choices: response.choices,
        suggestions: response.suggestions,
        progress_percent: response.progress_percent,
        done: response.done,
        step_id: response.state.pending_question_key ?? undefined,
        state: response.state,
      },
      200,
    );
  }

  if (intent === "STOP_OR_PAUSE") {
    const pausedProgress: SetupProgress = {
      status: "paused",
      updated_at: nowIso(),
      progress_percent: computeProgress(answeredKeys),
      missing_fields: getMissingKeys(answeredKeys),
      current_step_key: pendingKey ?? null,
      completed_keys: Array.from(answeredKeys),
    };
    const { next, updatedFields } = applyMemoryPatch(brain, {
      setup_progress_v1: pausedProgress,
      ...(contextPatch ?? {}),
    });
    if (updatedFields.length > 0) {
      try {
        await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, next);
      } catch (error: any) {
        return jsonResponse({ error: error.message ?? "Failed to update agency brain" }, 500);
      }
    }

    const assistant_message = sanitizeAssistantMessage(
      "Paused. If you'd like to continue, reply RESUME and I'll pick up from where we left off. Ready to resume?",
    );
    const responsePayload: SetupResponse = {
      thread_id: opts.threadId,
      assistant_message,
      expects: "text",
      choices: [],
      suggestions: [
        { id: "resume", label: "Resume", user_message: "Resume" },
        { id: "exit", label: "Exit", user_message: "Exit for now" },
      ],
      progress_percent: pausedProgress.progress_percent,
      done: false,
      step_id: pendingKey ?? undefined,
      state: {
        intent: "STOP_OR_PAUSE",
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      },
    };
    await insertAssistantMessage(opts.supabase, opts.threadId, assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: pausedProgress.progress_percent,
      updated_fields: updatedFields,
      done: false,
      intent: "STOP_OR_PAUSE",
      pending_question_key: pendingKey,
      pending_question_text: pendingText,
      state: responsePayload.state,
      suggestions: responsePayload.suggestions ?? [],
    });
    return jsonResponse(responsePayload, 200);
  }

  if (intent === "READY_CONFIRMATION" && pendingKey === "readiness_confirmation") {
    const first = getFirstQuestion();
    if (!first) {
      const responsePayload: SetupResponse = {
        thread_id: opts.threadId,
        assistant_message: "You're all set.",
        expects: "text",
        choices: [],
        suggestions: [],
        progress_percent: 100,
        done: true,
        step_id: undefined,
        state: {
          intent: "ANSWER_TO_ONBOARDING_QUESTION",
          pending_question_key: null,
          pending_question_text: null,
        },
      };
      return jsonResponse(responsePayload, 200);
    }

    const progressPercent = computeProgress(answeredKeys);
    const guided = buildQuestionResponse({
      questionKey: first.key,
      questionText: first.question_text,
      progressPercent,
      intro: snapshot.admin?.first_name ? `Great, ${snapshot.admin.first_name}. Let's start.` : "Great. Let's start.",
    });
    logSetupEvent("setup_transition", {
      thread_id: opts.threadId,
      from: "readiness_confirmation",
      to: first.key,
    });

    const { next, updatedFields } = applyMemoryPatch(brain, {
      setup_progress_v1: {
        status: "in_progress",
        progress_percent: progressPercent,
        missing_fields: getMissingKeys(answeredKeys),
        current_step_key: first.key,
        completed_keys: Array.from(answeredKeys),
      },
      ...(contextPatch ?? {}),
    });
    if (updatedFields.length > 0) {
      await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, next);
    }

    await insertAssistantMessage(opts.supabase, opts.threadId, guided.assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: guided.progress_percent,
      updated_fields: updatedFields,
      done: guided.done,
      intent: guided.state.intent,
      pending_question_key: guided.state.pending_question_key,
      pending_question_text: guided.state.pending_question_text,
      state: guided.state,
      suggestions: guided.suggestions ?? [],
    });

    return jsonResponse(
      {
        thread_id: opts.threadId,
        assistant_message: guided.assistant_message,
        expects: guided.expects,
        choices: guided.choices,
        suggestions: guided.suggestions,
        progress_percent: guided.progress_percent,
        done: guided.done,
        step_id: guided.state.pending_question_key ?? undefined,
        state: guided.state,
      },
      200,
    );
  }

  if (intent === "CLARIFICATION_REQUEST" && pendingText) {
    let assistant_message: string;
    if (pendingQuestion?.key?.includes("primary_services") || pendingText.toLowerCase().includes("service")) {
      assistant_message = buildClarificationForOffers({
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      }).assistant_message;
    } else {
      assistant_message = buildClarificationForQuestion(pendingText, pendingQuestion?.examples);
    }

    const responsePayload: SetupResponse = {
      thread_id: opts.threadId,
      assistant_message,
      expects: "text",
      choices: [],
      suggestions: buildSuggestionsForPendingQuestion(pendingKey, pendingText),
      progress_percent: computeProgress(answeredKeys),
      done: false,
      step_id: pendingKey ?? undefined,
      state: {
        intent: "CLARIFICATION_REQUEST",
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      },
    };

    await insertAssistantMessage(opts.supabase, opts.threadId, assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: responsePayload.progress_percent ?? 0,
      updated_fields: [],
      done: false,
      intent: responsePayload.state?.intent ?? "CLARIFICATION_REQUEST",
      pending_question_key: pendingKey,
      pending_question_text: pendingText,
      state: responsePayload.state,
      suggestions: responsePayload.suggestions ?? [],
    });

    return jsonResponse(responsePayload, 200);
  }

  if (intent === "OFFTOPIC_QUESTION") {
    const aiReply = await runAdminGeneralChatAi({
      message: incomingMessage,
      agencyId: opts.agencyId,
      userId: opts.userId,
      snapshot,
      conversation,
      supabase: opts.supabase,
    });
    const trimmed = aiReply.assistant_message.replace(/\?/g, "").trim();
    const combined = pendingText
      ? sanitizeAssistantMessage(`${trimmed}\n\n${pendingText.endsWith("?") ? pendingText : `${pendingText}?`}`)
      : trimmed;

    const responsePayload: SetupResponse = {
      thread_id: opts.threadId,
      assistant_message: combined,
      expects: "text",
      choices: [],
      suggestions: pendingText ? buildSuggestionsForPendingQuestion(pendingKey, pendingText) : aiReply.suggestions ?? [],
      progress_percent: computeProgress(answeredKeys),
      done: false,
      step_id: pendingKey ?? undefined,
      state: {
        intent: "OFFTOPIC_QUESTION",
        pending_question_key: pendingKey,
        pending_question_text: pendingText,
      },
    };

    await insertAssistantMessage(opts.supabase, opts.threadId, combined, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: aiReply.meta?.provider ?? null,
      model: aiReply.meta?.model ?? null,
      progress_percent: responsePayload.progress_percent ?? 0,
      updated_fields: [],
      done: false,
      intent: "OFFTOPIC_QUESTION",
      pending_question_key: pendingKey,
      pending_question_text: pendingText,
      state: responsePayload.state,
      suggestions: responsePayload.suggestions ?? [],
    });

    return jsonResponse(responsePayload, 200);
  }

  if (pendingKey === "readiness_confirmation" && intent !== "READY_CONFIRMATION") {
    const responsePayload = buildParseFailureResponse(pendingKey, readinessQuestionText);
    await insertAssistantMessage(opts.supabase, opts.threadId, responsePayload.assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: responsePayload.progress_percent,
      updated_fields: [],
      done: false,
      intent: responsePayload.state.intent,
      pending_question_key: responsePayload.state.pending_question_key,
      pending_question_text: responsePayload.state.pending_question_text,
      state: responsePayload.state,
      suggestions: responsePayload.suggestions ?? [],
    });
    return jsonResponse(
      {
        thread_id: opts.threadId,
        assistant_message: responsePayload.assistant_message,
        expects: responsePayload.expects,
        choices: responsePayload.choices,
        suggestions: responsePayload.suggestions,
        progress_percent: responsePayload.progress_percent,
        done: responsePayload.done,
        step_id: responsePayload.state.pending_question_key ?? undefined,
        state: responsePayload.state,
      },
      200,
    );
  }

  if (intent === "ANSWER_TO_ONBOARDING_QUESTION" && pendingQuestion) {
    let extractedValue: unknown = null;
    try {
      const result = await runAiTask({
        task_type: TaskType.AGENCY_ADMIN_SETUP_EXTRACT,
        mode: getAiMode(),
        tenant: { agency_id: opts.agencyId, user_id: opts.userId },
        input: { message: incomingMessage },
        metadata: {
          questionKey: pendingQuestion.key,
          questionText: pendingQuestion.question_text,
          targetPath: pendingQuestion.target_path,
          contextSnapshot: snapshot,
        },
        supabase: opts.supabase,
      });
      extractedValue = (result?.json as any)?.value ?? null;
      if (!hasMeaningfulValue(extractedValue)) {
        logSetupEvent("setup_parse_failure", {
          thread_id: opts.threadId,
          question_key: pendingQuestion.key,
          reason: "empty_value",
        });
        const fallback = buildParseFailureResponse(pendingKey, pendingQuestion.question_text);
        await insertAssistantMessage(opts.supabase, opts.threadId, fallback.assistant_message, {
          task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
          provider: result?.meta?.provider ?? null,
          model: result?.meta?.model ?? null,
          progress_percent: fallback.progress_percent,
          updated_fields: [],
          done: false,
          intent: fallback.state.intent,
          pending_question_key: fallback.state.pending_question_key,
          pending_question_text: fallback.state.pending_question_text,
          state: fallback.state,
          suggestions: fallback.suggestions ?? [],
        });
        return jsonResponse(
          {
            thread_id: opts.threadId,
            assistant_message: fallback.assistant_message,
            expects: fallback.expects,
            choices: fallback.choices,
            suggestions: fallback.suggestions,
            progress_percent: fallback.progress_percent,
            done: fallback.done,
            step_id: fallback.state.pending_question_key ?? undefined,
            state: fallback.state,
          },
          200,
        );
      }
    } catch {
      logSetupEvent("setup_parse_failure", {
        thread_id: opts.threadId,
        question_key: pendingQuestion.key,
        reason: "extract_error",
      });
      const fallback = buildParseFailureResponse(pendingKey, pendingQuestion.question_text);
      return jsonResponse(
        {
          thread_id: opts.threadId,
          assistant_message: fallback.assistant_message,
          expects: fallback.expects,
          choices: fallback.choices,
          suggestions: fallback.suggestions,
          progress_percent: fallback.progress_percent,
          done: fallback.done,
          step_id: fallback.state.pending_question_key ?? undefined,
          state: fallback.state,
        },
        200,
      );
    }

    const patch = buildMemoryPatchForAnswer(pendingQuestion.target_path, extractedValue);
    logSetupEvent("setup_answer", {
      thread_id: opts.threadId,
      question_key: pendingQuestion.key,
    });
    const updatedAnsweredKeys = new Set(answeredKeys);
    updatedAnsweredKeys.add(pendingQuestion.key);
    const updatedProgress = computeProgress(updatedAnsweredKeys);
    const remaining = getMissingKeys(updatedAnsweredKeys);
    const upcoming = getNextQuestion(updatedAnsweredKeys);
    logSetupEvent("setup_transition", {
      thread_id: opts.threadId,
      from: pendingQuestion.key,
      to: upcoming?.key ?? null,
    });

    const progressPatch: SetupProgress = {
      status: remaining.length === 0 ? "completed" : "in_progress",
      progress_percent: remaining.length === 0 ? 100 : updatedProgress,
      missing_fields: remaining,
      current_step_key: upcoming?.key ?? null,
      completed_keys: Array.from(updatedAnsweredKeys),
    };

    const { next, updatedFields } = applyMemoryPatch(brain, {
      ...patch,
      setup_progress_v1: progressPatch,
      ...(contextPatch ?? {}),
    });
    if (progressPatch.status === "completed") {
      next.setup_progress_v1 = applyCompletion(next.setup_progress_v1 ?? null);
    }

    if (updatedFields.length > 0 || progressPatch.status === "completed") {
      try {
        await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, next);
      } catch (error: any) {
        return jsonResponse({ error: error.message ?? "Failed to update agency brain" }, 500);
      }
    }

    if (!upcoming) {
      const doneMessage = sanitizeAssistantMessage(
        "That's everything I need for now. Want a quick recap before I lock this in?",
      );
      const responsePayload: SetupResponse = {
        thread_id: opts.threadId,
        assistant_message: doneMessage,
        expects: "text",
        choices: [],
        suggestions: [
          { id: "recap_yes", label: "Show recap", user_message: "Show me a recap." },
          { id: "recap_no", label: "No recap", user_message: "No recap needed." },
        ],
        progress_percent: 100,
        done: true,
        step_id: undefined,
        state: {
          intent: "ANSWER_TO_ONBOARDING_QUESTION",
          pending_question_key: null,
          pending_question_text: null,
        },
      };
      await insertAssistantMessage(opts.supabase, opts.threadId, doneMessage, {
        task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
        provider: null,
        model: null,
        progress_percent: responsePayload.progress_percent ?? 100,
        updated_fields: updatedFields,
        done: true,
        intent: responsePayload.state?.intent ?? "ANSWER_TO_ONBOARDING_QUESTION",
        pending_question_key: null,
        pending_question_text: null,
        state: responsePayload.state,
        suggestions: responsePayload.suggestions ?? [],
      });
      return jsonResponse(responsePayload, 200);
    }

    const nextResponse = buildQuestionResponse({
      questionKey: upcoming.key,
      questionText: upcoming.question_text,
      progressPercent: updatedProgress,
      intro: "Got it.",
    });

    await insertAssistantMessage(opts.supabase, opts.threadId, nextResponse.assistant_message, {
      task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
      provider: null,
      model: null,
      progress_percent: nextResponse.progress_percent,
      updated_fields: updatedFields,
      done: nextResponse.done,
      intent: nextResponse.state.intent,
      pending_question_key: nextResponse.state.pending_question_key,
      pending_question_text: nextResponse.state.pending_question_text,
      state: nextResponse.state,
      suggestions: nextResponse.suggestions ?? [],
    });

    return jsonResponse(
      {
        thread_id: opts.threadId,
        assistant_message: nextResponse.assistant_message,
        expects: nextResponse.expects,
        choices: nextResponse.choices,
        suggestions: nextResponse.suggestions,
        progress_percent: nextResponse.progress_percent,
        done: nextResponse.done,
        step_id: nextResponse.state.pending_question_key ?? undefined,
        state: nextResponse.state,
      },
      200,
    );
  }

  const fallback = buildParseFailureResponse(pendingKey, pendingText ?? "Can you answer the last onboarding question?");
  await insertAssistantMessage(opts.supabase, opts.threadId, fallback.assistant_message, {
    task_type: "AGENCY_ADMIN_SETUP_GUIDED_V2",
    provider: null,
    model: null,
    progress_percent: fallback.progress_percent,
    updated_fields: [],
    done: false,
    intent: fallback.state.intent,
    pending_question_key: fallback.state.pending_question_key,
    pending_question_text: fallback.state.pending_question_text,
    state: fallback.state,
    suggestions: fallback.suggestions ?? [],
  });

  return jsonResponse(
    {
      thread_id: opts.threadId,
      assistant_message: fallback.assistant_message,
      expects: fallback.expects,
      choices: fallback.choices,
      suggestions: fallback.suggestions,
      progress_percent: fallback.progress_percent,
      done: fallback.done,
      step_id: fallback.state.pending_question_key ?? undefined,
      state: fallback.state,
    },
    200,
  );
}
