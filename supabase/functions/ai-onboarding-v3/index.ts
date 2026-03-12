import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

type V3Intent = "answer" | "clarification_request" | "help_me_answer" | "question_about_process" | "off_topic";
type V3AssistantMode = "Collect" | "Clarify" | "Coach" | "Confirm";
type V3FieldStatus = "missing" | "draft" | "confirmed" | "blocked";

type V3FieldDef = {
  id: string;
  label: string;
  prompt: string;
  parser: (input: string, state: Record<string, unknown>) => { updates: Record<string, unknown>; confidence: number; error?: string };
  templates: Array<{ id: string; label: string; template: string }>;
};

type V3Request = {
  agency_id: string;
  client_id: string;
  turn_id: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  state_version?: string | null;
  action?: "turn" | "apply_proposed_updates" | "undo_last_apply";
  proposed_updates?: Record<string, unknown>;
  ui_context?: {
    locale?: string;
    timezone?: string;
    user_confidence?: "high" | "medium" | "low";
  };
};

type V3StateDoc = {
  state_version: string;
  current_field_id: string | null;
  resolved_fields: string[];
  pending_clarification: boolean;
  turn_history: Array<{ turn_id: string; intent: V3Intent; field_id: string | null; at: string }>;
  last_applied_patch: Record<string, unknown> | null;
  last_applied_previous: Record<string, unknown> | null;
  completion_score: number;
  status_by_field: Record<string, V3FieldStatus>;
  last_turn_id: string | null;
  last_response_json: Record<string, unknown> | null;
};

const REQUIRED_FIELDS = [
  "q1_business_name",
  "industry_niche",
  "primary_goal",
  "conversion_path",
  "conversion_link",
  "q6_offer_name",
  "primary_customer",
  "q9_pain_points",
  "platforms",
  "formats",
  "cadence_per_platform",
  "brand_voice",
  "content_style",
];

function clampConfidence(value: number): number {
  if (value < 0.3) return 0.3;
  if (value > 0.95) return 0.95;
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripLeadingLabel(input: string, labels: string[]): string {
  let output = input.trim();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`^${escaped}\\s*[:=-]\\s*`, "i");
    output = output.replace(pattern, "");
  }
  return normalizeText(output);
}

