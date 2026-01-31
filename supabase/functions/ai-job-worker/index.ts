import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { verifyCronSecret } from "../_shared/cron.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { mapV3AnswersToClientBrain } from "../_shared/client-brain-mapping.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { buildChunks, embedText, getExpectedEmbeddingDim, tokenize } from "../_shared/embeddings.ts";
import { embedWithPolicy } from "../_shared/embedding-policy.ts";
import { persistEmbeddingResult } from "../_shared/embedding-store.ts";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 5;
const SUMMARY_CHUNK_SIZE_TOKENS = 900;
const SUMMARY_OVERLAP_TOKENS = 140;
const SUMMARY_MAX_CHUNKS = 12;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function backoffDelayMs(attempts: number) {
  const base = 1000;
  const max = 15 * 60 * 1000;
  const delay = Math.min(max, base * Math.pow(2, Math.max(0, attempts - 1)));
  return delay;
}

function sanitizeText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function extractOfferNames(offers: unknown) {
  if (!Array.isArray(offers)) return [];
  const names: string[] = [];
  for (const offer of offers) {
    if (offer && typeof offer === "object") {
      const name = (offer as any).name;
      const cleaned = sanitizeText(name);
      if (cleaned) names.push(cleaned);
    } else {
      const cleaned = sanitizeText(offer);
      if (cleaned) names.push(cleaned);
    }
  }
  return names;
}

function buildRawResponsesFromOnboardingProfile(profile: Record<string, unknown>) {
  const q12Competitors = Array.isArray(profile.q12_competitors)
    ? (profile.q12_competitors as any[]).map((c) => sanitizeText((c as any)?.name)).filter(Boolean)
    : [];

  const offers = extractOfferNames(profile.offers);
  const priceMin = typeof profile.q6_price_min === "number" ? profile.q6_price_min : null;
  const priceMax = typeof profile.q6_price_max === "number" ? profile.q6_price_max : null;
  const pricing =
    priceMin !== null || priceMax !== null
      ? `${priceMin ?? ""}${priceMin != null && priceMax != null ? "-" : ""}${priceMax ?? ""}`.trim()
      : "";

  const platforms = sanitizeList(profile.platforms)
    .concat(sanitizeList(profile.q16_enabled_channels))
    .concat(sanitizeList(profile.q2_social_links));

  const differentiators = sanitizeList(profile.q13_differentiators);
  const painPoints = sanitizeList(profile.q9_pain_points);

  const primaryCustomer = sanitizeText(profile.primary_customer ?? profile.q8_ideal_customer);
  const audience = [primaryCustomer, ...painPoints].filter(Boolean);

  const primaryGoal = sanitizeText(profile.primary_goal ?? profile.q17_primary_goal);
  const conversionPath = sanitizeText(profile.conversion_path);
  const goals = [primaryGoal, conversionPath].filter(Boolean);

  const competitorLink = sanitizeText(profile.competitor_link);
  const competitors = [...q12Competitors, competitorLink].filter(Boolean);

  const cta = sanitizeText(profile.q6_main_cta);

  return {
    brand: sanitizeText(profile.q1_business_name),
    website: sanitizeText(profile.q2_website),
    platforms,
    offers: offers.length ? offers : sanitizeList([profile.q6_offer_name, profile.q5_offer_type]).filter(Boolean),
    differentiators,
    audience,
    goals,
    competitors,
    cta_styles: cta ? [cta] : [],
    pricing,
    pillars: differentiators.slice(0, 6),
    assets: sanitizeList(profile.available_assets),
  } satisfies Record<string, unknown>;
}

async function getAgencyBrainApprovedDocCount(supabase: any, agencyId: string) {
  const { count, error } = await supabase
    .from("ai_documents")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("doc_type", "brain_document")
    .eq("metadata->>status", "approved");

  if (error) throw new Error(error.message ?? "Failed to check agency brain readiness");
  return Number(count ?? 0);
}

async function upsertJob(supabase: any, args: {
  agencyId: string;
  clientId: string;
  jobType: string;
  dedupeKey: string;
  payload?: Record<string, unknown>;
  runAfterIso?: string;
}) {
  await supabase.from("ai_jobs").upsert(
    {
      agency_id: args.agencyId,
      client_id: args.clientId,
      job_type: args.jobType,
      payload_json: args.payload ?? {},
      dedupe_key: args.dedupeKey,
      status: "pending",
      run_after: args.runAfterIso ?? new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "job_type,client_id,dedupe_key" },
  );
}

