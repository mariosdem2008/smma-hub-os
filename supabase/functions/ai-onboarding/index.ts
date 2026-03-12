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
  normalizeOnboardingSuggestions,
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
import { getV5ProgressSummary } from "../../../src/lib/onboarding/progress.ts";

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

const v2RequestSchema = z.object({
  version: z.literal("v2"),
  agency_id: z.string().uuid(),
  client_id: z.string().uuid(),
  client_turn_id: z.string().trim().min(1).max(120),
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string().trim().min(1).max(4000) })).min(1),
  current_state_version: z.string().nullable().optional(),
  ui_context: z
    .object({
      locale: z.string().trim().min(2).max(32).optional(),
      timezone: z.string().trim().min(1).max(120).optional(),
      user_confidence: z.enum(["high", "medium", "low"]).optional(),
    })
    .optional(),
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

function classifyV2Intent(input: string): "direct_answer" | "question" | "help_request" | "vague_answer" | "off_topic" {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "vague_answer";
  if (/\b(weather|football|soccer|movie|song|recipe|crypto|bitcoin|politics|news)\b/.test(normalized)) {
    return "off_topic";
  }
  if (
    /\b(help me|can you help|suggest|draft|recommend|example|what should i|how do i|create it for me|can you create|create .* for me|build .* for me|write .* for me|persona for me)\b/.test(
      normalized
    )
  ) {
    return "help_request";
  }
  if (normalized.length < 8 || /\b(idk|don't know|dont know|not sure|whatever|maybe|hmm)\b/.test(normalized)) {
    return "vague_answer";
  }
  if (normalized.includes("?") || /^(what|why|how|when|where|which)\b/.test(normalized)) {
    return "question";
  }
  return "direct_answer";
}

function v2SuggestionPool(state: Record<string, unknown>): string[] {
  const primaryCustomer = typeof state.primary_customer === "string" ? state.primary_customer : null;
  const industry = typeof state.industry_niche === "string" ? state.industry_niche : null;
  const goal = typeof state.primary_goal === "string" ? state.primary_goal : null;
  const seeded = [
    primaryCustomer && industry ? `${primaryCustomer} in ${industry}` : null,
    goal ? `Primary goal: ${goal}` : null,
    "Local service businesses, budget 1500 EUR/mo, goal is lead growth",
    "B2B founders, budget 3000 EUR/mo, goal is demo bookings",
    "Ecommerce stores, budget 2500 EUR/mo, goal is higher conversion sales",
  ].filter(Boolean) as string[];

  return Array.from(new Set(seeded)).slice(0, 4);
}

function toFieldLabel(field: string | undefined) {
  if (!field) return "next onboarding field";
  const labels: Record<string, string> = {
    q1_business_name: "business name",
    q2_website_or_socials: "website or primary social",
    industry_niche: "industry / niche",
    q3_market_scope: "market scope",
    q3_geo: "country and city",
    q4_languages: "client languages",
    primary_goal: "primary goal",
    conversion_path: "conversion path",
    conversion_link_required: "conversion link",
    dm_keyword_required: "DM keyword",
    offers: "core offer",
    primary_customer: "primary customer",
    q9_pain_points: "pain points",
    platforms: "channels",
    cadence_requirement: "posting cadence",
    brand_voice: "brand voice",
    content_style: "content style",
  };
  return labels[field] ?? field.replace(/_/g, " ");
}

function getPrimaryCustomerDraftFromState(state: Record<string, unknown>) {
  const niche = typeof state.industry_niche === "string" ? state.industry_niche : "";
  if (niche === "clinic_medical") return "Private clinics and dentists seeking more qualified consultations";
  if (niche === "saas_tech") return "B2B SaaS founders seeking more qualified demo calls";
  if (niche === "restaurant_cafe") return "Local restaurant owners focused on table bookings and repeat visits";
  if (niche === "gym_fitness_studio") return "Gym owners targeting consistent member signups each month";
  return "Local business owners with small teams who need predictable lead flow";
}

function buildDraftForMissingField(field: string | undefined, state: Record<string, unknown>): Record<string, unknown> {
  switch (field) {
    case "q1_business_name":
      return { q1_business_name: "Starter Client Profile" };
    case "q2_website_or_socials":
      return { q2_social_links: ["https://instagram.com/examplebrand"] };
    case "industry_niche":
      return { industry_niche: "gym_fitness_studio" };
    case "q3_market_scope":
      return { q3_market_scope: "local" };
    case "q3_geo":
      return {
        q3_country: typeof state.q3_country === "string" ? state.q3_country : "United States",
        q3_city: typeof state.q3_city === "string" ? state.q3_city : "Austin, TX",
      };
    case "q4_languages":
      return { q4_languages: ["english"] };
    case "primary_goal":
      return { primary_goal: "more_leads" };
    case "conversion_path":
      return { conversion_path: "book_call" };
    case "conversion_link_required":
      return { conversion_link: "https://calendly.com/intro-call" };
    case "dm_keyword_required":
      return { dm_keyword: "BOOK" };
    case "offers":
      return {
        offers: [{ type: "best_seller", name: "Signature Service", promise: "results_focused", price_min: 1200, price_max: 1800 }],
        q6_offer_name: "Signature Service",
      };
    case "primary_customer":
      return {
        audience_type: "local_consumers",
        primary_customer: getPrimaryCustomerDraftFromState(state),
      };
    case "q9_pain_points":
      return { q9_pain_points: ["Not enough customers/leads", "Low trust / weak reputation", "Inconsistent content"] };
    case "platforms":
      return {
        platforms: ["instagram", "tiktok"],
        q16_enabled_channels: ["instagram", "tiktok"],
        formats: ["short_video", "carousels"],
      };
    case "cadence_requirement":
      return {
        cadence_preset: "standard",
        cadence_per_platform: { instagram: 5, tiktok: 5 },
        q18_cadence: { instagram: 5, tiktok: 5 },
      };
    case "brand_voice":
      return { brand_voice: ["friendly", "educational"] };
    case "content_style":
      return { content_style: ["educational_tips"] };
    default:
      return {};
  }
}

function buildIntentAwareSuggestions(params: {
  intent: "direct_answer" | "question" | "help_request" | "vague_answer" | "off_topic";
  state: Record<string, unknown>;
  missingFields: string[];
}): Array<{ id: string; label: string; confidence?: number }> {
  const { intent, state, missingFields } = params;
  const topMissingField = missingFields[0];
  const topMissing = missingFields.slice(0, 3);
  const missingLabels = topMissing.map((field) => toFieldLabel(field));
  const topLabel = toFieldLabel(topMissingField);
  const targetedPrompt = nextPromptForMissingField(topMissingField);

  const fallback = v2SuggestionPool(state).map((label, index) => ({
    id: `s${index + 1}`,
    label,
    confidence: Math.max(30, 95 - index * 10),
  }));

  if (intent === "question") {
    const q = [
      `Draft the minimum high-quality answer for ${topLabel}`,
      "Explain why this field matters for strategy quality",
      "Use best-practice defaults, then I will edit",
      "Give 3 strong options and I will choose one",
    ];
    return q.map((label, index) => ({ id: `q${index + 1}`, label, confidence: 80 - index * 8 }));
  }

  if (intent === "help_request") {
    const h = [
      `Create a concrete draft answer for ${topLabel}`,
      "Give 3 strong persona examples I can choose from",
      "Recommend a realistic first 30-day goal",
      `Use this format: ${targetedPrompt.example ?? "short, concrete, measurable"}`,
    ];
    return h.map((label, index) => ({ id: `h${index + 1}`, label, confidence: 82 - index * 8 }));
  }

  if (intent === "vague_answer") {
    const v = [
      `Here is a complete answer for ${topLabel}: ${targetedPrompt.example ?? "Local services | 1500 EUR/mo | 30 leads/mo"}`,
      "Niche: dentists | Budget: 2000 EUR/mo | Goal: more booked consults",
      "Niche: B2B SaaS | Budget: 3000 EUR/mo | Goal: more demos",
      "Use a starter draft and I will edit",
    ];
    return v.map((label, index) => ({ id: `v${index + 1}`, label, confidence: 74 - index * 6 }));
  }

  if (intent === "off_topic") {
    const o = [
      "Let's continue onboarding with a quick draft",
      `Set ${topLabel} first`,
      "Use defaults for missing required fields",
      "Show me what is blocking completion now",
    ];
    return o.map((label, index) => ({ id: `o${index + 1}`, label, confidence: 70 - index * 5 }));
  }

  if (missingLabels.length > 0) {
    const direct = [
      `Set ${missingLabels[0]}`,
      missingLabels[1] ? `Then set ${missingLabels[1]}` : "Set conversion goal next",
      "Use this draft and continue",
      "Refine this draft first",
    ];
    return direct.map((label, index) => ({ id: `d${index + 1}`, label, confidence: 88 - index * 9 }));
  }

  return fallback;
}
function nextPromptForMissingField(field: string | undefined): { prompt: string; example?: string } {
  switch (field) {
    case "q1_business_name":
      return { prompt: "What is the exact client business name (as shown publicly)?", example: "Northwave Fitness" };
    case "q2_website_or_socials":
      return {
        prompt: "Share the client website or one primary social profile URL.",
        example: "https://northwavefitness.com or https://instagram.com/northwavefitness",
      };
    case "industry_niche":
      return { prompt: "Which industry / niche best matches this client?", example: "gym_fitness_studio" };
    case "q3_market_scope":
      return { prompt: "Is this client targeting local, national, or international markets?", example: "local" };
    case "q3_geo":
      return { prompt: "What country and city should strategy focus on?", example: "United States | Austin, TX" };
    case "q4_languages":
      return { prompt: "Which client languages should we optimize for?", example: "English, Greek" };
    case "primary_goal":
      return { prompt: "What is the primary growth goal for the next 90 days?", example: "more_leads" };
    case "conversion_path":
      return { prompt: "What conversion path should campaigns push to?", example: "book_call or dm_keyword" };
    case "conversion_link_required":
      return { prompt: "Share the exact booking / checkout link for conversion.", example: "https://calendly.com/intro" };
    case "dm_keyword_required":
      return { prompt: "What DM keyword should prospects send?", example: "BOOK" };
    case "offers":
      return { prompt: "What is the main offer (name + realistic price range)?", example: "Signature Service | 1200-1800 EUR" };
    case "primary_customer":
      return { prompt: "Who is the primary customer persona in one clear line?", example: "Local business owners with 3-15 employees" };
    case "q9_pain_points":
      return { prompt: "List exactly 3 pain points this client solves.", example: "Low leads | Weak trust | Inconsistent content" };
    case "platforms":
      return { prompt: "Which channels should we activate first?", example: "Instagram + TikTok" };
    case "cadence_requirement":
      return { prompt: "What weekly posting cadence should we run per channel?", example: "Instagram 5/week, TikTok 5/week" };
    case "brand_voice":
      return { prompt: "Pick 2-3 brand voice traits for content tone.", example: "friendly, educational" };
    case "content_style":
      return { prompt: "What content style should lead the plan?", example: "educational_tips + short_video" };
    default:
      return { prompt: "Share the next missing business detail so I can keep mapping accurately." };
  }
}
function buildStrategicImpactLine(state: Record<string, unknown>, missingCount: number): string {
  const niche = typeof state.industry_niche === "string" ? state.industry_niche : "your niche";
  const goal = typeof state.primary_goal === "string" ? state.primary_goal : "lead growth";
  if (missingCount <= 2) {
    return `You are close to completion. Finalizing these details sharpens strategy quality for ${niche} and ${goal}.`;
  }
  return `Locking this detail improves targeting accuracy for ${niche} and strengthens your plan toward ${goal}.`;
}

function getOperatorCapture(state: Record<string, unknown>) {
  const v5Meta = asRecord(state.v5_meta);
  return asRecord(v5Meta.operator_capture);
}

function buildExpertClarificationFollowUp(params: {
  state: Record<string, unknown>;
  topMissingField?: string;
  intent: "direct_answer" | "question" | "help_request" | "vague_answer" | "off_topic";
}) {
  const { state, topMissingField, intent } = params;
  const operator = getOperatorCapture(state);
  const constraints = Array.isArray(operator.financial_constraints)
    ? operator.financial_constraints.filter((v): v is string => typeof v === "string")
    : [];
  const riskScope = Array.isArray(operator.risk_compliance_scope)
    ? operator.risk_compliance_scope.filter((v): v is string => typeof v === "string")
    : [];
  const escalation = Array.isArray(operator.escalation_triggers)
    ? operator.escalation_triggers.filter((v): v is string => typeof v === "string")
    : [];
  const decisionRights = typeof operator.decision_rights === "string" ? operator.decision_rights : null;

  const fieldLabel = toFieldLabel(topMissingField);
  const prefix =
    intent === "question"
      ? "Good point."
      : intent === "help_request"
        ? "I can draft this for you."
        : intent === "vague_answer"
          ? "No problem."
          : intent === "off_topic"
            ? "Let's refocus quickly."
            : "Next step.";

  if (topMissingField === "conversion_path" && constraints.includes("budget_ceiling")) {
    return `${prefix} Set conversion path now so recommendations stay efficient under your budget cap.`;
  }
  if (topMissingField === "offers" && constraints.includes("margin_sensitive")) {
    return `${prefix} Share your main offer so we can optimize for margin, not just volume.`;
  }
  if (topMissingField === "response_handling" && decisionRights) {
    return `${prefix} Confirm who handles responses (${decisionRights}) so automation and approvals map correctly.`;
  }
  if (topMissingField === "q9_pain_points" && riskScope.length > 0) {
    return `${prefix} Clarify top pain points so messaging stays compliant with your risk scope (${riskScope.join(", ")}).`;
  }
  if (topMissingField === "proof_types" && escalation.includes("reputation_risk")) {
    return `${prefix} Add proof types now to reduce trust risk and strengthen reputation protection.`;
  }
  if (intent === "question" || intent === "help_request") {
    return `${prefix} I will keep it concise and practical. Let's lock ${fieldLabel} next.`;
  }
  return `${prefix} Give one concrete detail for ${fieldLabel} and I will map it immediately.`;
}

function buildV2AssistantMessage(params: {
  intent: "direct_answer" | "question" | "help_request" | "vague_answer" | "off_topic";
  nextPrompt: { prompt: string };
  remainingMissing: number;
  userMessage?: string;
}) {
  const { intent, nextPrompt, remainingMissing, userMessage } = params;
  const normalizedMessage = (userMessage ?? "").toLowerCase();
  if (intent === "question" && /pricing|price|budget|cost/.test(normalizedMessage)) {
    return `Pricing keeps recommendations realistic and aligned with budget. ${nextPrompt.prompt}`;
  }
  if (intent === "question") {
    return `Great question. Here is the next detail I need: ${nextPrompt.prompt}`;
  }
  if (intent === "help_request") {
    return `I can help with that. Let’s lock this next: ${nextPrompt.prompt}`;
  }
  if (intent === "off_topic") {
    return `Let’s keep onboarding moving. ${nextPrompt.prompt}`;
  }
  if (intent === "vague_answer") {
    return `Thanks. I need one more specific detail to map this correctly: ${nextPrompt.prompt}`;
  }
  if (remainingMissing <= 2) {
    return `Great progress. Final step: ${nextPrompt.prompt}`;
  }
  return `Got it. Next: ${nextPrompt.prompt}`;
}

type OperatorCapturePatch = {
  financial_constraints?: string[];
  decision_rights?: string;
  risk_compliance_scope?: string[];
  qa_sla?: {
    approval_hours?: number;
    response_hours?: number;
    revision_limit?: number;
  };
  escalation_triggers?: string[];
};

function mergeOperatorCaptureIntoV5Meta(currentState: Record<string, unknown>, patch: OperatorCapturePatch) {
  const currentV5Meta = asRecord(currentState.v5_meta);
  const currentCapture = asRecord(currentV5Meta.operator_capture);
  const nextCapture: Record<string, unknown> = {
    ...currentCapture,
    ...patch,
  };
  return {
    ...currentV5Meta,
    operator_capture: nextCapture,
  };
}

function parseV2HeuristicUpdates(
  input: string,
  currentState: Record<string, unknown>,
  intent: "direct_answer" | "question" | "help_request" | "vague_answer" | "off_topic"
): { updates: Record<string, unknown>; confidence: number; followUp?: string } {
  const normalized = input.trim().toLowerCase();
  const updates: Record<string, unknown> = {};
  let signals = 0;
  const lowSignalIntent = intent === "vague_answer" || intent === "off_topic" || intent === "question";
  const text = input.trim();
  const urls = input.match(/https?:\/\/[^\s,]+/gi) ?? [];

  const explicitNameMatch =
    text.match(/(?:business|brand|company|client)\s*name\s*(?:is|:)\s*([^.,\n]+)/i) ??
    text.match(/^([A-Z][A-Za-z0-9&' -]{2,50})$/);
  if (explicitNameMatch?.[1]) {
    updates.q1_business_name = explicitNameMatch[1].trim();
    signals += 1;
  }

  if (urls.length > 0) {
    const website = urls.find((url) => !/instagram|tiktok|linkedin|youtube|facebook|x\.com|twitter/i.test(url)) ?? null;
    const socials = urls.filter((url) => /instagram|tiktok|linkedin|youtube|facebook|x\.com|twitter/i.test(url));
    if (website) updates.q2_website = website;
    if (socials.length > 0) updates.q2_social_links = Array.from(new Set(socials));
    if (website || socials.length > 0) signals += 1;
  }

  if (/(gym|fitness)/.test(normalized)) {
    updates.industry_niche = "gym_fitness_studio";
    signals += 1;
  } else if (/(dentist|dental|clinic|medical)/.test(normalized)) {
    updates.industry_niche = "clinic_medical";
    signals += 1;
  } else if (/(saas|software|tech)/.test(normalized)) {
    updates.industry_niche = "saas_tech";
    signals += 1;
  } else if (/(restaurant|cafe|coffee)/.test(normalized)) {
    updates.industry_niche = "restaurant_cafe";
    signals += 1;
  }

  if (/(lead|qualified leads)/.test(normalized)) {
    updates.primary_goal = "more_leads";
    signals += 1;
  } else if (/(booking|appointment|booked)/.test(normalized)) {
    updates.primary_goal = "more_bookings";
    signals += 1;
  } else if (/(sale|revenue|checkout)/.test(normalized)) {
    updates.primary_goal = "more_online_sales";
    signals += 1;
  }

  if (/(dm keyword|dm)/.test(normalized)) {
    updates.conversion_path = "dm_keyword";
    const keywordMatch = input.match(/keyword(?:\s+is|:)?\s+([a-z0-9_-]+)/i);
    if (keywordMatch?.[1]) updates.dm_keyword = keywordMatch[1].toUpperCase();
    signals += 1;
  } else if (/(book call|calendly|schedule call)/.test(normalized)) {
    updates.conversion_path = "book_call";
    const urlMatch = input.match(/https?:\/\/\S+/i);
    if (urlMatch?.[0]) updates.conversion_link = urlMatch[0];
    signals += 1;
  }

  if (/(english)/.test(normalized) || /(greek)/.test(normalized) || /(arabic)/.test(normalized)) {
    const langs: string[] = [];
    if (/(english)/.test(normalized)) langs.push("english");
    if (/(greek)/.test(normalized)) langs.push("greek");
    if (/(arabic)/.test(normalized)) langs.push("arabic");
    updates.q4_languages = langs;
    signals += 1;
  }

  if (/(local)/.test(normalized)) {
    updates.q3_market_scope = "local";
    updates.q3_country = typeof currentState.q3_country === "string" ? currentState.q3_country : "United States";
    updates.q3_city = typeof currentState.q3_city === "string" ? currentState.q3_city : "Austin, TX";
    signals += 1;
  } else if (/(national)/.test(normalized)) {
    updates.q3_market_scope = "national";
    signals += 1;
  } else if (/(international|global)/.test(normalized)) {
    updates.q3_market_scope = "international";
    signals += 1;
  }

  const geoDelimitedMatch = input.match(/\b([A-Za-z][A-Za-z .'-]{1,40})\s*,\s*([A-Za-z][A-Za-z .'-]{1,40})\b/);
  if (geoDelimitedMatch?.[1] && geoDelimitedMatch?.[2]) {
    const city = geoDelimitedMatch[1].trim();
    const country = geoDelimitedMatch[2].trim();
    if (city.length >= 2 && country.length >= 2) {
      updates.q3_city = city;
      updates.q3_country = country;
      updates.q3_market_scope = updates.q3_market_scope ?? "local";
      signals += 1;
    }
  }
  if (!updates.q3_city && !updates.q3_country && input.includes(",")) {
    const [rawCity, rawCountry] = input.split(",", 2).map((part) => part.trim());
    if (rawCity && rawCountry && /^[A-Za-z .'-]{2,40}$/.test(rawCity) && /^[A-Za-z .'-]{2,40}$/.test(rawCountry)) {
      updates.q3_city = rawCity;
      updates.q3_country = rawCountry;
      updates.q3_market_scope = updates.q3_market_scope ?? "local";
      signals += 1;
    }
  }

  const budgetMatch = input.match(/(\d{3,5})\s*(eur|usd|\$)?/i);
  if (budgetMatch?.[1]) {
    const parsedBudget = Number(budgetMatch[1]);
    if (Number.isFinite(parsedBudget) && parsedBudget > 0) {
      updates.offers = [
        {
          type: "best_seller",
          name: typeof currentState.q6_offer_name === "string" ? currentState.q6_offer_name : "Signature Service",
          promise: "results_focused",
          price_min: Math.max(500, Math.floor(parsedBudget * 0.8)),
          price_max: Math.max(900, Math.ceil(parsedBudget * 1.2)),
        },
      ];
      updates.q6_offer_name = typeof currentState.q6_offer_name === "string" ? currentState.q6_offer_name : "Signature Service";
      signals += 1;
    }
  }

  if (/(instagram|tiktok|linkedin|youtube)/.test(normalized)) {
    const channels: string[] = [];
    if (/(instagram)/.test(normalized)) channels.push("instagram");
    if (/(tiktok)/.test(normalized)) channels.push("tiktok");
    if (/(linkedin)/.test(normalized)) channels.push("linkedin");
    if (/(youtube)/.test(normalized)) channels.push("youtube");
    updates.platforms = channels;
    updates.q16_enabled_channels = channels;
    updates.formats = ["short_video", "carousels"];
    updates.cadence_preset = "standard";
    updates.cadence_per_platform = Object.fromEntries(channels.map((channel) => [channel, 5]));
    updates.q18_cadence = updates.cadence_per_platform;
    signals += 1;
  }

  if (!updates.formats && /(reel|short video|short-form|carousel|carousels|ugc|testimonial)/.test(normalized)) {
    const formats: string[] = [];
    if (/(reel|short video|short-form|ugc|testimonial)/.test(normalized)) formats.push("short_video");
    if (/(carousel|carousels)/.test(normalized)) formats.push("carousels");
    if (formats.length > 0) {
      updates.formats = Array.from(new Set(formats));
      signals += 1;
    }
  }

  const cadencePairs = [
    ["instagram", /instagram[^0-9]{0,12}(\d{1,2})/i],
    ["tiktok", /tiktok[^0-9]{0,12}(\d{1,2})/i],
    ["linkedin", /linkedin[^0-9]{0,12}(\d{1,2})/i],
    ["youtube", /youtube[^0-9]{0,12}(\d{1,2})/i],
  ] as const;
  const cadence: Record<string, number> = {};
  for (const [platform, pattern] of cadencePairs) {
    const match = input.match(pattern);
    if (!match?.[1]) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0 && n <= 14) cadence[platform] = n;
  }
  if (Object.keys(cadence).length > 0) {
    updates.cadence_per_platform = cadence;
    updates.q18_cadence = cadence;
    updates.cadence_preset = "custom";
    signals += 1;
  }

  if (!updates.primary_customer) {
    const personaMatch =
      text.match(/(?:target|ideal customer|primary customer|persona)\s*(?:is|:)?\s*([^.\n]+)/i) ??
      text.match(/(dentists?|gym owners?|saas founders?|restaurant owners?|local business owners?)/i);
    if (personaMatch?.[1]) {
      updates.primary_customer = personaMatch[1].trim();
      signals += 1;
    }
  }
  if (!updates.primary_customer && /owner|founder|business owner|dentist|gym owner/.test(normalized)) {
    updates.primary_customer = getPrimaryCustomerDraftFromState(currentState);
    signals += 1;
  }
  if (!updates.audience_type && /(local|owner|founder|consumer|b2b)/.test(normalized)) {
    updates.audience_type = /(b2b)/.test(normalized) ? "b2b_decision_makers" : "local_consumers";
    signals += 1;
  }
  if (!lowSignalIntent && !updates.main_objection && /(price|cost|expensive|trust|skeptic|time|approval)/.test(normalized)) {
    updates.main_objection = "price_too_high";
    signals += 1;
  }
  if (
    !lowSignalIntent &&
    !updates.q9_pain_points &&
    /(low leads|not enough customers|inconsistent content|low trust|engagement|bad reviews|seasonal)/.test(normalized)
  ) {
    updates.q9_pain_points = ["Not enough customers/leads", "Low trust / weak reputation", "Inconsistent content"];
    signals += 1;
  }

  if (!updates.brand_voice && /(friendly|professional|bold|luxury|educational|direct|playful|clinical|witty)/.test(normalized)) {
    const voice: string[] = [];
    if (/friendly/.test(normalized)) voice.push("friendly");
    if (/professional/.test(normalized)) voice.push("professional");
    if (/educational/.test(normalized)) voice.push("educational");
    if (/bold/.test(normalized)) voice.push("bold");
    if (/luxury/.test(normalized)) voice.push("luxury");
    if (/direct/.test(normalized)) voice.push("direct");
    if (/playful/.test(normalized)) voice.push("playful");
    if (/clinical/.test(normalized)) voice.push("clinical");
    if (/witty/.test(normalized)) voice.push("witty");
    if (voice.length >= 1) {
      updates.brand_voice = Array.from(new Set(voice)).slice(0, 3);
      signals += 1;
    }
  }

  if (!updates.content_style && /(founder|tips|before\/after|social proof|trend|storytelling)/.test(normalized)) {
    const style: string[] = [];
    if (/founder/.test(normalized)) style.push("founder_led");
    if (/tips/.test(normalized)) style.push("educational_tips");
    if (/before\/after/.test(normalized)) style.push("before_after");
    if (/social proof/.test(normalized)) style.push("social_proof");
    if (/trend/.test(normalized)) style.push("trend_based");
    if (/storytelling/.test(normalized)) style.push("storytelling");
    if (style.length > 0) {
      updates.content_style = Array.from(new Set(style)).slice(0, 2);
      signals += 1;
    }
  }

  if (intent === "help_request" && Object.keys(updates).length === 0) {
    updates.primary_customer = getPrimaryCustomerDraftFromState(currentState);
    updates.audience_type =
      /saas|b2b/.test(String(currentState.industry_niche ?? ""))
        ? "b2b_decision_makers"
        : "local_consumers";
    signals += 1;
  }

  if (!updates.response_handling) {
    if (/(we handle|agency handles|our team handles|done-for-you)/.test(normalized)) {
      updates.response_handling = "agency";
      signals += 1;
    } else if (/(owner handles|i handle|founder handles)/.test(normalized)) {
      updates.response_handling = "owner";
      signals += 1;
    } else if (/(team handles|in-house team)/.test(normalized)) {
      updates.response_handling = "team";
      signals += 1;
    } else if (/(nobody handles|no one handles|not handled)/.test(normalized)) {
      updates.response_handling = "nobody_yet";
      signals += 1;
    }
  }

  if (!updates.on_camera_availability) {
    if (/(faceless|no face|without face)/.test(normalized)) {
      updates.on_camera_availability = "faceless";
      signals += 1;
    } else if (/(owner on camera|founder on camera|i can be on camera)/.test(normalized)) {
      updates.on_camera_availability = "owner";
      signals += 1;
    } else if (/(team on camera|staff on camera)/.test(normalized)) {
      updates.on_camera_availability = "team";
      signals += 1;
    } else if (/(not sure on camera|unsure on camera)/.test(normalized)) {
      updates.on_camera_availability = "not_sure";
      signals += 1;
    }
  }

  if (!updates.available_assets && /(brand kit|photos|videos|testimonials|case studies|catalog|menu)/.test(normalized)) {
    const assets: string[] = [];
    if (/brand kit/.test(normalized)) assets.push("brand_kit");
    if (/photo/.test(normalized)) assets.push("photos");
    if (/video/.test(normalized)) assets.push("videos");
    if (/testimonial/.test(normalized)) assets.push("testimonials");
    if (/case stud/.test(normalized)) assets.push("case_studies");
    if (/catalog/.test(normalized)) assets.push("product_catalog");
    if (/menu/.test(normalized) || /price list/.test(normalized)) assets.push("menu_price_list");
    if (assets.length > 0) {
      updates.available_assets = Array.from(new Set(assets));
      signals += 1;
    }
  }

  if (!updates.proof_types && /(reviews|testimonials|before\/after|results|press|featured)/.test(normalized)) {
    const proof: string[] = [];
    if (/review/.test(normalized)) proof.push("reviews");
    if (/testimonial/.test(normalized)) proof.push("testimonials");
    if (/before\/after|before after/.test(normalized)) proof.push("before_after");
    if (/result|roas|cpa|cac|conversion/.test(normalized)) proof.push("results_numbers");
    if (/press|featured/.test(normalized)) proof.push("press_features");
    if (proof.length > 0) {
      updates.proof_types = Array.from(new Set(proof));
      signals += 1;
    }
  }

  if (!updates.competitor_link) {
    const competitorUrl =
      urls.find((url) => /competitor|vs|benchmark/i.test(text)) ??
      urls.find((url) => /instagram|tiktok|facebook|linkedin/.test(url));
    if (competitorUrl) {
      updates.competitor_link = competitorUrl;
      signals += 1;
    }
  }

  const operatorPatch: OperatorCapturePatch = {};
  if (/budget cap|max budget|cannot exceed|cash flow|margin|profit/.test(normalized)) {
    const constraints: string[] = [];
    if (/budget cap|max budget|cannot exceed/.test(normalized)) constraints.push("budget_ceiling");
    if (/cash flow/.test(normalized)) constraints.push("cashflow_sensitive");
    if (/margin|profit/.test(normalized)) constraints.push("margin_sensitive");
    if (constraints.length > 0) operatorPatch.financial_constraints = constraints;
  }
  if (/hipaa|gdpr|compliance|regulated|legal review/.test(normalized)) {
    const scope: string[] = [];
    if (/hipaa/.test(normalized)) scope.push("hipaa");
    if (/gdpr/.test(normalized)) scope.push("gdpr");
    if (/regulated/.test(normalized)) scope.push("regulated_industry");
    if (/legal review/.test(normalized)) scope.push("legal_review_required");
    if (scope.length > 0) operatorPatch.risk_compliance_scope = scope;
  }
  if (/(owner approves|founder approves|manager approves|approval owner)/.test(normalized)) {
    operatorPatch.decision_rights = /(owner approves|founder approves)/.test(normalized) ? "owner" : "manager";
  }
  const approvalHours = normalized.match(/approval\s*(?:sla)?\s*(\d{1,3})\s*h/);
  const responseHours = normalized.match(/response\s*(?:sla)?\s*(\d{1,3})\s*h/);
  const revisionLimit = normalized.match(/(\d{1,2})\s*(?:rounds?|revisions?)/);
  if (approvalHours || responseHours || revisionLimit) {
    operatorPatch.qa_sla = {};
    if (approvalHours) operatorPatch.qa_sla.approval_hours = Number(approvalHours[1]);
    if (responseHours) operatorPatch.qa_sla.response_hours = Number(responseHours[1]);
    if (revisionLimit) operatorPatch.qa_sla.revision_limit = Number(revisionLimit[1]);
  }
  if (/escalate|escalation|alert if|notify if/.test(normalized)) {
    const triggers: string[] = [];
    if (/lead drop|conversion drop|drop/.test(normalized)) triggers.push("performance_drop");
    if (/negative comments|reputation|crisis/.test(normalized)) triggers.push("reputation_risk");
    if (/blocked approval|approval delay/.test(normalized)) triggers.push("approval_blocked");
    if (triggers.length > 0) operatorPatch.escalation_triggers = triggers;
  }
  if (Object.keys(operatorPatch).length > 0) {
    updates.v5_meta = mergeOperatorCaptureIntoV5Meta(currentState, operatorPatch);
    signals += 1;
  }

  const confidence = Math.max(0.45, Math.min(0.9, 0.5 + signals * 0.06));
  const followUp =
    confidence < 0.6
      ? "Next: share one concrete niche, budget, and outcome target so I can increase confidence."
      : undefined;
  return { updates, confidence, followUp };
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

function isLikelyQuestion(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("?")) return true;
  return /^(what|why|how|when|where|which|who|can|could|should|would|do|does|did|is|are)\b/.test(normalized);
}

function isLowSignalNoise(input: string) {
  const normalized = input.trim();
  if (!normalized) return true;
  // Reject punctuation-only or symbol-only payloads like ???, ..., !!!.
  if (/^[\p{P}\p{S}\s]+$/u.test(normalized)) return true;
  return false;
}


function parseNumbers(input: string) {
  const matches = input.match(/\d+(?:\.\d+)?/g);
  if (!matches) return [];
  return matches.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
}

function hasLetters(input: string) {
  return /[a-zA-Z]/.test(input);
}

function isValidIanaTimezone(input: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: input });
    return true;
  } catch {
    return false;
  }
}