function toArrayFromCsv(input: string): string[] {
  return input
    .split(/[,\n|]/g)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

function classifyIntent(input: string): V3Intent {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "clarification_request";
  if (/\b(weather|football|movie|song|crypto|bitcoin|politics)\b/.test(normalized)) return "off_topic";
  if (/\b(help|example|suggest|draft|write it|create it for me|can you do it|not sure how)\b/.test(normalized)) return "help_me_answer";
  if (/\b(how does this work|what happens|why do you need|what do you do with|what is this)\b/.test(normalized)) return "question_about_process";
  if (normalized.includes("?")) return "clarification_request";
  if (normalized.length < 8 || /\b(idk|dont know|don't know|not sure|whatever)\b/.test(normalized)) return "clarification_request";
  return "answer";
}

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseCadence(input: string, state: Record<string, unknown>) {
  const lines = toArrayFromCsv(input);
  const platforms = Array.isArray(state.platforms) ? (state.platforms as string[]) : [];
  const cadence: Record<string, number> = {};

  for (const line of lines) {
    const match = line.match(/([a-z_]+)\s*[:=-]\s*(\d{1,2})/i);
    if (match) cadence[match[1].toLowerCase()] = Number(match[2]);
  }
  if (Object.keys(cadence).length > 0) {
    return { updates: { cadence_per_platform: cadence }, confidence: 0.84 };
  }

  const numeric = Number(lines[0]);
  if (Number.isFinite(numeric) && numeric > 0) {
    const fallbackPlatforms = platforms.length > 0 ? platforms : ["instagram"];
    for (const platform of fallbackPlatforms) cadence[platform] = numeric;
    return { updates: { cadence_per_platform: cadence }, confidence: 0.72 };
  }

  return { updates: {}, confidence: 0.45, error: "Use format like: instagram:5, tiktok:3" };
}

const FIELD_DEFS: V3FieldDef[] = [
  {
    id: "q1_business_name",
    label: "Business name",
    prompt: "What is the exact public business name?",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Business name", "Client name", "Company name"]);
      if (value.length < 2) return { updates: {}, confidence: 0.4, error: "Share the exact public business name." };
      return { updates: { q1_business_name: value }, confidence: 0.9 };
    },
    templates: [
      { id: "q1-1", label: "Template", template: "Business name: [Exact public business name]" },
      { id: "q1-2", label: "Example", template: "Business name: Northwave Fitness" },
      { id: "q1-3", label: "Need help", template: "I am unsure. Give me one strong example I can edit." },
    ],
  },
  {
    id: "industry_niche",
    label: "Industry / niche",
    prompt: "What is the client industry/niche? Use one clear category.",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Industry / niche", "Industry", "Niche"]).toLowerCase().replace(/\s+/g, "_");
      if (value.length < 3) return { updates: {}, confidence: 0.45, error: "Use one clear niche, for example dental_clinic." };
      return { updates: { industry_niche: value }, confidence: 0.84 };
    },
    templates: [
      { id: "n1", label: "Dental clinic", template: "Industry / niche: dental_clinic" },
      { id: "n2", label: "Gym studio", template: "Industry / niche: gym_fitness_studio" },
      { id: "n3", label: "B2B SaaS", template: "Industry / niche: saas_tech" },
    ],
  },
  {
    id: "primary_goal",
    label: "Primary goal",
    prompt: "What is the primary business goal right now?",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Primary goal", "Goal"]).toLowerCase().replace(/\s+/g, "_");
      return { updates: { primary_goal: value }, confidence: 0.82 };
    },
    templates: [
      { id: "g1", label: "More leads", template: "Primary goal: more_leads" },
      { id: "g2", label: "More sales", template: "Primary goal: more_online_sales" },
      { id: "g3", label: "More bookings", template: "Primary goal: more_bookings" },
    ],
  },
  {
    id: "conversion_path",
    label: "Conversion path",
    prompt: "What is the main conversion path? (book_call, book_appointment, dm_keyword, whatsapp, website_checkout, visit_store)",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Conversion path", "Path"]).toLowerCase().replace(/\s+/g, "_");
      return { updates: { conversion_path: value }, confidence: 0.82 };
    },
    templates: [
      { id: "cp1", label: "Book call", template: "Conversion path: book_call" },
      { id: "cp2", label: "DM keyword", template: "Conversion path: dm_keyword" },
      { id: "cp3", label: "Website checkout", template: "Conversion path: website_checkout" },
    ],
  },
  {
    id: "conversion_link",
    label: "Conversion link",
    prompt: "What is the conversion link users should visit?",
    parser: (input) => {
      const candidate = stripLeadingLabel(input, ["Conversion link", "Link", "URL"]);
      if (!isUrl(candidate)) return { updates: {}, confidence: 0.45, error: "Use a full URL, for example https://calendly.com/..." };
      return { updates: { conversion_link: candidate }, confidence: 0.9 };
    },
    templates: [
      { id: "cl1", label: "Calendly example", template: "Conversion link: https://calendly.com/brand/demo-call" },
      { id: "cl2", label: "Landing page", template: "Conversion link: https://yourdomain.com/book" },
      { id: "cl3", label: "Placeholder", template: "Conversion link: https://your-link-here" },
    ],
  },
  {
    id: "q6_offer_name",
    label: "Core offer name",
    prompt: "What is the main paid offer name?",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Core offer", "Offer name", "Offer"]);
      if (value.length < 3) return { updates: {}, confidence: 0.5, error: "Share one clear offer name." };
      return { updates: { q6_offer_name: value }, confidence: 0.88 };
    },
    templates: [
      { id: "o1", label: "Retainer offer", template: "Core offer: Growth Accelerator Retainer" },
      { id: "o2", label: "Sprint offer", template: "Core offer: Lead Generation Sprint (90 days)" },
      { id: "o3", label: "Template", template: "Core offer: [Main paid service name]" },
    ],
  },
  {
    id: "primary_customer",
    label: "Ideal customer",
    prompt: "Describe ideal customer in one line: who they are, budget, and primary goal.",
    parser: (input) => {
      const value = stripLeadingLabel(input, ["Ideal customer", "Primary customer", "ICP"]);
      if (value.length < 16) return { updates: {}, confidence: 0.5, error: "Use who + budget + goal in one line." };
      return { updates: { primary_customer: value }, confidence: 0.82 };
    },
    templates: [
      { id: "icp1", label: "Clinic owner ICP", template: "Ideal customer: Local clinic owner | Budget: 1500 EUR/mo | Goal: 30 qualified leads monthly" },
      { id: "icp2", label: "SaaS founder ICP", template: "Ideal customer: B2B SaaS founder | Budget: 3000 EUR/mo | Goal: More booked demos" },
      { id: "icp3", label: "Template", template: "Ideal customer: [who] | Budget: [range] | Goal: [outcome]" },
    ],
  },
  {
    id: "q9_pain_points",
    label: "Top pain points",
    prompt: "List top 3 pain points (comma-separated).",
    parser: (input) => {
      const values = toArrayFromCsv(stripLeadingLabel(input, ["Top pain points", "Pain points"]));
      if (values.length < 3) return { updates: {}, confidence: 0.45, error: "Please provide at least 3 pain points." };
      return { updates: { q9_pain_points: values.slice(0, 5) }, confidence: 0.86 };
    },
    templates: [
      { id: "pp1", label: "Lead quality + consistency", template: "Top pain points: Low lead quality, Inconsistent content, Weak conversion from DMs" },
      { id: "pp2", label: "Sales friction", template: "Top pain points: Too few qualified calls, Price objections, Low close rates" },
      { id: "pp3", label: "Template", template: "Top pain points: [Pain 1], [Pain 2], [Pain 3]" },
    ],
  },
  {
    id: "platforms",
    label: "Platforms",
    prompt: "Which platforms are in scope? (comma-separated)",
    parser: (input) => {
      const values = toArrayFromCsv(stripLeadingLabel(input, ["Platforms", "Channels"])).map((value) =>
        value.toLowerCase().replace(/\s+/g, "_")
      );
      if (values.length === 0) return { updates: {}, confidence: 0.4, error: "Share at least one platform." };
      return { updates: { platforms: values, q16_enabled_channels: values }, confidence: 0.88 };
    },
    templates: [
      { id: "pl1", label: "Instagram + TikTok", template: "Platforms: instagram, tiktok" },
      { id: "pl2", label: "LinkedIn + YouTube", template: "Platforms: linkedin, youtube" },
      { id: "pl3", label: "Template", template: "Platforms: [platform1], [platform2]" },
    ],
  },
  {
    id: "formats",
    label: "Content formats",
    prompt: "Which content formats will be used? (comma-separated)",
    parser: (input) => {
      const values = toArrayFromCsv(stripLeadingLabel(input, ["Formats", "Content style", "Content formats"]));
      if (values.length === 0) return { updates: {}, confidence: 0.45, error: "Provide at least one content format." };
      return { updates: { formats: values }, confidence: 0.84 };
    },
    templates: [
      { id: "f1", label: "Short-form mix", template: "Formats: short_video, carousels, stories" },
      { id: "f2", label: "Educational mix", template: "Formats: educational_tips, case_study_posts, founder_clips" },
      { id: "f3", label: "Template", template: "Formats: [format1], [format2]" },
    ],
  },
  {
    id: "cadence_per_platform",
    label: "Posting cadence",
    prompt: "Set weekly cadence per platform (example: instagram:5, tiktok:4).",
    parser: (input, state) => parseCadence(stripLeadingLabel(input, ["Cadence", "Posting cadence"]), state),
    templates: [
      { id: "c1", label: "Balanced cadence", template: "instagram:5, tiktok:4" },
      { id: "c2", label: "Lean cadence", template: "instagram:3, tiktok:2" },
      { id: "c3", label: "Template", template: "instagram:[x], tiktok:[y]" },
    ],
  },
  {
    id: "brand_voice",
    label: "Brand voice",
    prompt: "Choose 2-3 brand voice traits (comma-separated).",
    parser: (input) => {
      const values = toArrayFromCsv(stripLeadingLabel(input, ["Brand voice", "Voice"])).map((value) =>
        value.toLowerCase().replace(/\s+/g, "_")
      );
      if (values.length < 2) return { updates: {}, confidence: 0.45, error: "Pick at least 2 voice traits." };
      return { updates: { brand_voice: values.slice(0, 3) }, confidence: 0.85 };
    },
    templates: [
      { id: "bv1", label: "Professional + direct", template: "Brand voice: professional, direct" },
      { id: "bv2", label: "Friendly + educational", template: "Brand voice: friendly, educational" },
      { id: "bv3", label: "Template", template: "Brand voice: [trait1], [trait2]" },
    ],
  },
  {
    id: "content_style",
    label: "Content style",
    prompt: "Choose main content style(s) (comma-separated).",
    parser: (input) => {
      const values = toArrayFromCsv(stripLeadingLabel(input, ["Content style", "Style"])).map((value) =>
        value.toLowerCase().replace(/\s+/g, "_")
      );
      if (values.length === 0) return { updates: {}, confidence: 0.45, error: "Share at least one style." };
      return { updates: { content_style: values.slice(0, 3) }, confidence: 0.85 };
    },
    templates: [
      { id: "cs1", label: "Educational", template: "Content style: educational_tips, storytelling" },
      { id: "cs2", label: "Proof-driven", template: "Content style: social_proof, before_after" },
      { id: "cs3", label: "Template", template: "Content style: [style1], [style2]" },
    ],
  },
];

