import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import {
  buildAgencyPulse,
  type AgencyPulseBlockerSnapshot,
  type AgencyPulseClient,
  type AgencyPulseGrading,
  type AgencyPulseOutput,
  type AgencyPulseReportState,
  type AgencyPulseStrategyState,
} from "../_shared/agency-pulse.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type PulseBody = {
  agency_id?: string;
  refresh_blockers?: boolean;
  refreshBlockers?: boolean;
  blocker_stale_minutes?: number;
  blockerStaleMinutes?: number;
  refresh_limit?: number;
  refreshLimit?: number;
  refresh_offset?: number;
  refreshOffset?: number;
  run_briefing?: boolean;
  runBriefing?: boolean;
};

type RefreshResult = {
  attempted: number;
  refreshed: number;
  failed: number;
  stale_total: number;
  next_offset: number | null;
  errors: Array<{ client_id: string; error: string }>;
};

const MAX_CLIENTS = 500;
const DEFAULT_BLOCKER_STALE_MINUTES = 6 * 60;
const DEFAULT_REFRESH_LIMIT = 25;
const MAX_REFRESH_LIMIT = 50;
const RECENT_GRADING_DAYS = 30;
const STRATEGY_STALE_DAYS = 45;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeLimit(value: unknown) {
  return Math.max(1, Math.min(MAX_REFRESH_LIMIT, Math.floor(toNumber(value, DEFAULT_REFRESH_LIMIT))));
}

function normalizeOffset(value: unknown) {
  return Math.max(0, Math.floor(toNumber(value, 0)));
}

