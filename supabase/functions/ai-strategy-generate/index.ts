import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { embedText } from "../_shared/embeddings.ts";
import { mapV3AnswersToClientBrain } from "../_shared/client-brain-mapping.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { applyRagPolicy, getRagConfig, shouldUseRagPolicy } from "../../../src/ai/ragPolicy.ts";
import { validateCitations } from "../../../src/ai/citations.ts";
import { calculateCost } from "../_shared/budgets.ts";
import { capMatchesByTokenBudget, clampMatchCount } from "../_shared/retrieval.ts";
import { buildBrainDocumentReferences, formatBrainDocumentReferencesMarkdown } from "../_shared/strategy-references.ts";
import { buildStrategyOutputSchema, type StrategyOutput } from "../_shared/strategy-output.ts";
import { marked } from "npm:marked@9.1.6";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { evaluateStrategyModule } from "../../../src/lib/strategy/rulesEngine.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

type GatedCode = "BRAIN_INCOMPLETE" | "AGENCY_BRAIN_INCOMPLETE";

function buildUnknownResponse(
  gate: { missing_fields: string[]; questions: string[] },
  options?: { code?: GatedCode; deep_link?: string },
) {
  return {
    unknown: true,
    missing_fields: gate.missing_fields,
    questions: gate.questions,
    escalation: false,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.deep_link ? { deep_link: options.deep_link } : {}),
  };
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function estimateTokensForCost(text: string) {
  return Math.ceil(text.length / 3);
}

