import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { runAiTask } from "../_shared/ai.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";

type CopilotSection = "basics" | "goal" | "offers" | "audience" | "brand" | "proof" | "channels" | "review";

type CopilotRequest = {
  agency_id: string;
  client_id: string;
  section: CopilotSection;
  input: string;
  profile?: Record<string, unknown>;
};

type CopilotResponse = {
  updates: Record<string, unknown>;
  confidence: number;
  follow_up?: string;
};

function clampConfidence(value: unknown, fallback = 0.55): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  if (value < 0.3) return 0.3;
  if (value > 0.95) return 0.95;
  return Math.round(value * 100) / 100;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const guardResponse = getEndpointGuardResponse("ai-onboarding-copilot", corsHeaders);
    if (guardResponse) return guardResponse;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as CopilotRequest;
    const { agency_id, client_id, section, input, profile } = body;

    if (!agency_id || !client_id || !section || !input?.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields: agency_id, client_id, section, input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabase
      .from("agency_members")
      .select("id")
      .eq("agency_id", agency_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Unauthorized: Not a member of this agency" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = [
      "You map client-onboarding conversational input into structured JSON updates.",
      "Return only valid JSON with this exact shape:",
      '{"updates": { ... }, "confidence": 0.0, "follow_up": "optional string"}',
      "Rules:",
      "- confidence must be between 0 and 1",
      "- include only fields relevant to the given section",
      "- do not return markdown",
      "",
      `Section: ${section}`,
      `User input: ${input}`,
      `Existing profile JSON: ${JSON.stringify(profile ?? {})}`,
    ].join("\n");

    const aiResult = await runAiTask({
      task_type: TaskType.EXTRACT_STRUCTURED,
      tenant: { agency_id, client_id, user_id: user.id },
      input: { message: prompt },
      metadata: {
        instructions:
          "Output JSON only. Keys: updates(object), confidence(number), follow_up(string optional).",
        providerOverride: "anthropic",
        modelOverride: "claude-3-5-haiku-20241022",
      },
      supabase,
    });

    const json = (aiResult?.json ?? {}) as Record<string, unknown>;
    const response: CopilotResponse = {
      updates: (json.updates as Record<string, unknown>) ?? {},
      confidence: clampConfidence(json.confidence, 0.6),
      follow_up: typeof json.follow_up === "string" ? json.follow_up : undefined,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ai-onboarding-copilot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

