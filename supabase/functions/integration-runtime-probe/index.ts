import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../_shared/env.ts";

type ProbeResult = {
  function_name: string;
  status: number | null;
  ok: boolean;
  body: unknown;
};

const CRON_TARGETS = [
  "publish-scheduled-posts",
  "refresh-meta-tokens",
  "sync-social-metrics",
  "email-sequence-dispatcher",
  "generate-approval-reminders",
];

async function invokeCronTarget(baseUrl: string, cronSecret: string, name: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": cronSecret,
      },
      body: JSON.stringify({ source: "integration-runtime-probe" }),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return {
      function_name: name,
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      body,
    };
  } catch (error) {
    return {
      function_name: name,
      status: null,
      ok: false,
      body: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/bearer\s+/i, "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: "Missing CRON_SECRET" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const results: ProbeResult[] = [];
    for (const target of CRON_TARGETS) {
      const result = await invokeCronTarget(SUPABASE_URL, cronSecret, target);
      results.push(result);
    }

    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    return new Response(
      JSON.stringify({
        ok: failed.length === 0,
        total: results.length,
        successful: okCount,
        failed: failed.length,
        results,
      }),
      {
        status: failed.length === 0 ? 200 : 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});