const FIELD_DEF_MAP = new Map(FIELD_DEFS.map((field) => [field.id, field]));

function resolvedFromProfile(profile: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS.filter((fieldId) => {
    const value = profile[fieldId];
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return value !== null && value !== undefined && String(value).trim().length > 0;
  });
}

function nextMissingField(profile: Record<string, unknown>, state: V3StateDoc): string | null {
  const resolved = new Set([...resolvedFromProfile(profile), ...(state.resolved_fields ?? [])]);
  for (const fieldId of REQUIRED_FIELDS) {
    if (!resolved.has(fieldId)) return fieldId;
  }
  return null;
}

async function stableHash(input: unknown): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function toAssistantMode(intent: V3Intent, hasUpdates: boolean, needsConfirmation: boolean): V3AssistantMode {
  if (intent === "help_me_answer") return "Coach";
  if (intent === "clarification_request" || intent === "question_about_process") return "Clarify";
  if (needsConfirmation || hasUpdates) return "Confirm";
  return "Collect";
}

function processQuestionAnswer(fieldDef: V3FieldDef, input: string, state: Record<string, unknown>) {
  const parsed = fieldDef.parser(input, state);
  const updates = parsed.updates ?? {};
  const confidence = clampConfidence(parsed.confidence ?? 0.5);
  const requiresConfirmation = confidence < 0.8;
  return { updates, confidence, requiresConfirmation, parseError: parsed.error };
}

