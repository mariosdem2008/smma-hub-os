// Full tenant audit runner (Phase 2 gate).
//
// Requires two real tenants and two JWTs (do not commit/store JWTs).
// Produces a sanitized evidence JSON file under tests/security/results/.
//
// Env required:
// - SUPABASE_URL
// - SUPABASE_ANON_KEY
// - TENANT_A_AGENCY_ID, TENANT_A_CLIENT_ID, TENANT_A_JWT
// - TENANT_B_AGENCY_ID, TENANT_B_CLIENT_ID, TENANT_B_JWT

import fs from "node:fs";
import path from "node:path";

function isoDayUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
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
  return { status: res.status, ok: res.ok, json };
}

function redact(obj) {
  // Ensure we do not write JWTs. Only keep structure and small excerpts.
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj.length > 200 ? `${obj.slice(0, 200)}…` : obj;
  if (Array.isArray(obj)) return obj.slice(0, 5).map(redact);
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (String(k).toLowerCase().includes("token") || String(k).toLowerCase().includes("authorization")) continue;
      out[k] = redact(v);
    }
    return out;
  }
  return obj;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const supabaseUrl = mustEnv("SUPABASE_URL").replace(/\/$/, "");
  const anonKey = mustEnv("SUPABASE_ANON_KEY");

  const a = {
    agencyId: mustEnv("TENANT_A_AGENCY_ID"),
    clientId: mustEnv("TENANT_A_CLIENT_ID"),
    jwt: mustEnv("TENANT_A_JWT"),
  };
  const b = {
    agencyId: mustEnv("TENANT_B_AGENCY_ID"),
    clientId: mustEnv("TENANT_B_CLIENT_ID"),
    jwt: mustEnv("TENANT_B_JWT"),
  };

  const headersA = { apikey: anonKey, Authorization: `Bearer ${a.jwt}` };
  const headersB = { apikey: anonKey, Authorization: `Bearer ${b.jwt}` };

  const checks = [];

  // REST cross-tenant reads: expect empty arrays under RLS (0 cross-tenant leaks).
  checks.push({
    name: "user_a_cannot_read_client_b",
    req: { method: "GET", url: "/rest/v1/clients?select=id,agency_id&id=eq.<TENANT_B_CLIENT_ID>" },
    res: redact(await httpJson(`${supabaseUrl}/rest/v1/clients?select=id,agency_id&id=eq.${encodeURIComponent(b.clientId)}`, { headers: headersA })),
  });

  checks.push({
    name: "user_a_cannot_read_ai_documents_b",
    req: { method: "GET", url: "/rest/v1/ai_documents?select=id,agency_id&agency_id=eq.<TENANT_B_AGENCY_ID>" },
    res: redact(await httpJson(`${supabaseUrl}/rest/v1/ai_documents?select=id,agency_id&agency_id=eq.${encodeURIComponent(b.agencyId)}`, { headers: headersA })),
  });

  checks.push({
    name: "user_a_cannot_read_otel_spans_b",
    req: { method: "GET", url: "/rest/v1/ai_otel_spans?select=id,agency_id&agency_id=eq.<TENANT_B_AGENCY_ID>" },
    res: redact(await httpJson(`${supabaseUrl}/rest/v1/ai_otel_spans?select=id,agency_id&agency_id=eq.${encodeURIComponent(b.agencyId)}`, { headers: headersA })),
  });

  // Edge function negative: user A tries to retrieve context for agency B.
  checks.push({
    name: "ai_retrieve_context_denies_cross_tenant",
    req: { method: "POST", url: "/functions/v1/ai-retrieve-context" },
    res: redact(await httpJson(`${supabaseUrl}/functions/v1/ai-retrieve-context`, {
      method: "POST",
      headers: headersA,
      body: { agency_id: b.agencyId, client_id: b.clientId, query: "tenant_a_should_not_access_tenant_b" },
    })),
  });

  // Symmetry spot check (B cannot read A).
  checks.push({
    name: "user_b_cannot_read_ai_documents_a",
    req: { method: "GET", url: "/rest/v1/ai_documents?select=id,agency_id&agency_id=eq.<TENANT_A_AGENCY_ID>" },
    res: redact(await httpJson(`${supabaseUrl}/rest/v1/ai_documents?select=id,agency_id&agency_id=eq.${encodeURIComponent(a.agencyId)}`, { headers: headersB })),
  });

  const day = isoDayUtc();
  const outPath = path.join("tests", "security", "results", `${day}_full_tenant_audit.json`);
  writeJson(outPath, {
    date_utc: day,
    result: "UNKNOWN",
    note:
      "Runner records responses. Mark result PASS only if every cross-tenant read returns empty/403 and no data from the other agency_id is present (0 cross-tenant leaks).",
    tenants: {
      tenant_a: { agency_id: a.agencyId, client_id: a.clientId },
      tenant_b: { agency_id: b.agencyId, client_id: b.clientId },
    },
    checks,
  });

  console.log(`Wrote: ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

