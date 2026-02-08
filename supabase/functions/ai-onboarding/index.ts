import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { z } from "../_shared/zod.edge.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { runAiTask } from "../_shared/ai.ts";
import {
  applyCalibrationInput,
  mergeDraftSnapshot,
  resolveSnapshotValue,
} from "../../../src/ai/onboardingState.ts";
import {
  QUESTION_BANK,
  countRequiredComplete,
  getNextQuestion,
  splitFieldPath,
  QUESTION_EXPLAINERS,
  type QuestionDef,
} from "../../../src/ai/onboardingScript.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";

const FN_VERSION = "2.0.0";

const requestSchema = z
  .object({
    agency_id: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    scope: z.enum(["agency", "client"]).optional(),
    client_turn_id: z.string().trim().min(1).max(120).optional(),
    user_message: z.string().trim().max(4000).optional(),
    selected_suggestion: z.string().trim().max(4000).optional(),
    tap_to_send: z.boolean().optional(),
    skip_optional: z.boolean().optional(),
    skip_all_optional: z.boolean().optional(),
    undo_last: z.boolean().optional(),
    reset_onboarding: z.boolean().optional(),
    memory_patch: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    persona: z
      .object({
        assistant_name: z.string().trim().min(1).max(80).optional(),
        tone_traits: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
        expertise_traits: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const scope = value.scope ?? (value.client_id ? "client" : "agency");
    if (scope === "client" && !value.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "client_id is required when scope=client",
        path: ["client_id"],
      });
    }
    if (scope === "agency" && value.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "client_id must be null when scope=agency",
        path: ["client_id"],
      });
    }
  });

const responseSchema = z.object({
  v: z.string(),
  trace_id: z.string(),
  onboarding_status: z.object({
    id: z.string(),
    status: z.enum(["not_started", "in_progress", "complete", "blocked"]),
    scope: z.enum(["agency", "client"]),
    last_step_id: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
  }),
  assistant_message: z.string().min(1),
  expects: z.string().min(1),
  suggestions: z.array(z.string().min(1)).min(3).max(4),
  question_id: z.string().optional(),
  field_path: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2"]).optional(),
  input_type: z.enum(["text", "list", "numeric", "percent", "tz_lang"]).optional(),
  can_skip: z.boolean().optional(),
  progress: z
    .object({
      required_complete: z.boolean(),
      current_index: z.number(),
      total_required: z.number(),
    })
    .optional(),
  unknown: z.boolean(),
  unknown_reason: z.string().optional(),
  brain_snapshot: z.record(z.any()),
  state: z.object({
    module: z.string(),
    resolver_state: z.enum(["ready", "calibration_needed", "unknown"]),
    missing_fields: z.array(z.string()).optional(),
  }),
  idempotent_replay: z.boolean().optional(),
});

type OnboardingRequest = z.infer<typeof requestSchema>;

type MinimalSupabase = ReturnType<typeof createClient>;

type CompletionIngestState = {
  status?: "ok" | "failed";
  at?: string;
  snapshot_hash?: string;
  scope?: "agency" | "client";
  error?: string;
};

type AgencyBootstrap = {
  name: string | null;
  website: string | null;
};

function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "X-AI-Onboarding-Version": FN_VERSION,
      ...extraHeaders,
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function sanitizeMessage(value: string | undefined, maxLength = 3000) {
  const trimmed = (value ?? "").trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}

function readEnvFlag(name: string, fallback = "true") {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return (Deno.env.get(name) ?? fallback) === "true";
  }
  return fallback === "true";
}

const PLACEHOLDER_PATTERNS = [
  /ready to begin onboarding/i,
];

function isPlaceholderString(value: string) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function cleanSnapshotValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    return isPlaceholderString(trimmed) ? null : trimmed;
  }
  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => cleanSnapshotValue(item))
      .filter((item) => item !== null && item !== undefined)
      .filter((item) => (typeof item === "string" ? item.trim().length > 0 : true));
    return cleaned;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = cleanSnapshotValue(entry);
      if (cleaned !== null && cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return value;
}

function sanitizeSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
  const cleaned = cleanSnapshotValue(snapshot);
  if (!cleaned || typeof cleaned !== "object" || Array.isArray(cleaned)) return {};
  return cleaned as Record<string, unknown>;
}

function containsPlaceholder(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isPlaceholderString(value.trim());
  if (Array.isArray(value)) return value.some((item) => containsPlaceholder(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => containsPlaceholder(item));
  }
  return false;
}

