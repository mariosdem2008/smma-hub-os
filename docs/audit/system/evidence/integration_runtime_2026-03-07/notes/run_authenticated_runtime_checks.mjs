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
  const a = parseDotEnvFile(path.join(repoRoot, "supabase", ".env"));
  const b = parseDotEnvFile(path.join(repoRoot, ".env"));
  return { ...a, ...b };
}

function env(name, fallback) {
  return process.env[name] ?? fallback[name] ?? "";
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
    json = null;
  }
  return { res, text, json };
}

async function getAdminSession(supabaseUrl, anonKey, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const memberUrl = `${supabaseUrl}/rest/v1/agency_members?select=agency_id,user_id,role&role=eq.admin&limit=10`;
  const { res: memberRes, json: memberJson } = await httpJson(memberUrl, { method: "GET", headers: adminHeaders });
  if (!memberRes.ok || !Array.isArray(memberJson) || memberJson.length === 0) {
    throw new Error(`No admin membership rows: ${memberRes.status}`);
  }

  for (const m of memberJson) {
    const clientUrl = `${supabaseUrl}/rest/v1/clients?select=id&agency_id=eq.${encodeURIComponent(m.agency_id)}&limit=1`;
    const { res: cRes, json: cJson } = await httpJson(clientUrl, { method: "GET", headers: adminHeaders });
    if (!cRes.ok || !Array.isArray(cJson) || cJson.length === 0) continue;

    const userUrl = `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(m.user_id)}`;
    const { res: uRes, json: uJson } = await httpJson(userUrl, { method: "GET", headers: adminHeaders });
    if (!uRes.ok || !uJson?.email) continue;

    const { res: gRes, json: gJson } = await httpJson(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: { type: "magiclink", email: uJson.email },
    });
    if (!gRes.ok) continue;

    const token = gJson?.email_otp ?? gJson?.properties?.email_otp;
    if (!token) continue;

    const { res: vRes, json: vJson } = await httpJson(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: anonKey },
      body: { type: "magiclink", email: uJson.email, token: String(token) },
    });
    if (!vRes.ok || !vJson?.access_token) continue;

    return {
      agencyId: m.agency_id,
      clientId: cJson[0].id,
      userId: m.user_id,
      accessToken: vJson.access_token,
    };
  }

  throw new Error("Could not generate authenticated admin session for any agency with a client");
}

async function main() {
  const fallback = loadEnvFallback();
  const supabaseUrl = env("SUPABASE_URL", fallback).replace(/\/$/, "");
  const anonKey = env("SUPABASE_ANON_KEY", fallback);
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY", fallback);

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing required env vars for authenticated checks");
  }

  const base = path.resolve("docs/audit/system/evidence/integration_runtime_2026-03-07");
  const startedAt = new Date().toISOString();

  const session = await getAdminSession(supabaseUrl, anonKey, serviceRoleKey);
  const authHeaders = { apikey: anonKey, Authorization: `Bearer ${session.accessToken}` };

  const checks = [];

  const oauth = await httpJson(`${supabaseUrl}/functions/v1/social-oauth`, {
    method: "POST",
    headers: authHeaders,
    body: { platform: "instagram", clientId: session.clientId, source: "agency" },
  });
  checks.push({
    id: "social_oauth_authenticated",
    status: oauth.res.status,
    ok: oauth.res.status === 200 && typeof oauth.json?.url === "string" && oauth.json.url.includes("facebook.com"),
    bodyPreview: oauth.json ?? oauth.text.slice(0, 220),
  });

  const checkout = await httpJson(`${supabaseUrl}/functions/v1/create-checkout`, {
    method: "POST",
    headers: authHeaders,
    body: { planType: "starter", billingInterval: "monthly" },
  });
  checks.push({
    id: "create_checkout_authenticated",
    status: checkout.res.status,
    ok: checkout.res.status === 200 && (checkout.json?.url || checkout.json?.sessionId),
    bodyPreview: checkout.json ?? checkout.text.slice(0, 220),
  });

  const portal = await httpJson(`${supabaseUrl}/functions/v1/customer-portal`, {
    method: "POST",
    headers: authHeaders,
    body: {},
  });
  checks.push({
    id: "customer_portal_authenticated",
    status: portal.res.status,
    ok: portal.res.status === 200 && typeof portal.json?.url === "string",
    bodyPreview: portal.json ?? portal.text.slice(0, 220),
  });

  const endedAt = new Date().toISOString();
  const passCount = checks.filter((c) => c.ok).length;

  const artifact = {
    startedAt,
    endedAt,
    supabaseHost: new URL(supabaseUrl).host,
    agencyId: session.agencyId,
    clientId: session.clientId,
    userId: session.userId,
    passCount,
    totalCount: checks.length,
    checks,
  };

  fs.writeFileSync(path.join(base, "logs", "authenticated_runtime_checks.json"), JSON.stringify(artifact, null, 2));

  const md = [
    "# Authenticated Integration Runtime Checks",
    "",
    `Started: ${startedAt}`,
    `Ended: ${endedAt}`,
    `Supabase host: ${artifact.supabaseHost}`,
    `Agency ID: ${artifact.agencyId}`,
    `Client ID: ${artifact.clientId}`,
    `Pass: ${passCount}/${checks.length}`,
    "",
    "| Check | Status | OK |",
    "|---|---:|---|",
    ...checks.map((c) => `| ${c.id} | ${c.status} | ${c.ok ? "yes" : "no"} |`),
  ].join("\n");
  fs.writeFileSync(path.join(base, "notes", "authenticated_runtime_checks_summary.md"), md);

  console.log(`authenticated_runtime_checks: ${passCount}/${checks.length} passed`);
}

main().catch((err) => {
  console.error(`authenticated_runtime_checks failed: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
