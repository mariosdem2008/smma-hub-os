import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL } from "../_shared/env.ts";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildStripeSignature(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const sigHex = bytesToHex(new Uint8Array(sig));
  return `t=${timestamp},v1=${sigHex}`;
}

serve(async (req: Request) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
    if (!webhookSecret) {
      return new Response(JSON.stringify({ error: "Missing STRIPE_WEBHOOK_SECRET" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL" }), {
        status: 500,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const eventPayload = JSON.stringify({
      id: `evt_probe_${Date.now()}`,
      object: "event",
      type: "invoice.payment_failed",
      data: {
        object: {
          object: "invoice",
          customer: "cus_probe_unknown",
        },
      },
    });

    const signature = await buildStripeSignature(eventPayload, webhookSecret);
    const webhookRes = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: eventPayload,
    });

    const webhookText = await webhookRes.text();
    let webhookJson: unknown = null;
    try {
      webhookJson = webhookText ? JSON.parse(webhookText) : null;
    } catch {
      webhookJson = { raw: webhookText };
    }

    const ok = webhookRes.status === 200 && (webhookJson as Record<string, unknown> | null)?.received === true;
    return new Response(
      JSON.stringify({
        ok,
        webhook_status: webhookRes.status,
        webhook_response: webhookJson,
      }),
      {
        status: ok ? 200 : 500,
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
