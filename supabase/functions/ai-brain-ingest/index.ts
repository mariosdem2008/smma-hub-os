import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { buildChunks, embedText, getExpectedEmbeddingDim, tokenize } from "../_shared/embeddings.ts";
import { embedWithPolicy } from "../_shared/embedding-policy.ts";
import { persistEmbeddingResult } from "../_shared/embedding-store.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { mapV3AnswersToClientBrain } from "../_shared/client-brain-mapping.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

const CHUNK_SIZE_TOKENS = 900;
const OVERLAP_TOKENS = 140;
const MAX_CHUNKS = 12;

type BrainScope = "agency" | "client";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function splitToList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => item.toString()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractFirstUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.match(/https?:\/\/\S+/i);
  return match ? match[0] : "";
}

function buildClientSummary(brain: Record<string, any>) {
  const name = brain?.brand_basics?.name || "Client";
  const offers = (brain?.offer_details?.products_services || []).join("; ");
  const goals = (brain?.goals || []).join("; ");
  const pillars = (brain?.pillars || []).map((p: any) => p?.name).filter(Boolean).join("; ");
  const constraints = [
    ...(brain?.constraints?.banned_claims || []),
    ...(brain?.constraints?.taboo_topics || []),
  ]
    .filter(Boolean)
    .join("; ");

  return [
    `Brand: ${name}.`,
    offers ? `Offers: ${offers}.` : null,
    goals ? `Goals: ${goals}.` : null,
    pillars ? `Pillars: ${pillars}.` : null,
    constraints ? `Constraints: ${constraints}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAgencySummary(brain: Record<string, any>) {
  const name = brain?.identity?.name || brain?.setup_profile_v1?.agency?.name || "Agency";
  const offers = (brain?.identity?.offers || []).join("; ");
  const services = (brain?.setup_profile_v1?.agency?.primary_services || []).join("; ");
  const niches = (brain?.identity?.niches || brain?.setup_profile_v1?.agency?.niche_industries || []).join("; ");
  const voice = (brain?.voice_tone?.adjectives || brain?.setup_profile_v1?.brand?.voice_adjectives || []).join(", ");
  const pricing = brain?.setup_profile_v1?.agency?.pricing_structure || "";
  const differentiators = brain?.setup_profile_v1?.agency?.unique_differentiators || "";

  return [
    `Agency: ${name}.`,
    offers ? `Services: ${offers}.` : null,
    services ? `Services: ${services}.` : null,
    niches ? `Niches: ${niches}.` : null,
    voice ? `Brand Voice: ${voice}.` : null,
    pricing ? `Pricing: ${pricing}.` : null,
    differentiators ? `Differentiators: ${differentiators}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-brain-ingest", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
  }

  const startTime = Date.now();
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;
  const brainId = body.brain_id as string | undefined;
  const rawResponsesOverride = body.raw_responses as Record<string, unknown> | undefined;
  const followupOverride = body.followup_responses as Record<string, unknown> | undefined;
  const scope = (body.scope as BrainScope | undefined) ?? (clientId ? "client" : "agency");

  if (!agencyId) {
    return jsonResponse({ error: "agency_id is required" }, 400, corsHeaders(req));
  }
  if (scope === "client" && !clientId) {
    return jsonResponse({ error: "client_id is required for client scope" }, 400, corsHeaders(req));
  }

  const { data: membership } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", user.id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
  }

  const table = scope === "agency" ? "agency_brains" : "client_brains";
  let query = supabase.from(table).select("id, brain_json, status, version").eq("agency_id", agencyId);
  if (scope === "client" && clientId) {
    query = query.eq("client_id", clientId);
  }
  if (brainId) {
    query = query.eq("id", brainId);
  }

  const { data: brainRow, error: brainError } = await query
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (brainError || !brainRow) {
    return jsonResponse({ error: brainError?.message ?? "Brain not found" }, 404, corsHeaders(req));
  }

  const rawResponses = rawResponsesOverride ?? (brainRow.brain_json as any)?.raw_responses ?? {};
  const followupResponses = followupOverride ?? (brainRow.brain_json as any)?.followup_responses ?? {};
  const generatedAt = new Date().toISOString();

  if (scope === "agency") {
    const agencyBrain = {
      identity: {
        name: (rawResponses.identity as string) ?? "",
        niches: splitToList(rawResponses.identity),
        offers: splitToList(rawResponses.offers),
        geo: splitToList(rawResponses.geo),
        languages: splitToList(rawResponses.languages),
      },
      icp: {
        industries: splitToList(rawResponses.icp),
        size: [],
        personas: splitToList(rawResponses.personas),
        pains: splitToList(rawResponses.pains),
        objections: splitToList(rawResponses.objections),
      },
      voice_tone: {
        adjectives: splitToList(rawResponses.tone),
        banned_words: splitToList(rawResponses.banned),
        preferred_vocab: splitToList(rawResponses.vocab),
        writing_rules: splitToList(rawResponses.rules),
      },
      strategy_defaults: {
        pillars: splitToList(rawResponses.pillars),
        hook_styles: splitToList(rawResponses.hooks),
        cta_styles: splitToList(rawResponses.ctas),
        platform_formats: splitToList(rawResponses.formats),
      },
      safety_policy: {
        allowed: splitToList(rawResponses.safety),
        avoid: [],
        compliance_notes: [],
      },
      process_rules: {
        revisions: (rawResponses.process as string) ?? "",
        approvals: (rawResponses.process as string) ?? "",
        escalation_rules: (rawResponses.process as string) ?? "",
      },
      faq: [],
      gold_examples: splitToList(rawResponses.examples),
      raw_responses: rawResponses,
      followup_responses: followupResponses,
      inference_metadata: {
        source: "onboarding_v2",
        generated_at: generatedAt,
      },
    };

    const { data: updated } = await supabase
      .from("agency_brains")
      .update({ brain_json: agencyBrain })
      .eq("id", brainRow.id)
      .select("updated_at")
      .single();

    const agencySummary = buildAgencySummary(agencyBrain);
    if (agencySummary.trim().length > 0) {
      const { data: docRow } = await supabase
        .from("ai_documents")
        .insert({
          agency_id: agencyId,
          client_id: null,
          doc_type: "ai_artifact",
          title: "Agency brain summary",
          content: agencySummary,
          extracted_text: agencySummary,
          source: { source_type: "agency_brain", source_ref: brainRow.id },
          metadata: { summary_type: "agency_brain_summary" },
        })
        .select("id")
        .single();

      if (docRow?.id) {
        const tokens = tokenize(agencySummary);
        const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);
        const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
        const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
        const expectedDim = getExpectedEmbeddingDim();

        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = chunks[index];
          const { data: chunkRow } = await supabase
            .from("ai_document_chunks")
            .insert({
              document_id: docRow.id,
              chunk_index: index,
              chunk_text: chunk.text,
              token_count: chunk.tokenCount,
              chunk_meta: { start_token: chunk.start, end_token: chunk.end },
              embedding_status: "failed",
            })
            .select("id")
            .single();

          if (!chunkRow?.id) continue;

          let embeddingResult;
          try {
            embeddingResult = await embedWithPolicy({
              text: chunk.text,
              apiKey: embeddingApiKey ?? undefined,
              failHard,
              embed: (text) => embedText(text, embeddingApiKey ?? "", embeddingModel),
            });
          } catch (error: any) {
            if (error?.code === "MISSING_API_KEY") {
              return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
            }
            if (error?.code === "EMBEDDING_FAILED") {
              return jsonResponse({ error: "Embedding failed", code: "EMBEDDING_FAILED" }, 500, corsHeaders(req));
            }
            throw error;
          }

          const persistResult = await persistEmbeddingResult({
            supabase,
            chunkId: chunkRow.id,
            embeddingResult,
            embeddingPayload: {
              agency_id: agencyId,
              client_id: null,
              doc_type: "ai_artifact",
              document_id: docRow.id,
              chunk_id: chunkRow.id,
              embedding: [],
              model: embeddingModel,
              metadata: {
                similarity: "cosine",
                embedding_dim: expectedDim,
              },
            },
          });

          if (!persistResult.stored && persistResult.errorCode === "EMBEDDING_DIM_MISMATCH") {
            return jsonResponse({ error: "Embedding dimension mismatch", code: "EMBEDDING_DIM_MISMATCH" }, 500, corsHeaders(req));
          }
        }
      }
    }

    return jsonResponse(
      { ok: true, scope, usable: true, missing_fields: [], updated_at: updated?.updated_at ?? null },
      200,
      corsHeaders(req),
    );
  }

  const clientBrain = mapV3AnswersToClientBrain(rawResponses, followupResponses, generatedAt);

  const gate = evaluateClientBrainForStrategy(clientBrain);
  const status = gate.usable ? "usable" : "draft";

  const { data: updated } = await supabase
    .from("client_brains")
    .update({ brain_json: clientBrain, status, usable: gate.usable })
    .eq("id", brainRow.id);

  const summary = buildClientSummary(clientBrain);
  if (summary.trim().length > 0) {
    await supabase.from("ai_memory_items").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      type: "client_brain_summary",
      content: summary,
      metadata: {
        source: "brain_ingest_v1",
        brain_id: brainRow.id,
      },
    });

    const { data: docRow } = await supabase
      .from("ai_documents")
      .insert({
        agency_id: agencyId,
        client_id: clientId ?? null,
        doc_type: "ai_artifact",
        title: "Client brain summary",
        content: summary,
        extracted_text: summary,
        source: { source_type: "client_brain", source_ref: brainRow.id },
        metadata: { summary_type: "client_brain_summary" },
      })
      .select("id")
      .single();

    if (docRow?.id) {
      const tokens = tokenize(summary);
      const chunks = buildChunks(tokens, CHUNK_SIZE_TOKENS, OVERLAP_TOKENS, MAX_CHUNKS);
      const embeddingApiKey = Deno.env.get("OPENAI_API_KEY");
      const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
      const expectedDim = getExpectedEmbeddingDim();

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const { data: chunkRow } = await supabase
          .from("ai_document_chunks")
          .insert({
            document_id: docRow.id,
            chunk_index: index,
            chunk_text: chunk.text,
            token_count: chunk.tokenCount,
            chunk_meta: { start_token: chunk.start, end_token: chunk.end },
            embedding_status: "failed",
          })
          .select("id")
          .single();

        if (!chunkRow?.id) continue;

        let embeddingResult;
        try {
          embeddingResult = await embedWithPolicy({
            text: chunk.text,
            apiKey: embeddingApiKey ?? undefined,
            failHard,
            embed: (text) => embedText(text, embeddingApiKey ?? "", embeddingModel),
          });
        } catch (error: any) {
          if (error?.code === "MISSING_API_KEY") {
            return jsonResponse({ error: "OPENAI_API_KEY is not configured", code: "MISSING_API_KEY" }, 500, corsHeaders(req));
          }
          if (error?.code === "EMBEDDING_FAILED") {
            return jsonResponse({ error: "Embedding failed", code: "EMBEDDING_FAILED" }, 500, corsHeaders(req));
          }
          throw error;
        }

        const persistResult = await persistEmbeddingResult({
          supabase,
          chunkId: chunkRow.id,
          embeddingResult,
          embeddingPayload: {
            agency_id: agencyId,
            client_id: clientId ?? null,
            doc_type: "ai_artifact",
            document_id: docRow.id,
            chunk_id: chunkRow.id,
            embedding: [],
            model: embeddingModel,
            metadata: {
              similarity: "cosine",
              embedding_dim: expectedDim,
            },
          },
        });

        if (!persistResult.stored && persistResult.errorCode === "EMBEDDING_DIM_MISMATCH") {
          return jsonResponse({ error: "Embedding dimension mismatch", code: "EMBEDDING_DIM_MISMATCH" }, 500, corsHeaders(req));
        }
      }
    }
  }

  await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId ?? null,
    endpoint: "ai-brain-ingest",
    model: "mapping-only",
    tokens_estimate: 0,
    tokens_in: 0,
    tokens_out: 0,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

  return jsonResponse(
    {
      ok: true,
      scope,
      usable: gate.usable,
      missing_fields: gate.missing_fields,
      updated_at: updated?.updated_at ?? null,
    },
    200,
    corsHeaders(req),
  );
});