function isLikelyTimezone(input: string) {
  return isValidIanaTimezone(input.trim());
}

function toDelimitedLines(input: string) {
  const normalized = input.trim();
  if (!normalized) return [];
  if (/\r?\n/.test(normalized)) {
    return normalized
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  // Keep pipe-structured rows intact even when they include semicolons in deliverables.
  if (normalized.includes("|")) {
    return [normalized];
  }
  return normalized
    .split(/;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toDelimitedCsv(input: string) {
  return input
    .split(/\r?\n|;/)
    .map((line) => line.split(",").map((part) => part.trim()))
    .filter((parts) => parts.some(Boolean));
}

function countWords(input: string) {
  return input.trim().split(/\s+/).filter(Boolean).length;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validationFollowUp(code: string, help: string, example?: string) {
  const suffix = example ? ` Example: ${example}` : "";
  return { decision: "follow_up" as const, message: `${help}${suffix}`, code };
}

function sanitizeUserFacingAssistantMessage(input: string) {
  return input
    .replace(/\bagency_brain_missing\b/gi, "")
    .replace(/\bERR_[A-Z0-9_]+\s*:\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countFilledTopLevelKeys(snapshot: Record<string, unknown>) {
  return Object.values(snapshot).reduce((count, value) => (isPopulated(value) ? count + 1 : count), 0);
}

function pickQuestionIntentLead(question: QuestionDef, snapshot: Record<string, unknown>) {
  const leads = [
    "Context:",
    "Why it matters:",
    "Quick note:",
    "Clarity:",
    "In short:",
  ];
  const seedBase = question.field_path.length + countFilledTopLevelKeys(snapshot);
  return leads[seedBase % leads.length] ?? "Context:";
}

function buildQuestionIntentReply(question: QuestionDef, snapshot: Record<string, unknown>) {
  const fieldWhyMap: Record<string, { why: string; impact: string }> = {
    "agency.timezone": {
      why: "timezone controls deadlines and reporting windows",
      impact: "SLA timing and schedule accuracy",
    },
    "agency.primary_client_languages": {
      why: "language mix sets your default communication language",
      impact: "message clarity and localization quality",
    },
    "agency.team_size_total": {
      why: "team size helps calibrate delivery capacity",
      impact: "realistic workload and planning suggestions",
    },
    "agency.active_paying_clients": {
      why: "active client count sets your current operating scale",
      impact: "better growth and ops recommendations",
    },
    "agency.best_client_summary": {
      why: "this anchors your ideal client profile",
      impact: "more precise strategy and messaging",
    },
    "agency.service_catalog": {
      why: "it defines what you actually sell and deliver",
      impact: "more relevant workflows and playbooks",
    },
    "agency.top_margin_offers": {
      why: "margin leaders should drive your growth focus",
      impact: "higher-quality pricing and offer guidance",
    },
    "agency.packaged_offers": {
      why: "packaging makes delivery and sales repeatable",
      impact: "faster proposal and execution quality",
    },
    "agency.pricing_model": {
      why: "pricing model shapes sales and forecasting logic",
      impact: "cleaner recommendations and planning",
    },
    "operations.required_client_assets": {
      why: "kickoff assets prevent delivery delays",
      impact: "faster onboarding and execution consistency",
    },
  };
  const mapped = fieldWhyMap[question.field_path];
  const explainer = QUESTION_EXPLAINERS[question.field_path];
  const why = (mapped?.why ?? explainer?.why_needed ?? "it helps personalize your setup").replace(/[.]+\s*$/, "");
  const impact = (mapped?.impact ?? explainer?.impact ?? "output quality").replace(/[.]+\s*$/, "");
  const example = question.examples?.[0];
  const exampleText = example ? ` Example: ${example}` : "";
  const impactLine = `Impact: ${impact}.`;
  const lead = pickQuestionIntentLead(question, snapshot);
  const intro = `${lead} ${why}.`;
  return `${intro} ${impactLine} Please share your best answer.${exampleText}`;
}

function buildHelpDraft(question: QuestionDef, snapshot: Record<string, unknown>) {
  const industry = firstIndustryLabel(snapshot) || "B2B SaaS";
  const service = firstServiceLabel(snapshot) || "Paid Ads";
  const serviceLower = service.toLowerCase();
  const timezone = firstString(snapshot, ["agency.timezone"]) || "Europe/Athens";
  const teamSize = Number(firstString(snapshot, ["agency.team_size_total"])?.match(/\d+/)?.[0] ?? "7");
  const clientCount = Number(firstString(snapshot, ["agency.active_paying_clients"])?.match(/\d+/)?.[0] ?? "12");
  const monthlyBudget =
    clientCount >= 25 ? "3000-7000 EUR/mo" : clientCount >= 10 ? "1500-4000 EUR/mo" : "800-2500 EUR/mo";
  const kpiFocus = serviceLower.includes("ads")
    ? "qualified leads and CAC efficiency"
    : serviceLower.includes("social")
    ? "consistent content output and inbound leads"
    : "pipeline growth and conversion rate";
  const pricingModelDraft =
    teamSize >= 8 || clientCount >= 15
      ? "Hybrid | Base retainer plus performance upside on agreed KPIs"
      : "Fixed retainer | Predictable monthly scope and planning";

  switch (question.field_path) {
    case "agency.timezone":
      return timezone;
    case "agency.primary_client_languages":
      return "English 70%, Greek 30%";
    case "agency.team_size_total":
      return String(teamSize);
    case "agency.active_paying_clients":
      return String(clientCount);
    case "agency.top_industries":
      return `${industry}\nDentists`;
    case "agency.best_client_summary":
      return `${industry} founder with a ${teamSize}-person team, targeting ${kpiFocus}, budget ${monthlyBudget}.`;
    case "agency.key_differentiators":
      return `Niche focus in ${industry}\nWeekly KPI reporting on ${kpiFocus}\nFast execution with clear ownership`;
    case "agency.service_catalog":
      return `${service} | Weekly optimization and transparent reporting`;
    case "agency.top_margin_offers":
      return `${service} Growth | Weekly strategy; execution; KPI reporting | ${monthlyBudget} | Reusable delivery system`;
    case "agency.packaged_offers":
      return `Lead Engine | Qualified leads/month | strategy; execution; reporting | 30 days | ${monthlyBudget}`;
    case "agency.pricing_model":
      return pricingModelDraft;
    case "operations.required_client_assets":
      return "Brand guidelines | 5";
    case "operations.approval_workflow":
      return "Founder,email,48";
    case "operations.turnaround_slas":
      return "drafts:48, edits:24, urgent:6";
    default:
      return question.examples?.[0] ?? null;
  }
}

function buildQuestionIntentReplyWithDraft(question: QuestionDef, snapshot: Record<string, unknown>) {
  const base = buildQuestionIntentReply(question, snapshot);
  const draft = buildHelpDraft(question, snapshot);
  if (!draft) return base;
  return `${base} Draft: ${draft}`;
}

function firstServiceLabel(snapshot: Record<string, unknown>) {
  const raw = getPathValue(snapshot, "agency.service_catalog");
  if (Array.isArray(raw) && raw.length > 0) {
    const first = String(raw[0] ?? "");
    return first.split("|")[0]?.trim() || null;
  }
  if (typeof raw === "string" && raw.trim()) {
    const firstLine = raw.split(/\r?\n/)[0] ?? raw;
    return firstLine.split("|")[0]?.trim() || null;
  }
  return null;
}

function firstIndustryLabel(snapshot: Record<string, unknown>) {
  const raw = getPathValue(snapshot, "agency.top_industries");
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0] ?? "").trim() || null;
  if (typeof raw === "string" && raw.trim()) return raw.split(/\r?\n|,/)[0]?.trim() || null;
  return null;
}

function buildContextualSuggestions(question: QuestionDef, snapshot: Record<string, unknown>) {
  const agencyName = firstString(snapshot, ["agency.name"]) || "our agency";
  const service = firstServiceLabel(snapshot) || "Paid Ads";
  const industry = firstIndustryLabel(snapshot) || "B2B SaaS";

  switch (question.field_path) {
    case "agency.best_client_summary":
      return [
        `${industry} founder focused on predictable monthly lead flow and better close rates.`,
        `${industry} owner with a small team aiming for consistent qualified inquiries.`,
      ];
    case "agency.key_differentiators":
      return [
        "Fast execution\nWeekly KPI reporting\nClear strategic direction",
        "Founder-led strategy\nTight feedback loops\nPerformance-first delivery",
      ];
    case "agency.service_catalog":
      return [
        `${service} | Weekly optimization and transparent reporting`,
        `Social Mgmt | Monthly strategy, posting, and community engagement`,
      ];
    case "agency.top_margin_offers":
      return [
        `${service} Growth | Weekly strategy; creative testing; reporting | 1500-2500 | Reusable delivery system`,
        `Lead Engine | ICP targeting; creative iterations; analytics | 1300-2200 | Efficient fulfillment`,
      ];
    case "agency.packaged_offers":
      return [
        `Lead Engine | 40 leads/month | strategy; creatives; optimization | 30 days | 1500-2500`,
        `${industry} Accelerator | Qualified appointments/month | targeting; content; follow-up framework | 30 days | 1800-3000`,
      ];
    case "agency.pricing_model":
      return [
        "Fixed retainer | Predictable scope and stable delivery planning",
        "Hybrid | Base retainer plus performance upside for growth campaigns",
      ];
    case "operations.required_client_assets":
      return [
        "Brand guidelines | 5",
        `${service} account access | 3`,
        "Offer details + pricing | 4",
      ];
    default:
      return [];
  }
}

function strictFieldTemplateSuggestion(question: QuestionDef) {
  switch (question.field_path) {
    case "agency.timezone":
      return "Europe/Athens";
    case "agency.primary_client_languages":
      return "English 70%, Greek 30%";
    case "agency.service_catalog":
      return "Paid Ads | Meta + Google management and optimization";
    case "agency.top_margin_offers":
      return "Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow";
    case "agency.packaged_offers":
      return "Lead Engine | 40 leads/month | 12 creatives; ad mgmt; reporting | 30 days | 1500-2500";
    case "agency.pricing_model":
      return "Fixed retainer | Predictable monthly scope and planning";
    case "operations.required_client_assets":
      return "Brand guidelines | 5";
    case "operations.approval_workflow":
      return "Founder,email,48";
    case "operations.turnaround_slas":
      return "drafts:48, edits:24, urgent:6";
    case "agency.role_counts":
      return "strategist,2";
    case "agency.price_ranges_by_tier":
      return "Growth,1000,1800";
    default:
      return null;
  }
}

function buildFollowUpSuggestions(question: QuestionDef, snapshot: Record<string, unknown>) {
  const draft = buildHelpDraft(question, snapshot);
  const template = strictFieldTemplateSuggestion(question);
  const contextual = buildContextualSuggestions(question, snapshot);
  const raw = [draft, template, ...contextual, ...question.examples]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const uniqueRaw: string[] = [];
  for (const value of raw) {
    if (!uniqueRaw.includes(value)) uniqueRaw.push(value);
  }
  if (uniqueRaw.length >= 3) return uniqueRaw.slice(0, 4);
  return normalizeOnboardingSuggestions({
    rawSuggestions: uniqueRaw,
    module: (question.module as
      | "bootstrap"
      | "positioning"
      | "offer_stack"
      | "operations"
      | "ai_persona"
      | "rep_policy"
      | "voice"
      | "persona"),
    fieldPath: question.field_path,
    snapshot,
  }).slice(0, 4);
}

function buildPrimarySuggestions(question: QuestionDef, snapshot: Record<string, unknown>) {
  const contextual = buildContextualSuggestions(question, snapshot);
  const raw = [...contextual, ...question.examples].map((value) => String(value ?? "").trim()).filter(Boolean);
  const uniqueRaw: string[] = [];
  for (const value of raw) {
    if (!uniqueRaw.includes(value)) uniqueRaw.push(value);
  }
  if (uniqueRaw.length >= 3) return uniqueRaw.slice(0, 4);
  return normalizeOnboardingSuggestions({
    rawSuggestions: uniqueRaw,
    module: (question.module as
      | "bootstrap"
      | "positioning"
      | "offer_stack"
      | "operations"
      | "ai_persona"
      | "rep_policy"
      | "voice"
      | "persona"),
    fieldPath: question.field_path,
    snapshot,
  }).slice(0, 4);
}

function parseLanguagePercentPairs(input: string) {
  const pairs: Array<{ label: string; percent: number }> = [];
  const regex = /([A-Za-z][A-Za-z\s&/ -]*)\s*[:-]?\s*(\d{1,3})\s*%/g;
  let match: RegExpExecArray | null = regex.exec(input);
  while (match) {
    const label = match[1].trim();
    const percent = Number(match[2]);
    if (label && Number.isInteger(percent)) {
      pairs.push({ label, percent });
    }
    match = regex.exec(input);
  }
  return pairs;
}

function validateAnswerLocally(question: QuestionDef, input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return validationFollowUp(question.error_code ?? "ERR_REQUIRED", question.help_text ?? "Please provide a value.", question.examples?.[0]);
  }

  if (isLikelyQuestion(trimmed)) {
    return validationFollowUp(
      "ERR_EXPECTED_ANSWER",
      "It looks like you asked a question. Please provide your best answer to the current field.",
      question.examples?.[0]
    );
  }

  if (isLowSignalNoise(trimmed)) {
    return validationFollowUp(
      "ERR_LOW_SIGNAL_ANSWER",
      "Please provide a concrete answer (text, number, list, or structured value) for this field.",
      question.examples?.[0]
    );
  }

  if (isUnknownAnswer(trimmed)) {
    if (question.priority === "P0") {
      return validationFollowUp(
        question.error_code ?? "ERR_REQUIRED",
        "This field is required for activation. Please provide a best-effort value.",
        question.examples?.[0]
      );
    }
    return { decision: "accept" as const };
  }

  switch (question.field_path) {
    case "agency.name": {
      if (trimmed.length < 3 || trimmed.length > 80) {
        return validationFollowUp("ERR_AGENCY_NAME_FORMAT", "Use 3-80 characters.", question.examples?.[0]);
      }
      if (/[\u{1F300}-\u{1FAFF}]/u.test(trimmed)) {
        return validationFollowUp("ERR_AGENCY_NAME_FORMAT", "Do not use emojis in agency name.", question.examples?.[0]);
      }
      if (/[`*_#[\]{}<>]/.test(trimmed)) {
        return validationFollowUp("ERR_AGENCY_NAME_FORMAT", "Do not use markup characters.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.timezone": {
      if (!isValidIanaTimezone(trimmed)) {
        return validationFollowUp("ERR_TIMEZONE_INVALID", "Use a valid IANA timezone.", "Europe/Athens");
      }
      return { decision: "accept" as const };
    }
    case "bootstrap.locale": {
      if (!isValidIanaTimezone(trimmed)) {
        return validationFollowUp("ERR_TIMEZONE_INVALID", "Use a valid IANA timezone.", "Europe/Athens");
      }
      return { decision: "accept" as const };
    }
    case "agency.primary_client_languages": {
      const pairs = parseLanguagePercentPairs(trimmed);
      if (pairs.length === 0) {
        return validationFollowUp("ERR_LANGUAGE_SPLIT_INVALID", "Provide language + percentage entries.", question.examples?.[0]);
      }
      for (const pair of pairs) {
        if (pair.percent < 0 || pair.percent > 100) {
          return validationFollowUp("ERR_LANGUAGE_SPLIT_INVALID", "Each language must include an integer percent.", question.examples?.[0]);
        }
      }
      const sum = pairs.reduce((total, pair) => total + pair.percent, 0);
      if (sum !== 100) {
        return validationFollowUp("ERR_LANGUAGE_SPLIT_INVALID", "Percentages must sum to exactly 100.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.team_size_total": {
      const value = parseNumbers(trimmed)[0];
      if (value === undefined || !Number.isInteger(value) || value < 0 || value > 500) {
        return validationFollowUp("ERR_TEAM_SIZE_RANGE", "Use an integer from 0 to 500.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.active_paying_clients": {
      const value = parseNumbers(trimmed)[0];
      if (value === undefined || !Number.isInteger(value) || value < 0 || value > 5000) {
        return validationFollowUp("ERR_ACTIVE_CLIENTS_RANGE", "Use an integer from 0 to 5000.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.top_industries": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 5) {
        return validationFollowUp("ERR_TOP_INDUSTRIES_INVALID", "Provide between 1 and 5 industries.", question.examples?.[0]);
      }
      const hasCustomWithoutProof = rows.some((row) => row.toLowerCase().startsWith("custom:") && !row.toLowerCase().includes("proof:"));
      if (hasCustomWithoutProof) {
        return validationFollowUp("ERR_TOP_INDUSTRIES_INVALID", "Custom industries must include 'proof: ...' in the same line.");
      }
      return { decision: "accept" as const };
    }
    case "agency.best_client_summary": {
      const words = countWords(trimmed);
      if (words < 10 || words > 30) {
        return validationFollowUp("ERR_BEST_CLIENT_SUMMARY_LENGTH", "Use one sentence with 10-30 words.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.key_differentiators": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length !== 3) {
        return validationFollowUp("ERR_DIFFERENTIATORS_FORMAT", "Provide exactly 3 bullet lines.", question.examples?.[0]);
      }
      if (rows.some((row) => countWords(row) > 10)) {
        return validationFollowUp("ERR_DIFFERENTIATORS_FORMAT", "Each bullet must be 10 words or fewer.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.service_catalog": {
      const rows = toDelimitedLines(trimmed);
      const allowed = new Set(["social mgmt", "content production", "paid ads", "email/sms", "seo"]);
      if (rows.length < 1) {
        return validationFollowUp("ERR_SERVICE_CATALOG_FORMAT", "Provide at least one service row.", question.examples?.[0]);
      }
      for (const row of rows) {
        const [serviceRaw, scope] = row.split("|").map((part) => part.trim());
        if (!serviceRaw || !scope) {
          return validationFollowUp("ERR_SERVICE_CATALOG_FORMAT", "Each row must use 'Service | scope summary'.", question.examples?.[0]);
        }
        if (!allowed.has(serviceRaw.toLowerCase())) {
          return validationFollowUp("ERR_SERVICE_CATALOG_FORMAT", "Service must be one of Social Mgmt, Content Production, Paid Ads, Email/SMS, SEO.");
        }
      }
      return { decision: "accept" as const };
    }
    case "agency.top_margin_offers": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 2) {
        return validationFollowUp("ERR_TOP_MARGIN_OFFERS_FORMAT", "Provide 1-2 rows.", question.examples?.[0]);
      }
      for (const row of rows) {
        const parts = row.split("|").map((part) => part.trim());
        if (parts.length !== 4 || parts.some((part) => part.length === 0)) {
          return validationFollowUp("ERR_TOP_MARGIN_OFFERS_FORMAT", "Each row must have 4 pipe-separated fields.", question.examples?.[0]);
        }
      }
      return { decision: "accept" as const };
    }
    case "agency.packaged_offers": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 5) {
        return validationFollowUp("ERR_PACKAGED_OFFERS_FORMAT", "Provide 1-5 rows.", question.examples?.[0]);
      }
      for (const row of rows) {
        const parts = row.split("|").map((part) => part.trim());
        if (parts.length !== 5 || parts.some((part) => part.length === 0)) {
          return validationFollowUp("ERR_PACKAGED_OFFERS_FORMAT", "Each row must contain 5 pipe-separated fields.", question.examples?.[0]);
        }
      }
      return { decision: "accept" as const };
    }
    case "agency.pricing_model": {
      const parts = trimmed.split("|").map((part) => part.trim());
      const allowed = new Set(["fixed retainer", "tiered packages", "performance-based", "hybrid", "project-based"]);
      if (parts.length !== 2 || !allowed.has(parts[0].toLowerCase()) || countWords(parts[1]) < 3) {
        return validationFollowUp("ERR_PRICING_MODEL_FORMAT", "Use 'Model | one-line explanation' with an allowed model.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.website_and_links":
    case "agency.competitor_urls": {
      const rows = toDelimitedLines(trimmed);
      const max = question.field_path === "agency.competitor_urls" ? 3 : 6;
      if (rows.length < 1 && question.field_path === "agency.website_and_links") {
        return validationFollowUp("ERR_WEBSITE_LINKS_INVALID", "Provide at least one URL.", question.examples?.[0]);
      }
      if (rows.length > max) {
        return validationFollowUp(question.field_path === "agency.competitor_urls" ? "ERR_COMPETITOR_URLS_INVALID" : "ERR_WEBSITE_LINKS_INVALID", `Provide at most ${max} URLs.`);
      }
      if (rows.some((row) => !isValidUrl(row))) {
        return validationFollowUp(question.field_path === "agency.competitor_urls" ? "ERR_COMPETITOR_URLS_INVALID" : "ERR_WEBSITE_LINKS_INVALID", "All entries must be valid http(s) URLs.");
      }
      return { decision: "accept" as const };
    }
    case "agency.role_counts": {
      const rows = toDelimitedCsv(trimmed);
      if (rows.length < 1) {
        return validationFollowUp("ERR_ROLE_COUNTS_INVALID", "Provide at least one role,count row.", question.examples?.[0]);
      }
      let sum = 0;
      for (const row of rows) {
        if (row.length < 2 || !row[0]) {
          return validationFollowUp("ERR_ROLE_COUNTS_INVALID", "Each row must be role,count.", question.examples?.[0]);
        }
        const count = Number(row[1]);
        if (!Number.isInteger(count) || count < 0) {
          return validationFollowUp("ERR_ROLE_COUNTS_INVALID", "Count must be a non-negative integer.");
        }
        sum += count;
      }
      if (sum <= 0) return validationFollowUp("ERR_ROLE_COUNTS_INVALID", "Total headcount must be greater than zero.");
      return { decision: "accept" as const };
    }
    case "agency.client_type_split": {
      const numbers = parseNumbers(trimmed).map((value) => Math.round(value));
      if (numbers.length < 3 || numbers[0] + numbers[1] + numbers[2] !== 100) {
        return validationFollowUp("ERR_CLIENT_TYPE_SPLIT_INVALID", "Provide SMB/Mid/Enterprise percentages summing to 100.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.who_to_avoid": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 3) {
        return validationFollowUp("ERR_WHO_TO_AVOID_INVALID", "Provide 1-3 bullets.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "agency.proof_metrics": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 3) {
        return validationFollowUp("ERR_PROOF_METRICS_INVALID", "Provide 1-3 proof rows.", question.examples?.[0]);
      }
      for (const row of rows) {
        const hasNumber = parseNumbers(row).length > 0;
        const hasTimeframe = /\b(day|days|week|weeks|month|months|quarter|quarters|year|years)\b/i.test(row);
        if (!hasNumber || !hasTimeframe) {
          return validationFollowUp("ERR_PROOF_METRICS_INVALID", "Each row needs a metric number and timeframe.", question.examples?.[0]);
        }
      }
      return { decision: "accept" as const };
    }
    case "agency.price_ranges_by_tier": {
      const rows = toDelimitedCsv(trimmed);
      if (rows.length < 2 || rows.length > 4) {
        return validationFollowUp("ERR_PRICE_RANGES_BY_TIER_INVALID", "Provide 2-4 tier rows.", question.examples?.[0]);
      }
      for (const row of rows) {
        if (row.length < 3 || !row[0]) {
          return validationFollowUp("ERR_PRICE_RANGES_BY_TIER_INVALID", "Each row must be tier,low,high.", question.examples?.[0]);
        }
        const low = Number(row[1]);
        const high = Number(row[2]);
        if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low) {
          return validationFollowUp("ERR_PRICE_RANGES_BY_TIER_INVALID", "Use valid numeric ranges where low <= high.");
        }
      }
      return { decision: "accept" as const };
    }
    case "ai.persona_name": {
      if (trimmed.length > 20) {
        return validationFollowUp("ERR_PERSONA_NAME_LENGTH", "Use up to 20 characters.");
      }
      return { decision: "accept" as const };
    }
    case "ai.role_title": {
      if (trimmed.length > 30) {
        return validationFollowUp("ERR_ROLE_TITLE_LENGTH", "Use up to 30 characters.");
      }
      return { decision: "accept" as const };
    }
    case "ai.personality_traits": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length !== 3) {
        return validationFollowUp("ERR_PERSONALITY_TRAITS_FORMAT", "Provide exactly 3 trait:level entries.", question.examples?.[0]);
      }
      const validLevels = new Set(["low", "med", "high"]);
      for (const row of rows) {
        const [trait, level] = row.split(":").map((part) => part.trim().toLowerCase());
        if (!trait || !level || !validLevels.has(level)) {
          return validationFollowUp("ERR_PERSONALITY_TRAITS_FORMAT", "Each entry must be Trait:Low/Med/High.");
        }
      }
      return { decision: "accept" as const };
    }
    case "ai.writing_preferences": {
      const normalized = trimmed.toLowerCase();
      const hasTone = /\btone:\s*(formal|neutral|conversational)\b/.test(normalized);
      const hasLength = /\blength:\s*(short|medium|long)\b/.test(normalized);
      const hasEmojis = /\bemojis:\s*(0|1-2|3\+)\b/.test(normalized);
      const hasCta = /\bcta:\s*(yes|no)\b/.test(normalized);
      if (!hasTone || !hasLength || !hasEmojis || !hasCta) {
        return validationFollowUp("ERR_WRITING_PREFS_FORMAT", "Use Tone/Length/Emojis/CTA structured format.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "operations.required_client_assets": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1) {
        return validationFollowUp("ERR_REQUIRED_ASSETS_INVALID", "Provide at least one asset row.", question.examples?.[0]);
      }
      for (const row of rows) {
        const [asset, daysRaw] = row.split("|").map((part) => part.trim());
        const days = Number(daysRaw);
        if (!asset || !Number.isInteger(days) || days < 0) {
          return validationFollowUp("ERR_REQUIRED_ASSETS_INVALID", "Each row must be 'asset | max_delay_days'.", question.examples?.[0]);
        }
      }
      return { decision: "accept" as const };
    }
    case "operations.approval_workflow": {
      const rows = toDelimitedCsv(trimmed);
      if (rows.length < 1 || rows.length > 3) {
        return validationFollowUp("ERR_APPROVAL_WORKFLOW_INVALID", "Provide 1-3 workflow rows.", question.examples?.[0]);
      }
      for (const row of rows) {
        const hours = Number(row[2]);
        if (row.length < 3 || !row[0] || !row[1] || !Number.isFinite(hours) || hours <= 0) {
          return validationFollowUp("ERR_APPROVAL_WORKFLOW_INVALID", "Each row must be role,method,sla_hours.", question.examples?.[0]);
        }
      }
      return { decision: "accept" as const };
    }
    case "operations.turnaround_slas": {
      const numbers = parseNumbers(trimmed);
      const hasDrafts = /\bdrafts?\b/i.test(trimmed);
      const hasEdits = /\bedits?\b/i.test(trimmed);
      const hasUrgent = /\burgent\b/i.test(trimmed);
      if (!hasDrafts || !hasEdits || !hasUrgent || numbers.length < 3) {
        return validationFollowUp("ERR_TURNAROUND_SLAS_INVALID", "Include drafts, edits, and urgent with numeric hours.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "operations.tools_stack":
    case "operations.platforms_managed": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 6) {
        return validationFollowUp(
          question.field_path === "operations.tools_stack" ? "ERR_TOOLS_STACK_INVALID" : "ERR_PLATFORMS_MANAGED_INVALID",
          "Provide 1-6 items.",
          question.examples?.[0]
        );
      }
      return { decision: "accept" as const };
    }
    case "operations.rep_policy_boundaries": {
      const rows = toDelimitedLines(trimmed);
      if (rows.length < 1 || rows.length > 5) {
        return validationFollowUp("ERR_REP_POLICY_BOUNDARIES_INVALID", "Provide 1-5 bullet lines.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "operations.paid_ads_account_access": {
      if (countWords(trimmed) < 3) {
        return validationFollowUp("ERR_PAID_ADS_ACCESS_REQUIRED", "Provide access model and owner contact.", question.examples?.[0]);
      }
      return { decision: "accept" as const };
    }
    case "operations.paid_ads_spend_bracket": {
      const numbers = parseNumbers(trimmed);
      if (numbers.length < 2 || numbers[1] < numbers[0]) {
        return validationFollowUp("ERR_PAID_ADS_SPEND_BRACKET_REQUIRED", "Use a low-high spend bracket such as 1500-5000.");
      }
      return { decision: "accept" as const };
    }
    default:
      break;
  }

  if (question.input_type === "numeric") {
    const numbers = parseNumbers(trimmed);
    if (numbers.length === 0) {
      return validationFollowUp(question.error_code ?? "ERR_NUMERIC_FORMAT", question.help_text ?? "Please reply with a number.", question.examples?.[0]);
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "percent") {
    const numbers = parseNumbers(trimmed);
    if (numbers.length < 2) {
      return validationFollowUp(question.error_code ?? "ERR_PERCENT_FORMAT", question.help_text ?? "Please provide a split in percentages.", question.examples?.[0]);
    }
    const sum = numbers.reduce((total, value) => total + value, 0);
    if (sum < 95 || sum > 105) {
      return validationFollowUp(question.error_code ?? "ERR_PERCENT_SUM", "Percentages should sum to 100.", question.examples?.[0]);
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "tz_lang") {
    if (!isLikelyTimezone(trimmed)) {
      return validationFollowUp(question.error_code ?? "ERR_TIMEZONE_INVALID", question.help_text ?? "Use a valid timezone.", question.examples?.[0]);
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "list") {
    const items = toList(trimmed);
    if (items.length === 0) {
      return validationFollowUp(question.error_code ?? "ERR_LIST_REQUIRED", question.help_text ?? "Please provide at least one item.", question.examples?.[0]);
    }
    return { decision: "accept" as const };
  }

  if (question.input_type === "text") {
    if (!/[a-zA-Z0-9]/.test(trimmed)) {
      return validationFollowUp(question.error_code ?? "ERR_TEXT_TOO_SHORT", "Please provide a meaningful text answer.", question.examples?.[0]);
    }
    if (trimmed.length < 2) {
      return validationFollowUp(question.error_code ?? "ERR_TEXT_TOO_SHORT", question.help_text ?? "Please share a brief answer.", question.examples?.[0]);
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
      : "This helps me tailor your setup and recommendations.";
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
  suggestionsOverride?: string[];
}) {
  const mergedSuggestions = params.suggestionsOverride?.length
    ? params.suggestionsOverride
    : buildPrimarySuggestions(params.question, params.snapshot);

  return {
    v: FN_VERSION,
    trace_id: params.traceId,
    onboarding_status: params.onboardingStatus,
    assistant_message: sanitizeUserFacingAssistantMessage(params.assistantMessage ?? params.question.question_text),
    expects: params.question.input_type,
    suggestions: mergedSuggestions,
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

      const parsedV2 = v2RequestSchema.safeParse(rawBody);
      if (parsedV2.success) {
        const payloadV2 = parsedV2.data;
        agencyId = payloadV2.agency_id;
        clientId = payloadV2.client_id;
        observedRequestId = payloadV2.client_turn_id;

        const [hasMembership, validClientScope] = await Promise.all([
          ensureAgencyMembership(supabase, agencyId, user.id),
          ensureClientBelongsToAgency(supabase, agencyId, clientId),
        ]);
        if (!hasMembership) {
          return jsonResponse(req, { version: "v2", status: "error", errors: [{ code: "FORBIDDEN", message: "Forbidden" }] }, 403);
        }
        if (!validClientScope) {
          return jsonResponse(
            req,
            { version: "v2", status: "error", errors: [{ code: "INVALID_SCOPE", message: "client_id does not belong to agency_id" }] },
            400
          );
        }

        const { data: profileRow } = await supabase
          .from("client_onboarding_profiles")
          .select("*")
          .eq("client_id", clientId)
          .maybeSingle();

        const currentState = asRecord(profileRow ?? {});
        const lastUserMessage =
          [...payloadV2.messages].reverse().find((message) => message.role === "user")?.content?.trim() ?? "";
        const intent = classifyV2Intent(lastUserMessage);
        const userConfidence = payloadV2.ui_context?.user_confidence ?? "medium";

          const heuristic = parseV2HeuristicUpdates(lastUserMessage, currentState, intent);
        let updates: Record<string, unknown> = heuristic.updates;
        let confidence = heuristic.confidence;
        let followUp: string | undefined = heuristic.followUp;

        const heuristicSignals = Object.keys(heuristic.updates).length;
        const lowSignalIntent = intent === "vague_answer" || intent === "off_topic";
        const asksForHelp = intent === "help_request" || intent === "question";
        const enableLlmExtract = Deno.env.get("ONBOARDING_V2_ENABLE_LLM_EXTRACT") === "true";
        const shouldSkipLlmExtract =
          !enableLlmExtract ||
          lowSignalIntent ||
          asksForHelp ||
          heuristicSignals >= 2 ||
          (heuristicSignals >= 1 && confidence >= 0.72 && !asksForHelp);

        if (!shouldSkipLlmExtract) {
          try {
            const extractPrompt = [
              "You are mapping onboarding chat turns into strict JSON field updates.",
              'Return JSON only: {"updates": {...}, "confidence": 0.0, "follow_up": "optional"}',
              "Only include keys that exist in client onboarding profile schema.",
              `User message: ${lastUserMessage}`,
              `Current state JSON: ${JSON.stringify(currentState)}`,
            ].join("\n");

            const aiResult = await runAiTask({
              task_type: TaskType.EXTRACT_STRUCTURED,
              tenant: { agency_id: agencyId, client_id: clientId, user_id: user.id },
              input: { message: extractPrompt },
              metadata: {
                instructions: "JSON only. updates object + confidence number + follow_up optional.",
              },
              supabase,
            });

            const json = asRecord(aiResult?.json ?? {});
            const aiUpdates = asRecord(json.updates ?? {});
            const parsedConfidence = Number(json.confidence);
            if (Object.keys(aiUpdates).length > 0) {
              updates = { ...updates, ...aiUpdates };
              if (Number.isFinite(parsedConfidence)) {
                confidence = Math.max(confidence, Math.max(0.3, Math.min(0.95, parsedConfidence)));
              }
            } else if (Number.isFinite(parsedConfidence)) {
              if (Object.keys(updates).length === 0) {
                confidence = Math.max(0.3, Math.min(0.95, parsedConfidence));
              }
            }
            if (typeof json.follow_up === "string" && json.follow_up.trim()) {
              followUp = json.follow_up.trim();
            }
          } catch (_error) {
            // keep heuristic result on extraction failure
          }
        }

        if (Object.keys(updates).length === 0 && (intent === "help_request" || intent === "question")) {
          const currentProgress = getV5ProgressSummary(currentState as never);
          const firstMissing = currentProgress.missingFields[0];
          updates = buildDraftForMissingField(firstMissing, currentState);
          confidence = Object.keys(updates).length > 0 ? 0.62 : 0.52;
          if (Object.keys(updates).length === 0) {
            followUp = followUp ?? "Share one concrete answer for the current field and I will map it instantly.";
          }
        } else if (intent === "vague_answer" || intent === "off_topic") {
          confidence = Math.min(confidence, 0.5);
          followUp = followUp ?? "Next: share one clear client type + budget + goal so I can map this accurately.";
        }

        if (userConfidence === "low") {
          confidence = Math.min(confidence, 0.74);
          if (Object.keys(updates).length > 0) {
            const firstUpdateField = Object.keys(updates)[0];
            const updateLabel = toFieldLabel(firstUpdateField);
            followUp =
              followUp ??
              `I mapped a draft for ${updateLabel}. If any detail is uncertain, edit it now and I will refine before applying.`;
          } else {
            followUp =
              followUp ?? "No problem. Share the best draft you have and I will convert it into a cleaner answer.";
          }
        } else if (userConfidence === "high" && intent === "direct_answer" && Object.keys(updates).length > 0) {
          confidence = Math.min(0.95, confidence + 0.05);
        }

        const mergedState = sanitizeSnapshot({ ...currentState, ...updates });
        const progress = getV5ProgressSummary(mergedState as never);
        const complete = progress.missingFields.length === 0;
        const topMissing = progress.missingFields[0];
        const nextPrompt = nextPromptForMissingField(topMissing);
        const strategicImpact = buildStrategicImpactLine(mergedState, progress.missingFields.length);
        const suggestions = buildIntentAwareSuggestions({
          intent,
          state: mergedState,
          missingFields: progress.missingFields,
        });

        const currentStateVersion = await hashSnapshot(mergedState);
        const assistantMessage = buildV2AssistantMessage({
          intent,
          nextPrompt,
          remainingMissing: progress.missingFields.length,
          userMessage: lastUserMessage,
        });
        const expertClarification = buildExpertClarificationFollowUp({
          state: mergedState,
          topMissingField: topMissing,
          intent,
        });

        if (!complete) {
          if (!followUp && nextPrompt.example) {
            followUp = `${nextPrompt.example} ${strategicImpact}`;
          } else if (followUp) {
            followUp = `${followUp} ${strategicImpact}`;
          }
          if (intent !== "direct_answer") {
            followUp = followUp ? `${expertClarification} ${followUp}` : expertClarification;
          }
        }

        return jsonResponse(req, {
          version: "v2",
          status: complete ? "complete" : confidence < 0.6 ? "calibration_needed" : "in_progress",
          assistant_message: assistantMessage,
          intent,
          expects: "textarea",
          constraints: { required: true, min: 3, max: 1200, pattern: null },
          suggestions: suggestions.slice(0, 4),
          updates,
          confidence,
          follow_up: followUp,
          current_state_json: {
            ...mergedState,
            __v2_user_confidence: userConfidence,
          },
          current_state_version: currentStateVersion,
          errors: [],
        });
      }

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
        const userAskedQuestion = isLikelyQuestion(userInput);
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
            userAskedQuestion);

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
              if (!unresolvedP0.includes(currentQuestion.field_path)) {
                unresolvedP0.push(currentQuestion.field_path);
                observedUnresolvedP0Count = unresolvedP0.length;
              }
              const progress = countRequiredComplete(draftSnapshot);
              const followUpMessage = userAskedQuestion
                ? sanitizeUserFacingAssistantMessage(buildQuestionIntentReplyWithDraft(currentQuestion, draftSnapshot))
                : "If you're unsure, reply \"continue\" to move on, or share a best-effort answer now.";
              const assistantMessage = clarificationText
                ? `${sanitizeUserFacingAssistantMessage(clarificationText)} ${sanitizeUserFacingAssistantMessage(followUpMessage)}`
                : sanitizeUserFacingAssistantMessage(followUpMessage);
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
                suggestionsOverride: buildFollowUpSuggestions(currentQuestion, draftSnapshot),
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
                    last_clarify_reason: "p0_confirm_gate",
                    last_clarify_text: assistantMessage,
                  },
                })
                .eq("id", onboardingStatus.id);

              return jsonResponse(req, parsedResponse.data, 200);
            }
          } else {
            followupCounts[currentQuestion.field_path] = followupCount + 1;
            observedFollowupCount = followupCounts[currentQuestion.field_path] as number;
            const progress = countRequiredComplete(draftSnapshot);
            const followUpMessage = userAskedQuestion
              ? sanitizeUserFacingAssistantMessage(buildQuestionIntentReplyWithDraft(currentQuestion, draftSnapshot))
              : (localCheck.decision === "follow_up"
                ? localCheck.message
                : llmFollowUp ?? "Can you share a bit more detail so I can capture it correctly?");
            const assistantMessage = clarificationText
              ? `${sanitizeUserFacingAssistantMessage(clarificationText)} ${sanitizeUserFacingAssistantMessage(followUpMessage)}`
              : sanitizeUserFacingAssistantMessage(followUpMessage);
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
              suggestionsOverride: buildFollowUpSuggestions(currentQuestion, draftSnapshot),
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

      // Persist turn-level evidence for deterministic branch as well.
      const nextIndex = await getLatestTurnIndex(supabase, onboardingStatus.id);
      await supabase.from("ai_onboarding_turn_logs").insert({
        agency_id: agencyId,
        client_id: clientId,
        onboarding_status_id: onboardingStatus.id,
        scope,
        turn_index: nextIndex,
        step_id: nextQuestion.module,
        user_message: userInput || null,
        assistant_message: parsedResponse.data.assistant_message,
        // Deterministic path does not build a chat transcript; persist empty trace bucket.
        messages_json: [],
        snapshot_json: {
          draft_brain_json: draftSnapshot,
          resolver_state: "ready",
          classifier: null,
          planner: null,
        },
        response_json: parsedResponse.data,
        trace_id: traceId,
        span_id: rootSpanId,
        source_endpoint: "ai-onboarding",
        created_by: user.id,
        client_turn_id: payload.client_turn_id ?? null,
      });

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
          ? sanitizeUserFacingAssistantMessage(guidedOutput.assistant_message.trim())
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


