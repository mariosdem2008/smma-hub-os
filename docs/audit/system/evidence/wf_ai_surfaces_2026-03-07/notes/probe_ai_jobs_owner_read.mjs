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

function loadEnv() {
  const root = process.cwd();
  return {
    ...parseDotEnvFile(path.join(root, "supabase", ".env")),
    ...parseDotEnvFile(path.join(root, ".env")),
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
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, text };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = env.ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
  }

  const runAt = new Date().toISOString();
  const now = Date.now();
  const email = `wf.ai.jobs.owner.${now}@example.com`;
  const password = `Smmahub!${now}`;
  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();

  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const createUser = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF AI Jobs Owner" },
    },
  });
  if (!createUser.res.ok || !createUser.json?.id) {
    throw new Error(`create user failed: ${createUser.res.status} ${createUser.text}`);
  }
  const userId = createUser.json.id;

  await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: { id: agencyId, user_id: userId, name: `WF AI Jobs ${now}` },
  });
  await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: { agency_id: agencyId, user_id: userId, role: "owner", accepted_at: new Date().toISOString() },
  });
  await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: { id: clientId, agency_id: agencyId, name: "WF AI Jobs Client", status: "active" },
  });
  await httpJson(`${supabaseUrl}/rest/v1/ai_jobs`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: {
      agency_id: agencyId,
      client_id: clientId,
      job_type: "seed_strategy",
      payload_json: { source: "probe" },
      status: "pending",
      run_after: new Date().toISOString(),
    },
  });

  const login = await httpJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey },
    body: { email, password },
  });
  if (!login.res.ok || !login.json?.access_token) {
    throw new Error(`login failed: ${login.res.status} ${login.text}`);
  }
  const accessToken = login.json.access_token;

  const readJobs = await httpJson(
    `${supabaseUrl}/rest/v1/ai_jobs?select=id,job_type,status,agency_id,client_id&agency_id=eq.${agencyId}&limit=5`,
    {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const result = {
    runAt,
    agencyId,
    userId,
    readStatus: readJobs.res.status,
    rows: Array.isArray(readJobs.json) ? readJobs.json.length : 0,
    ok: readJobs.res.ok,
    body: readJobs.json,
  };

  const outPath = path.resolve(
    "docs/audit/system/evidence/wf_ai_surfaces_2026-03-07/logs/probe_ai_jobs_owner_read.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!readJobs.res.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
