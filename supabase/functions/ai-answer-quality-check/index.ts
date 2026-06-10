import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import {
  gradeAgainstGovernance,
  loadGovernanceForGrading,
  persistAiGrading,
  type GradingResult,
} from "../_shared/answer-grading.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function normalizeAnswer(answer: unknown): string {
  if (Array.isArray(answer)) {
    return answer.map((item) => String(item)).join(", ").trim();
  }
  if (answer == null) return "";
  return String(answer).trim();
}

function responseFromGrading(result: GradingResult) {
  const issues = [
    ...result.hard_violations.map((issue) => issue.code),
    ...result.soft_issues.map((issue) => issue.code),
  ];
  const followupQuestions = result.accepted
    ? []
    : [
        ...result.hard_violations.map((issue) => issue.message),
        ...result.soft_issues.map((issue) => issue.message),
      ].slice(0, 4);

  return {
    ...result,
    issues,
    followup_questions: followupQuestions,
  };
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
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

    const guardResponse = getEndpointGuardResponse("ai-answer-quality-check", corsHeaders(req));
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
    const body = await req.json().catch(() => ({}));
    agencyId = normalizeAnswer(body.agency_id) || undefined;
    clientId = normalizeAnswer(body.client_id) || undefined;
    const answer = normalizeAnswer(body.answer ?? body.text ?? body.response);
    const contentType = normalizeAnswer(body.content_type ?? body.contentType) || "answer";
    const surface = normalizeAnswer(body.surface) || "ai-answer-quality-check";
    const runLlmJudge = body.run_llm_judge !== false && body.runLlmJudge !== false;

    if (!agencyId) {
      return jsonResponse({ error: "agency_id is required" }, 400, corsHeaders(req));
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

    if (clientId) {
      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select("id, agency_id")
        .eq("id", clientId)
        .maybeSingle();
      if (clientError) {
        return jsonResponse({ error: "Failed to load client" }, 500, corsHeaders(req));
      }
      if (!clientRow || clientRow.agency_id !== agencyId) {
        return jsonResponse({ error: "Client not found for agency" }, 404, corsHeaders(req));
      }
    }

    const governance = await loadGovernanceForGrading({
      supabase,
      agencyId,
      clientId: clientId ?? null,
    });

    const grading = await gradeAgainstGovernance({
      text: answer,
      governance,
      contentType,
      surface,
      runLlmJudge,
      context: {
        agencyId,
        clientId,
        userId,
        environment: "prod",
        supabase,
        skipUsageLog: true,
      },
    });

    const persisted = await persistAiGrading({
      supabase,
      agencyId,
      clientId: clientId ?? null,
      contentType,
      surface,
      result: grading,
      createdBy: user.id,
    });
    if (!persisted.ok) {
      return jsonResponse({ error: "Failed to persist grading", detail: persisted.error }, 500, corsHeaders(req));
    }

    return jsonResponse(responseFromGrading(grading), 200, corsHeaders(req));
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-answer-quality-check",
    taskType: TaskType.ANSWER_QUALITY_CHECK,
    agencyId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});
