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

async function getAdminSession(supabaseUrl, anonKey, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const members = await httpJson(`${supabaseUrl}/rest/v1/agency_members?select=agency_id,user_id,role&role=eq.admin&limit=20`, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!members.res.ok || !Array.isArray(members.json) || members.json.length === 0) {
    throw new Error("No admin memberships found");
  }

  const ensuredClientIdByAgency = new Map();
  for (const member of members.json) {
    let clients = await httpJson(
      `${supabaseUrl}/rest/v1/clients?select=id&agency_id=eq.${encodeURIComponent(member.agency_id)}&limit=1`,
      { method: "GET", headers: adminHeaders },
    );
    if (!clients.res.ok) continue;
    if (!Array.isArray(clients.json)) continue;

    if (clients.json.length === 0) {
      // Ensure there is at least one client in this agency for integration probes.
      const cachedClientId = ensuredClientIdByAgency.get(member.agency_id);
      if (cachedClientId) {
        clients = { ...clients, json: [{ id: cachedClientId }] };
      } else {
        const insertedClientId = crypto.randomUUID();
        const createClient = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
          method: "POST",
          headers: {
            ...adminHeaders,
            Prefer: "return=representation",
          },
          body: {
            id: insertedClientId,
            agency_id: member.agency_id,
            name: `WF Integrations Probe ${new Date().toISOString()}`,
            status: "active",
          },
        });
        if (!createClient.res.ok) continue;
        ensuredClientIdByAgency.set(member.agency_id, insertedClientId);
        clients = { ...clients, json: [{ id: insertedClientId }] };
      }
    }

    const user = await httpJson(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(member.user_id)}`, {
      method: "GET",
      headers: adminHeaders,
    });
    if (!user.res.ok || !user.json?.email) continue;

    const magic = await httpJson(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: adminHeaders,
      body: { type: "magiclink", email: user.json.email },
    });
    if (!magic.res.ok) continue;

    const token = magic.json?.email_otp ?? magic.json?.properties?.email_otp;
    if (!token) continue;

    const verify = await httpJson(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: anonKey },
      body: { type: "magiclink", email: user.json.email, token: String(token) },
    });
    if (!verify.res.ok || !verify.json?.access_token) continue;

    return {
      agencyId: member.agency_id,
      clientId: clients.json[0].id,
      userId: member.user_id,
      accessToken: verify.json.access_token,
    };
  }

  throw new Error("Could not create admin session for agency with client");
}

async function main() {
  const env = loadEnvFallback();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing required Supabase env vars");
  }

  const startedAt = new Date().toISOString();
  const session = await getAdminSession(supabaseUrl, anonKey, serviceRoleKey);
  const authHeaders = { apikey: anonKey, Authorization: `Bearer ${session.accessToken}` };

  const checks = [];

  const oauthConnect = await httpJson(`${supabaseUrl}/functions/v1/social-oauth`, {
    method: "POST",
    headers: authHeaders,
    body: { action: "connect", platform: "instagram", clientId: session.clientId, source: "agency" },
  });
  checks.push({
    id: "oauth_connect_url",
    status: oauthConnect.res.status,
    ok: oauthConnect.res.status === 200 && typeof oauthConnect.json?.url === "string",
    bodyPreview: oauthConnect.json,
  });

  const oauthReconnect = await httpJson(`${supabaseUrl}/functions/v1/social-oauth`, {
    method: "POST",
    headers: authHeaders,
    body: {
      action: "reconnect",
      platform: "instagram",
      clientId: session.clientId,
      connectionId: "00000000-0000-0000-0000-000000000000",
      source: "agency",
    },
  });
  checks.push({
    id: "oauth_reconnect_url",
    status: oauthReconnect.res.status,
    ok: oauthReconnect.res.status === 200 && typeof oauthReconnect.json?.url === "string",
    bodyPreview: oauthReconnect.json,
  });

  const integrationProbe = await httpJson(`${supabaseUrl}/functions/v1/integration-runtime-probe`, {
    method: "POST",
    headers: authHeaders,
    body: { source: "wf-integrations-e2e" },
  });
  checks.push({
    id: "cron_email_runtime_probe",
    status: integrationProbe.res.status,
    ok: integrationProbe.res.status === 200 && integrationProbe.json?.ok === true,
    bodyPreview: integrationProbe.json,
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

  const base = path.resolve("docs/audit/system/evidence/integration_runtime_2026-03-07");
  fs.writeFileSync(path.join(base, "logs", "wf_integrations_e2e_checks.json"), JSON.stringify(artifact, null, 2));

  const md = [
    "# WF Integrations E2E Runtime Checks",
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
  fs.writeFileSync(path.join(base, "notes", "wf_integrations_e2e_checks_summary.md"), md);

  console.log(`wf_integrations_e2e_checks: ${passCount}/${checks.length} passed`);
  if (passCount !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_integrations_e2e_checks failed: ${error?.message ?? String(error)}`);
  process.exitCode = 1;
});
