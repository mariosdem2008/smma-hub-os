import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const TOKEN_CAP = 6000;
const DAILY_LIMIT = 20;
const MONTHLY_BUDGET = 50;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function utcDayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcMonthString(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
  }

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
  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;
  const question = (body.question as string | undefined)?.trim() ?? "";

  if (!agencyId || !question) {
    return jsonResponse({ error: "agency_id and question are required" }, 400, corsHeaders(req));
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

  const { data: promptRow, error: promptError } = await supabase
    .from("ai_prompt_registry")
    .select("id, version, model")
    .eq("task_type", "rag_ask")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (promptError || !promptRow) {
    return jsonResponse({ error: "Prompt registry not configured" }, 500, corsHeaders(req));
  }

  const dayKey = utcDayString();
  const monthKey = utcMonthString();

  const { data: rateRow } = await supabase
    .from("ai_rate_limits")
    .select("id, used_count, limit_per_day")
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("day_yyyy_mm_dd", dayKey)
    .maybeSingle();

  if (!rateRow) {
    await supabase.from("ai_rate_limits").insert({
      agency_id: agencyId,
      user_id: user.id,
      day_yyyy_mm_dd: dayKey,
      limit_per_day: DAILY_LIMIT,
      used_count: 0,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
  } else if (rateRow.used_count >= rateRow.limit_per_day) {
    const latency = Date.now() - startTime;
    const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: ["Daily rate limit reached. Please try again after 00:00 UTC."],
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: false,
      escalation_reason: null,
    };

    await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
    });

    return jsonResponse(responsePayload, 200, corsHeaders(req));
  }

  const { data: budgetRow } = await supabase
    .from("ai_budgets")
    .select("id, spent_usd, budget_usd, hard_stop")
    .eq("agency_id", agencyId)
    .eq("month_yyyy_mm", monthKey)
    .maybeSingle();

  if (!budgetRow) {
    await supabase.from("ai_budgets").insert({
      agency_id: agencyId,
      month_yyyy_mm: monthKey,
      budget_usd: MONTHLY_BUDGET,
      spent_usd: 0,
      hard_stop: true,
      reset_day: 1,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
  } else if (budgetRow.hard_stop && budgetRow.spent_usd >= budgetRow.budget_usd) {
    const latency = Date.now() - startTime;
    const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: null,
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: true,
      escalation_reason: "Monthly AI budget exceeded",
    };

    await supabase.from("ai_escalations").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      question,
      reason: "Monthly AI budget exceeded",
      status: "open",
      assignee_role: "agency_admin",
    });

    await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: true,
      escalation_reason: responsePayload.escalation_reason,
    });

    return jsonResponse(responsePayload, 200, corsHeaders(req));
  }

  const tokenEstimate = estimateTokens(question);
  if (tokenEstimate > TOKEN_CAP) {
    const latency = Date.now() - startTime;
    const responsePayload = {
      answer: "UNKNOWN",
      unknown: true,
      questions: ["Your request is too long. Please shorten it."],
      confidence: 0,
      sources: emptySources(),
      escalate_to_human: false,
      escalation_reason: null,
    };

    await supabase.from("ai_runs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      user_id: user.id,
      prompt_id: promptRow.id,
      prompt_version: promptRow.version,
      model: promptRow.model,
      tokens_in: tokenEstimate,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: latency,
      success: true,
      citations: responsePayload.sources,
      unknown: true,
      escalate_to_human: false,
      escalation_reason: null,
    });

    return jsonResponse(responsePayload, 200, corsHeaders(req));
  }

  await supabase
    .from("ai_rate_limits")
    .update({ used_count: (rateRow?.used_count ?? 0) + 1 })
    .eq("agency_id", agencyId)
    .eq("user_id", user.id)
    .eq("day_yyyy_mm_dd", dayKey);

  const responsePayload = {
    answer: "UNKNOWN",
    unknown: true,
    questions: [
      "What platform is this for?",
      "What is the primary goal of this request?",
    ],
    confidence: 0,
    sources: emptySources(),
    escalate_to_human: false,
    escalation_reason: null,
  };

  const latency = Date.now() - startTime;
  await supabase.from("ai_runs").insert({
    agency_id: agencyId,
    client_id: clientId ?? null,
    user_id: user.id,
    prompt_id: promptRow.id,
    prompt_version: promptRow.version,
    model: promptRow.model,
    tokens_in: tokenEstimate,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: latency,
    success: true,
    citations: responsePayload.sources,
    unknown: true,
    escalate_to_human: false,
    escalation_reason: null,
  });

  await supabase
    .from("ai_budgets")
    .update({ spent_usd: (budgetRow?.spent_usd ?? 0) })
    .eq("agency_id", agencyId)
    .eq("month_yyyy_mm", monthKey);

  return jsonResponse(responsePayload, 200, corsHeaders(req));
});