function buildFieldStatus(
  profile: Record<string, unknown>,
  currentFieldId: string | null,
  pendingClarification: boolean,
  lastUpdates: Record<string, unknown>,
  priorState: Record<string, V3FieldStatus>
): Record<string, V3FieldStatus> {
  const status: Record<string, V3FieldStatus> = { ...priorState };
  const resolved = new Set(resolvedFromProfile(profile));
  for (const fieldId of REQUIRED_FIELDS) {
    if (resolved.has(fieldId)) {
      status[fieldId] = "confirmed";
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(lastUpdates, fieldId)) {
      status[fieldId] = "draft";
      continue;
    }
    status[fieldId] = fieldId === currentFieldId && pendingClarification ? "blocked" : "missing";
  }
  return status;
}

function createDefaultState(): V3StateDoc {
  return {
    state_version: "init",
    current_field_id: REQUIRED_FIELDS[0],
    resolved_fields: [],
    pending_clarification: false,
    turn_history: [],
    last_applied_patch: null,
    last_applied_previous: null,
    completion_score: 0,
    status_by_field: {},
    last_turn_id: null,
    last_response_json: null,
  };
}

function recentTurnsOnField(state: V3StateDoc, fieldId: string | null, sample = 6): number {
  if (!fieldId) return 0;
  const recent = (state.turn_history ?? []).slice(-sample);
  return recent.filter((turn) => turn.field_id === fieldId).length;
}

