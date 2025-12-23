import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const MIN_TEXT_LENGTH = 20;
const MAX_FOLLOWUPS = 3;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function buildFollowups(inputType: string) {
  if (inputType === "chips" || inputType === "single_select") {
    return ["Select at least one option."].slice(0, MAX_FOLLOWUPS);
  }
  return [
    "Please add more detail.",
    "Include any specific constraints or examples.",
  ].slice(0, MAX_FOLLOWUPS);
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

  const body = await req.json().catch(() => ({}));
  const agencyId = body.agency_id as string | undefined;
  const questionId = body.question_id as string | undefined;
  const questionText = body.question_text as string | undefined;
  const inputType = body.input_type as string | undefined;
  const answer = body.answer as string | string[] | undefined;

  if (!agencyId || !questionId || !questionText || !inputType) {
    return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders(req));
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

  const answerText = Array.isArray(answer) ? answer.join(" ") : (answer ?? "").toString();
  const tokenEstimate = estimateTokens(`${questionText} ${answerText}`);

  const { data: promptRow } = await supabase
    .from("ai_prompt_registry")
    .select("id, version, model")
    .eq("task_type", "answer_quality_check")
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shouldAccept = (() => {
    if (inputType === "chips" || inputType === "multi_select") {
      return Array.isArray(answer) && answer.length > 0;
    }
    if (inputType === "single_select") {
      return typeof answer === "string" && answer.trim().length > 0;
    }
    return answerText.trim().length >= MIN_TEXT_LENGTH;
  })();

  const followups = shouldAccept ? [] : buildFollowups(inputType);
  const issues = shouldAccept ? [] : ["Answer too short or incomplete."];

  await supabase.from("ai_runs").insert({
    agency_id: agencyId,
    client_id: body.client_id ?? null,
    user_id: user.id,
    prompt_id: promptRow?.id ?? null,
    prompt_version: promptRow?.version ?? null,
    model: promptRow?.model ?? "CHEAP_MODEL",
    tokens_in: tokenEstimate,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    success: true,
    citations: { agency_brain_fields: [], client_brain_fields: [], memory_citations: [] },
    unknown: false,
    escalate_to_human: false,
    escalation_reason: null,
  });

  return jsonResponse(
    {
      accepted: shouldAccept,
      followup_questions: followups,
      issues,
      question_id: questionId,
    },
    200,
    corsHeaders(req)
  );
});
