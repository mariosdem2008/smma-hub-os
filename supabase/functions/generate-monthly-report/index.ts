import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "../_shared/env.ts";
import {
  loadGovernanceForGrading,
  summarizeGovernanceForJudge,
} from "../_shared/answer-grading.ts";
import { detectClientBlockers } from "../_shared/blocker-detection.ts";
import { ai } from "../../../src/ai/router.ts";
import {
  buildClientStrategyContext,
  buildKpiEvidencePhrases,
  generateStructuredReportInsight,
  governReportInsight,
  reportInsightToLegacyStrings,
  type DeliveryStateContext,
  type MonthlyReportKpis,
  type ReportTopPost,
} from "./report-insight.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = any;

type ReportRequestBody = {
  client_id?: string;
  agency_id?: string;
  month?: string;
};

type ClientRow = {
  id: string;
  agency_id: string;
  name: string;
  company: string | null;
  niche: string | null;
  tone_of_voice?: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function envValue(name: string): string | undefined {
  return Deno.env.get(name) ?? undefined;
}

function localReportLlmConfigured() {
  const baseUrl = envValue("OPENAI_BASE_URL") ?? "";
  const apiKey = envValue("OPENAI_API_KEY") ?? "";
  if (!apiKey.trim() || !baseUrl.trim()) return false;
  return /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/i.test(baseUrl) || /ollama/i.test(baseUrl);
}

function localReportModel() {
  return envValue("AI_MODEL__REPORT_INSIGHT") ?? envValue("AI_REPORT_LOCAL_MODEL") ?? "qwen2.5:7b-instruct";
}

function parseMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }
  const startDate = `${month}-01`;
  const endDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().split("T")[0];
  return { startDate, endDate };
}

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

