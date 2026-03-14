import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { handleAgencyAdminChat, handleAgencyAdminChatStream } from "../_shared/agency-admin-chat.ts";
import { enforceAgencyAgentActivation } from "../_shared/agency-ai-setup.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function sseHeaders(req: Request): Record<string, string> {
  return {
    ...corsHeaders(req),
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
}

function buildSseStreamFromGenerator(generator: AsyncGenerator<{ event: string; data: unknown }>) {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          send(controller, chunk.event, chunk.data);
          if (chunk.event === "done" || chunk.event === "error") break;
        }
      } catch (error) {
        send(controller, "error", { error: error instanceof Error ? error.message : "Streaming failed" });
      } finally {
        controller.close();
      }
    },
  });
}

async function resolveAgencyIdForAdminChat(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const threadId = typeof body.thread_id === "string" ? body.thread_id.trim() : "";
  if (threadId) {
    const { data } = await supabase
      .from("agency_ai_chat_threads")
      .select("agency_id")
      .eq("id", threadId)
      .maybeSingle();
    if (data?.agency_id) return data.agency_id as string;
  }

  const { data } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  return (data?.agency_id as string | undefined) ?? undefined;
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let agencyId: string | undefined;
  let userId: string | undefined;

  response = await (async () => {
    try {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(req) });
      }

      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
      }

      const guardResponse = getEndpointGuardResponse("ai-agency-admin-chat", corsHeaders(req));
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
      agencyId = await resolveAgencyIdForAdminChat(supabase, user.id, (body ?? {}) as Record<string, unknown>);

      if (agencyId) {
        const activationResponse = await enforceAgencyAgentActivation({
          supabaseClient: supabase,
          agencyId,
          agentClass: "operator",
          requiredMode: "internal_assist_only",
          corsHeaders: corsHeaders(req),
        });
        if (activationResponse) return activationResponse;
      }

      const url = new URL(req.url);
      const streamEnabled = url.searchParams.get("stream") === "1";
      if (streamEnabled) {
        const stream = await handleAgencyAdminChatStream({
          supabase,
          userId: user.id,
          body,
        });
        return new Response(buildSseStreamFromGenerator(stream), { status: 200, headers: sseHeaders(req) });
      }

      const result = await handleAgencyAdminChat({
        supabase,
        userId: user.id,
        body,
      });

      return jsonResponse(result.body, result.status, corsHeaders(req));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unhandled error";
      // Helpful in local dev; still avoid leaking stack traces to production origins.
      const origin = req.headers.get("origin") ?? "";
      const includeDebug = origin.startsWith("http://localhost:");

      if (error instanceof Error) {
        console.error("ai-agency-admin-chat_unhandled_error", { message: error.message, stack: error.stack });
      } else {
        console.error("ai-agency-admin-chat_unhandled_error", { message });
      }

      return jsonResponse(
        { error: message, ...(includeDebug ? { debug: String((error as any)?.stack ?? "") } : {}) },
        500,
        corsHeaders(req),
      );
    }
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-agency-admin-chat",
    taskType: TaskType.AGENCY_ADMIN_GENERAL_CHAT,
    agencyId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  return response!;
});
