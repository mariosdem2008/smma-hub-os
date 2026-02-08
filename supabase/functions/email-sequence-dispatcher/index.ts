import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { verifyCronSecret } from "../_shared/cron.ts";

type EmailDispatchResult = {
  provider: string;
  provider_message_id?: string | null;
};

const DEFAULT_BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3;

serve(async (req: Request) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const cronAuth = verifyCronSecret(req, headers);
  if (cronAuth) return cronAuth;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const batchSize = Number(Deno.env.get("EMAIL_SEQUENCE_BATCH_SIZE") ?? DEFAULT_BATCH_SIZE);
    const { data: pendingJobs, error: pendingError } = await supabase
      .from("email_sequence_jobs")
      .select("id, agency_id, client_id, sequence_id, payload, attempts")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(Number.isFinite(batchSize) ? batchSize : DEFAULT_BATCH_SIZE);

    if (pendingError) {
      throw new Error(pendingError.message ?? "Failed to load email sequence jobs");
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No email sequence jobs to dispatch", processed: 0 }),
        { headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    const results: Array<Record<string, unknown>> = [];

    for (const job of pendingJobs) {
      const jobId = job.id as string;
      const attempts = Number(job.attempts ?? 0);

      const { data: claimed } = await supabase
        .from("email_sequence_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .eq("status", "pending")
        .select("id, agency_id, client_id, sequence_id, payload, attempts")
        .maybeSingle();

      if (!claimed) {
        continue;
      }

      try {
        const agencyId = String(claimed.agency_id);
        const clientId = String(claimed.client_id);
        const sequenceId = String(claimed.sequence_id ?? "");
        const payload = (claimed.payload ?? {}) as Record<string, unknown>;

        if (!sequenceId) {
          throw new Error("sequence_id_missing");
        }

        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, agency_id, name, email")
          .eq("id", clientId)
          .eq("agency_id", agencyId)
          .maybeSingle();

        if (clientError || !client) {
          throw new Error("tenant_scope_violation_or_client_missing");
        }

        if (!client.email) {
          throw new Error("client_email_missing");
        }

        const { data: agency } = await supabase
          .from("agencies")
          .select("id, name")
          .eq("id", agencyId)
          .maybeSingle();

        const subject = buildSubject(payload, agency?.name ?? null, sequenceId);
        const body = buildBody(payload, client.name ?? null, agency?.name ?? null, sequenceId);

        const dispatchResult = await dispatchEmail({
          toEmail: client.email,
          subject,
          text: body.text,
          html: body.html,
        });

        await supabase
          .from("email_sequence_jobs")
          .update({
            status: "sent",
            attempts: attempts + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await supabase.from("ai_history").insert({
          agency_id: agencyId,
          client_id: clientId,
          mode: "email_sequence_dispatch",
          input: {
            job_id: jobId,
            sequence_id: sequenceId,
            to: client.email,
          },
          output: {
            status: "sent",
            provider: dispatchResult.provider,
            provider_message_id: dispatchResult.provider_message_id ?? null,
          },
        });

        results.push({ id: jobId, status: "sent" });
      } catch (error) {
        const nextAttempts = attempts + 1;
        const exceeded = nextAttempts >= MAX_ATTEMPTS;
        const message = error instanceof Error ? error.message : String(error);

        await supabase
          .from("email_sequence_jobs")
          .update({
            status: exceeded ? "failed" : "pending",
            attempts: nextAttempts,
            last_error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        const agencyId = String((job as any).agency_id ?? "");
        const clientId = String((job as any).client_id ?? "");
        if (agencyId && clientId) {
          await supabase.from("ai_history").insert({
            agency_id: agencyId,
            client_id: clientId,
            mode: "email_sequence_dispatch",
            input: { job_id: jobId, sequence_id: String((job as any).sequence_id ?? "") },
            output: { status: exceeded ? "failed" : "retrying", error: message },
          });
        }

        results.push({ id: jobId, status: exceeded ? "failed" : "retrying", error: message });
      }
    }

    return new Response(
      JSON.stringify({ message: "Email sequence dispatch complete", processed: results.length, results }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...headers, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

function buildSubject(payload: Record<string, unknown>, agencyName: string | null, sequenceId: string) {
  const custom = typeof payload.subject === "string" ? payload.subject.trim() : "";
  if (custom) return custom;
  const agencyLabel = agencyName ? `from ${agencyName}` : "from your agency";
  return `Update ${agencyLabel} (${sequenceId})`;
}

function buildBody(
  payload: Record<string, unknown>,
  clientName: string | null,
  agencyName: string | null,
  sequenceId: string,
) {
  const customText = typeof payload.text === "string" ? payload.text.trim() : "";
  const customHtml = typeof payload.html === "string" ? payload.html.trim() : "";
  if (customText || customHtml) {
    return { text: customText || stripHtml(customHtml), html: customHtml || textToHtml(customText) };
  }

  const greeting = clientName ? `Hi ${clientName},` : "Hi there,";
  const agencyLabel = agencyName ?? "your agency";
  const text = `${greeting}\n\nThis is an update from ${agencyLabel} related to sequence ${sequenceId}.\n\nIf you have questions, reply to this email.\n`;
  const html = `<p>${escapeHtml(greeting)}</p><p>This is an update from ${escapeHtml(agencyLabel)} related to sequence ${escapeHtml(sequenceId)}.</p><p>If you have questions, reply to this email.</p>`;
  return { text, html };
}

function textToHtml(value: string) {
  return `<p>${escapeHtml(value).replace(/\n+/g, "</p><p>")}</p>`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function dispatchEmail(input: {
  toEmail: string;
  subject: string;
  text: string;
  html: string;
}): Promise<EmailDispatchResult> {
  const provider = (Deno.env.get("EMAIL_DISPATCH_PROVIDER") ?? "").trim().toLowerCase();
  const from = Deno.env.get("EMAIL_DISPATCH_FROM") ?? "";

  if (provider === "resend") {
    const apiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!apiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    if (!from) {
      throw new Error("EMAIL_DISPATCH_FROM not configured");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.toEmail],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend error: ${response.status} ${body}`);
    }

    const data = await response.json();
    return { provider: "resend", provider_message_id: data?.id ?? null };
  }

  throw new Error("EMAIL_DISPATCH_PROVIDER not configured");
}
