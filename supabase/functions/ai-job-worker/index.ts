import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { verifyCronSecret } from "../_shared/cron.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 5;

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

      if (jobType === "seed_strategy") {
        const response = await invokeStrategyGenerate(SUPABASE_URL, cronSecret, clientId);
        if (!response.ok) {
          throw new Error(response.error ?? "Strategy generation failed");
        }
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