function extractUsageFromRaw(raw: unknown) {
  const usage = (raw as any)?.usage;
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const serialized = entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",");
    return `{${serialized}}`;
  }
  return JSON.stringify(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function deepMergePreferExisting(existing: any, fallback: any): any {
  if (existing === null || existing === undefined) return fallback;
  if (fallback === null || fallback === undefined) return existing;

  if (Array.isArray(existing) || Array.isArray(fallback)) {
    const existingArr = Array.isArray(existing) ? existing : [];
    const fallbackArr = Array.isArray(fallback) ? fallback : [];
    return existingArr.length > 0 ? existingArr : fallbackArr;
  }

  if (typeof existing === "object" && typeof fallback === "object") {
    const out: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
    for (const [key, value] of Object.entries(existing as Record<string, unknown>)) {
      out[key] = deepMergePreferExisting(value, (fallback as Record<string, unknown>)[key]);
    }
    return out;
  }

  if (typeof existing === "string") {
    return existing.trim().length > 0 ? existing : fallback;
  }

  return existing;
}

function buildRawResponsesFromOnboarding(profile: Record<string, unknown>) {
  const businessName = (profile.q1_business_name as string) ?? "";
  const website = (profile.q2_website as string) ?? "";
  const platforms = toList(profile.platforms ?? profile.q16_enabled_channels);

  const offerNames = [
    ...(Array.isArray(profile.offers)
      ? (profile.offers as Array<any>).map((offer) => (offer?.name ? String(offer.name) : "")).filter(Boolean)
      : []),
    ...(typeof profile.q6_offer_name === "string" ? [profile.q6_offer_name] : []),
  ].filter(Boolean);

  const audience = [
    ...(Array.isArray(profile.q9_pain_points) ? (profile.q9_pain_points as string[]) : []),
    ...(typeof profile.primary_customer === "string" ? [profile.primary_customer] : []),
    ...(typeof profile.q8_ideal_customer === "string" ? [profile.q8_ideal_customer] : []),
  ]
    .map((item) => String(item).trim())
    .filter(Boolean);

  const goal = (profile.primary_goal as string) ?? (profile.q17_primary_goal as string) ?? "";
  const conversionPath = (profile.conversion_path as string) ?? "";
  const dmKeyword = (profile.dm_keyword as string) ?? "";
  const conversionLink = (profile.conversion_link as string) ?? "";

  const goals: string[] = [];
  if (goal) goals.push(goal);
  if (conversionPath === "dm_keyword") {
    goals.push(dmKeyword ? `DM keyword: ${dmKeyword}` : "DM keyword");
  } else if (conversionPath) {
    goals.push(conversionLink ? `${conversionPath}: ${conversionLink}` : conversionPath);
  }

  const ctaStyles: string[] = [];
  if (conversionPath === "dm_keyword") {
    ctaStyles.push(dmKeyword ? `DM ${dmKeyword}` : "DM keyword");
  } else if (conversionPath) {
    ctaStyles.push(conversionPath);
  }

  return {
    brand: businessName,
    website,
    goals,
    offers: offerNames,
    audience,
    platforms,
    cta_styles: ctaStyles,
    competitors: toList(profile.q12_competitors ?? profile.competitors),
    differentiators: toList(profile.q13_differentiators ?? profile.differentiators),
    banned_claims: toList(profile.banned_claims),
    taboo_topics: toList(profile.taboo_topics),
    pricing: (profile.q6_price_min || profile.q6_price_max) ? `${profile.q6_price_min ?? ""}-${profile.q6_price_max ?? ""}` : "",
  } as Record<string, unknown>;
}

async function sha256Hex(input: string) {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const MODULE_LABELS: Record<string, string> = {
  positioning: "Positioning",
  pillars: "Pillars",
  campaign_plan: "Campaign plan",
  weekly_plan: "Weekly plan",
  channel_adaptations: "Channel adaptations",
  rules_constraints: "Rules + constraints",
};

async function safeInsertAiRun(
  supabase: ReturnType<typeof createClient>,
  payload: {
    agencyId: string;
    clientId: string;
    userId: string | null;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    startTime: number;
    success: boolean;
    unknown: boolean;
    citations: unknown;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("ai_runs").insert({
      agency_id: payload.agencyId,
      client_id: payload.clientId,
      user_id: payload.userId,
      prompt_id: null,
      prompt_version: null,
      model: payload.model,
      tokens_in: payload.tokensIn,
      tokens_out: payload.tokensOut,
      cost_usd: payload.costUsd,
      latency_ms: Date.now() - payload.startTime,
      success: payload.success,
      citations: payload.citations,
      unknown: payload.unknown,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: payload.metadata ?? {},
    });
  } catch (error) {
    console.error("Failed to write ai_runs", error);
  }
}

function pad2(num: number) {
  return String(num).padStart(2, "0");
}

function isoWeekString(date: Date): string {
  // ISO week date weeks start on Monday.
  // Algorithm: shift to Thursday, then week = 1 + floor((thursday - jan4)/7days)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${pad2(week)}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-strategy-generate", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const startTime = Date.now();
  const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
  const body = await req.json().catch(() => ({}));
  const clientId = body.client_id as string | undefined;
  const instruction = body.instruction as string | undefined;
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const isCron = cronSecret.length > 0 && cronHeader === cronSecret;

  if (!clientId) {
    return jsonResponse({ error: "client_id is required", code: "MISSING_CLIENT_ID" }, 400, corsHeaders(req));
  }

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !clientRow?.agency_id) {
    return jsonResponse({ error: "Client not found", code: "CLIENT_NOT_FOUND" }, 404, corsHeaders(req));
  }

  const agencyId = clientRow.agency_id as string;

  let actingUserId: string | null = null;
  if (isCron) {
    const { data: adminUser } = await supabase
      .from("agency_members")
      .select("user_id")
      .eq("agency_id", agencyId)
      .in("role", ["owner", "admin"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    actingUserId = adminUser?.user_id ?? null;
    if (!actingUserId) {
      return jsonResponse({ error: "No admin user available for job execution" }, 403, corsHeaders(req));
    }
  } else {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
    }

    const { data: membership } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!membership) {
      return jsonResponse({ error: "Forbidden", code: "FORBIDDEN" }, 403, corsHeaders(req));
    }
    actingUserId = user.id;
  }

  const { data: brainRow, error: brainError } = await supabase
    .from("client_brains")
    .select("id, brain_json, usable, status, updated_at")
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Defense-in-depth: bootstrap a baseline brain row if missing.
  // The database trigger/backfill should make this rare, but this keeps the endpoint resilient.
  let ensuredBrainRow = brainRow ?? null;
  if (!brainError && !ensuredBrainRow) {
    await supabase.from("client_brains").insert({
      agency_id: agencyId,
      client_id: clientId,
      version: 1,
      status: "draft",
      locked: false,
      usable: false,
      brain_json: {},
      json_diff: null,
      confidence: 0,
    });

    const { data: reloaded } = await supabase
      .from("client_brains")
      .select("id, brain_json, usable, status, updated_at")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    ensuredBrainRow = reloaded ?? null;
  }

  if (brainError || !ensuredBrainRow) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "CLIENT_BRAIN_MISSING" },
    });
    return jsonResponse(
      buildUnknownResponse(
        {
          missing_fields: ["client_brain"],
          questions: ["Complete client onboarding before generating a strategy."],
        },
        { code: "CLIENT_BRAIN_MISSING", deep_link: `/onboarding/client/${clientId}` },
      ),
      200,
      corsHeaders(req),
    );
  }

  const { data: onboardingProfile } = await supabase
    .from("client_onboarding_profiles")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const gate = evaluateClientBrainForStrategy((ensuredBrainRow.brain_json as any) ?? {});

  const onboardingCompleted =
    Boolean(onboardingProfile?.completed_at) ||
    (typeof (onboardingProfile as any)?.readiness_score === "number" && (onboardingProfile as any).readiness_score >= 100);

  let effectiveBrain = (ensuredBrainRow.brain_json as any) ?? {};
  let effectiveBrainUsable = Boolean(ensuredBrainRow.usable) && gate.usable;

  if (!effectiveBrainUsable && onboardingProfile && onboardingCompleted) {
    try {
      const rawResponses = buildRawResponsesFromOnboarding(onboardingProfile as any);
      const fallbackBrain = mapV3AnswersToClientBrain(rawResponses, {}, new Date().toISOString());
      const mergedBrain = deepMergePreferExisting(effectiveBrain, fallbackBrain);
      const mergedGate = evaluateClientBrainForStrategy(mergedBrain ?? {});

      if (mergedGate.usable) {
        effectiveBrain = mergedBrain;
        effectiveBrainUsable = true;

        await supabase
          .from("client_brains")
          .update({
            brain_json: mergedBrain,
            usable: true,
            status: "usable",
            updated_at: new Date().toISOString(),
          })
          .eq("id", ensuredBrainRow.id);
      }
    } catch (error) {
      console.error("Failed to hydrate client brain from onboarding fallback", error);
    }
  }

  if (!effectiveBrainUsable) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "gate-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: {
        code: "BRAIN_INCOMPLETE",
        missing_fields: gate.missing_fields,
      },
    });
    return jsonResponse(
      buildUnknownResponse(gate, { code: "BRAIN_INCOMPLETE", deep_link: `/onboarding/client/${clientId}` }),
      200,
      corsHeaders(req),
    );
  }

  const { count: approvedBrainDocCount, error: approvedBrainDocError } = await supabase
    .from("ai_documents")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("doc_type", "brain_document")
    .eq("metadata->>status", "approved");

  if (approvedBrainDocError) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "retrieval-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "RAG_FAILURE", error: approvedBrainDocError.message },
    });
    return jsonResponse({ error: "Failed to check agency brain readiness", code: "RAG_FAILURE" }, 500, corsHeaders(req));
  }

  if ((approvedBrainDocCount ?? 0) === 0) {
    const gateResponse = buildUnknownResponse(
      {
        missing_fields: ["agency_brain_documents"],
        questions: ["Agency AI setup is incomplete. Approve and ingest at least one brain module to continue."],
      },
      { code: "AGENCY_BRAIN_INCOMPLETE", deep_link: "/agency/ai-setup" },
    );
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "AGENCY_BRAIN_INCOMPLETE" },
    });
    return jsonResponse(gateResponse, 200, corsHeaders(req));
  }

  const { data: latestStrategy } = await supabase
    .from("strategies")
    .select("id, updated_at")
    .eq("client_id", clientId)
    .order("version_int", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: moduleRows } = latestStrategy?.id
    ? await supabase
        .from("strategy_modules")
        .select("module, content_json, updated_at")
        .eq("strategy_id", latestStrategy.id)
    : { data: [] };

  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const useRagPolicy = shouldUseRagPolicy({ agencyId, clientId });
  const ragConfig = getRagConfig(TaskType.STRATEGY_PLAN);
  // Strategy generation needs *some* context even when similarity is low.
  // Using a fixed query embedding can cause false "no matches" when min_similarity is too high.
  const minSimilarity = 0.0;
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText("strategy_draft", "", embeddingModel);
  } catch (error: any) {
    const message = error?.message ?? String(error);
    const missingApiKey = message.includes("API_KEY is not configured");
    if (missingApiKey) {
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: "missing-ai-api-key",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: false,
        citations: emptySources(),
        metadata: { code: "MISSING_API_KEY", error: message },
      });
      return jsonResponse(
        {
          error: "AI configuration missing",
          message: "Please configure GEMINI_API_KEY (or OPENAI_API_KEY if using OpenAI) in your Supabase project secrets.",
          code: "MISSING_API_KEY",
        },
        500,
        corsHeaders(req),
      );
    }
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: embeddingModel,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "RAG_FAILURE", error: message },
    });
    return jsonResponse({ error: "Embedding failed", code: "RAG_FAILURE" }, 500, corsHeaders(req));
  }

  const legacyClientDocTypes = ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"];
  const legacyAgencyDocTypes = ["agency_sop", "brain_document"];
  const legacyExemplarDocTypes = ["agency_exemplar_strategy"];

  let { data: clientMatches, error: clientMatchesError } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: clientId,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : 6),
    p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
    p_modules: null,
    p_min_similarity: minSimilarity,
  });

  let { data: agencyMatches, error: agencyMatchesError } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : 4),
    p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
    p_modules: null,
    p_min_similarity: minSimilarity,
  });

  let { data: exemplarMatches, error: exemplarMatchesError } = await supabase.rpc("match_ai_embeddings", {
    p_agency_id: agencyId,
    p_client_id: null,
    p_query_embedding: queryEmbedding,
    p_match_count: clampMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : 2),
    p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
    p_modules: null,
    p_min_similarity: minSimilarity,
  });

  if (clientMatchesError || agencyMatchesError || exemplarMatchesError) {
    const message = clientMatchesError?.message ?? agencyMatchesError?.message ?? exemplarMatchesError?.message ?? "unknown";
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "retrieval-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "RAG_FAILURE", error: message },
    });
    return jsonResponse({ error: "Failed to retrieve context", code: "RAG_FAILURE" }, 500, corsHeaders(req));
  }

  let matches = [
    ...(clientMatches || []),
    ...(agencyMatches || []),
    ...(exemplarMatches || []),
  ];

  // Fallback: if embeddings retrieval returns nothing, still proceed using approved docs directly.
  // This avoids a confusing "upload memory" hard gate when onboarding/client brain is usable.
  if (matches.length === 0) {
    const { data: approvedDocs } = await supabase
      .from("ai_documents")
      .select("id, extracted_text")
      .eq("agency_id", agencyId)
      .eq("doc_type", "brain_document")
      .eq("metadata->>status", "approved")
      .order("created_at", { ascending: false })
      .limit(2);

    if ((approvedDocs ?? []).length > 0) {
      agencyMatches = (approvedDocs ?? []).map((doc: any) => ({
        doc_type: "brain_document",
        document_id: doc.id,
        chunk_id: null,
        chunk_text: doc.extracted_text ?? "",
        score: 1,
      }));
      matches = [
        ...(clientMatches || []),
        ...(agencyMatches || []),
        ...(exemplarMatches || []),
      ];
    }
  }

  if (matches.length === 0) {
    // Onboarding + ClientBrain should be sufficient for a v1 strategy draft.
    // Missing embeddings or zero retrieved matches should reduce quality, not block generation.
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "retrieval-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: false,
    });
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "retrieval-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: true,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "RAG_EMPTY_CONTINUING" },
    });
  }

  const agencyBrainMatchCount = (agencyMatches ?? []).filter((row: any) => row.doc_type === "brain_document").length;

  const legacyMatches = matches.length === 0 ? [] : useRagPolicy ? matches : capMatchesByTokenBudget(matches, 1200).matches;
  const fullContext = legacyMatches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n");
  const legacyContext = truncate(fullContext, 6000);
  const legacyContextTruncated = fullContext.length > 6000 || legacyMatches.length < matches.length;
  const ragResult = useRagPolicy ? applyRagPolicy(matches, ragConfig) : null;
  const context = ragResult?.context ?? legacyContext;
  const selectedMatches = ragResult?.selectedMatches ?? legacyMatches;
  const contextTruncated = ragResult?.contextTruncated ?? legacyContextTruncated;
  const retrievalCount = ragResult?.retrievalCount ?? legacyMatches.length;
  const docTypesUsed = ragResult?.docTypesUsed ?? Array.from(new Set(legacyMatches.map((row: any) => row.doc_type)));
  const ragPolicyVersion = useRagPolicy ? "v1" : "legacy";

  const brainDocChunkRetrievedCount = (agencyMatches ?? []).filter((row: any) => row.doc_type === "brain_document").length;
  const brainDocChunkUsedCount = selectedMatches.filter((row: any) => row.doc_type === "brain_document").length;

  const brainDocAiDocumentIds = Array.from(
    new Set(
      selectedMatches
        .filter((row: any) => row.doc_type === "brain_document" && row.document_id)
        .map((row: any) => row.document_id),
    ),
  );

  const { data: brainAiDocumentRows } = brainDocAiDocumentIds.length
    ? await supabase
        .from("ai_documents")
        .select("id, title, metadata")
        .eq("agency_id", agencyId)
        .eq("doc_type", "brain_document")
        .in("id", brainDocAiDocumentIds)
    : { data: [] };

  const brainDocReferences = buildBrainDocumentReferences({
    matches: selectedMatches,
    aiDocuments: (brainAiDocumentRows ?? []) as any[],
    maxReferences: 20,
  });

  const referencesSection = formatBrainDocumentReferencesMarkdown({
    references: brainDocReferences,
    maxReferences: 20,
  });

  // If references are missing, continue (quality may be lower) but do not block.

  const { count: failedBrainDocChunksCount } = brainDocAiDocumentIds.length
    ? await supabase
        .from("ai_document_chunks")
        .select("id", { count: "exact", head: true })
        .in("document_id", brainDocAiDocumentIds)
        .eq("embedding_status", "failed")
    : { count: 0 };

  const promptContext = [
    `GeneratedAtUtc: ${new Date().toISOString()}`,
    `CurrentMonth: ${new Date().getUTCFullYear()}-${pad2(new Date().getUTCMonth() + 1)}`,
    `CurrentIsoWeek: ${isoWeekString(new Date())}`,
    `Onboarding Profile:\n${JSON.stringify(onboardingProfile ?? {})}`,
    `Structured Strategy:\n${JSON.stringify(moduleRows ?? [])}`,
    `RAG Context:\n${context}`,
    referencesSection,
  ].join("\n\n");

  const outputSchema = buildStrategyOutputSchema();
  let aiResult: any = null;
  let output: StrategyOutput | null = null;
  try {
    aiResult = await ai.run({
      taskType: TaskType.STRATEGY_PLAN,
      input: "",
      // Provide supabase so the AI router can load AgencyBrain/ClientBrain context.
      // We still disable usage logging for this internal call because ai-strategy-generate handles ai_runs itself.
      context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase, skipUsageLog: true },
      metadata: { context: promptContext, instruction, client_brain: effectiveBrain },
      outputSchema,
    });
    output = (aiResult.output ?? null) as StrategyOutput | null;
  } catch (error: any) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const code = isTimeout ? "GENERATION_TIMEOUT" : "GENERATION_ERROR";
    const status = isTimeout ? 504 : 500;
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code, error: error?.message ?? String(error) },
    });
    return jsonResponse({ error: "Failed to generate strategy", code }, status, corsHeaders(req));
  }

  if (aiResult?.unknown || (aiResult?.output as any)?.unknown === true) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "GENERATION_ERROR", reason: "ai_run_unknown" },
    });
    return jsonResponse({ error: "Strategy generation failed. Please retry.", code: "GENERATION_ERROR" }, 500, corsHeaders(req));
  }

  if (!aiResult?.schemaOk || !output) {
    const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
    const tokensIn = estimateTokensForCost(context);
    const tokensOut = 0;
    const costUsd = calculateCost(aiResult?.meta?.provider ?? "openai", runtimeModel, tokensIn, tokensOut);

    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: runtimeModel,
      tokensIn,
      tokensOut,
      costUsd,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "STRATEGY_SCHEMA_INVALID" },
    });

    return jsonResponse({ error: "Strategy JSON invalid", code: "STRATEGY_SCHEMA_INVALID" }, 500, corsHeaders(req));
  }

  const referencesMarkdown = referencesSection.replace(/^References:/, "## References");
  const baseMarkdown = output.document.markdown?.trim() ?? "";
  const markdown = /\n##\s+References\b/i.test(baseMarkdown)
    ? baseMarkdown
    : `${baseMarkdown}\n\n${referencesMarkdown}`;
  const html = marked.parse(markdown);

  const citations = selectedMatches.map((row: any) => ({
    doc_type: row.doc_type,
    document_id: row.document_id,
    chunk_id: row.chunk_id,
    score: row.score,
  }));

  const brainDocRows = (brainAiDocumentRows ?? []) as any[];

  const brainDocVersions = (brainDocRows ?? [])
    .map((row: any) => ({
      id: row.id,
      module: row.metadata?.module ?? null,
      version: row.metadata?.version ?? null,
      status: row.metadata?.status ?? null,
      approved_at: row.metadata?.approved_at ?? null,
    }))
    .sort((a: any, b: any) => String(a.module ?? "").localeCompare(String(b.module ?? "")));

  const derivedFromHash = await sha256Hex(
    stableStringify({
      onboardingProfile,
      scan: {
        ai_scan_result: onboardingProfile?.ai_scan_result ?? null,
        ai_scan_at: onboardingProfile?.ai_scan_at ?? null,
        ai_scan_accepted: onboardingProfile?.ai_scan_accepted ?? null,
      },
      brain_documents: brainDocVersions,
    }),
  );

  const modulePayload = Object.entries(output.modules).map(([module, content]) => ({
    module,
    content_json: content,
    ai_confidence: (content as any).confidence_0_100 ?? null,
  }));

  const moduleEvaluations = Object.entries(output.modules).map(([module, content]) => {
    const evaluation = evaluateStrategyModule(module as any, content as any, {
      modules: output.modules as any,
      currentStatus: "draft",
      isLocked: false,
    });
    return { module, ...evaluation };
  });

  const autoValidationTasks = Object.entries(output.modules)
    .filter(([, content]) => (content as any).confidence_0_100 < 70)
    .map(([module, content]) => {
      const questions = (content as any).open_questions ?? [];
      const description = questions.length
        ? `Open questions: ${questions.slice(0, 5).join("; ")}`
        : "Review module for accuracy and completeness.";
      return {
        module,
        title: `Validate ${MODULE_LABELS[module] ?? module} module`,
        description,
        priority: "high",
        dedupe_key: `validation:${module}`,
      };
    });

  const taskRows = [...(output.tasks ?? []), ...autoValidationTasks];
  const tasksPayload = Array.from(
    taskRows.reduce((map, task) => {
      const key = task.dedupe_key ?? `${task.module ?? "general"}:${task.title}`;
      if (!map.has(key)) {
        map.set(key, task);
      }
      return map;
    }, new Map<string, any>())
  ).map(([, task]) => task);

  const rpcResult = await supabase.rpc("create_strategy_snapshot", {
    p_client_id: clientId,
    p_agency_id: agencyId,
    p_strategy_id: latestStrategy?.id ?? null,
    p_user_id: actingUserId,
    p_modules: modulePayload,
    p_document_markdown: markdown,
    p_document_html: html,
    p_model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
    p_instruction: instruction ?? null,
    p_derived_hash: derivedFromHash,
    p_decisions: output.decisions ?? null,
    p_tasks: tasksPayload.length ? tasksPayload : null,
  });

  if (rpcResult?.error) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "PERSISTENCE_ERROR", error: rpcResult.error.message },
    });
    return jsonResponse({ error: "Failed to save strategy snapshot", code: "PERSISTENCE_ERROR" }, 500, corsHeaders(req));
  }

  const createdStrategyId = (rpcResult as any)?.data?.strategy_id;
  if (createdStrategyId) {
    const updateOps = moduleEvaluations.map((result) =>
      supabase
        .from("strategy_modules")
        .update({
          status: result.status,
          completion_percent: result.completion_percent,
          blocker_count: result.blockers.length,
          blockers: result.blockers,
        })
        .eq("strategy_id", createdStrategyId)
        .eq("module", result.module),
    );

    const updateResults = await Promise.allSettled(updateOps);
    const failed = updateResults
      .map((result) => {
        if (result.status === "rejected") return { ok: false, message: result.reason?.message ?? String(result.reason) };
        const err = (result.value as any)?.error;
        if (err) return { ok: false, message: err.message ?? String(err) };
        return { ok: true, message: "" };
      })
      .filter((item) => !item.ok);

    if (failed.length) {
      console.error("strategy_module_evaluation_persist_failed", {
        agencyId,
        clientId,
        strategyId: createdStrategyId,
        failures: failed.map((item) => item.message ?? "unknown_error"),
      });
    }
  } else {
    console.error("strategy_snapshot_missing_strategy_id", { agencyId, clientId });
  }

  const usage = extractUsageFromRaw(aiResult?.raw);
  const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
  const tokensIn = usage?.inputTokens ?? estimateTokensForCost(context);
  const tokensOut = usage?.outputTokens ?? estimateTokensForCost(markdown);
  const costUsd = calculateCost(aiResult?.meta?.provider ?? "openai", runtimeModel, tokensIn, tokensOut);
  const costEstimationMethod = usage ? "token_based" : "estimate_chars_div3";

  const citationsForRun = {
    memory_citations: selectedMatches
      .map((row: any) => ({
        doc_id: row.document_id ?? row.doc_id,
        chunk_id: row.chunk_id,
        doc_type: row.doc_type,
        similarity: row.score ?? row.similarity ?? 0,
      }))
      .filter((row: any) => typeof row.doc_id === "string"),
    client_brain_fields: ["client_brain.summary"],
    agency_brain_fields: [],
  };

  const citationValidation = validateCitations(
    { sources: citationsForRun, unknown: false, escalate_to_human: false },
    selectedMatches,
  );

  if (!citationValidation.valid && strictSchema) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: runtimeModel,
      tokensIn,
      tokensOut,
      costUsd,
      startTime,
      success: false,
      unknown: false,
      citations: citationsForRun,
      metadata: {
        cost_estimation_method: costEstimationMethod,
        retrieval_count: retrievalCount,
        context_truncated: contextTruncated,
        doc_types_used: docTypesUsed,
        rag_policy_version: ragPolicyVersion,
        citation_errors: citationValidation.errors,
      },
    });
    return jsonResponse({ error: "Citation validation failed", code: "CITATION_VALIDATION_FAILED" }, 500, corsHeaders(req));
  }

  await safeInsertAiRun(supabase, {
    agencyId,
    clientId,
    userId: actingUserId,
    model: runtimeModel,
    tokensIn,
    tokensOut,
    costUsd,
    startTime,
    success: true,
    unknown: false,
    citations: citationsForRun,
    metadata: {
      cost_estimation_method: costEstimationMethod,
      retrieval_count: retrievalCount,
      context_truncated: contextTruncated,
      doc_types_used: docTypesUsed,
      rag_policy_version: ragPolicyVersion,
      ...(citationValidation.valid ? {} : { citation_errors: citationValidation.errors }),
    },
  });

  await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId,
    endpoint: "ai-strategy-generate",
    model: runtimeModel,
    tokens_estimate: Math.ceil(markdown.length / 4),
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

  return jsonResponse(
    {
      unknown: false,
      modules: output.modules,
      tasks_created: tasksPayload.length,
      citations,
      rag_debug: {
        brain_document_chunks_retrieved: brainDocChunkRetrievedCount,
        brain_document_chunks_used: brainDocChunkUsedCount,
        brain_document_failed_chunks: failedBrainDocChunksCount ?? 0,
        brain_document_any_failed_chunks: (failedBrainDocChunksCount ?? 0) > 0,
        brain_document_references_used: brainDocReferences,
        context_truncated: contextTruncated,
        rag_policy_version: ragPolicyVersion,
      },
      confidence: Math.round(
        Object.values(output.modules)
          .map((mod: any) => Number(mod.confidence_0_100 ?? 0))
          .reduce((acc, val) => acc + val, 0) / Object.keys(output.modules).length,
      ),
      document: rpcResult?.data ?? null,
    },
    200,
    corsHeaders(req),
  );
});
