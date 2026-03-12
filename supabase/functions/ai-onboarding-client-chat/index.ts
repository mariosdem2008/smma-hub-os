import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { getV5ProgressSummary } from "../../../src/lib/onboarding/progress.ts";
import { getFieldLabel } from "../../../src/lib/onboarding/labels.ts";
import {
  getClientOnboardingCardByStep,
  getClientOnboardingCardStep,
  getNextClientOnboardingCard,
  getClientOnboardingCards,
  type ClientOnboardingCardId,
  type ClientOnboardingCardSpec,
  validateCardPayload,
} from "../../../src/lib/onboarding/clientChatContract.ts";

type ChatMode = "start" | "resume" | "card_submit" | "freeform";

type ChatRequest = {
  agency_id: string;
  client_id: string;
  turn_id?: string;
  mode?: ChatMode;
  card_id?: ClientOnboardingCardId;
  card_payload?: Record<string, unknown>;
  message?: string;
};

type ProfileRow = Record<string, unknown> & {
  client_id: string;
  agency_id: string;
  current_step: number | null;
  readiness_score: number | null;
  blockers: unknown;
  v5_meta: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function detectFreeformIntent(input: string): "help" | "continue" | "question" | "off_topic" | "answer_like" {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "help";
  if (/\b(continue|next|move on|go on)\b/.test(normalized)) return "continue";
  if (/\b(help|example|suggest|draft|what should i|how do i)\b/.test(normalized)) return "help";
  if (/\?/.test(normalized)) return "question";
  if (/\b(weather|football|movie|song|crypto|bitcoin|politics|news)\b/.test(normalized)) return "off_topic";
  return "answer_like";
}

function getError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function response(body: unknown, headers: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function buildBlockers(profile: Record<string, unknown>) {
  const progress = getV5ProgressSummary(profile);
  return progress.missingFields.map((field) => ({
    field,
    label: getFieldLabel(field),
    message: `${getFieldLabel(field)} is required`,
  }));
}

function mapCardToSection(cardId: ClientOnboardingCardId) {
  if (cardId === "business_essentials_card" || cardId === "market_scope_card") return "basics";
  if (cardId === "goal_conversion_card") return "goal";
  if (cardId === "offers_card") return "offers";
  if (cardId === "audience_card") return "audience";
  if (cardId === "brand_card") return "brand";
  if (cardId === "proof_card") return "proof";
  if (cardId === "channels_card") return "channels";
  return "review";
}

function createAssistantText(
  mode: ChatMode,
  card: ClientOnboardingCardSpec,
  message?: string,
  submittedCardTitle?: string
) {
  if (mode === "resume") {
    return `Welcome back. Continue with "${card.title}".`;
  }
  if (mode === "freeform") {
    const userMessage = message ?? "";
    const intent = detectFreeformIntent(userMessage);
    if (intent === "continue") return `Perfect. Continue with "${card.title}".`;
    if (intent === "off_topic") return `I can answer quickly, then we continue onboarding. Next step is "${card.title}".`;
    if (intent === "question" || intent === "help") {
      return `Good question. Complete "${card.title}" first and I will adapt suggestions after your submit.`;
    }
    return `Captured. Use the "${card.title}" card so I can save this in structured format.`;
  }
  if (mode === "card_submit") {
    if (submittedCardTitle && submittedCardTitle !== card.title) {
      return `Saved "${submittedCardTitle}". Next: "${card.title}".`;
    }
    return `Saved "${submittedCardTitle ?? card.title}".`;
  }
  return `Let's begin with "${card.title}".`;
}

type ChatTurnLogRow = {
  agency_id: string;
  client_id: string;
  user_id: string;
  turn_id: string;
  mode: string;
  card_id: string | null;
  intent: string | null;
  user_message: string | null;
  card_payload_json: Record<string, unknown> | null;
  validation_errors_json: string[] | null;
  assistant_text: string;
  progress_json: Record<string, unknown>;
  blockers_json: Record<string, unknown>[];
};

async function appendTurnLog(supabase: ReturnType<typeof createClient>, row: ChatTurnLogRow) {
  try {
    await supabase.from("client_onboarding_chat_turn_logs").insert(row);
  } catch {
    // Non-blocking until migration is applied in every environment.
  }
}

async function ensureProfile(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  agencyId: string
): Promise<ProfileRow | null> {
  const existing = await supabase
    .from("client_onboarding_profiles")
    .select("*")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (existing.data) return existing.data as ProfileRow;

  const created = await supabase.rpc("upsert_onboarding_profile", {
    p_client_id: clientId,
    p_agency_id: agencyId,
    p_flow_type: "agency_led",
    p_current_step: 1,
    p_profile_data: {},
  });
  if (created.error) return null;

  const reloaded = await supabase
    .from("client_onboarding_profiles")
    .select("*")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return (reloaded.data as ProfileRow | null) ?? null;
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const guard = getEndpointGuardResponse("ai-onboarding-client-chat", headers);
    if (guard) return guard;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return response({ error: "Missing Authorization header" }, headers, 401);

    const body = (await req.json()) as ChatRequest;
    const agencyId = body.agency_id;
    const clientId = body.client_id;
    const mode = body.mode ?? "start";

    if (!agencyId || !clientId) return response({ error: "agency_id and client_id are required" }, headers, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return response({ error: "Missing Supabase environment variables" }, headers, 500);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) return response({ error: "Unauthorized" }, headers, 401);

    const { data: member } = await supabase
      .from("agency_members")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return response({ error: "Unauthorized for agency" }, headers, 403);

    const profile = await ensureProfile(supabase, clientId, agencyId);
    if (!profile) return response({ error: "Failed to initialize onboarding profile" }, headers, 500);

    let workingProfile = profile;
    const v5Meta = asRecord(workingProfile.v5_meta);
    const chatMeta = asRecord(v5Meta.chat_onboarding);
    const explicitCard = asString(chatMeta.current_card_id) as ClientOnboardingCardId | null;
    const knownCards = new Set(getClientOnboardingCards().map((card) => card.id));
    const resolvedCardId = explicitCard && knownCards.has(explicitCard) ? explicitCard : null;
    let currentCard = resolvedCardId
      ? getClientOnboardingCards().find((card) => card.id === resolvedCardId) ?? getClientOnboardingCardByStep(workingProfile.current_step ?? 1)
      : getClientOnboardingCardByStep(workingProfile.current_step ?? 1);
    let saveResult: "noop" | "saved" = "noop";
    const turnId = body.turn_id ?? crypto.randomUUID();
    const userMessage = asString(body.message);
    let validationErrors: string[] | null = null;
    let intent: string | null = null;
    let lastSubmittedCardTitle: string | undefined;

    if (mode === "card_submit") {
      lastSubmittedCardTitle = currentCard.title;
      const cardId = body.card_id;
      if (!cardId) return response({ error: "card_id is required for card_submit" }, headers, 400);
      if (cardId !== currentCard.id) {
        return response({
          ok: false,
          errors: [`Out-of-sequence submit: expected ${currentCard.id}, received ${cardId}.`],
          assistant_text: `Please complete "${currentCard.title}" first.`,
          ui_card: {
            ...currentCard,
            prefill: workingProfile,
          },
        }, headers);
      }

      const validation = validateCardPayload(cardId, body.card_payload ?? {});
      if (!validation.ok) {
        validationErrors = validation.errors;
        const progressOnError = getV5ProgressSummary(workingProfile);
        const blockersOnError = buildBlockers(workingProfile);
        await appendTurnLog(supabase, {
          agency_id: agencyId,
          client_id: clientId,
          user_id: user.id,
          turn_id: turnId,
          mode,
          card_id: cardId,
          intent: null,
          user_message: null,
          card_payload_json: asRecord(body.card_payload ?? {}),
          validation_errors_json: validation.errors,
          assistant_text: `I found ${validation.errors.length} issue(s). Fix them and submit again.`,
          progress_json: {
            current_index: getClientOnboardingCardStep(currentCard.id),
            total_required: 9,
            percent_complete: progressOnError.totalPercent,
            required_complete: progressOnError.missingFields.length === 0,
          },
          blockers_json: blockersOnError,
        });
        return response({
          ok: false,
          errors: validation.errors,
          assistant_text: `I found ${validation.errors.length} issue(s). Fix them and submit again.`,
          ui_card: {
            ...currentCard,
            id: cardId,
            prefill: body.card_payload ?? {},
          },
        }, headers);
      }

      const nextCard = getNextClientOnboardingCard(cardId);
      const nextStep = getClientOnboardingCardStep(nextCard.id);
      const mergedCandidate = { ...workingProfile, ...validation.updates };
      const progress = getV5ProgressSummary(mergedCandidate);
      const blockers = buildBlockers(mergedCandidate);
      const activeSection = mapCardToSection(nextCard.id);
      const currentMeta = asRecord(workingProfile.v5_meta);
      const latestChatMeta = asRecord(currentMeta.chat_onboarding);

      const updatePayload: Record<string, unknown> = {
        ...validation.updates,
        current_step: nextStep,
        readiness_score: progress.totalPercent,
        blockers,
        v5_meta: {
          ...currentMeta,
          progress: {
            active_section: activeSection,
            completed_sections: Object.values(progress.perSection)
              .filter((item) => item.percent === 100)
              .map((item) => item.sectionId),
            percent_complete: progress.totalPercent,
            updated_at: new Date().toISOString(),
          },
          chat_onboarding: {
            ...latestChatMeta,
            current_card_id: nextCard.id,
            previous_card_id: cardId,
            updated_at: new Date().toISOString(),
            turn_id: turnId,
            ui_contract_version: "v1",
          },
        },
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("client_onboarding_profiles")
        .update(updatePayload)
        .eq("client_id", clientId)
        .eq("agency_id", agencyId);
      if (updateError) return response({ error: "Failed to save onboarding card" }, headers, 500);

      saveResult = "saved";
      const { data: reloaded } = await supabase
        .from("client_onboarding_profiles")
        .select("*")
        .eq("client_id", clientId)
        .eq("agency_id", agencyId)
        .maybeSingle();
      if (!reloaded) return response({ error: "Failed to reload onboarding profile" }, headers, 500);
      workingProfile = reloaded as ProfileRow;
      currentCard = nextCard;

      if (cardId === "review_card") {
        const finalProgress = getV5ProgressSummary(workingProfile);
        if (finalProgress.missingFields.length > 0) {
          return response({
            ok: false,
            errors: finalProgress.missingFields.map((field) => `${getFieldLabel(field)} is required.`),
            assistant_text: "You still have required fields missing before strategy generation.",
            ui_card: { ...currentCard, prefill: {} },
          }, headers);
        }
        const { error: completeError } = await supabase.rpc("complete_onboarding_profile", {
          p_client_id: clientId,
        });
        if (completeError) return response({ error: "Failed to complete onboarding" }, headers, 500);

        await appendTurnLog(supabase, {
          agency_id: agencyId,
          client_id: clientId,
          user_id: user.id,
          turn_id: turnId,
          mode,
          card_id: cardId,
          intent: null,
          user_message: null,
          card_payload_json: asRecord(body.card_payload ?? {}),
          validation_errors_json: null,
          assistant_text: "Onboarding complete. Generating strategy and opening client workspace.",
          progress_json: {
            current_index: getClientOnboardingCardStep(cardId),
            total_required: 9,
            percent_complete: 100,
            required_complete: true,
          },
          blockers_json: [],
        });

        return response({
          ok: true,
          done: true,
          assistant_text: "Onboarding complete. Generating strategy and opening client workspace.",
          save_result: saveResult,
          progress: {
            required_complete: true,
            current_index: getClientOnboardingCardStep(cardId),
            total_required: 9,
            percent_complete: 100,
          },
          blockers: [],
          next_path: `/clients/${clientId}`,
        }, headers);
      }
    } else if (mode === "freeform" && body.message?.trim()) {
      intent = detectFreeformIntent(body.message.trim());
      const currentMeta = asRecord(workingProfile.v5_meta);
      const latestChatMeta = asRecord(currentMeta.chat_onboarding);
      await supabase
        .from("client_onboarding_profiles")
        .update({
          v5_meta: {
            ...currentMeta,
            chat_onboarding: {
              ...latestChatMeta,
              last_freeform_message: body.message.trim(),
              last_freeform_intent: intent,
              updated_at: new Date().toISOString(),
              turn_id: turnId,
              ui_contract_version: "v1",
            },
          },
        })
        .eq("client_id", clientId)
        .eq("agency_id", agencyId);

      if (intent === "continue") {
        currentCard = getClientOnboardingCardByStep(workingProfile.current_step ?? 1);
      }
    }

    const progress = getV5ProgressSummary(workingProfile);
    const blockers = buildBlockers(workingProfile);
    const cardStep = getClientOnboardingCardStep(currentCard.id);
    const assistantText = createAssistantText(mode, currentCard, body.message, lastSubmittedCardTitle);

    await appendTurnLog(supabase, {
      agency_id: agencyId,
      client_id: clientId,
      user_id: user.id,
      turn_id: turnId,
      mode,
      card_id: currentCard.id,
      intent,
      user_message: userMessage,
      card_payload_json: mode === "card_submit" ? asRecord(body.card_payload ?? {}) : null,
      validation_errors_json: validationErrors,
      assistant_text: assistantText,
      progress_json: {
        current_index: cardStep,
        total_required: 9,
        percent_complete: progress.totalPercent,
        required_complete: progress.missingFields.length === 0,
      },
      blockers_json: blockers,
    });

    return response({
      ok: true,
      done: false,
      assistant_text: assistantText,
      save_result: saveResult,
      ui_card: {
        ...currentCard,
        prefill: workingProfile,
      },
      progress: {
        required_complete: progress.missingFields.length === 0,
        current_index: cardStep,
        total_required: 9,
        percent_complete: progress.totalPercent,
      },
      blockers,
      trace_id: crypto.randomUUID(),
    }, headers);
  } catch (error) {
    console.error("ai-onboarding-client-chat error:", error);
    return response({ error: error instanceof Error ? error.message : "Unknown error" }, headers, 500);
  }
});
