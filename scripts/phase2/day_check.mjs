// Phase 2 daily checklist runner (Day N).
//
// Produces evidence artifacts without storing JWTs.
// - Load test (p95) via scripts/perf/http_load_test.ts
// - Eval harness stub + replay harness stub (dataset integrity)
// - Tenant safety spot check (mismatched agency_id denials)
// - OTel spot check (spans exist for tenant)
//
// NOTE: This cannot "complete" 7-day checklist in one run; it produces *today's* artifacts.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFallback() {
  const root = process.cwd();
  return {
    ...parseDotEnvFile(path.join(root, "supabase", ".env")),
    ...parseDotEnvFile(path.join(root, ".env")),
  };
}

function getEnv(name, fallbackEnv) {
  return process.env[name] ?? fallbackEnv[name] ?? "";
}

function requireEnv(name, fallbackEnv) {
  const v = getEnv(name, fallbackEnv);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function isoDayUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function httpJson(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

function getQueryParam(urlStr, key) {
  try {
    const u = new URL(urlStr);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

async function getAdminAccessToken(opts) {
  const { supabaseUrl, anonKey, serviceRoleKey, agencyId } = opts;

  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const adminMemberUrl =
    `${supabaseUrl}/rest/v1/agency_members?select=user_id,role&agency_id=eq.${encodeURIComponent(agencyId)}&role=eq.admin&limit=1`;
  const { res: memberRes, json: memberJson } = await httpJson(adminMemberUrl, { headers: adminHeaders });
  if (!memberRes.ok) throw new Error(`admin member lookup failed (${memberRes.status})`);

  const adminUserId = Array.isArray(memberJson) ? memberJson[0]?.user_id : null;
  if (!adminUserId) throw new Error(`no admin user found for agency_id=${agencyId}`);

  const getUserUrl = `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(adminUserId)}`;
  const { res: userRes, json: userJson } = await httpJson(getUserUrl, { headers: adminHeaders });
  if (!userRes.ok) throw new Error(`admin get user failed (${userRes.status})`);

  const email = userJson?.email;
  if (!email) throw new Error(`admin user missing email`);

  const genLinkUrl = `${supabaseUrl}/auth/v1/admin/generate_link`;
  const { res: genRes, json: genJson } = await httpJson(genLinkUrl, {
    method: "POST",
    headers: adminHeaders,
    body: { type: "magiclink", email },
  });
  if (!genRes.ok) throw new Error(`generate_link failed (${genRes.status})`);

  const emailOtp = genJson?.email_otp ?? genJson?.properties?.email_otp ?? null;
  if (!emailOtp) {
    const actionLink = genJson?.action_link ?? genJson?.properties?.action_link ?? null;
    const token = actionLink ? getQueryParam(actionLink, "token") : null;
    if (!token) throw new Error(`generate_link missing email_otp/token`);
    const verifyUrl = `${supabaseUrl}/auth/v1/verify`;
    const { res: verifyRes, json: verifyJson } = await httpJson(verifyUrl, {
      method: "POST",
      headers: { apikey: anonKey },
      body: { type: "magiclink", email, token },
    });
    if (!verifyRes.ok) throw new Error(`verify failed (${verifyRes.status})`);
    return verifyJson?.access_token ?? null;
  }

  const verifyUrl = `${supabaseUrl}/auth/v1/verify`;
  const { res: verifyRes, json: verifyJson } = await httpJson(verifyUrl, {
    method: "POST",
    headers: { apikey: anonKey },
    body: { type: "magiclink", email, token: String(emailOtp) },
  });
  if (!verifyRes.ok) throw new Error(`verify failed (${verifyRes.status})`);
  return verifyJson?.access_token ?? null;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function runNodeTs(scriptPath, env, timeoutMs = 10 * 60 * 1000) {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", scriptPath],
    {
      env: { ...process.env, ...env },
      encoding: "utf8",
      timeout: timeoutMs,
    },
  );
  return result;
}

async function main() {
  const fallbackEnv = loadEnvFallback();
  const supabaseUrl = requireEnv("SUPABASE_URL", fallbackEnv).replace(/\/$/, "");
  const anonKey = requireEnv("SUPABASE_ANON_KEY", fallbackEnv);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", fallbackEnv);

  const agencyId = process.env.PHASE2_SMOKE_AGENCY_ID ?? "115dc619-1867-4275-83ec-4d5a0d47f94b";
  const clientId = process.env.PHASE2_SMOKE_CLIENT_ID ?? "af1a1b5a-cf77-4303-a56b-4edf6b2a0c6e";
  const day = isoDayUtc();

  const accessToken = await getAdminAccessToken({ supabaseUrl, anonKey, serviceRoleKey, agencyId });
  if (!accessToken) throw new Error("failed to obtain admin access token");

  const authHeaders = JSON.stringify({
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  });

  // 1) Load test (p95)
  const endpoint = "ai-retrieve-context";
  const loadTest = runNodeTs(
    path.join("scripts", "perf", "http_load_test.ts"),
    {
      LOADTEST_URL: `${supabaseUrl}/functions/v1/${endpoint}`,
      LOADTEST_METHOD: "POST",
      LOADTEST_CONCURRENCY: process.env.LOADTEST_CONCURRENCY ?? "10",
      LOADTEST_REQUESTS: process.env.LOADTEST_REQUESTS ?? "200",
      LOADTEST_TIMEOUT_MS: process.env.LOADTEST_TIMEOUT_MS ?? "15000",
      LOADTEST_WARMUP_REQUESTS: process.env.LOADTEST_WARMUP_REQUESTS ?? "25",
      LOADTEST_EXPECT_P95_MS: process.env.LOADTEST_EXPECT_P95_MS ?? "2500",
      LOADTEST_EXPECT_SUCCESS_RATE: process.env.LOADTEST_EXPECT_SUCCESS_RATE ?? "0.95",
      LOADTEST_HEADERS_JSON: authHeaders,
      LOADTEST_BODY_JSON: JSON.stringify({
        agency_id: agencyId,
        client_id: clientId,
        query: "phase2 daily check",
        doc_types: null,
        modules: null,
        top_k: 6,
        token_budget: 400,
        min_similarity: 0.0,
      }),
    },
  );

  const perfOut = loadTest.stdout.trim();
  const perfJson = perfOut ? JSON.parse(perfOut) : { error: "missing_output" };
  const perfPath = path.join("tests", "perf", "results", `${day}_${endpoint}_p95.json`);
  writeJson(perfPath, perfJson);

  // 2) Eval harness stub + replay harness stub
  const evalRun = runNodeTs(path.join("scripts", "evals", "run_evals.ts"), { AI_EVALS_ENABLED: "true" }, 2 * 60 * 1000);
  const replayRun = runNodeTs(path.join("scripts", "evals", "replay_executor.ts"), { AI_EVALS_ENABLED: "true" }, 2 * 60 * 1000);
  const evalPath = path.join("tests", "evals", "results", `${day}_eval_harness.json`);
  writeJson(evalPath, {
    date_utc: day,
    run_evals: { exit_code: evalRun.status ?? 0, stdout: evalRun.stdout.trim(), stderr: evalRun.stderr.trim() },
    replay_executor: { exit_code: replayRun.status ?? 0, stdout: replayRun.stdout.trim(), stderr: replayRun.stderr.trim() },
  });

  // 3) Tenant safety spot check: mismatched agency_id must deny (0 cross-tenant leaks).
  const wrongAgencyId = "00000000-0000-0000-0000-000000000000";
  const spotChecks = [];
  for (const fn of ["ai-documents-ingest", "ai-retrieve-context", "ai-memory-approve"]) {
    const url = `${supabaseUrl}/functions/v1/${fn}`;
    const body =
      fn === "ai-documents-ingest"
        ? {
            agency_id: wrongAgencyId,
            client_id: clientId,
            doc_type: "client_notes",
            title: "tenant-spotcheck",
            content: "tenant-spotcheck",
            source_type: "web",
            source_ref: `tenant-spotcheck-${day}`,
            source_url: "https://example.com/tenant-spotcheck",
          }
        : fn === "ai-retrieve-context"
          ? { agency_id: wrongAgencyId, client_id: clientId, query: "tenant-spotcheck", top_k: 3, token_budget: 200 }
          : { agency_id: wrongAgencyId, memory_item_id: "00000000-0000-0000-0000-000000000000", decision: "approved" };

    const { res, json } = await httpJson(url, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      body,
    });
    spotChecks.push({ endpoint: fn, status: res.status, body: json });
  }

  const secPath = path.join("tests", "security", "results", `${day}_tenant_spotcheck.json`);
  writeJson(secPath, {
    date_utc: day,
    tenant_scope: { agency_id: agencyId, client_id: clientId },
    note: "This is a spot check (denials for mismatched agency_id). Full audit still requires two real tenants/users.",
    checks: spotChecks,
  });

  // 4) OTel spot check: spans exist for this agency_id in last ~24h (service_role read).
  const spansUrl =
    `${supabaseUrl}/rest/v1/ai_otel_spans?select=id,stage,created_at,attributes&agency_id=eq.${encodeURIComponent(agencyId)}&order=created_at.desc&limit=20`;
  const { res: spansRes, json: spansJson } = await httpJson(spansUrl, {
    method: "GET",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const otelPath = path.join("tests", "perf", "results", `${day}_otel_spotcheck.json`);
  writeJson(otelPath, {
    date_utc: day,
    ok: spansRes.ok,
    status: spansRes.status,
    recent_spans_count: Array.isArray(spansJson) ? spansJson.length : 0,
    sample: Array.isArray(spansJson)
      ? spansJson.slice(0, 5).map((s) => ({
          id: s?.id ?? null,
          stage: s?.stage ?? null,
          created_at: s?.created_at ?? null,
          http_status: s?.attributes?.http_status ?? null,
        }))
      : spansJson,
  });

  console.log(`Wrote: ${perfPath}`);
  console.log(`Wrote: ${evalPath}`);
  console.log(`Wrote: ${secPath}`);
  console.log(`Wrote: ${otelPath}`);

  // Gate: do not claim success if perf/evals failed.
  if ((loadTest.status ?? 0) !== 0 || (evalRun.status ?? 0) !== 0 || (replayRun.status ?? 0) !== 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