async function readQuery<T>(label: string, query: PromiseLike<{ data: unknown; error: any }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn("[MONTHLY-REPORT] Optional query failed:", { label, message: error.message ?? String(error) });
      return fallback;
    }
    return (data ?? fallback) as T;
  } catch (error) {
    console.warn("[MONTHLY-REPORT] Optional query threw:", {
      label,
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

async function requireMembership(args: { supabase: SupabaseClient; userId: string; agencyId: string }) {
  const { data, error } = await args.supabase
    .from("agency_members")
    .select("id")
    .eq("agency_id", args.agencyId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function loadClient(args: { supabase: SupabaseClient; agencyId: string; clientId: string }) {
  const { data, error } = await args.supabase
    .from("clients")
    .select("id, agency_id, name, company, niche, tone_of_voice")
    .eq("id", args.clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as ClientRow | null;
  if (!row || row.agency_id !== args.agencyId) return null;
  return row;
}

async function loadLatestClientBrain(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
}) {
  const row = await readQuery<Record<string, unknown> | null>(
    "client_brains",
    args.supabase
      .from("client_brains")
      .select("brain_json")
      .eq("agency_id", args.agencyId)
      .eq("client_id", args.clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    null,
  );
  return (row?.brain_json as Record<string, unknown> | undefined) ?? null;
}

async function loadStrategyContext(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
  client: ClientRow;
  clientBrainJson: Record<string, unknown> | null;
}) {
  const [approvedBrief, approvedArtifacts, approvedModules, onboardingProfile] = await Promise.all([
    readQuery<Record<string, unknown> | null>(
      "client_operating_briefs_v2",
      args.supabase
        .from("client_operating_briefs_v2")
        .select("id, version, readiness_state, status, content_json, updated_at, approved_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .eq("status", "approved")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    ),
    readQuery<Array<Record<string, unknown>>>(
      "strategy_artifacts_v2",
      args.supabase
        .from("strategy_artifacts_v2")
        .select("id, artifact_type, status, version, content_json, markdown, approved_at, updated_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .eq("status", "approved")
        .in("artifact_type", ["strategy_recommendation", "strategy_plan_v2", "creator_brief"])
        .order("updated_at", { ascending: false })
        .limit(6),
      [],
    ),
    readQuery<Array<Record<string, unknown>>>(
      "strategy_modules",
      args.supabase
        .from("strategy_modules")
        .select("id, strategy_id, module, status, content_json, version, updated_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(12),
      [],
    ),
    readQuery<Record<string, unknown> | null>(
      "client_onboarding_profiles",
      args.supabase
        .from("client_onboarding_profiles")
        .select(
          "id, completed_at, readiness_score, primary_goal, conversion_path, q6_offer_name, q8_ideal_customer, q9_pain_points, q16_enabled_channels, q17_primary_goal, platforms, updated_at",
        )
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    ),
  ]);

  return buildClientStrategyContext({
    client: args.client,
    approvedBrief,
    approvedArtifacts,
    approvedModules,
    onboardingProfile,
    clientBrainJson: args.clientBrainJson,
  });
}

function isOnboardingComplete(profile: Record<string, unknown> | null, brainStatus: Record<string, unknown> | null) {
  const readiness = toNumber(profile?.readiness_score);
  return Boolean(profile?.completed_at || readiness >= 100 || brainStatus?.usable === true);
}

function normalizeDeliverySnapshot(row: Record<string, unknown> | null): DeliveryStateContext | null {
  if (!row) return null;
  const deliveryState = cleanString(row.delivery_state);
  const validState = deliveryState === "blocked" || deliveryState === "at_risk" || deliveryState === "on_track"
    ? deliveryState
    : "on_track";
  const counts = (row.counts && typeof row.counts === "object" ? row.counts : {}) as Record<string, unknown>;
  return {
    source: "client_blockers",
    delivery_state: validState,
    blockers: Array.isArray(row.blockers) ? row.blockers as DeliveryStateContext["blockers"] : [],
    counts: {
      high: toNumber(counts.high),
      med: toNumber(counts.med),
      blocked: toNumber(counts.blocked),
    },
    scanned_at: cleanString(row.scanned_at) || null,
  };
}

async function detectDeliveryContext(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
}): Promise<DeliveryStateContext> {
  const [
    brainStatusRaw,
    operationsSetup,
    enrichmentQueue,
    executionTasks,
    projects,
    profile,
    strategies,
    strategyModules,
    strategyArtifacts,
  ] = await Promise.all([
    readQuery<unknown>("get_client_brain_status", args.supabase.rpc("get_client_brain_status", { p_client_id: args.clientId }), null),
    readQuery<Record<string, unknown> | null>(
      "client_operations_setup",
      args.supabase
        .from("client_operations_setup")
        .select("*")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .maybeSingle(),
      null,
    ),
    readQuery<Array<Record<string, unknown>>>(
      "client_enrichment_queue",
      args.supabase
        .from("client_enrichment_queue")
        .select("*")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .in("status", ["queued", "ready", "in_progress"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      [],
    ),
    readQuery<Array<Record<string, unknown>>>(
      "client_execution_tasks",
      args.supabase
        .from("client_execution_tasks")
        .select("*")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .in("status", ["todo", "waiting_on_client", "in_progress", "blocked"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      [],
    ),
    readQuery<Array<Record<string, unknown>>>(
      "projects",
      args.supabase
        .from("projects")
        .select("id, title, status, pipeline_stage, scheduled_for, scheduled_time, last_moved_at, created_at, updated_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .order("updated_at", { ascending: false })
        .limit(250),
      [],
    ),
    readQuery<Record<string, unknown> | null>(
      "client_onboarding_profiles_for_delivery",
      args.supabase
        .from("client_onboarding_profiles")
        .select("completed_at, readiness_score, updated_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    ),
    readQuery<Array<Record<string, unknown>>>(
      "strategies",
      args.supabase
        .from("strategies")
        .select("id, status, locked_at, updated_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .order("updated_at", { ascending: false })
        .limit(10),
      [],
    ),
    readQuery<Array<Record<string, unknown>>>(
      "strategy_modules_for_delivery",
      args.supabase
        .from("strategy_modules")
        .select("id, status, strategy_id")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .eq("status", "approved")
        .limit(25),
      [],
    ),
    readQuery<Array<Record<string, unknown>>>(
      "strategy_artifacts_v2_for_delivery",
      args.supabase
        .from("strategy_artifacts_v2")
        .select("id, status, published_to_strategy_id, artifact_type, approved_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .eq("status", "approved")
        .limit(25),
      [],
    ),
  ]);

  const brainStatus = (Array.isArray(brainStatusRaw) ? brainStatusRaw[0] : brainStatusRaw) as Record<string, unknown> | null;
  const detected = detectClientBlockers({
    clientId: args.clientId,
    brainStatus: brainStatus as any,
    operationsSetup: operationsSetup as any,
    enrichmentQueue: enrichmentQueue as any,
    executionTasks: executionTasks as any,
    projects: projects as any,
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

  return {
    source: "live_detector",
    delivery_state: detected.delivery_state,
    blockers: detected.blockers,
    counts: detected.counts,
    scanned_at: new Date().toISOString(),
  };
}

async function loadDeliveryContext(args: {
  supabase: SupabaseClient;
  agencyId: string;
  clientId: string;
}): Promise<DeliveryStateContext> {
  const snapshot = normalizeDeliverySnapshot(
    await readQuery<Record<string, unknown> | null>(
      "client_blockers",
      args.supabase
        .from("client_blockers")
        .select("delivery_state, blockers, counts, scanned_at")
        .eq("agency_id", args.agencyId)
        .eq("client_id", args.clientId)
        .order("scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null,
    ),
  );

  if (snapshot) return snapshot;

  try {
    return await detectDeliveryContext(args);
  } catch (error) {
    console.warn("[MONTHLY-REPORT] Delivery detection unavailable:", error instanceof Error ? error.message : String(error));
    return {
      source: "unavailable",
      delivery_state: "on_track",
      blockers: [],
      counts: { high: 0, med: 0, blocked: 0 },
      scanned_at: null,
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[MONTHLY-REPORT] Function invoked");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Authentication required" }, 401);
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user) {
      return jsonResponse({ success: false, error: "Authentication failed" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as ReportRequestBody;
    const client_id = cleanString(body.client_id);
    const agency_id = cleanString(body.agency_id);
    const month = cleanString(body.month);
    const range = parseMonthRange(month);

    if (!client_id || !agency_id || !month || !range) {
      return jsonResponse({
        success: false,
        error: "client_id, agency_id, and month (YYYY-MM) are required",
      }, 400);
    }

    console.log("[MONTHLY-REPORT] Generating report for:", { client_id, month });

    const hasMembership = await requireMembership({ supabase: supabaseClient, userId: user.id, agencyId: agency_id });
    if (!hasMembership) {
      return jsonResponse({ success: false, error: "Unauthorized access to this agency" }, 403);
    }

    const client = await loadClient({ supabase: supabaseClient, agencyId: agency_id, clientId: client_id });
    if (!client) {
      return jsonResponse({ success: false, error: "Client not found for this agency" }, 404);
    }

    console.log("[MONTHLY-REPORT] Date range:", range.startDate, "to", range.endDate);

    const [profileStatsStart, profileStatsEnd, postMetrics] = await Promise.all([
      readQuery<Record<string, unknown> | null>(
        "social_profile_stats_start",
        supabaseClient
          .from("social_profile_stats")
          .select("followers, impressions")
          .eq("client_id", client_id)
          .lte("date", range.startDate)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
      readQuery<Record<string, unknown> | null>(
        "social_profile_stats_end",
        supabaseClient
          .from("social_profile_stats")
          .select("followers, impressions, profile_visits")
          .eq("client_id", client_id)
          .lte("date", range.endDate)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
      readQuery<Array<Record<string, unknown>>>(
        "social_post_metrics",
        supabaseClient
          .from("social_post_metrics")
          .select("*")
          .eq("client_id", client_id)
          .gte("date", range.startDate)
          .lte("date", range.endDate),
        [],
      ),
    ]);

    const followersStart = toNumber(profileStatsStart?.followers);
    const followersEnd = toNumber(profileStatsEnd?.followers);
    const followersGrowth = followersStart > 0 ? ((followersEnd - followersStart) / followersStart) * 100 : 0;

    const postsCount = postMetrics.length;
    const totalImpressions = postMetrics.reduce((sum, item) => sum + toNumber(item.impressions), 0);
    const totalReach = postMetrics.reduce((sum, item) => sum + toNumber(item.reach), 0);
    const totalLikes = postMetrics.reduce((sum, item) => sum + toNumber(item.likes), 0);
    const totalComments = postMetrics.reduce((sum, item) => sum + toNumber(item.comments), 0);
    const totalShares = postMetrics.reduce((sum, item) => sum + toNumber(item.shares), 0);
    const totalSaves = postMetrics.reduce((sum, item) => sum + toNumber(item.saves), 0);
    const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

    const postsWithEngagement = postMetrics.map((post) => {
      const raw = post as Record<string, unknown>;
      const engagement = toNumber(raw.likes) + toNumber(raw.comments) + toNumber(raw.shares) + toNumber(raw.saves);
      const reach = toNumber(raw.reach);
      const engagementRate = reach > 0 ? (engagement / reach) * 100 : 0;
      return { raw, engagement, engagementRate };
    });

    const topPosts: ReportTopPost[] = postsWithEngagement
      .sort((a, b) => toNumber(b.engagementRate) - toNumber(a.engagementRate))
      .slice(0, 5)
      .map((post) => ({
        platform: cleanString(post.raw.platform) || "unknown",
        platform_post_id: cleanString(post.raw.platform_post_id) || "unknown",
        date: cleanString(post.raw.date) || range.startDate,
        impressions: toNumber(post.raw.impressions),
        reach: toNumber(post.raw.reach),
        engagement: toNumber(post.engagement),
        engagementRate: roundMetric(toNumber(post.engagementRate)),
      }));

    const kpis: MonthlyReportKpis = {
      followersStart,
      followersEnd,
      followersGrowth: roundMetric(followersGrowth),
      postsCount,
      totalImpressions,
      totalReach,
      totalEngagement,
      avgEngagementRate: roundMetric(avgEngagementRate),
      profileVisits: toNumber(profileStatsEnd?.profile_visits),
    };

    console.log("[MONTHLY-REPORT] Computed KPIs:", {
      followersGrowth: kpis.followersGrowth,
      postsCount,
      totalImpressions,
      avgEngagementRate: kpis.avgEngagementRate,
    });

    const [clientBrainJson, delivery] = await Promise.all([
      loadLatestClientBrain({ supabase: supabaseClient, agencyId: agency_id, clientId: client_id }),
      loadDeliveryContext({ supabase: supabaseClient, agencyId: agency_id, clientId: client_id }),
    ]);

    const [governance, strategy] = await Promise.all([
      loadGovernanceForGrading({
        supabase: supabaseClient,
        agencyId: agency_id,
        clientId: client_id,
        clientBrainJson,
      }),
      loadStrategyContext({
        supabase: supabaseClient,
        agencyId: agency_id,
        clientId: client_id,
        client,
        clientBrainJson,
      }),
    ]);

    const insightContext = {
      month,
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        niche: client.niche,
      },
      kpis,
      topPosts,
      strategy,
      delivery,
      governanceSummary: summarizeGovernanceForJudge(governance),
      governance,
    };

    const localModelConfigured = localReportLlmConfigured();
    const aiContext = {
      agencyId: agency_id,
      clientId: client_id,
      userId: user.id,
      environment: "prod" as const,
      supabase: supabaseClient,
    };

    const generatedInsight = await generateStructuredReportInsight({
      context: insightContext,
      aiContext,
      aiRunner: ai.run.bind(ai),
      localLlmConfigured: localModelConfigured,
      modelOverride: localReportModel(),
    });

    const governedInsight = await governReportInsight({
      candidate: generatedInsight.insight,
      context: insightContext,
      governance,
      supabase: supabaseClient,
      agencyId: agency_id,
      clientId: client_id,
      createdBy: user.id,
      aiContext: { ...aiContext, skipUsageLog: true },
      runLlmJudge: localModelConfigured,
    });

    const legacyNarrative = reportInsightToLegacyStrings(governedInsight.insight);

    const reportData = {
      month,
      generated_at: new Date().toISOString(),
      kpis,
      topPosts,
      insights: legacyNarrative.insights,
      recommendations: legacyNarrative.recommendations,
      report_insight_json: governedInsight.insight,
      grounding: {
        kpi_evidence_phrases: buildKpiEvidencePhrases(insightContext),
        strategy_sources: strategy.sources,
        delivery_source: delivery.source,
        delivery_state: delivery.delivery_state,
        blocker_count: delivery.blockers.length,
      },
      governance: {
        score: governedInsight.grading.score,
        accepted: governedInsight.grading.accepted,
        blocked_by_governance: governedInsight.blockedByGovernance,
        initial_hard_violation_count: governedInsight.initialGrading.hard_violations.length,
        initial_soft_issue_count: governedInsight.initialGrading.soft_issues.length,
        grading_persist_error: governedInsight.gradingPersistError,
      },
      ai: {
        task_type: "REPORT_INSIGHT",
        insight_source: generatedInsight.source,
        insight_model: generatedInsight.model,
        local_model_configured: localModelConfigured,
        fallback_reason: governedInsight.fallbackReason ?? generatedInsight.fallbackReason,
      },
    };

    const { data: report, error: insertError } = await supabaseClient
      .from("client_reports")
      .upsert({
        agency_id,
        client_id,
        month,
        data: reportData,
      }, {
        onConflict: "client_id,month",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[MONTHLY-REPORT] Failed to store report:", insertError);
      return jsonResponse({ success: false, error: "Failed to store report" }, 500);
    }

    console.log("[MONTHLY-REPORT] Report generated and stored:", report.id);

    return jsonResponse({
      success: true,
      report: {
        id: report.id,
        ...reportData,
      },
    });
  } catch (error) {
    console.error("[MONTHLY-REPORT] Unexpected error:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }, 500);
  }
});
