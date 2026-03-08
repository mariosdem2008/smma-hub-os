import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function parseDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFallback() {
  const repoRoot = process.cwd();
  return {
    ...parseDotEnvFile(path.join(repoRoot, "supabase", ".env")),
    ...parseDotEnvFile(path.join(repoRoot, ".env")),
    ...process.env,
  };
}

function signStripePayload(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function main() {
  const env = loadEnvFallback();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET || "";

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: "invoice.payment_failed",
    data: {
      object: {
        object: "invoice",
        customer: "cus_runtime_probe_unknown",
      },
    },
  });

  const signature = signStripePayload(payload, webhookSecret);
  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": signature,
    },
    body: payload,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  const base = path.resolve("docs/audit/system/evidence/integration_runtime_2026-03-07");
  const artifact = {
    at: new Date().toISOString(),
    status: res.status,
    ok: res.status === 200 && Boolean(json?.received),
    response: json ?? text,
    eventType: "invoice.payment_failed",
    note: "Signed test event validates staging webhook signature acceptance and handler path execution.",
  };

  fs.writeFileSync(path.join(base, "logs", "stripe_webhook_signed_probe.json"), JSON.stringify(artifact, null, 2));

  const md = [
    "# Stripe Webhook Signed Probe",
    "",
    `Timestamp: ${artifact.at}`,
    `Status: ${artifact.status}`,
    `OK: ${artifact.ok ? "yes" : "no"}`,
    `Event: ${artifact.eventType}`,
    `Response: ${JSON.stringify(artifact.response)}`,
  ].join("\n");
  fs.writeFileSync(path.join(base, "notes", "stripe_webhook_signed_probe.md"), md);

  console.log(`stripe_webhook_signed_probe: status=${artifact.status} ok=${artifact.ok}`);
  if (!artifact.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`stripe_webhook_signed_probe failed: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