async function ingestClientBrainSummaryAsGuidelines(opts: {
  supabase: any;
  agencyId: string;
  clientId: string;
  summary: string;
  sourceRef: string;
}) {
  const extractedText = opts.summary.slice(0, 150000);
  const tokens = tokenize(extractedText);
  const chunks = buildChunks(tokens, SUMMARY_CHUNK_SIZE_TOKENS, SUMMARY_OVERLAP_TOKENS, SUMMARY_MAX_CHUNKS);
  if (chunks.length === 0) return;

  const { data: docRow, error: docError } = await opts.supabase
    .from("ai_documents")
    .insert({
      agency_id: opts.agencyId,
      client_id: opts.clientId,
      doc_type: "client_guidelines",
      title: "Client onboarding summary",
      content: extractedText,
      extracted_text: extractedText,
      source: { source_type: "client_brain", source_ref: opts.sourceRef },
      metadata: {
        summary_type: "client_brain_summary_v1",
        chunk_size_tokens: SUMMARY_CHUNK_SIZE_TOKENS,
        overlap_tokens: SUMMARY_OVERLAP_TOKENS,
        max_chunks_per_doc: SUMMARY_MAX_CHUNKS,
        token_count: tokens.length,
      },
    })
    .select("id")
    .single();

  if (docError || !docRow?.id) {
    throw new Error(docError?.message ?? "Failed to create client guidelines document");
  }

  const embeddingApiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
  const embeddingModel = Deno.env.get("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const expectedDim = getExpectedEmbeddingDim();
  const failHard = Deno.env.get("AI_EMBEDDING_FAIL_HARD") === "true";

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const { data: chunkRow } = await opts.supabase
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

    const embeddingResult = await embedWithPolicy({
      text: chunk.text,
      apiKey: embeddingApiKey ?? undefined,
      failHard,
      embed: (text) => embedText(text, "", embeddingModel),
    });

    await persistEmbeddingResult({
      supabase: opts.supabase,
      chunkId: chunkRow.id,
      embeddingResult,
      embeddingPayload: {
        agency_id: opts.agencyId,
        client_id: opts.clientId,
        doc_type: "client_guidelines",
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
  }

  // Keep only the most recent generated summary for this client.
  await opts.supabase
    .from("ai_documents")
    .delete()
    .eq("agency_id", opts.agencyId)
    .eq("client_id", opts.clientId)
    .eq("doc_type", "client_guidelines")
    .eq("metadata->>summary_type", "client_brain_summary_v1")
    .neq("id", docRow.id);
}

async function invokeStrategyGenerate(
  supabaseUrl: string,
  cronSecret: string,
  clientId: string,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/ai-strategy-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({ client_id: clientId, source: "ai_job_worker" }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data?.error ?? `Strategy generate failed with ${response.status}`;
    return { ok: false, error: errorMessage };
  }

  return { ok: true, data };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-job-worker", corsHeaders(req));
  if (guardResponse) return guardResponse;

  const cronAuth = verifyCronSecret(req, corsHeaders(req));
  if (cronAuth) return cronAuth;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const batchSize = Number(Deno.env.get("AI_JOB_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);
  const { data: jobs, error } = await supabase.rpc("claim_ai_jobs", {
    p_limit: Number.isFinite(batchSize) ? batchSize : DEFAULT_BATCH_SIZE,
  });

  if (error) {
    return jsonResponse({ error: "Failed to claim jobs" }, 500, corsHeaders(req));
  }

  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (!cronSecret) {
    return jsonResponse({ error: "CRON_SECRET not configured" }, 500, corsHeaders(req));
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of jobs ?? []) {
    const jobId = (job as any).id as string;
    const jobType = (job as any).job_type as string;
    const clientId = (job as any).client_id as string;
    const agencyId = (job as any).agency_id as string;
    const attempts = Number((job as any).attempts ?? 1);
    const dedupeKey = (job as any).dedupe_key as string | null;

    try {
      if (dedupeKey) {
        const { data: existing } = await supabase
          .from("ai_jobs")
          .select("id")
          .eq("job_type", jobType)
          .eq("client_id", clientId)
          .eq("dedupe_key", dedupeKey)
          .eq("status", "succeeded")
          .limit(1);

        if ((existing ?? []).length > 0) {
          await supabase.from("ai_jobs").update({
            status: "succeeded",
            last_error: null,
            updated_at: new Date().toISOString(),
          }).eq("id", jobId);
          results.push({ id: jobId, status: "skipped" });
          continue;
        }
      }

      if (jobType === "ingest_client_brain") {
        const { data: profile, error: profileError } = await supabase
          .from("client_onboarding_profiles")
          .select("*")
          .eq("client_id", clientId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (profileError) throw new Error(profileError.message ?? "Failed to load onboarding profile");
        if (!profile) throw new Error("Onboarding profile missing");

        const rawResponses = buildRawResponsesFromOnboardingProfile(profile as any);
        const generatedAt = new Date().toISOString();
        const clientBrain = mapV3AnswersToClientBrain(rawResponses, {}, generatedAt);
        const gate = evaluateClientBrainForStrategy(clientBrain as any);

        const status = gate.usable ? "usable" : "draft";

        const { data: brainRow, error: brainError } = await supabase
          .from("client_brains")
          .select("id")
          .eq("agency_id", agencyId)
          .eq("client_id", clientId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (brainError) throw new Error(brainError.message ?? "Failed to load client brain row");

        const sourceRef = brainRow?.id ?? `client:${clientId}:generated_at:${generatedAt}`;

        if (!brainRow?.id) {
          await supabase.from("client_brains").insert({
            agency_id: agencyId,
            client_id: clientId,
            version: 1,
            status,
            locked: false,
            usable: gate.usable,
            brain_json: clientBrain,
            json_diff: null,
            confidence: 0,
          });
        } else {
          await supabase.from("client_brains").update({
            brain_json: clientBrain,
            status,
            usable: gate.usable,
            updated_at: new Date().toISOString(),
          }).eq("id", brainRow.id);
        }

        // Seed client memory so strategy generation can be grounded without asking users to upload docs.
        const brandName = (clientBrain as any)?.brand_basics?.name ?? "";
        const offer = Array.isArray((clientBrain as any)?.offer_details?.products_services)
          ? (clientBrain as any).offer_details.products_services.join("; ")
          : "";
        const goals = Array.isArray((clientBrain as any)?.goals) ? (clientBrain as any).goals.join("; ") : "";
        const pillars = Array.isArray((clientBrain as any)?.pillars)
          ? (clientBrain as any).pillars.map((p: any) => p?.name).filter(Boolean).join("; ")
          : "";
        const constraints = Array.isArray((clientBrain as any)?.constraints?.banned_claims_or_taboo_topics)
          ? (clientBrain as any).constraints.banned_claims_or_taboo_topics.join("; ")
          : "";

        const summary = [
          brandName ? `Brand: ${brandName}.` : null,
          offer ? `Offers: ${offer}.` : null,
          goals ? `Goals: ${goals}.` : null,
          pillars ? `Pillars: ${pillars}.` : null,
          constraints ? `Constraints: ${constraints}.` : null,
        ].filter(Boolean).join(" ");

        if (summary.trim().length > 0) {
          await ingestClientBrainSummaryAsGuidelines({
            supabase,
            agencyId,
            clientId,
            summary,
            sourceRef: String(sourceRef),
          });
        }

        if (gate.usable) {
          const approvedCount = await getAgencyBrainApprovedDocCount(supabase, agencyId);
          if (approvedCount > 0) {
            await upsertJob(supabase, {
              agencyId,
              clientId,
              jobType: "seed_strategy",
              dedupeKey: `seed_strategy:${clientId}`,
              payload: { source: "onboarding" },
              runAfterIso: new Date().toISOString(),
            });
          }
        }
      } else if (jobType === "seed_strategy") {
        const response = await invokeStrategyGenerate(SUPABASE_URL, cronSecret, clientId);
        if (!response.ok) {
          throw new Error(response.error ?? "Strategy generation failed");
        }

        // If the endpoint gates with UNKNOWN, the response is still HTTP 200.
        // We treat that as a success: the system is intentionally blocking.
      } else {
        throw new Error(`Unsupported job_type: ${jobType}`);
      }

      await supabase.from("ai_jobs").update({
        status: "succeeded",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      results.push({ id: jobId, status: "succeeded" });
    } catch (err: any) {
      const exceeded = attempts >= MAX_ATTEMPTS;
      const nextRun = new Date(Date.now() + backoffDelayMs(attempts));

      await supabase.from("ai_jobs").update({
        status: exceeded ? "failed" : "pending",
        run_after: exceeded ? new Date().toISOString() : nextRun.toISOString(),
        last_error: err?.message ?? "Unknown error",
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      results.push({ id: jobId, status: exceeded ? "failed" : "retrying", error: err?.message });
    }
  }

  return jsonResponse({ success: true, processed: results.length, results }, 200, corsHeaders(req));
});
