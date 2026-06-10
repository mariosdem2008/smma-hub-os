import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import {
  detectClientBlockers,
  type BlockerDetectionResult,
  type ClientBlocker,
} from "../_shared/blocker-detection.ts";
import { ai } from "../../../src/ai/router.ts";
import { arraySchema } from "../../../src/ai/schema.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type ScanBody = {
  agency_id?: string;
  client_id?: string;
  mode?: "client" | "agency";
  limit?: number;
  offset?: number;
  run_llm?: boolean;
  runLlm?: boolean;
};

type ClientRow = {
  id: string;
  agency_id: string;
  status?: string | null;
};

type PersistedSnapshot = {
  id: string;
  agency_id: string;
  client_id: string;
  delivery_state: BlockerDetectionResult["delivery_state"];
  blockers: ClientBlocker[];
  counts: BlockerDetectionResult["counts"];
  scanned_at: string;
};

const MAX_AGENCY_SCAN_LIMIT = 50;
const DEFAULT_AGENCY_SCAN_LIMIT = 25;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function envValue(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

function localBlockerLlmConfigured() {
  const baseUrl = envValue("OPENAI_BASE_URL") ?? "";
  const apiKey = envValue("OPENAI_API_KEY") ?? "";
  if (!apiKey.trim() || !baseUrl.trim()) return false;
  return /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/i.test(baseUrl) || /ollama/i.test(baseUrl);
}

function normalizeLimit(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AGENCY_SCAN_LIMIT;
  return Math.max(1, Math.min(MAX_AGENCY_SCAN_LIMIT, Math.floor(numeric)));
}

function normalizeOffset(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

async function requireMembership(args: {
  supabase: SupabaseClient;
  userId: string;
  agencyId: string;
}) {
  const { data, error } = await args.supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", args.userId)
    .eq("agency_id", args.agencyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function loadClient(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
}) {
  const { data, error } = await args.supabase
    .from("clients")
    .select("id, agency_id, status")
    .eq("id", args.clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.agency_id !== args.agencyId) return null;
  return data as ClientRow;
}

async function loadAgencyClients(args: {
  supabase: SupabaseClient;
  agencyId: string;
  limit: number;
  offset: number;
}) {
  const from = args.offset;
  const to = args.offset + args.limit - 1;
  const { data, error } = await args.supabase
    .from("clients")
    .select("id, agency_id, status")
    .eq("agency_id", args.agencyId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClientRow[];
}

function isOnboardingComplete(profile: Record<string, unknown> | null, brainStatus: Record<string, unknown> | null) {
  const readiness = Number(profile?.readiness_score ?? 0);
  return Boolean(profile?.completed_at || readiness >= 100 || brainStatus?.usable === true);
}

async function maybeTightenActions(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
  userId: string;
  result: BlockerDetectionResult;
  runLlm: boolean;
}) {
  if (!args.runLlm || args.result.blockers.length === 0 || !localBlockerLlmConfigured()) {
    return args.result;
  }

  try {
    const llm = await ai.run({
      taskType: TaskType.SUMMARIZE,
      input: JSON.stringify(
        args.result.blockers.map((blocker) => ({
          code: blocker.code,
          title: blocker.title,
          owner: blocker.owner,
          current_action: blocker.recommended_next_action,
        })),
      ),
      context: {
        agencyId: args.agencyId,
        clientId: args.clientId,
        userId: args.userId,
        environment: "prod",
        supabase: args.supabase,
        skipUsageLog: true,
      },
      metadata: {
        providerOverride: "openai",
        modelOverride: envValue("AI_BLOCKER_LOCAL_MODEL") ?? envValue("AI_GRADER_FALLBACK_MODEL") ?? "qwen2.5:7b-instruct",
        systemPrompt:
          "Rewrite only recommended_next_action values for an agency delivery blocker dashboard. Return strict JSON array only, each item {\"code\":\"...\",\"recommended_next_action\":\"...\"}. Keep actions concrete, under 180 characters, no hype, no new facts.",
      },
      outputSchema: arraySchema<{ code?: unknown; recommended_next_action?: unknown }>("blocker_action_rewrites"),
    });

    if (!Array.isArray(llm.output)) return args.result;
    const rewrites = new Map<string, string>();
    for (const item of llm.output) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const code = cleanString(record.code);
      const action = cleanString(record.recommended_next_action);
      if (!code || !action || action.length > 180) continue;
      rewrites.set(code, action);
    }
    if (rewrites.size === 0) return args.result;

    return {
      ...args.result,
      blockers: args.result.blockers.map((blocker) => ({
        ...blocker,
        recommended_next_action: rewrites.get(blocker.code) ?? blocker.recommended_next_action,
      })),
    };
  } catch (error) {
    console.error("blocker_local_wording_failed", {
      agencyId: args.agencyId,
      clientId: args.clientId,
      message: error instanceof Error ? error.message : String(error),
    });
    return args.result;
  }
}

async function scanClient(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
  userId: string;
  nowIso: string;
  runLlm: boolean;
}): Promise<PersistedSnapshot> {
  const [
    brainStatusRes,
    operationsSetupRes,
    enrichmentQueueRes,
    executionTasksRes,
    projectsRes,
    profileRes,
    strategiesRes,
    strategyModulesRes,
    strategyArtifactsRes,
  ] = await Promise.all([
    args.supabase.rpc("get_client_brain_status", { p_client_id: args.clientId }),
    args.supabase
      .from("client_operations_setup")
      .select("*")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .maybeSingle(),
    args.supabase
      .from("client_enrichment_queue")
      .select("*")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .in("status", ["queued", "ready", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    args.supabase
      .from("client_execution_tasks")
      .select("*")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .in("status", ["todo", "waiting_on_client", "in_progress", "blocked"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    args.supabase
      .from("projects")
      .select("id, title, status, pipeline_stage, scheduled_for, scheduled_time, last_moved_at, created_at, updated_at")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .order("updated_at", { ascending: false })
      .limit(250),
    args.supabase
      .from("client_onboarding_profiles")
      .select("completed_at, readiness_score, v5_meta, updated_at")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    args.supabase
      .from("strategies")
      .select("id, status, locked_at, updated_at")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .order("updated_at", { ascending: false })
      .limit(10),
    args.supabase
      .from("strategy_modules")
      .select("id, status, strategy_id")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .eq("status", "approved")
      .limit(25),
    args.supabase
      .from("strategy_artifacts_v2")
      .select("id, status, published_to_strategy_id, artifact_type, approved_at")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .eq("status", "approved")
      .limit(25),
  ]);

  const responses = [
    brainStatusRes,
    operationsSetupRes,
    enrichmentQueueRes,
    executionTasksRes,
    projectsRes,
    profileRes,
    strategiesRes,
    strategyModulesRes,
    strategyArtifactsRes,
  ];
  const firstError = responses.find((res) => res.error)?.error;
  if (firstError) throw new Error(firstError.message ?? "Failed to load blocker signals");

  const rawBrainStatus = Array.isArray(brainStatusRes.data) ? brainStatusRes.data[0] : brainStatusRes.data;
  const brainStatus = (rawBrainStatus ?? null) as Record<string, unknown> | null;
  const profile = (profileRes.data ?? null) as Record<string, unknown> | null;
  const strategies = (strategiesRes.data ?? []) as Array<Record<string, unknown>>;
  const strategyModules = (strategyModulesRes.data ?? []) as Array<Record<string, unknown>>;
  const strategyArtifacts = (strategyArtifactsRes.data ?? []) as Array<Record<string, unknown>>;

  const detected = detectClientBlockers({
    clientId: args.clientId,
    now: args.nowIso,
    brainStatus: brainStatus as any,
    operationsSetup: (operationsSetupRes.data ?? null) as any,
    enrichmentQueue: (enrichmentQueueRes.data ?? []) as any,
    executionTasks: (executionTasksRes.data ?? []) as any,
    projects: (projectsRes.data ?? []) as any,
    strategyState: {
      onboardingComplete: isOnboardingComplete(profile, brainStatus),
      strategies: strategies as any,
      approvedModuleCount: strategyModules.length,
      approvedArtifactCount: strategyArtifacts.length,
      hasApprovedStrategy:
        strategyModules.length > 0 ||
        strategyArtifacts.length > 0 ||
        strategies.some((strategy) => {
          const status = cleanString(strategy.status).toLowerCase();
          return status === "approved" || status === "locked" || Boolean(strategy.locked_at);
        }),
    },
  });

  const result = await maybeTightenActions({
    supabase: args.supabase,
    agencyId: args.agencyId,
    clientId: args.clientId,
    userId: args.userId,
    result: detected,
    runLlm: args.runLlm,
  });

  const { data, error } = await args.supabase
    .from("client_blockers")
    .upsert(
      {
        agency_id: args.agencyId,
        client_id: args.clientId,
        delivery_state: result.delivery_state,
        blockers: result.blockers,
        counts: result.counts,
        scanned_at: args.nowIso,
      },
      { onConflict: "client_id" },
    )
    .select("id, agency_id, client_id, delivery_state, blockers, counts, scanned_at")
    .single();

  if (error) throw new Error(error.message);
  return data as PersistedSnapshot;
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: SupabaseClient | null = null;
  let agencyId: string | undefined;
  let clientId: string | undefined;
  let userId: string | undefined;

  response = await (async () => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
    }

    const guardResponse = getEndpointGuardResponse("ai-blocker-scan", corsHeaders(req));
    if (guardResponse) return guardResponse;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
    }

    userId = user.id;
    const body = (await req.json().catch(() => ({}))) as ScanBody;
    agencyId = cleanString(body.agency_id) || undefined;
    clientId = cleanString(body.client_id) || undefined;
    const runLlm = body.run_llm === true || body.runLlm === true;

    if (!agencyId) {
      return jsonResponse({ error: "agency_id is required" }, 400, corsHeaders(req));
    }

    const hasMembership = await requireMembership({ supabase, userId: user.id, agencyId });
    if (!hasMembership) {
      return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
    }

    const nowIso = new Date().toISOString();

    if (clientId) {
      const client = await loadClient({ supabase, agencyId, clientId });
      if (!client) {
        return jsonResponse({ error: "Client not found for agency" }, 404, corsHeaders(req));
      }

      const snapshot = await scanClient({
        supabase,
        agencyId,
        clientId,
        userId: user.id,
        nowIso,
        runLlm,
      });
      return jsonResponse({ mode: "client", snapshot, local_llm_used: runLlm && localBlockerLlmConfigured() }, 200, corsHeaders(req));
    }

    const limit = normalizeLimit(body.limit);
    const offset = normalizeOffset(body.offset);
    const clients = await loadAgencyClients({ supabase, agencyId, limit, offset });
    const snapshots: PersistedSnapshot[] = [];
    const errors: Array<{ client_id: string; error: string }> = [];

    for (const client of clients) {
      try {
        const snapshot = await scanClient({
          supabase,
          agencyId,
          clientId: client.id,
          userId: user.id,
          nowIso,
          runLlm,
        });
        snapshots.push(snapshot);
      } catch (error) {
        errors.push({
          client_id: client.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return jsonResponse(
      {
        mode: "agency",
        scanned: snapshots.length,
        failed: errors.length,
        snapshots,
        errors,
        paging: {
          limit,
          offset,
          next_offset: clients.length === limit ? offset + limit : null,
        },
        local_llm_used: runLlm && localBlockerLlmConfigured(),
      },
      errors.length > 0 && snapshots.length === 0 ? 500 : 200,
      corsHeaders(req),
    );
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-blocker-scan",
    taskType: TaskType.TOOL_EXECUTION,
    agencyId,
    clientId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});
