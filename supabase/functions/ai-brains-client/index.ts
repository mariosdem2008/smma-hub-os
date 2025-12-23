import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const ACTIONS = ["create", "update", "lock"] as const;

type Action = (typeof ACTIONS)[number];

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
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
  const action = body.action as Action | undefined;
  const agencyId = body.agency_id as string | undefined;
  const clientId = body.client_id as string | undefined;

  if (!action || !ACTIONS.includes(action)) {
    return jsonResponse({ error: "Invalid action" }, 400, corsHeaders(req));
  }
  if (!agencyId || !clientId) {
    return jsonResponse({ error: "agency_id and client_id are required" }, 400, corsHeaders(req));
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

  if (action === "create") {
    const existing = await supabase
      .from("client_brains")
      .select("id")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .eq("version", 1)
      .maybeSingle();

    if (existing.data) {
      return jsonResponse({ error: "Client brain v1 already exists" }, 409, corsHeaders(req));
    }

    const { data, error } = await supabase
      .from("client_brains")
      .insert({
        agency_id: agencyId,
        client_id: clientId,
        version: 1,
        status: "draft",
        locked: false,
        brain_json: body.brain_json ?? {},
        json_diff: body.json_diff ?? null,
        confidence: body.confidence ?? 0,
      })
      .select("id, agency_id, client_id, version, status, locked")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400, corsHeaders(req));
    }

    return jsonResponse({ success: true, brain: data }, 200, corsHeaders(req));
  }

  const brainId = body.brain_id as string | undefined;
  if (!brainId) {
    return jsonResponse({ error: "brain_id is required" }, 400, corsHeaders(req));
  }

  if (action === "update") {
    const updatePayload: Record<string, unknown> = {
      brain_json: body.brain_json ?? {},
      json_diff: body.json_diff ?? null,
    };

    if (typeof body.confidence === "number") {
      updatePayload.confidence = body.confidence;
    }
    if (typeof body.status === "string") {
      updatePayload.status = body.status;
    }

    const { data, error } = await supabase
      .from("client_brains")
      .update(updatePayload)
      .eq("id", brainId)
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .select("id, agency_id, client_id, version, status, locked")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400, corsHeaders(req));
    }

    return jsonResponse({ success: true, brain: data }, 200, corsHeaders(req));
  }

  const { data, error } = await supabase
    .from("client_brains")
    .update({ status: "locked", locked: true })
    .eq("id", brainId)
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .select("id, agency_id, client_id, version, status, locked")
    .single();

  if (error) {
    return jsonResponse({ error: error.message }, 400, corsHeaders(req));
  }

  return jsonResponse({ success: true, brain: data }, 200, corsHeaders(req));
});
