import fs from "node:fs";
import path from "node:path";

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

async function httpJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function getAdminToken(supabaseUrl, anonKey, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const members = await httpJson(`${supabaseUrl}/rest/v1/agency_members?select=user_id,role&role=eq.admin&limit=1`, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!members.res.ok || !Array.isArray(members.json) || members.json.length === 0) {
    throw new Error("No admin user found");
  }
  const userId = members.json[0].user_id;

  const user = await httpJson(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!user.res.ok || !user.json?.email) throw new Error("Admin user email missing");

  const gen = await httpJson(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: adminHeaders,
    body: { type: "magiclink", email: user.json.email },
  });
  if (!gen.res.ok) throw new Error("Failed to generate link");

  const token = gen.json?.email_otp ?? gen.json?.properties?.email_otp;
  if (!token) throw new Error("Missing magic link token");

  const verify = await httpJson(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anonKey },
    body: { type: "magiclink", email: user.json.email, token: String(token) },
  });
  if (!verify.res.ok || !verify.json?.access_token) throw new Error("Failed to verify magic link");

  return verify.json.access_token;
}

async function main() {
  const env = loadEnvFallback();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase env for probe invocation");
  }

  const accessToken = await getAdminToken(supabaseUrl, anonKey, serviceRoleKey);
  const result = await httpJson(`${supabaseUrl}/functions/v1/stripe-webhook-probe`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: { trigger: "signed_webhook_probe" },
  });

  const artifact = {
    at: new Date().toISOString(),
    status: result.res.status,
    body: result.json,
    ok: result.res.ok && result.json?.ok === true,
  };

  const base = path.resolve("docs/audit/system/evidence/integration_runtime_2026-03-07");
  fs.writeFileSync(path.join(base, "logs", "stripe_webhook_probe_invoke.json"), JSON.stringify(artifact, null, 2));
  fs.writeFileSync(
    path.join(base, "notes", "stripe_webhook_probe_invoke.md"),
    [
      "# Stripe Webhook Probe Invoke",
      "",
      `Timestamp: ${artifact.at}`,
      `Status: ${artifact.status}`,
      `OK: ${artifact.ok ? "yes" : "no"}`,
      `Body: ${JSON.stringify(artifact.body)}`,
    ].join("\n"),
  );

  console.log(`stripe_webhook_probe_invoke: status=${artifact.status} ok=${artifact.ok}`);
  if (!artifact.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`stripe_webhook_probe_invoke failed: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