function sanitizeProposedUpdates(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const allowed = new Set([
    "q1_business_name",
    "industry_niche",
    "primary_goal",
    "conversion_path",
    "conversion_link",
    "q6_offer_name",
    "primary_customer",
    "q9_pain_points",
    "platforms",
    "q16_enabled_channels",
    "formats",
    "cadence_per_platform",
    "q18_cadence",
    "brand_voice",
    "content_style",
  ]);
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    output[key] = value;
  }
  if (Array.isArray(output.platforms) && !Array.isArray(output.q16_enabled_channels)) {
    output.q16_enabled_channels = output.platforms;
  }
  if (output.cadence_per_platform && !output.q18_cadence) {
    output.q18_cadence = output.cadence_per_platform;
  }
  return output;
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const guardResponse = getEndpointGuardResponse("ai-onboarding-v3", headers);
    if (guardResponse) return guardResponse;

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "METHOD_NOT_ALLOWED", message: "Method not allowed" }] }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "UNAUTHORIZED", message: "Missing Authorization header" }] }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as V3Request;
    const action = body?.action ?? "turn";
    const requiresMessages = action === "turn";
    if (
      !body?.agency_id ||
      !body?.client_id ||
      !body?.turn_id ||
      (requiresMessages && (!Array.isArray(body?.messages) || body.messages.length === 0))
    ) {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "INVALID_REQUEST", message: "Missing required request fields" }] }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "UNAUTHORIZED", message: "Unauthorized" }] }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const [{ data: membership }, { data: agencyOwner }, { data: client }] = await Promise.all([
      supabase.from("agency_members").select("id").eq("agency_id", body.agency_id).eq("user_id", user.id).maybeSingle(),
      supabase.from("agencies").select("id").eq("id", body.agency_id).eq("owner_user_id", user.id).maybeSingle(),
      supabase.from("clients").select("id").eq("id", body.client_id).eq("agency_id", body.agency_id).maybeSingle(),
    ]);

    if (!membership && !agencyOwner) {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "FORBIDDEN", message: "Not a member of this agency" }] }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (!client) {
      return new Response(JSON.stringify({ version: "v3", errors: [{ code: "INVALID_SCOPE", message: "client_id does not belong to agency_id" }] }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const [{ data: profileRow }, { data: stateRow, error: stateReadError }] = await Promise.all([
      supabase.from("client_onboarding_profiles").select("*").eq("client_id", body.client_id).maybeSingle(),
      supabase.from("client_onboarding_v3_states").select("*").eq("client_id", body.client_id).eq("agency_id", body.agency_id).maybeSingle(),
    ]);

    const profile = (profileRow ?? {}) as Record<string, unknown>;
    const state = (stateRow?.state_doc as V3StateDoc | null) ?? createDefaultState();
    const persistedStateVersion = typeof stateRow?.state_version === "string" ? stateRow.state_version : null;

    // Only enforce stale-state protection when a persisted state row exists.
    if (body.state_version && persistedStateVersion && body.state_version !== persistedStateVersion) {
      return new Response(
        JSON.stringify({
          version: "v3",
          assistant_message: "This onboarding tab is out of date. Refreshing state now.",
          assistant_mode: "Clarify",
          intent: "question_about_process",
          next_field: state.current_field_id,
          field_status: state.status_by_field ?? {},
          structured_suggestions: [],
          proposed_updates: {},
          confidence: 0.5,
          requires_confirmation: false,
          state_version: state.state_version,
          done: false,
          errors: [{ code: "STALE_STATE_VERSION", message: "State version mismatch. Reload and retry." }],
        }),
        { status: 409, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    if (stateReadError) {
      console.warn(
        JSON.stringify({
          stage: "onboarding_v3_state_read_warning",
          agency_id: body.agency_id,
          client_id: body.client_id,
          code: stateReadError.code,
          message: stateReadError.message,
        })
      );
    }

    if (action === "turn" && state.last_turn_id && state.last_turn_id === body.turn_id && state.last_response_json) {
      return new Response(JSON.stringify(state.last_response_json), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (action === "apply_proposed_updates") {
      const proposed = sanitizeProposedUpdates(body.proposed_updates);
      if (Object.keys(proposed).length === 0) {
        return new Response(
          JSON.stringify({
            version: "v3",
            assistant_message: "No valid mapped updates to apply.",
            assistant_mode: "Clarify",
            intent: "question_about_process",
            next_field: state.current_field_id,
            field_status: state.status_by_field ?? {},
            structured_suggestions: [],
            proposed_updates: {},
            confidence: 0.5,
            requires_confirmation: false,
            state_version: state.state_version,
            done: false,
            errors: [{ code: "NO_UPDATES", message: "No valid proposed updates found." }],
          }),
          { status: 400, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }

      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(proposed)) previous[key] = profile[key] ?? null;

      await supabase.from("client_onboarding_profiles").upsert(
        {
          client_id: body.client_id,
          agency_id: body.agency_id,
          flow_type: "agency_led",
          ...proposed,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

      const mergedProfile = { ...profile, ...proposed };
      const resolved = resolvedFromProfile(mergedProfile);
      const done = REQUIRED_FIELDS.every((field) => resolved.includes(field));
      const nextField = done ? null : nextMissingField(mergedProfile, state);
      const nextDef = nextField ? FIELD_DEF_MAP.get(nextField) ?? null : null;
      const statusByField = buildFieldStatus(
        mergedProfile,
        nextField,
        false,
        proposed,
        state.status_by_field ?? {}
      );
      const stateVersion = await stableHash({
        client_id: body.client_id,
        resolved,
        current_field_id: nextField,
        done,
        completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
      });

      const responsePayload = {
        version: "v3" as const,
        assistant_message: done
          ? "Saved. Profile complete."
          : `Saved. Next: ${nextDef?.prompt ?? "Continue onboarding."}`,
        assistant_mode: "Confirm" as const,
        intent: "answer" as const,
        next_field: nextField,
        field_status: statusByField,
        structured_suggestions: nextDef?.templates ?? [],
        proposed_updates: {},
        confidence: 0.9,
        requires_confirmation: false,
        state_version: stateVersion,
        done,
        errors: [] as Array<{ code: string; message: string }>,
      };

      const nextState: V3StateDoc = {
        ...state,
        state_version: stateVersion,
        current_field_id: nextField,
        resolved_fields: resolved,
        pending_clarification: false,
        last_applied_patch: proposed,
        last_applied_previous: previous,
        completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
        status_by_field: statusByField,
        last_turn_id: body.turn_id,
        last_response_json: responsePayload,
        turn_history: [
          ...(state.turn_history ?? []).slice(-49),
          { turn_id: body.turn_id, intent: "answer", field_id: nextField, at: new Date().toISOString() },
        ],
      };
      await supabase.from("client_onboarding_v3_states").upsert(
        {
          client_id: body.client_id,
          agency_id: body.agency_id,
          state_doc: nextState,
          state_version: stateVersion,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (action === "undo_last_apply") {
      if (!state.last_applied_previous || Object.keys(state.last_applied_previous).length === 0) {
        return new Response(
          JSON.stringify({
            version: "v3",
            assistant_message: "Nothing to undo yet.",
            assistant_mode: "Clarify",
            intent: "question_about_process",
            next_field: state.current_field_id,
            field_status: state.status_by_field ?? {},
            structured_suggestions: [],
            proposed_updates: {},
            confidence: 0.55,
            requires_confirmation: false,
            state_version: state.state_version,
            done: false,
            errors: [],
          }),
          { status: 200, headers: { ...headers, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("client_onboarding_profiles").upsert(
        {
          client_id: body.client_id,
          agency_id: body.agency_id,
          flow_type: "agency_led",
          ...state.last_applied_previous,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

      const mergedProfile = { ...profile, ...state.last_applied_previous };
      const resolved = resolvedFromProfile(mergedProfile);
      const done = REQUIRED_FIELDS.every((field) => resolved.includes(field));
      const nextField = done ? null : nextMissingField(mergedProfile, state);
      const nextDef = nextField ? FIELD_DEF_MAP.get(nextField) ?? null : null;
      const statusByField = buildFieldStatus(
        mergedProfile,
        nextField,
        false,
        {},
        state.status_by_field ?? {}
      );
      const stateVersion = await stableHash({
        client_id: body.client_id,
        resolved,
        current_field_id: nextField,
        done,
        completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
      });

      const responsePayload = {
        version: "v3" as const,
        assistant_message: done
          ? "Undo complete. Profile remains complete."
          : `Undone. Next: ${nextDef?.prompt ?? "Continue onboarding."}`,
        assistant_mode: "Confirm" as const,
        intent: "answer" as const,
        next_field: nextField,
        field_status: statusByField,
        structured_suggestions: nextDef?.templates ?? [],
        proposed_updates: {},
        confidence: 0.88,
        requires_confirmation: false,
        state_version: stateVersion,
        done,
        errors: [] as Array<{ code: string; message: string }>,
      };

      const nextState: V3StateDoc = {
        ...state,
        state_version: stateVersion,
        current_field_id: nextField,
        resolved_fields: resolved,
        pending_clarification: false,
        last_applied_patch: null,
        last_applied_previous: null,
        completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
        status_by_field: statusByField,
        last_turn_id: body.turn_id,
        last_response_json: responsePayload,
        turn_history: [
          ...(state.turn_history ?? []).slice(-49),
          { turn_id: body.turn_id, intent: "answer", field_id: nextField, at: new Date().toISOString() },
        ],
      };
      await supabase.from("client_onboarding_v3_states").upsert(
        {
          client_id: body.client_id,
          agency_id: body.agency_id,
          state_doc: nextState,
          state_version: stateVersion,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const lastUserMessage = [...body.messages].reverse().find((message) => message.role === "user")?.content?.trim() ?? "";
    const intent = classifyIntent(lastUserMessage);
    const activeField = nextMissingField(profile, state);
    const fieldDef = activeField ? FIELD_DEF_MAP.get(activeField) ?? null : null;

    let assistantMessage = "All required fields are complete.";
    let nextField: string | null = activeField;
    let proposedUpdates: Record<string, unknown> = {};
    let confidence = 0.9;
    let requiresConfirmation = false;
    let pendingClarification = false;
    let parseFailReason: string | null = null;

    const repeatCount = recentTurnsOnField(state, activeField);
    if (!fieldDef) {
      assistantMessage = "Profile complete. You can proceed to strategy generation.";
      nextField = null;
      confidence = 0.95;
    } else if (intent === "off_topic") {
      pendingClarification = true;
      confidence = 0.45;
      assistantMessage = `Let's keep this focused. ${fieldDef.prompt}`;
      if (repeatCount >= 2 && fieldDef.templates[0]) {
        assistantMessage = `Let's finish this field now. Use this format: ${fieldDef.templates[0].template}`;
      }
    } else if (intent === "question_about_process") {
      pendingClarification = true;
      confidence = 0.58;
      assistantMessage = `We use this to generate your strategy and execution plan. ${fieldDef.prompt}`;
      if (repeatCount >= 2 && fieldDef.templates[0]) {
        assistantMessage = `Quick path: paste this and edit it. ${fieldDef.templates[0].template}`;
      }
    } else if (intent === "help_me_answer") {
      pendingClarification = true;
      confidence = 0.62;
      assistantMessage = `Use a draft below and edit quickly. ${fieldDef.prompt}`;
      if (fieldDef.templates[1]) {
        assistantMessage = `Use this starter and edit: ${fieldDef.templates[1].template}`;
      }
    } else if (intent === "clarification_request") {
      pendingClarification = true;
      confidence = 0.56;
      assistantMessage = `${fieldDef.label} is required for planning accuracy. ${fieldDef.prompt}`;
      if (repeatCount >= 2 && fieldDef.templates[0]) {
        assistantMessage = `Use this exact structure: ${fieldDef.templates[0].template}`;
      }
    } else {
      const parsed = processQuestionAnswer(fieldDef, lastUserMessage, profile);
      proposedUpdates = parsed.updates;
      confidence = clampConfidence(parsed.confidence);
      requiresConfirmation = parsed.requiresConfirmation;
      parseFailReason = parsed.parseError ?? null;

      if (Object.keys(proposedUpdates).length === 0) {
        pendingClarification = true;
        confidence = Math.min(confidence, 0.58);
        assistantMessage = parseFailReason ? `${parseFailReason} ${fieldDef.prompt}` : `I could not map that yet. ${fieldDef.prompt}`;
        if (fieldDef.templates[0]) {
          assistantMessage = `${assistantMessage} Use this format: ${fieldDef.templates[0].template}`;
        }
      } else if (requiresConfirmation) {
        pendingClarification = true;
        assistantMessage = `Draft ready for ${fieldDef.label}. Review and apply, or refine once.`;
      } else {
        pendingClarification = false;
        assistantMessage = `${fieldDef.label} saved.`;
      }
    }

    const mergedProfile = { ...profile, ...proposedUpdates };
    const autoConfirm = Object.keys(proposedUpdates).length > 0 && !requiresConfirmation && confidence >= 0.8;
    if (autoConfirm) {
      await supabase.from("client_onboarding_profiles").upsert(
        {
          client_id: body.client_id,
          agency_id: body.agency_id,
          flow_type: "agency_led",
          ...proposedUpdates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );
    }

    const resolved = resolvedFromProfile(autoConfirm ? mergedProfile : profile);
    const done = REQUIRED_FIELDS.every((field) => resolved.includes(field));
    const postField = done ? null : nextMissingField(autoConfirm ? mergedProfile : profile, state);
    const postFieldDef = postField ? FIELD_DEF_MAP.get(postField) ?? null : null;

    if (!done && postFieldDef && intent === "answer" && autoConfirm) {
      // Hard anti-repeat guard: always advance to next unresolved field after successful confirmation.
      assistantMessage = `Saved. Next: ${postFieldDef.prompt}`;
      nextField = postFieldDef.id;
    } else {
      nextField = postField;
    }

    if (done) {
      assistantMessage = "Profile complete. You can proceed to strategy generation.";
    }

    const suggestions = postFieldDef?.templates ?? fieldDef?.templates ?? [];
    const stateVersion = await stableHash({
      client_id: body.client_id,
      resolved,
      current_field_id: nextField,
      pending_clarification: pendingClarification,
      done,
      completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
    });

    const statusByField = buildFieldStatus(
      autoConfirm ? mergedProfile : profile,
      nextField,
      pendingClarification,
      proposedUpdates,
      state.status_by_field ?? {}
    );

    const assistantMode = toAssistantMode(intent, Object.keys(proposedUpdates).length > 0, requiresConfirmation);
    const responsePayload = {
      version: "v3" as const,
      assistant_message: assistantMessage,
      assistant_mode: assistantMode,
      intent,
      next_field: nextField,
      field_status: statusByField,
      structured_suggestions: suggestions,
      proposed_updates: proposedUpdates,
      confidence,
      requires_confirmation: requiresConfirmation,
      state_version: stateVersion,
      done,
      errors: [] as Array<{ code: string; message: string }>,
    };

    const autoAppliedPrevious: Record<string, unknown> | null =
      autoConfirm && Object.keys(proposedUpdates).length > 0
        ? Object.fromEntries(Object.keys(proposedUpdates).map((key) => [key, profile[key] ?? null]))
        : state.last_applied_previous ?? null;

    const nextState: V3StateDoc = {
      state_version: stateVersion,
      current_field_id: nextField,
      resolved_fields: resolved,
      pending_clarification: pendingClarification,
      turn_history: [
        ...(state.turn_history ?? []).slice(-49),
        {
          turn_id: body.turn_id,
          intent,
          field_id: nextField,
          at: new Date().toISOString(),
        },
      ],
      last_applied_patch: autoConfirm ? proposedUpdates : state.last_applied_patch ?? null,
      last_applied_previous: autoAppliedPrevious,
      completion_score: Math.round((resolved.length / REQUIRED_FIELDS.length) * 100),
      status_by_field: statusByField,
      last_turn_id: body.turn_id,
      last_response_json: responsePayload,
    };

    await supabase.from("client_onboarding_v3_states").upsert(
      {
        client_id: body.client_id,
        agency_id: body.agency_id,
        state_doc: nextState,
        state_version: stateVersion,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    );

    console.log(
      JSON.stringify({
        stage: "onboarding_v3_turn",
        agency_id: body.agency_id,
        client_id: body.client_id,
        turn_id: body.turn_id,
        intent,
        field_id: nextField,
        confidence,
        repeat_guard_triggered: autoConfirm && !!fieldDef && postField !== fieldDef.id,
        parse_fail_reason: parseFailReason,
        apply_result: autoConfirm ? "applied" : Object.keys(proposedUpdates).length > 0 ? "pending_confirmation" : "none",
      })
    );

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-onboarding-v3 error:", error);
    return new Response(
      JSON.stringify({
        version: "v3",
        assistant_message: "Onboarding hit an error. Please retry.",
        assistant_mode: "Clarify",
        intent: "question_about_process",
        next_field: null,
        field_status: {},
        structured_suggestions: [],
        proposed_updates: {},
        confidence: 0.4,
        requires_confirmation: false,
        state_version: "error",
        done: false,
        errors: [
          {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});