function getPathValue(snapshot: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = snapshot;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let current: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = current[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function firstString(snapshot: Record<string, unknown>, paths: string[]): string {
  for (const path of paths) {
    const value = getPathValue(snapshot, path);
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return "";
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function firstList(snapshot: Record<string, unknown>, paths: string[]): string[] {
  for (const path of paths) {
    const value = getPathValue(snapshot, path);
    const list = toList(value);
    if (list.length > 0) return list;
  }
  return [];
}

function buildIngestRawResponses(snapshot: Record<string, unknown>) {
  return {
    identity: firstString(snapshot, [
      "bootstrap.agency_name",
      "identity.name",
      "setup_profile_v1.agency.name",
    ]),
    offers: firstList(snapshot, [
      "offer_stack.core_offers",
      "bootstrap.services",
      "identity.offers",
      "setup_profile_v1.agency.primary_services",
    ]).join(", "),
    geo: firstList(snapshot, ["identity.geo", "setup_profile_v1.agency.geography"]).join(", "),
    languages: firstList(snapshot, ["identity.languages"]).join(", "),
    icp: firstList(snapshot, [
      "bootstrap.target_industries",
      "identity.niches",
      "setup_profile_v1.agency.niche_industries",
    ]).join(", "),
    personas: firstList(snapshot, ["icp.personas"]).join(", "),
    pains: firstList(snapshot, ["icp.pains"]).join(", "),
    objections: firstList(snapshot, ["icp.objections"]).join(", "),
    tone: firstList(snapshot, [
      "tone_voice.voice_attributes",
      "voice_tone.adjectives",
      "setup_profile_v1.brand.voice_adjectives",
    ]).join(", "),
    banned: firstList(snapshot, [
      "rep_policy.boundaries",
      "voice_tone.banned_words",
      "constraints.banned_claims",
      "constraints.taboo_topics",
    ]).join(", "),
    vocab: firstList(snapshot, ["voice_tone.preferred_vocab"]).join(", "),
    rules: firstList(snapshot, ["voice_tone.writing_rules"]).join(", "),
    pillars: firstList(snapshot, [
      "sop_strategy.content_pillars",
      "strategy_defaults.pillars",
      "pillars",
    ]).join(", "),
    hooks: firstList(snapshot, ["strategy_defaults.hook_styles"]).join(", "),
    ctas: firstList(snapshot, ["strategy_defaults.cta_styles"]).join(", "),
    formats: firstList(snapshot, ["strategy_defaults.platform_formats"]).join(", "),
    safety: firstList(snapshot, ["safety_policy.allowed"]).join(", "),
    process: firstString(snapshot, [
      "process_rules.revisions",
      "process_rules.approvals",
      "process_rules.escalation_rules",
    ]),
    examples: firstList(snapshot, ["gold_examples"]).join(", "),
  };
}

async function loadAgencyBootstrap(supabase: MinimalSupabase, agencyId: string): Promise<AgencyBootstrap> {
  const { data, error } = await supabase
    .from("agencies")
    .select("name, website")
    .eq("id", agencyId)
    .maybeSingle();
  if (error) {
    return { name: null, website: null };
  }
  return {
    name: (data?.name ?? null) as string | null,
    website: (data?.website ?? null) as string | null,
  };
}

async function hashSnapshot(snapshot: Record<string, unknown>) {
  const encoded = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashText(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function runCompletionIngest(params: {
  token: string;
  agencyId: string;
  clientId: string | null;
  scope: "agency" | "client";
  snapshot: Record<string, unknown>;
}) {
  const ingestResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-brain-ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agency_id: params.agencyId,
      client_id: params.clientId,
      scope: params.scope,
      raw_responses: buildIngestRawResponses(params.snapshot),
      followup_responses: params.snapshot,
    }),
  });

  if (!ingestResponse.ok) {
    const payload = await ingestResponse.json().catch(() => ({}));
    const message =
      typeof payload?.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : `ai-brain-ingest returned ${ingestResponse.status}`;
    throw new Error(message);
  }
}

function pickUserInput(payload: OnboardingRequest) {
  if (payload.tap_to_send && payload.selected_suggestion) {
    return sanitizeMessage(payload.selected_suggestion);
  }
  return sanitizeMessage(payload.user_message);
}

async function fetchClarifyRagContext(params: {
  token: string;
  agencyId: string;
  clientId: string | null;
  questionText: string;
  userMessage: string;
}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-retrieve-context`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agency_id: params.agencyId,
        client_id: params.clientId,
        query: `${params.questionText}\n${params.userMessage}`,
        top_k: 6,
        doc_types: ["brain_document"],
        min_similarity: 0.2,
        token_budget: 800,
      }),
    });
    if (!response.ok) return "";
    const json = await response.json().catch(() => []);
    if (!Array.isArray(json)) return "";
    return json
      .map((row) => (row?.snippet ? String(row.snippet) : ""))
      .filter(Boolean)
      .slice(0, 6)
      .join("\n");
  } catch {
    return "";
  }
}

function deriveScope(payload: OnboardingRequest): "agency" | "client" {
  return payload.scope ?? (payload.client_id ? "client" : "agency");
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function isPlaceholderAgencyName(value: unknown) {
  if (typeof value !== "string") return false;
  return isPlaceholderString(value.trim());
}

function isUnknownAnswer(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  return [
    "i do not know",
    "i don't know",
    "idk",
    "no idea",
    "not sure",
    "prefer not",
    "skip",
    "n/a",
  ].some((phrase) => normalized === phrase || normalized.includes(phrase));
}


function parseNumbers(input: string) {
  const matches = input.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
}

function hasLetters(input: string) {
  return /[a-zA-Z]/.test(input);
}

function isLikelyTimezone(input: string) {
  return /[A-Za-z]+\/[A-Za-z_]+/.test(input) || /\b(UTC|GMT|EST|CST|PST|EET|CET|BST)\b/i.test(input);
}

function validateAnswerLocally(question: QuestionDef, input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { decision: "follow_up" as const, message: "Please share a quick answer so we can move on." };
  }

  if (isUnknownAnswer(trimmed)) {
    if (question.priority === "P0") {
      return {
        decision: "follow_up" as const,
        message:
          "I respect that you do not want to share that information, but the more I know, the better I can help. Can you give a best-effort answer?",
      };
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "numeric") {
    const numbers = parseNumbers(trimmed);
    if (numbers.length === 0) {
      return { decision: "follow_up" as const, message: "Please reply with a number (e.g., 3)." };
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "percent") {
    const numbers = parseNumbers(trimmed);
    if (numbers.length < 2) {
      return {
        decision: "follow_up" as const,
        message: "Please share a % split that totals 100 (e.g., SMB 70 / Mid 30).",
      };
    }
    const sum = numbers.reduce((total, value) => total + value, 0);
    if (sum < 95 || sum > 105) {
      return {
        decision: "follow_up" as const,
        message: "Please make sure the split totals 100 (e.g., 60 / 40).",
      };
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "tz_lang") {
    const parts = trimmed.split(",");
    const hasTimezone = isLikelyTimezone(trimmed);
    const hasLang = parts.length >= 2 ? hasLetters(parts[1]) : false;
    if (!hasTimezone || !hasLang) {
      return {
        decision: "follow_up" as const,
        message: "Please include timezone and language (e.g., Europe/Athens, English).",
      };
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "list") {
    const items = toList(trimmed);
    if (items.length === 0) {
      return { decision: "follow_up" as const, message: "Please share at least one item." };
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "text") {
    if (trimmed.length < 2) {
      return { decision: "follow_up" as const, message: "Please share a brief answer." };
    }
  }

  return { decision: "accept" as const };
}

async function runAnswerCheck(params: {
  question: QuestionDef;
  answer: string;
  agencyId: string;
  clientId: string | null;
  userId: string;
  supabase: MinimalSupabase;
}) {
  const result = await runAiTask({
    task_type: TaskType.ONBOARDING_ANSWER_CHECK,
    tenant: {
      agency_id: params.agencyId,
      client_id: params.clientId ?? undefined,
      user_id: params.userId,
    },
    input: { message: params.answer },
    metadata: {
      questionText: params.question.question_text,
      fieldPath: params.question.field_path,
      inputType: params.question.input_type,
      priority: params.question.priority,
      examples: params.question.examples,
    },
    supabase: params.supabase,
  });

  const payload = asRecord(result.json);
  const decision = payload.decision === "follow_up" ? "follow_up" : "accept";
  const followUp =
    typeof payload.follow_up === "string" && payload.follow_up.trim().length > 0
      ? payload.follow_up.trim()
      : "Can you clarify that a bit so I can capture it accurately?";
  return { decision, followUp };
}

async function runClarifyCheck(params: {
  question: QuestionDef;
  answer: string;
  agencyId: string;
  clientId: string | null;
  userId: string;
  supabase: MinimalSupabase;
  ragContext?: string;
}) {
  const explainer = QUESTION_EXPLAINERS[params.question.field_path];
  const result = await runAiTask({
    task_type: TaskType.ONBOARDING_CLARIFY,
    tenant: {
      agency_id: params.agencyId,
      client_id: params.clientId ?? undefined,
      user_id: params.userId,
    },
    input: { message: params.answer },
    metadata: {
      questionText: params.question.question_text,
      fieldPath: params.question.field_path,
      inputType: params.question.input_type,
      priority: params.question.priority,
      examples: params.question.examples,
      whyNeeded: explainer?.why_needed ?? "This helps personalize your agency brain.",
      impact: explainer?.impact ?? "We use it to tailor strategy and outputs.",
      ragContext: params.ragContext ?? "",
    },
    supabase: params.supabase,
  });

  const payload = asRecord(result.json);
  const mode = payload.mode === "answer_and_continue" ? "answer_and_continue" : "follow_up";
  const followUp =
    typeof payload.follow_up_text === "string" && payload.follow_up_text.trim().length > 0
      ? payload.follow_up_text.trim()
      : "Can you share a bit more detail so I can capture it correctly?";
  const clarify =
    typeof payload.clarification_text === "string" && payload.clarification_text.trim().length > 0
      ? payload.clarification_text.trim()
      : "This helps me personalize your agency brain and recommendations.";
  return { mode, followUp, clarify };
}

function buildConversation(turns: Array<{ user_message: string | null; assistant_message: string | null }>, userInput: string) {
  const lines: string[] = [];
  for (const turn of turns) {
    if (turn.user_message) lines.push(`User: ${turn.user_message}`);
    if (turn.assistant_message) lines.push(`Assistant: ${turn.assistant_message}`);
  }
  if (userInput) lines.push(`User: ${userInput}`);
  return lines.join("\n");
}

function buildDeterministicResponse(params: {
  question: QuestionDef;
  snapshot: Record<string, unknown>;
  traceId: string;
  onboardingStatus: { id: string; status: "not_started" | "in_progress" | "complete" | "blocked"; scope: "agency" | "client"; last_step_id: string | null; started_at: string | null; completed_at: string | null };
  requiredComplete: boolean;
  currentIndex: number;
  totalRequired: number;
  assistantMessage?: string;
}) {
  return {
    v: FN_VERSION,
    trace_id: params.traceId,
    onboarding_status: params.onboardingStatus,
    assistant_message: params.assistantMessage ?? params.question.question_text,
    expects: "text",
    suggestions: params.question.examples.slice(0, 4),
    question_id: params.question.id,
    field_path: params.question.field_path,
    priority: params.question.priority,
    input_type: params.question.input_type,
    can_skip: params.question.priority !== "P0",
    progress: {
      required_complete: params.requiredComplete,
      current_index: params.currentIndex,
      total_required: params.totalRequired,
    },
    unknown: false,
    brain_snapshot: params.snapshot,
    state: {
      module: params.question.module,
      resolver_state: "ready",
    },
  };
}

async function ensureAgencyMembership(supabase: MinimalSupabase, agencyId: string, userId: string) {
  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

async function ensureClientBelongsToAgency(
  supabase: MinimalSupabase,
  agencyId: string,
  clientId: string | null
) {
  if (!clientId) return true;
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return Boolean(data);
}

async function getOrCreateOnboardingStatus(
  supabase: MinimalSupabase,
  params: {
    agencyId: string;
    clientId: string | null;
    scope: "agency" | "client";
  }
) {
  let query = supabase
    .from("ai_onboarding_status")
    .select("*")
    .eq("agency_id", params.agencyId)
    .eq("scope", params.scope);

  if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  } else {
    query = query.is("client_id", null);
  }

  const existing = await query.maybeSingle();
  if (existing.data) return existing.data;

  const insert = await supabase
    .from("ai_onboarding_status")
    .insert({
      agency_id: params.agencyId,
      client_id: params.clientId,
      scope: params.scope,
      status: "in_progress",
      metadata: {
        draft_brain_json: {},
        state_machine: {
          current_module: "bootstrap",
          completed_modules: [],
        },
        module_attempts: {},
      },
    })
    .select("*")
    .single();

  if (!insert.data) {
    throw new Error(insert.error?.message ?? "Failed to initialize onboarding status");
  }
  return insert.data;
}

async function getRecentTurns(
  supabase: MinimalSupabase,
  onboardingStatusId: string
) {
  const { data } = await supabase
    .from("ai_onboarding_turn_logs")
    .select("user_message, assistant_message")
    .eq("onboarding_status_id", onboardingStatusId)
    .order("turn_index", { ascending: true })
    .limit(8);
  return (data ?? []) as Array<{ user_message: string | null; assistant_message: string | null }>;
}

async function getLatestTurnIndex(
  supabase: MinimalSupabase,
  onboardingStatusId: string
) {
  const { data } = await supabase
    .from("ai_onboarding_turn_logs")
    .select("turn_index")
    .eq("onboarding_status_id", onboardingStatusId)
    .order("turn_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || typeof data.turn_index !== "number") return 0;
  return data.turn_index + 1;
}

async function ensurePersonaRow(
  supabase: MinimalSupabase,
  params: {
    agencyId: string;
    clientId: string | null;
    scope: "agency" | "client";
    persona?: OnboardingRequest["persona"];
  }
) {
  let query = supabase
    .from("ai_persona_vectors")
    .select("*")
    .eq("agency_id", params.agencyId)
    .eq("scope", params.scope);

  if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  } else {
    query = query.is("client_id", null);
  }

  const existing = await query.maybeSingle();
  const personaPatch = params.persona ?? {};

  if (!existing.data) {
    const inserted = await supabase
      .from("ai_persona_vectors")
      .insert({
        agency_id: params.agencyId,
        client_id: params.clientId,
        scope: params.scope,
        assistant_name: personaPatch.assistant_name ?? "Alex",
        tone_traits: personaPatch.tone_traits ?? [],
        expertise_traits: personaPatch.expertise_traits ?? [],
        source: personaPatch.assistant_name || personaPatch.tone_traits || personaPatch.expertise_traits ? "onboarding" : "default",
      })
      .select("*")
      .single();
    return inserted.data ?? null;
  }

  if (!params.persona) return existing.data;

  const updates: Record<string, unknown> = {
    source: "onboarding",
  };
  if (personaPatch.assistant_name) updates.assistant_name = personaPatch.assistant_name;
  if (personaPatch.tone_traits) updates.tone_traits = personaPatch.tone_traits;
  if (personaPatch.expertise_traits) updates.expertise_traits = personaPatch.expertise_traits;

  const updated = await supabase
    .from("ai_persona_vectors")
    .update(updates)
    .eq("id", existing.data.id)
    .select("*")
    .single();

  return updated.data ?? existing.data;
}

async function getReplayByClientTurnId(
  supabase: MinimalSupabase,
  onboardingStatusId: string,
  clientTurnId: string | undefined
) {
  if (!clientTurnId) return null;
  const { data } = await supabase
    .from("ai_onboarding_turn_logs")
    .select("response_json")
    .eq("onboarding_status_id", onboardingStatusId)
    .eq("client_turn_id", clientTurnId)
    .maybeSingle();

  if (!data?.response_json || typeof data.response_json !== "object") return null;
  return data.response_json as Record<string, unknown>;
}

async function writeAiRun(
  supabase: MinimalSupabase,
  params: {
    agencyId: string;
    clientId: string | null;
    userId: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
    unknown: boolean;
    success: boolean;
    taskType: TaskType;
    errorCode?: string | null;
    traceId?: string;
    spanId?: string;
    requestId?: string | null;
    moduleKey?: string | null;
    resolverState?: "ready" | "calibration_needed" | "unknown" | null;
    schemaOk?: boolean;
    repairAttempted?: boolean;
    repairSuccess?: boolean;
  }
) {
  await supabase.from("ai_runs").insert({
    agency_id: params.agencyId,
    client_id: params.clientId,
    user_id: params.userId,
    prompt_id: null,
    prompt_version: null,
    model: params.model,
    tokens_in: params.tokensIn,
    tokens_out: params.tokensOut,
    cost_usd: 0,
    latency_ms: Math.max(0, Math.round(params.latencyMs)),
    success: params.success,
    citations: {},
    unknown: params.unknown,
    escalate_to_human: false,
    escalation_reason: params.errorCode ?? null,
    metadata: {
      endpoint: "ai-onboarding",
      task_type: params.taskType,
      error_code: params.errorCode ?? null,
      trace_id: params.traceId ?? null,
      span_id: params.spanId ?? null,
      request_id: params.requestId ?? null,
      module_key: params.moduleKey ?? null,
      resolver_state: params.resolverState ?? null,
      schema_ok: params.schemaOk ?? null,
      repair_attempted: params.repairAttempted ?? null,
      repair_success: params.repairSuccess ?? null,
    },
  });
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const rootSpanId = generateSpanId();
  const requestStartedAt = Date.now();
  let response: Response | undefined;
  let supabase: MinimalSupabase | null = null;
  let agencyId: string | undefined;
  let clientId: string | null | undefined;
  let userId: string | undefined;
  let observedModule: string | null = null;
  let observedResolverState: "ready" | "calibration_needed" | "unknown" | null = null;
  let observedMissingFieldsCount = 0;
  let observedSuggestionCount = 0;
  let observedSuggestionFallback = false;
  let observedRepairAttempted = false;
  let observedRepairSuccess: boolean | null = null;
  let observedIngestStatus: "skipped" | "ok" | "failed" = "skipped";
  let observedStatus: "in_progress" | "complete" | null = null;
  let observedCacheInvalidated = false;
  let observedRequestId: string | null = null;
  let observedValidationDecision: string | null = null;
  let observedFollowupCount: number | null = null;
  let observedUnresolvedP0Count: number | null = null;

  response = await (async () => {
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders(req) });
      }

      if (req.method !== "POST") {
        return jsonResponse(req, { error: "Method not allowed", v: FN_VERSION }, 405);
      }

      const guardResponse = getEndpointGuardResponse("ai-onboarding", corsHeaders(req));
      if (guardResponse) return guardResponse;

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse(req, { error: "Missing Authorization header", v: FN_VERSION }, 401);
      }

      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

      const token = authHeader.replace("Bearer ", "");
      const authResult = await supabase.auth.getUser(token);
      const user = authResult.data?.user;
      if (authResult.error || !user) {
        return jsonResponse(req, { error: "Unauthorized", v: FN_VERSION }, 401);
      }
      userId = user.id;

      const rawBody = await req.json().catch(() => null);
      const parsed = requestSchema.safeParse(rawBody);
      if (!parsed.success) {
        await logOtelSpan(supabase, {
          traceId,
          spanId: generateSpanId(),
          parentSpanId: rootSpanId,
          stage: "edge.ai-onboarding.validation_error",
          taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
          userId,
          latencyMs: 0,
          attributes: {
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        });
        return jsonResponse(
          req,
          {
            error: "Invalid request payload",
            v: FN_VERSION,
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
          400
        );
      }

      const payload = parsed.data;
      agencyId = payload.agency_id;
      clientId = payload.client_id ?? null;
      const scope = deriveScope(payload);
      observedRequestId = payload.client_turn_id ?? null;

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "edge.ai-onboarding.turn_start",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          scope,
        },
      });

      const [hasMembership, validClientScope] = await Promise.all([
        ensureAgencyMembership(supabase, agencyId, user.id),
        ensureClientBelongsToAgency(supabase, agencyId, clientId),
      ]);
      if (!hasMembership) {
        return jsonResponse(req, { error: "Forbidden", v: FN_VERSION }, 403);
      }
      if (!validClientScope) {
        return jsonResponse(req, { error: "client_id does not belong to agency_id", v: FN_VERSION }, 400);
      }

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "onboarding.auth",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          membership_ok: hasMembership,
          client_scope_ok: validClientScope,
          scope,
        },
      });

      const onboardingStatusPromise = getOrCreateOnboardingStatus(supabase, {
        agencyId,
        clientId,
        scope,
      });

      const personaPromise = ensurePersonaRow(supabase, {
        agencyId,
        clientId,
        scope,
        persona: payload.persona,
      });

      const [onboardingStatus] = await Promise.all([onboardingStatusPromise, personaPromise]);

      const replayPayload = await getReplayByClientTurnId(supabase, onboardingStatus.id, payload.client_turn_id);
      if (replayPayload) {
        const replayResponse = {
          ...replayPayload,
          idempotent_replay: true,
        };
        return jsonResponse(req, replayResponse, 200);
      }

      const statusMetadata = asRecord(onboardingStatus.metadata);
      let draftSnapshot = asRecord(statusMetadata.draft_brain_json);
      draftSnapshot = mergeDraftSnapshot(draftSnapshot, asRecord(payload.memory_patch));
      const placeholderDetected = containsPlaceholder(draftSnapshot);
      draftSnapshot = sanitizeSnapshot(draftSnapshot);
      const bootstrap = await loadAgencyBootstrap(supabase, agencyId);
      const existingAgencyName = resolveSnapshotValue(draftSnapshot, "bootstrap", "agency_name");
      const existingAgencyWebsite = getPathValue(draftSnapshot, "agency.website");
      if (bootstrap.name && (!isPopulated(existingAgencyName) || isPlaceholderAgencyName(existingAgencyName))) {
        draftSnapshot = mergeDraftSnapshot(draftSnapshot, {
          bootstrap: {
            agency_name: bootstrap.name,
          },
          agency: {
            name: bootstrap.name,
          },
        });
      }
      if (bootstrap.website && !isPopulated(existingAgencyWebsite)) {
        draftSnapshot = mergeDraftSnapshot(draftSnapshot, {
          agency: {
            website: bootstrap.website,
          },
        });
      }
      draftSnapshot = sanitizeSnapshot(draftSnapshot);
      if (payload.persona) {
        draftSnapshot = mergeDraftSnapshot(draftSnapshot, {
          persona: {
            assistant_name: payload.persona.assistant_name,
            tone_traits: payload.persona.tone_traits,
            expertise_traits: payload.persona.expertise_traits,
          },
        });
      }

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "onboarding.snapshot.load",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          scope,
          snapshot_keys: Object.keys(draftSnapshot).length,
        },
      });

      let userInput = pickUserInput(payload);
      // DETERMINISTIC ONBOARDING
      if (payload.reset_onboarding || placeholderDetected) {
        await supabase.from("ai_onboarding_turn_logs").delete().eq("onboarding_status_id", onboardingStatus.id);
        await supabase
          .from("ai_onboarding_status")
          .update({
            status: "not_started",
            last_step_id: null,
            completed_at: null,
            metadata: {},
          })
          .eq("id", onboardingStatus.id);
        draftSnapshot = {};
      }

      const statusMetadataSafe = asRecord(payload.reset_onboarding ? {} : statusMetadata);
      const skippedFields = asRecord(statusMetadataSafe.skipped_fields);
      const currentQuestionId = typeof statusMetadataSafe.current_question_id === "string"
        ? statusMetadataSafe.current_question_id
        : null;
      const currentQuestion = QUESTION_BANK.find((question) => question.id === currentQuestionId) ?? null;
      const lastAnsweredField = typeof statusMetadataSafe.last_answered_field === "string"
        ? statusMetadataSafe.last_answered_field
        : null;
      const followupCounts = asRecord(statusMetadataSafe.followup_counts);
      const pendingP0Confirm =
        typeof statusMetadataSafe.pending_p0_confirm === "string"
          ? (statusMetadataSafe.pending_p0_confirm as string)
          : null;
      const unresolvedP0 = Array.isArray(statusMetadataSafe.unresolved_p0)
        ? (statusMetadataSafe.unresolved_p0 as string[])
        : [];

      if (payload.undo_last && lastAnsweredField) {
        setPathValue(draftSnapshot, lastAnsweredField, null);
        if (skippedFields[lastAnsweredField]) {
          delete skippedFields[lastAnsweredField];
        }
        draftSnapshot = sanitizeSnapshot(draftSnapshot);
        const question = QUESTION_BANK.find((entry) => entry.field_path === lastAnsweredField);
        if (question) {
          const progress = countRequiredComplete(draftSnapshot);
          const responsePayload = buildDeterministicResponse({
            question,
            snapshot: draftSnapshot,
            traceId,
            onboardingStatus: {
              id: onboardingStatus.id,
              status: progress.requiredComplete ? "complete" : "in_progress",
              scope,
              last_step_id: question.module,
              started_at: onboardingStatus.started_at ?? null,
              completed_at: progress.requiredComplete ? new Date().toISOString() : null,
            },
            requiredComplete: progress.requiredComplete,
            currentIndex: Math.min(progress.complete + 1, progress.total),
            totalRequired: progress.total,
          });

          const parsedResponse = responseSchema.safeParse(responsePayload);
          if (!parsedResponse.success) {
            return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
          }

          await supabase
            .from("ai_onboarding_status")
            .update({
              status: responsePayload.onboarding_status.status,
              last_step_id: question.module,
              completed_at: responsePayload.onboarding_status.completed_at,
              metadata: {
                ...statusMetadataSafe,
                draft_brain_json: draftSnapshot,
                skipped_fields: skippedFields,
                current_question_id: question.id,
                last_answered_field: lastAnsweredField,
                required_complete: progress.requiredComplete,
              },
            })
            .eq("id", onboardingStatus.id);

          return jsonResponse(req, parsedResponse.data, 200);
        }
      }

      if (
        userInput &&
        currentQuestion &&
        !payload.skip_optional &&
        !payload.skip_all_optional &&
        !payload.undo_last
      ) {
        let forceAccept = false;
        if (
          pendingP0Confirm &&
          pendingP0Confirm === currentQuestion.field_path &&
          /^(continue|skip|move on)/i.test(userInput.trim())
        ) {
          if (currentQuestion.priority === "P0" && !unresolvedP0.includes(currentQuestion.field_path)) {
            unresolvedP0.push(currentQuestion.field_path);
            observedUnresolvedP0Count = unresolvedP0.length;
          }
          userInput = "I do not know";
          setPathValue(draftSnapshot, currentQuestion.field_path, userInput);
          draftSnapshot = sanitizeSnapshot(draftSnapshot);
          statusMetadataSafe.pending_p0_confirm = null;
          forceAccept = true;
        }

        const localCheck = forceAccept
          ? { decision: "accept" as const }
          : validateAnswerLocally(currentQuestion, userInput);
        const followupCount =
          typeof followupCounts[currentQuestion.field_path] === "number"
            ? (followupCounts[currentQuestion.field_path] as number)
            : 0;
        const allowHybrid = readEnvFlag("AI_ONBOARDING_HYBRID", "true");
        const validateAlways = readEnvFlag("AI_ONBOARDING_VALIDATE_ALWAYS", "true");
        let llmDecision: "accept" | "follow_up" | null = null;
        let llmFollowUp: string | null = null;

        if (allowHybrid && validateAlways && !forceAccept) {
          try {
            const checkResult = await runAnswerCheck({
              question: currentQuestion,
              answer: userInput,
              agencyId,
              clientId,
              userId: user.id,
              supabase,
            });
            llmDecision = checkResult.decision;
            llmFollowUp = checkResult.followUp;
            observedValidationDecision = llmDecision;
          } catch (error) {
            console.error("onboarding_answer_check_failed", {
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        const shouldFollowUp =
          !forceAccept &&
          (localCheck.decision === "follow_up" ||
            (allowHybrid && validateAlways && llmDecision === "follow_up") ||
            userInput.includes("?"));

        let allowFollowUp = shouldFollowUp;
        if (shouldFollowUp) {
          let clarificationText: string | null = null;
          if (allowHybrid && validateAlways) {
            try {
              const clarifyStart = Date.now();
              const ragContext = await fetchClarifyRagContext({
                token,
                agencyId,
                clientId,
                questionText: currentQuestion.question_text,
                userMessage: userInput,
              });
              const clarify = await runClarifyCheck({
                question: currentQuestion,
                answer: userInput,
                agencyId,
                clientId,
                userId: user.id,
                supabase,
                ragContext,
              });
              await logOtelSpan(supabase, {
                traceId,
                spanId: generateSpanId(),
                parentSpanId: rootSpanId,
                stage: "onboarding.clarify",
                taskType: TaskType.ONBOARDING_CLARIFY,
                agencyId,
                clientId,
                userId: user.id,
                latencyMs: Date.now() - clarifyStart,
                attributes: {
                  fn_version: FN_VERSION,
                  request_id: payload.client_turn_id ?? null,
                  rag_context_len: ragContext.length,
                  clarify_mode: clarify.mode,
                },
              });
              if (clarify.mode === "answer_and_continue") {
                allowFollowUp = false;
              } else {
                clarificationText = clarify.clarify;
                if (clarify.followUp) {
                  llmFollowUp = clarify.followUp;
                }
              }
            } catch (error) {
              console.error("onboarding_clarify_failed", {
                message: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (!allowFollowUp) {
            // proceed without follow-up
          } else if (followupCount >= 2) {
            if (currentQuestion.priority === "P0") {
              const progress = countRequiredComplete(draftSnapshot);
              const followUpMessage =
                llmFollowUp ??
                "I can continue without this, but it may reduce accuracy. Reply \"continue\" to move on or share a best-effort answer.";
              const assistantMessage = clarificationText
                ? `${clarificationText} ${followUpMessage}`
                : followUpMessage;
              const responsePayload = buildDeterministicResponse({
                question: currentQuestion,
                snapshot: draftSnapshot,
                traceId,
                onboardingStatus: {
                  id: onboardingStatus.id,
                  status: progress.requiredComplete ? "complete" : "in_progress",
                  scope,
                  last_step_id: currentQuestion.module,
                  started_at: onboardingStatus.started_at ?? null,
                  completed_at: progress.requiredComplete ? new Date().toISOString() : null,
                },
                requiredComplete: progress.requiredComplete,
                currentIndex: Math.min(progress.complete + 1, progress.total),
                totalRequired: progress.total,
                assistantMessage,
              });

              const parsedResponse = responseSchema.safeParse(responsePayload);
              if (!parsedResponse.success) {
                return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
              }

              await supabase
                .from("ai_onboarding_status")
                .update({
                  status: responsePayload.onboarding_status.status,
                  last_step_id: currentQuestion.module,
                  completed_at: responsePayload.onboarding_status.completed_at,
                  metadata: {
                    ...statusMetadataSafe,
                    draft_brain_json: draftSnapshot,
                    skipped_fields: skippedFields,
                    current_question_id: currentQuestion.id,
                    last_answered_field: lastAnsweredField,
                    required_complete: progress.requiredComplete,
                    followup_counts: followupCounts,
                    unresolved_p0: unresolvedP0,
                    pending_p0_confirm: currentQuestion.field_path,
                    last_clarify_reason: "llm",
                    last_clarify_text: assistantMessage,
                  },
                })
                .eq("id", onboardingStatus.id);

              return jsonResponse(req, parsedResponse.data, 200);
            }

            if (currentQuestion.priority === "P0" && !unresolvedP0.includes(currentQuestion.field_path)) {
              unresolvedP0.push(currentQuestion.field_path);
              observedUnresolvedP0Count = unresolvedP0.length;
            }
          } else {
            followupCounts[currentQuestion.field_path] = followupCount + 1;
            observedFollowupCount = followupCounts[currentQuestion.field_path] as number;
            const progress = countRequiredComplete(draftSnapshot);
            const followUpMessage =
              localCheck.decision === "follow_up"
                ? localCheck.message
                : llmFollowUp ?? "Can you share a bit more detail so I can capture it correctly?";
            const assistantMessage = clarificationText
              ? `${clarificationText} ${followUpMessage}`
              : followUpMessage;
            const responsePayload = buildDeterministicResponse({
              question: currentQuestion,
              snapshot: draftSnapshot,
              traceId,
              onboardingStatus: {
                id: onboardingStatus.id,
                status: progress.requiredComplete ? "complete" : "in_progress",
                scope,
                last_step_id: currentQuestion.module,
                started_at: onboardingStatus.started_at ?? null,
                completed_at: progress.requiredComplete ? new Date().toISOString() : null,
              },
              requiredComplete: progress.requiredComplete,
              currentIndex: Math.min(progress.complete + 1, progress.total),
              totalRequired: progress.total,
              assistantMessage,
            });

            const parsedResponse = responseSchema.safeParse(responsePayload);
            if (!parsedResponse.success) {
              return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
            }

            await supabase
              .from("ai_onboarding_status")
              .update({
                status: responsePayload.onboarding_status.status,
                last_step_id: currentQuestion.module,
                completed_at: responsePayload.onboarding_status.completed_at,
                metadata: {
                  ...statusMetadataSafe,
                  draft_brain_json: draftSnapshot,
                  skipped_fields: skippedFields,
                  current_question_id: currentQuestion.id,
                  last_answered_field: lastAnsweredField,
                  required_complete: progress.requiredComplete,
                  followup_counts: followupCounts,
                  unresolved_p0: unresolvedP0,
                  last_clarify_reason: shouldFollowUp ? (localCheck.decision === "follow_up" ? "deterministic" : "llm") : null,
                  last_clarify_text: assistantMessage,
                },
              })
              .eq("id", onboardingStatus.id);

            return jsonResponse(req, parsedResponse.data, 200);
          }
        }
      }

      if (userInput && currentQuestion) {
        const { module, path } = splitFieldPath(currentQuestion.field_path);
        if (payload.skip_optional && currentQuestion.priority !== "P0") {
          skippedFields[currentQuestion.field_path] = true;
        } else {
          draftSnapshot = applyCalibrationInput(draftSnapshot, module, path, userInput);
        }
      } else if (payload.skip_optional && currentQuestion && currentQuestion.priority !== "P0") {
        skippedFields[currentQuestion.field_path] = true;
      }

      if (payload.skip_all_optional) {
        for (const entry of QUESTION_BANK) {
          if (entry.priority !== "P0") {
            skippedFields[entry.field_path] = true;
          }
        }
      }

      draftSnapshot = sanitizeSnapshot(draftSnapshot);

      const nextQuestion = getNextQuestion(draftSnapshot, skippedFields as Record<string, boolean>);
      const progress = countRequiredComplete(draftSnapshot);
      const nextStatus = progress.requiredComplete ? "complete" : "in_progress";

      if (!nextQuestion) {
        const completedPayload = {
          v: FN_VERSION,
          trace_id: traceId,
          onboarding_status: {
            id: onboardingStatus.id,
            status: "complete" as const,
            scope,
            last_step_id: onboardingStatus.last_step_id ?? null,
            started_at: onboardingStatus.started_at ?? null,
            completed_at: new Date().toISOString(),
          },
          assistant_message: "Onboarding complete. You can continue optional details later.",
          expects: "text",
          suggestions: ["Continue later", "Review my answers", "Invite a teammate"],
          priority: "P2" as const,
          input_type: "text" as const,
          can_skip: true,
          progress: {
            required_complete: true,
            current_index: progress.complete,
            total_required: progress.total,
          },
          unknown: false,
          brain_snapshot: draftSnapshot,
          state: {
            module: "bootstrap",
            resolver_state: "ready" as const,
          },
        };

        const parsedComplete = responseSchema.safeParse(completedPayload);
        if (!parsedComplete.success) {
          return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
        }

        await supabase
          .from("ai_onboarding_status")
          .update({
            status: "complete",
            last_step_id: null,
            completed_at: completedPayload.onboarding_status.completed_at,
            metadata: {
              ...statusMetadataSafe,
              draft_brain_json: draftSnapshot,
              skipped_fields: skippedFields,
              current_question_id: null,
              required_complete: true,
              followup_counts: followupCounts,
              unresolved_p0: unresolvedP0,
            },
          })
          .eq("id", onboardingStatus.id);

        return jsonResponse(req, parsedComplete.data, 200);
      }

      const responsePayload = buildDeterministicResponse({
        question: nextQuestion,
        snapshot: draftSnapshot,
        traceId,
        onboardingStatus: {
          id: onboardingStatus.id,
          status: nextStatus,
          scope,
          last_step_id: nextQuestion.module,
          started_at: onboardingStatus.started_at ?? null,
          completed_at: nextStatus === "complete" ? new Date().toISOString() : null,
        },
        requiredComplete: progress.requiredComplete,
        currentIndex: Math.min(progress.complete + 1, progress.total),
        totalRequired: progress.total,
      });

      const parsedResponse = responseSchema.safeParse(responsePayload);
      if (!parsedResponse.success) {
        return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
      }

      await supabase
        .from("ai_onboarding_status")
        .update({
          status: nextStatus,
          last_step_id: nextQuestion.module,
          completed_at: responsePayload.onboarding_status.completed_at,
          metadata: {
            ...statusMetadataSafe,
            draft_brain_json: draftSnapshot,
            skipped_fields: skippedFields,
            current_question_id: nextQuestion.id,
            last_answered_field: currentQuestion?.field_path ?? lastAnsweredField,
            required_complete: progress.requiredComplete,
            followup_counts: followupCounts,
            unresolved_p0: unresolvedP0,
          },
        })
        .eq("id", onboardingStatus.id);

      return jsonResponse(req, parsedResponse.data, 200);

      /*
      const fastMode = (Deno.env.get("AI_ONBOARDING_FAST") ?? "true") === "true";
      let classifierJson: Record<string, unknown> | null = null;
      let plannerJson: Record<string, unknown> | null = null;
      if (!fastMode && userInput) {
        const classifyResult = await runAiTask({
          task_type: TaskType.CLASSIFY_INTENT,
          tenant: {
            agency_id: agencyId,
            client_id: clientId ?? undefined,
            user_id: user.id,
          },
          input: { message: userInput },
          supabase,
        });
        classifierJson = asRecord(classifyResult.json);

        const plannerIntent =
          typeof classifierJson.intent === "string"
            ? classifierJson.intent
            : typeof classifierJson.mode === "string"
            ? classifierJson.mode
            : undefined;

        const plannerResult = await runAiTask({
          task_type: TaskType.PLANNER,
          tenant: {
            agency_id: agencyId,
            client_id: clientId ?? undefined,
            user_id: user.id,
          },
          input: { message: userInput },
          metadata: { intent: plannerIntent },
          supabase,
        });
        plannerJson = asRecord(plannerResult.json);
      }

      const resolverRouter = createAiRouter({ useBrainResolver: true });
      const resolverRunStarted = Date.now();
      let guidedRun = await resolverRouter.run({
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        input: userInput,
        context: {
          agencyId,
          clientId: clientId ?? undefined,
          userId: user.id,
          environment: "prod",
          supabase,
          skipUsageLog: true,
        },
        metadata: {
          contextSnapshot: draftSnapshot,
          latestUserMessage: userInput,
          conversation,
        },
      });

      await writeAiRun(supabase, {
        agencyId,
        clientId,
        userId: user.id,
        model: guidedRun.meta?.model ?? "unknown",
        tokensIn: guidedRun.usage?.inputTokens ?? 0,
        tokensOut: guidedRun.usage?.outputTokens ?? 0,
        latencyMs: Date.now() - resolverRunStarted,
        unknown: guidedRun.unknown ?? false,
        success: !guidedRun.error,
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        errorCode: guidedRun.error ?? null,
        traceId,
        spanId: rootSpanId,
        requestId: payload.client_turn_id ?? null,
        moduleKey: initialProgress.currentModule,
        resolverState: "ready",
        schemaOk: (guidedRun as Record<string, unknown>).schemaOk !== false,
        repairAttempted: (guidedRun as Record<string, unknown>).schemaOk === false,
        repairSuccess: (guidedRun as Record<string, unknown>).schemaOk === false ? true : null,
      });

      let resolverState: "ready" | "calibration_needed" | "unknown" = "ready";
      let missingFields: string[] = [];
      let activeModule: OnboardingModuleKey = initialProgress.currentModule;

      if (guidedRun.calibrationNeeded) {
        resolverState = "calibration_needed";
        const unresolved = guidedRun.calibrationNeeded.missingFields.filter((missing) => {
          const value = resolveSnapshotValue(draftSnapshot, missing.module, missing.fieldPath);
          return !isPopulated(value);
        });
        missingFields = unresolved.map((missing) => `${missing.module}.${missing.fieldPath}`);

        if (userInput && unresolved.length > 0) {
          const firstMissing = unresolved[0];
          draftSnapshot = applyCalibrationInput(draftSnapshot, firstMissing.module, firstMissing.fieldPath, userInput);
          draftSnapshot = sanitizeSnapshot(draftSnapshot);
        }

        const postInputUnresolved = unresolved.filter((missing) => {
          const value = resolveSnapshotValue(draftSnapshot, missing.module, missing.fieldPath);
          return !isPopulated(value);
        });

        if (postInputUnresolved.length === 0) {
          const fallbackRouter = createAiRouter({ useBrainResolver: false });
          const fallbackStartedAt = Date.now();
          guidedRun = await fallbackRouter.run({
            taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
            input: userInput,
            context: {
              agencyId,
              clientId: clientId ?? undefined,
              userId: user.id,
              environment: "prod",
              supabase,
              skipUsageLog: true,
            },
            metadata: {
              contextSnapshot: draftSnapshot,
              latestUserMessage: userInput,
              conversation,
            },
          });

          await writeAiRun(supabase, {
            agencyId,
            clientId,
            userId: user.id,
            model: guidedRun.meta?.model ?? "unknown",
            tokensIn: guidedRun.usage?.inputTokens ?? 0,
            tokensOut: guidedRun.usage?.outputTokens ?? 0,
            latencyMs: Date.now() - fallbackStartedAt,
            unknown: guidedRun.unknown ?? false,
            success: !guidedRun.error,
            taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
            errorCode: guidedRun.error ?? null,
            traceId,
            spanId: rootSpanId,
            requestId: payload.client_turn_id ?? null,
            moduleKey: activeModule,
            resolverState: "ready",
            schemaOk: (guidedRun as Record<string, unknown>).schemaOk !== false,
            repairAttempted: (guidedRun as Record<string, unknown>).schemaOk === false,
            repairSuccess: (guidedRun as Record<string, unknown>).schemaOk === false ? true : null,
          });

          resolverState = "ready";
          missingFields = [];
        } else {
          const nextProgress = evaluateOnboardingProgress(draftSnapshot);
          activeModule = nextProgress.currentModule;
          const requestedQuestion =
            guidedRun.calibrationNeeded.questions[0] ?? "Please provide the missing detail.";
          const desiredField = postInputUnresolved[0];
          const lastQuestionHash = typeof statusMetadata.last_question_hash === "string"
            ? statusMetadata.last_question_hash
            : null;
          const nextQuestionHash = await hashText(`${activeModule}:${requestedQuestion}:${desiredField?.fieldPath ?? ""}`);
          let finalQuestion = personalizeCalibrationQuestion(requestedQuestion, draftSnapshot);
          let finalField = desiredField;

          if (userInput && lastQuestionHash && lastQuestionHash === nextQuestionHash) {
            const alternative = postInputUnresolved[1];
            if (alternative) {
              finalQuestion = personalizeCalibrationQuestion(
                alternative.calibrationQuestion ?? "Please provide the missing detail.",
                draftSnapshot
              );
              finalField = alternative;
            } else {
              finalQuestion = `One more detail is needed: ${finalQuestion}`;
            }
          }

          const calibrationResponse = {
            v: FN_VERSION,
            trace_id: traceId,
            onboarding_status: {
              id: onboardingStatus.id,
              status: "in_progress" as const,
              scope,
              last_step_id: onboardingStatus.last_step_id ?? null,
              started_at: onboardingStatus.started_at ?? null,
              completed_at: onboardingStatus.completed_at ?? null,
            },
            assistant_message: finalQuestion,
            expects: "text",
            suggestions: normalizeOnboardingSuggestions({
              module: activeModule,
              fieldPath: finalField?.fieldPath ?? null,
              snapshot: draftSnapshot,
            }),
            unknown: false,
            brain_snapshot: draftSnapshot,
            state: {
              module: activeModule,
              resolver_state: resolverState,
              missing_fields: postInputUnresolved.map((missing) => `${missing.module}.${missing.fieldPath}`),
            },
          };

          const parsedCalibration = responseSchema.safeParse(calibrationResponse);
          if (!parsedCalibration.success) {
            return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
          }

          const nextIndex = await getLatestTurnIndex(supabase, onboardingStatus.id);
          await supabase.from("ai_onboarding_turn_logs").insert({
            agency_id: agencyId,
            client_id: clientId,
            onboarding_status_id: onboardingStatus.id,
            scope,
            turn_index: nextIndex,
            step_id: activeModule,
            user_message: userInput || null,
            assistant_message: parsedCalibration.data.assistant_message,
            messages_json: recentTurns,
            snapshot_json: {
              draft_brain_json: draftSnapshot,
              resolver_state: resolverState,
              classifier: classifierJson,
              planner: plannerJson,
            },
            response_json: parsedCalibration.data,
            trace_id: traceId,
            span_id: rootSpanId,
            source_endpoint: "ai-onboarding",
            created_by: user.id,
            client_turn_id: payload.client_turn_id ?? null,
          });

          await supabase
            .from("ai_onboarding_status")
            .update({
              status: "in_progress",
              last_step_id: activeModule,
              metadata: {
                ...statusMetadata,
                draft_brain_json: draftSnapshot,
                last_question_hash: await hashText(`${activeModule}:${finalQuestion}:${finalField?.fieldPath ?? ""}`),
                last_question_field: finalField?.fieldPath ?? null,
                state_machine: {
                  ...nextProgress,
                },
                resolver_state: resolverState,
                classifier: classifierJson,
                planner: plannerJson,
              },
            })
            .eq("id", onboardingStatus.id);

          return jsonResponse(req, parsedCalibration.data, 200);
        }
      }

      observedModule = activeModule;
      observedResolverState = resolverState;
      observedMissingFieldsCount = missingFields.length;
      observedRepairAttempted = (guidedRun as Record<string, unknown>).schemaOk === false;
      observedRepairSuccess = observedRepairAttempted ? true : null;

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "onboarding.resolver",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          module_key: activeModule,
          state: resolverState,
          missing_fields_count: missingFields.length,
          calibration_needed: resolverState === "calibration_needed",
          schema_ok: (guidedRun as Record<string, unknown>).schemaOk !== false,
          repair_attempted: observedRepairAttempted,
          repair_success: observedRepairSuccess,
        },
      });

      const guidedOutput = asRecord(guidedRun.output);
      const memoryPatch = asRecord(guidedOutput.memory_patch);
      draftSnapshot = mergeDraftSnapshot(draftSnapshot, memoryPatch);
      draftSnapshot = sanitizeSnapshot(draftSnapshot);
      const nextProgress = evaluateOnboardingProgress(draftSnapshot);
      activeModule = nextProgress.currentModule;

      const rawSuggestions = Array.isArray(guidedOutput.suggestions) ? guidedOutput.suggestions : [];
      const suggestedField = nextProgress.missingByModule[activeModule]?.[0] ?? null;
      const normalizedSuggestions = normalizeOnboardingSuggestions({
        rawSuggestions,
        module: activeModule,
        fieldPath: suggestedField,
        snapshot: draftSnapshot,
      });
      observedSuggestionCount = normalizedSuggestions.length;
      observedSuggestionFallback = rawSuggestions.length === 0;

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "onboarding.suggestions",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          module_key: activeModule,
          suggestions_count: normalizedSuggestions.length,
          suggestions_fallback: observedSuggestionFallback,
          suggestions_filtered_count: Math.max(0, rawSuggestions.length - normalizedSuggestions.length),
        },
      });

      const assistantMessage =
        typeof guidedOutput.assistant_message === "string" && guidedOutput.assistant_message.trim().length > 0
          ? guidedOutput.assistant_message.trim()
          : sanitizeMessage(guidedRun.text, 2000) || "Please share the next onboarding detail.";

      const expects =
        typeof guidedOutput.expects === "string" && guidedOutput.expects.trim().length > 0
          ? guidedOutput.expects
          : "text";

      const unknownPayload =
        guidedRun.unknown || guidedRun.text === "UNKNOWN"
          ? buildUnknownTurnPayload({
              reason: guidedRun.error ?? "router_unknown",
              snapshot: draftSnapshot,
              module: activeModule,
            })
          : null;

      const completionSnapshotHash = await hashSnapshot(draftSnapshot);
      const completionIngest = asRecord(statusMetadata.completion_ingest) as CompletionIngestState;
      const shouldComplete = nextProgress.requiredComplete && !unknownPayload;
      let finalStatusValue: "complete" | "in_progress" = shouldComplete ? "complete" : "in_progress";
      let completionIngestState: CompletionIngestState = completionIngest;
      if (shouldComplete) {
        const needsIngest =
          completionIngest.status !== "ok" || completionIngest.snapshot_hash !== completionSnapshotHash;
        if (needsIngest) {
          try {
            await runCompletionIngest({
              token,
              agencyId,
              clientId,
              scope,
              snapshot: draftSnapshot,
            });
            completionIngestState = {
              status: "ok",
              at: new Date().toISOString(),
              snapshot_hash: completionSnapshotHash,
              scope,
            };
            observedIngestStatus = "ok";
          } catch (completionError) {
            completionIngestState = {
              status: "failed",
              at: new Date().toISOString(),
              snapshot_hash: completionSnapshotHash,
              scope,
              error: completionError instanceof Error ? completionError.message : String(completionError),
            };
            finalStatusValue = "in_progress";
            observedIngestStatus = "failed";
          }
        } else {
          completionIngestState = {
            ...completionIngest,
            status: "ok",
            snapshot_hash: completionSnapshotHash,
            scope,
          };
          observedIngestStatus = "ok";
        }

        await logOtelSpan(supabase, {
          traceId,
          spanId: generateSpanId(),
          parentSpanId: rootSpanId,
          stage: "onboarding.ingest",
          taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
          agencyId,
          clientId,
          userId,
          latencyMs: 0,
          attributes: {
            fn_version: FN_VERSION,
            request_id: payload.client_turn_id ?? null,
            module_key: activeModule,
            ingest_status: observedIngestStatus,
            scope,
          },
        });
      }

      const lastQuestionHash = typeof statusMetadata.last_question_hash === "string"
        ? statusMetadata.last_question_hash
        : null;
      const nextQuestionHash = await hashText(`${activeModule}:${assistantMessage}:${missingFields[0] ?? ""}`);
      const avoidRepeat = userInput && lastQuestionHash && lastQuestionHash === nextQuestionHash;
      const finalAssistantMessage = avoidRepeat
        ? `${assistantMessage} (Please include one concrete detail so we can move on.)`
        : assistantMessage;

      const finalPayload = unknownPayload
        ? {
            v: FN_VERSION,
            trace_id: traceId,
            onboarding_status: {
              id: onboardingStatus.id,
              status: finalStatusValue,
              scope,
              last_step_id: activeModule,
              started_at: onboardingStatus.started_at ?? null,
              completed_at: finalStatusValue === "complete" ? new Date().toISOString() : null,
            },
            ...unknownPayload,
          }
        : {
            v: FN_VERSION,
            trace_id: traceId,
            onboarding_status: {
              id: onboardingStatus.id,
              status: finalStatusValue,
              scope,
              last_step_id: activeModule,
              started_at: onboardingStatus.started_at ?? null,
              completed_at: finalStatusValue === "complete" ? new Date().toISOString() : null,
            },
            assistant_message: finalAssistantMessage,
            expects,
            suggestions: normalizedSuggestions,
            unknown: false,
            brain_snapshot: draftSnapshot,
            state: {
              module: activeModule,
              resolver_state: resolverState,
              missing_fields: missingFields,
            },
          };

      const parsedResponse = responseSchema.safeParse(finalPayload);
      if (!parsedResponse.success) {
        return jsonResponse(req, { error: "Invalid response contract", v: FN_VERSION }, 500);
      }

      if (shouldComplete && finalStatusValue !== "complete") {
        const message =
          completionIngestState.error ??
          "Onboarding completion is blocked until final Agency Brain ingest succeeds.";
        return jsonResponse(
          req,
          {
            error: "ONBOARDING_COMPLETION_INGEST_FAILED",
            message,
            v: FN_VERSION,
          },
          502
        );
      }

      const nextIndex = await getLatestTurnIndex(supabase, onboardingStatus.id);
      const insertLog = await supabase.from("ai_onboarding_turn_logs").insert({
        agency_id: agencyId,
        client_id: clientId,
        onboarding_status_id: onboardingStatus.id,
        scope,
        turn_index: nextIndex,
        step_id: activeModule,
        user_message: userInput || null,
        assistant_message: parsedResponse.data.assistant_message,
        messages_json: recentTurns,
        snapshot_json: {
          draft_brain_json: draftSnapshot,
          resolver_state: resolverState,
          classifier: classifierJson,
          planner: plannerJson,
        },
        response_json: parsedResponse.data,
        trace_id: traceId,
        span_id: rootSpanId,
        source_endpoint: "ai-onboarding",
        created_by: user.id,
        client_turn_id: payload.client_turn_id ?? null,
      });

      if (insertLog.error && payload.client_turn_id && insertLog.error.message?.toLowerCase().includes("duplicate")) {
        const replay = await getReplayByClientTurnId(supabase, onboardingStatus.id, payload.client_turn_id);
        if (replay) {
          return jsonResponse(req, { ...replay, idempotent_replay: true }, 200);
        }
      }

      const promptCacheVersion =
        finalStatusValue === "complete"
          ? `persona_reload_${completionSnapshotHash.slice(0, 12)}_${Date.now()}`
          : (statusMetadata.prompt_cache_version as string | undefined) ?? null;
      observedStatus = finalStatusValue;
      observedCacheInvalidated = finalStatusValue === "complete";

      await supabase
        .from("ai_onboarding_status")
        .update({
          status: finalStatusValue,
          completed_at: finalStatusValue === "complete" ? new Date().toISOString() : null,
          last_step_id: activeModule,
          metadata: {
            ...statusMetadata,
            draft_brain_json: draftSnapshot,
            completion_ingest: completionIngestState,
            prompt_cache_version: promptCacheVersion,
            prompt_cache_invalidated_at: finalStatusValue === "complete" ? new Date().toISOString() : null,
            prompt_cache_scope: scope,
            last_question_hash: await hashText(`${activeModule}:${finalAssistantMessage}:${missingFields[0] ?? ""}`),
            last_question_field: missingFields[0] ?? null,
            state_machine: {
              ...nextProgress,
            },
            resolver_state: resolverState,
            classifier: classifierJson,
            planner: plannerJson,
          },
        })
        .eq("id", onboardingStatus.id);

      await logOtelSpan(supabase, {
        traceId,
        spanId: generateSpanId(),
        parentSpanId: rootSpanId,
        stage: "onboarding.persist",
        taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
        agencyId,
        clientId,
        userId,
        latencyMs: 0,
        attributes: {
          fn_version: FN_VERSION,
          request_id: payload.client_turn_id ?? null,
          module_key: activeModule,
          persist_action: finalStatusValue === "complete" ? "status_complete" : "draft_write",
          cache_invalidated: observedCacheInvalidated,
          onboarding_status: finalStatusValue,
        },
      });

      return jsonResponse(req, parsedResponse.data, 200);
      */
    } catch (error) {
      return jsonResponse(
        req,
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : String(error),
          v: FN_VERSION,
        },
        500
      );
    }
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId: rootSpanId,
    stage: "edge.ai-onboarding.turn_end",
    taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
    agencyId,
    clientId: clientId ?? null,
    userId,
    latencyMs: Date.now() - requestStartedAt,
    attributes: {
      http_status: response?.status ?? 0,
      endpoint: "ai-onboarding",
      version: FN_VERSION,
      request_id: observedRequestId,
      module_key: observedModule,
      state: observedResolverState,
      missing_fields_count: observedMissingFieldsCount,
      suggestions_count: observedSuggestionCount,
      suggestions_fallback: observedSuggestionFallback,
      repair_attempted: observedRepairAttempted,
      repair_success: observedRepairSuccess,
      ingest_status: observedIngestStatus,
      cache_invalidated: observedCacheInvalidated,
      onboarding_status: observedStatus,
      llm_validation_decision: observedValidationDecision,
      followup_count: observedFollowupCount,
      unresolved_p0_count: observedUnresolvedP0Count,
    },
  });

  return response!;
});