function parseDateMs(value: unknown) {
  if (!value) return 0;
  const date = new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function maxIso(values: unknown[]) {
  let max = 0;
  for (const value of values) {
    max = Math.max(max, parseDateMs(value));
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

function currentPeriod(now: Date) {
  return now.toISOString().slice(0, 7);
}

function envValue(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

function localPulseLlmConfigured() {
  const baseUrl = envValue("OPENAI_BASE_URL") ?? "";
  const apiKey = envValue("OPENAI_API_KEY") ?? "";
  if (!apiKey.trim() || !baseUrl.trim()) return false;
  return /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/i.test(baseUrl) || /ollama/i.test(baseUrl);
}

function deterministicBriefing(pulse: AgencyPulseOutput) {
  const summary = pulse.summary;
  const top = pulse.attention[0];
  if (!top) {
    return `${summary.on_track} of ${summary.clients_total} active client(s) are on track; no immediate agency pulse actions are queued.`;
  }
  return `${summary.blocked} blocked and ${summary.at_risk} at-risk client(s); next action is ${top.client_name}: ${top.recommended_action}`;
}

async function maybeBuildLocalBriefing(args: {
  pulse: AgencyPulseOutput;
  agencyId: string;
  userId: string;
  supabase: SupabaseClient;
  runBriefing: boolean;
}) {
  if (!args.runBriefing) {
    return { briefing: null as string | null, local_llm_used: false };
  }

  if (!localPulseLlmConfigured()) {
    return { briefing: deterministicBriefing(args.pulse), local_llm_used: false };
  }

  try {
    const aiRouterPath = ["..", "..", "..", "src", "ai", "router.ts"].join("/");
    const { ai } = await import(aiRouterPath) as {
      ai: {
        run: (args: Record<string, unknown>) => Promise<{ text?: string | null }>;
      };
    };
    const result = await ai.run({
      taskType: "SUMMARIZE",
      input: JSON.stringify({
        summary: args.pulse.summary,
        top_attention: args.pulse.attention.slice(0, 5),
      }),
      context: {
        agencyId: args.agencyId,
        userId: args.userId,
        environment: "prod",
        supabase: args.supabase,
        skipUsageLog: true,
      },
      metadata: {
        providerOverride: "openai",
        modelOverride: envValue("AI_AGENCY_PULSE_LOCAL_MODEL") ?? envValue("AI_GRADER_FALLBACK_MODEL") ?? "qwen2.5:7b-instruct",
        systemPrompt:
          "Write one concise agency-owner briefing sentence from the provided deterministic pulse JSON. No new facts. No hype. Under 180 characters.",
      },
    });
    const text = cleanString(result.text);
    if (!text || text === "UNKNOWN") {
      return { briefing: deterministicBriefing(args.pulse), local_llm_used: false };
    }
    return { briefing: text.slice(0, 220), local_llm_used: true };
  } catch (error) {
    console.warn("agency_pulse_local_briefing_failed", error instanceof Error ? error.message : String(error));
    return { briefing: deterministicBriefing(args.pulse), local_llm_used: false };
  }
}

async function requireMembership(args: { supabase: SupabaseClient; userId: string; agencyId: string }) {
  const { data, error } = await args.supabase
    .from("agency_members")
    .select("agency_id")
    .eq("agency_id", args.agencyId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function loadActiveClients(args: { supabase: SupabaseClient; agencyId: string }): Promise<AgencyPulseClient[]> {
  const { data, error } = await args.supabase
    .from("clients")
    .select("id, name, status, updated_at")
    .eq("agency_id", args.agencyId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(MAX_CLIENTS);

  if (error) throw new Error(error.message);
  return (data ?? []) as AgencyPulseClient[];
}

async function loadBlockerSnapshots(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientIds: string[];
}): Promise<AgencyPulseBlockerSnapshot[]> {
  if (args.clientIds.length === 0) return [];
  const { data, error } = await args.supabase
    .from("client_blockers")
    .select("agency_id, client_id, delivery_state, blockers, counts, scanned_at, created_at, updated_at")
    .eq("agency_id", args.agencyId)
    .in("client_id", args.clientIds)
    .order("scanned_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AgencyPulseBlockerSnapshot[];
}

async function refreshStaleBlockers(args: {
  authHeader: string;
  agencyId: string;
  clients: AgencyPulseClient[];
  snapshots: AgencyPulseBlockerSnapshot[];
  staleMinutes: number;
  limit: number;
  offset: number;
}): Promise<RefreshResult> {
  const byClient = new Map(args.snapshots.map((snapshot) => [cleanString(snapshot.client_id), snapshot]));
  const staleCutoff = Date.now() - Math.max(1, args.staleMinutes) * 60 * 1000;
  const staleClients = args.clients.filter((client) => {
    const snapshot = byClient.get(client.id);
    if (!snapshot) return true;
    const scannedAt = parseDateMs(snapshot.scanned_at);
    return !scannedAt || scannedAt < staleCutoff;
  });
  const page = staleClients.slice(args.offset, args.offset + args.limit);
  const errors: RefreshResult["errors"] = [];
  let refreshed = 0;

  for (const client of page) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-blocker-scan`, {
        method: "POST",
        headers: {
          "Authorization": args.authHeader,
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agency_id: args.agencyId,
          client_id: client.id,
          run_llm: false,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(cleanString((payload as any)?.error) || `HTTP ${response.status}`);
      }
      refreshed += 1;
    } catch (error) {
      errors.push({
        client_id: client.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    attempted: page.length,
    refreshed,
    failed: errors.length,
    stale_total: staleClients.length,
    next_offset: args.offset + args.limit < staleClients.length ? args.offset + args.limit : null,
    errors,
  };
}

async function loadGradings(args: {
  supabase: SupabaseClient;
  agencyId: string;
  now: Date;
}): Promise<AgencyPulseGrading[]> {
  const since = new Date(args.now.getTime() - RECENT_GRADING_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await args.supabase
    .from("ai_gradings")
    .select("id, client_id, content_type, surface, score, accepted, hard_violations, soft_issues, created_at")
    .eq("agency_id", args.agencyId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);
  return ((data ?? []) as AgencyPulseGrading[]).filter((grading) => {
    const hardCount = Array.isArray(grading.hard_violations) ? grading.hard_violations.length : 0;
    return grading.accepted === false || hardCount > 0;
  });
}

async function loadStrategyStates(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientIds: string[];
}): Promise<AgencyPulseStrategyState[]> {
  if (args.clientIds.length === 0) return [];

  const [profilesRes, strategiesRes, modulesRes, artifactsRes] = await Promise.all([
    args.supabase
      .from("client_onboarding_profiles")
      .select("client_id, completed_at, readiness_score, updated_at")
      .eq("agency_id", args.agencyId)
      .in("client_id", args.clientIds)
      .order("updated_at", { ascending: false }),
    args.supabase
      .from("strategies")
      .select("client_id, status, locked_at, updated_at, created_at")
      .eq("agency_id", args.agencyId)
      .in("client_id", args.clientIds)
      .order("updated_at", { ascending: false }),
    args.supabase
      .from("strategy_modules")
      .select("client_id, status, locked_at, updated_at")
      .eq("agency_id", args.agencyId)
      .in("client_id", args.clientIds)
      .in("status", ["approved", "locked"])
      .order("updated_at", { ascending: false }),
    args.supabase
      .from("strategy_artifacts_v2")
      .select("client_id, status, approved_at, updated_at, published_to_strategy_id")
      .eq("agency_id", args.agencyId)
      .in("client_id", args.clientIds)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
  ]);

  const firstError = [profilesRes, strategiesRes, modulesRes, artifactsRes].find((res) => res.error)?.error;
  if (firstError) throw new Error(firstError.message ?? "Failed to load strategy state");

  const latestProfile = new Map<string, any>();
  for (const profile of profilesRes.data ?? []) {
    if (!latestProfile.has(profile.client_id)) latestProfile.set(profile.client_id, profile);
  }

  const strategiesByClient = new Map<string, any[]>();
  for (const row of strategiesRes.data ?? []) {
    strategiesByClient.set(row.client_id, [...(strategiesByClient.get(row.client_id) ?? []), row]);
  }

  const modulesByClient = new Map<string, any[]>();
  for (const row of modulesRes.data ?? []) {
    modulesByClient.set(row.client_id, [...(modulesByClient.get(row.client_id) ?? []), row]);
  }

  const artifactsByClient = new Map<string, any[]>();
  for (const row of artifactsRes.data ?? []) {
    artifactsByClient.set(row.client_id, [...(artifactsByClient.get(row.client_id) ?? []), row]);
  }

  return args.clientIds.map((clientId) => {
    const profile = latestProfile.get(clientId);
    const strategies = strategiesByClient.get(clientId) ?? [];
    const approvedStrategies = strategies.filter((strategy) => {
      const status = cleanString(strategy.status).toLowerCase();
      return status === "approved" || status === "locked" || Boolean(strategy.locked_at);
    });
    const modules = modulesByClient.get(clientId) ?? [];
    const artifacts = artifactsByClient.get(clientId) ?? [];
    const readiness = Number(profile?.readiness_score ?? 0);
    const approvedAt = maxIso([
      ...approvedStrategies.flatMap((strategy) => [strategy.locked_at, strategy.updated_at, strategy.created_at]),
      ...modules.flatMap((module) => [module.locked_at, module.updated_at]),
      ...artifacts.flatMap((artifact) => [artifact.approved_at, artifact.updated_at]),
    ]);
    const latestActivity = maxIso([
      ...strategies.flatMap((strategy) => [strategy.updated_at, strategy.created_at]),
      ...modules.map((module) => module.updated_at),
      ...artifacts.map((artifact) => artifact.updated_at),
    ]);

    return {
      client_id: clientId,
      onboarding_complete: Boolean(profile?.completed_at || readiness >= 100),
      onboarding_completed_at: profile?.completed_at ?? null,
      onboarding_updated_at: profile?.updated_at ?? null,
      has_approved_strategy: approvedStrategies.length + modules.length + artifacts.length > 0,
      approved_strategy_count: approvedStrategies.length,
      approved_module_count: modules.length,
      approved_artifact_count: artifacts.length,
      approved_strategy_at: approvedAt,
      latest_strategy_updated_at: latestActivity,
    };
  });
}

async function loadReportStates(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientIds: string[];
  period: string;
}): Promise<AgencyPulseReportState[]> {
  if (args.clientIds.length === 0) return [];
  const { data, error } = await args.supabase
    .from("client_reports")
    .select("client_id, month, data, created_at, updated_at")
    .eq("agency_id", args.agencyId)
    .in("client_id", args.clientIds)
    .order("month", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);

  const rowsByClient = new Map<string, any[]>();
  for (const row of data ?? []) {
    rowsByClient.set(row.client_id, [...(rowsByClient.get(row.client_id) ?? []), row]);
  }

  return args.clientIds.map((clientId) => {
    const reports = rowsByClient.get(clientId) ?? [];
    const current = reports.find((report) => report.month === args.period);
    const latest = reports[0];
    return {
      client_id: clientId,
      current_period: args.period,
      current_period_report_generated: Boolean(current),
      latest_report_month: latest?.month ?? null,
      latest_report_generated_at: cleanString(latest?.data?.generated_at) || latest?.updated_at || latest?.created_at || null,
    };
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

  const guardResponse = getEndpointGuardResponse("ai-agency-pulse", corsHeaders(req));
  if (guardResponse) return guardResponse;

  try {
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

    const body = (await req.json().catch(() => ({}))) as PulseBody;
    const agencyId = cleanString(body.agency_id);
    if (!agencyId) {
      return jsonResponse({ error: "agency_id is required" }, 400, corsHeaders(req));
    }

    const hasMembership = await requireMembership({ supabase, userId: user.id, agencyId });
    if (!hasMembership) {
      return jsonResponse({ error: "Forbidden" }, 403, corsHeaders(req));
    }

    const refreshBlockers = body.refresh_blockers !== false && body.refreshBlockers !== false;
    const refreshLimit = normalizeLimit(body.refresh_limit ?? body.refreshLimit);
    const refreshOffset = normalizeOffset(body.refresh_offset ?? body.refreshOffset);
    const staleMinutes = Math.max(
      1,
      Math.floor(toNumber(body.blocker_stale_minutes ?? body.blockerStaleMinutes, DEFAULT_BLOCKER_STALE_MINUTES)),
    );
    const runBriefing = body.run_briefing === true || body.runBriefing === true;

    const now = new Date();
    const period = currentPeriod(now);
    const clients = await loadActiveClients({ supabase, agencyId });
    const clientIds = clients.map((client) => client.id);

    let blockerSnapshots = await loadBlockerSnapshots({ supabase, agencyId, clientIds });
    const refresh = refreshBlockers
      ? await refreshStaleBlockers({
          authHeader,
          agencyId,
          clients,
          snapshots: blockerSnapshots,
          staleMinutes,
          limit: refreshLimit,
          offset: refreshOffset,
        })
      : {
          attempted: 0,
          refreshed: 0,
          failed: 0,
          stale_total: 0,
          next_offset: null,
          errors: [],
        };

    if (refresh.refreshed > 0) {
      blockerSnapshots = await loadBlockerSnapshots({ supabase, agencyId, clientIds });
    }

    const [gradings, strategyStates, reportStates] = await Promise.all([
      loadGradings({ supabase, agencyId, now }),
      loadStrategyStates({ supabase, agencyId, clientIds }),
      loadReportStates({ supabase, agencyId, clientIds, period }),
    ]);

    const pulse = buildAgencyPulse({
      clients,
      blockerSnapshots,
      gradings,
      strategyStates,
      reportStates,
      now,
      strategyStaleDays: STRATEGY_STALE_DAYS,
      recentGradingDays: RECENT_GRADING_DAYS,
    });

    const briefing = await maybeBuildLocalBriefing({
      pulse,
      agencyId,
      userId: user.id,
      supabase,
      runBriefing,
    });

    return jsonResponse(
      {
        ...pulse,
        generated_at: now.toISOString(),
        current_period: period,
        persisted: false,
        refresh,
        briefing: briefing.briefing,
        local_llm_used: briefing.local_llm_used,
      },
      refresh.failed > 0 && refresh.refreshed === 0 && refresh.attempted > 0 ? 207 : 200,
      corsHeaders(req),
    );
  } catch (error) {
    console.error("agency_pulse_failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to build agency pulse" },
      500,
      corsHeaders(req),
    );
  }
});
