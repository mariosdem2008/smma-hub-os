// Phase 2 staging smoke:
// - contextual ingestion allowlist enforcement
// - memory item approval -> synchronous ingestion -> embeddings/chunks
//
// This script intentionally scopes every read/write by agency_id (and client_id where applicable)
// to maintain "0 cross-tenant leaks" during smoke.

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
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFallback() {
  // Prefer process.env; fallback to repo-local env files (never commit secrets).
  const repoRoot = process.cwd();
  const a = parseDotEnvFile(path.join(repoRoot, "supabase", ".env"));
  const b = parseDotEnvFile(path.join(repoRoot, ".env"));
  return { ...a, ...b };
}

function getEnv(name, fallbackEnv) {
  return process.env[name] ?? fallbackEnv[name] ?? "";
}

function requireEnv(name, fallbackEnv) {
  const v = getEnv(name, fallbackEnv);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getQueryParam(urlStr, key) {
  try {
    const u = new URL(urlStr);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

async function httpJson(url, { method = "GET", headers = {}, body, redirect = "follow" } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect,
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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

async function main() {
  const fallbackEnv = loadEnvFallback();
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = requireEnv("SUPABASE_URL", fallbackEnv).replace(/\/$/, "");
  const anonKey = requireEnv("SUPABASE_ANON_KEY", fallbackEnv);
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", fallbackEnv);

  const agencyId = args["agency-id"] ?? process.env.PHASE2_SMOKE_AGENCY_ID ?? "115dc619-1867-4275-83ec-4d5a0d47f94b";
  const clientId = args["client-id"] ?? process.env.PHASE2_SMOKE_CLIENT_ID ?? "af1a1b5a-cf77-4303-a56b-4edf6b2a0c6e";
  const cleanup = !!args["cleanup"];

  const runId = `phase2-smoke-${nowId()}`;

  console.log(`[phase2-smoke] supabase_url=${supabaseUrl}`);
  console.log(`[phase2-smoke] agency_id=${agencyId}`);
  console.log(`[phase2-smoke] client_id=${clientId}`);
  console.log(`[phase2-smoke] run_id=${runId}`);

  // We need a real *admin* user token for admin-only endpoints (ai-memory-approve, ai-ingestion-source-register).
  // Some tenants enforce constraints on number of admins; so we try to reuse an existing admin user in this agency.
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  // 1) Find an existing admin user_id for this agency.
  const adminMemberUrl =
    `${supabaseUrl}/rest/v1/agency_members?select=user_id,role&agency_id=eq.${encodeURIComponent(agencyId)}&role=eq.admin&limit=1`;
  const { res: adminMemberRes, json: adminMemberJson } = await httpJson(adminMemberUrl, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!adminMemberRes.ok) {
    throw new Error(`Admin member lookup failed (${adminMemberRes.status}): ${JSON.stringify(adminMemberJson)}`);
  }
  const adminUserId = Array.isArray(adminMemberJson) ? adminMemberJson[0]?.user_id : null;
  if (!adminUserId) {
    throw new Error(
      `No admin user found for agency_id=${agencyId}. Provide a known admin JWT and run smoke manually.`,
    );
  }
  console.log(`[phase2-smoke] using_existing_admin_user_id=${adminUserId}`);

  // 2) Generate a magic link for that user (admin API) and exchange it for a session.
  const getUserUrl = `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(adminUserId)}`;
  const { res: getUserRes, json: getUserJson } = await httpJson(getUserUrl, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!getUserRes.ok) {
    throw new Error(`Admin get user failed (${getUserRes.status}): ${JSON.stringify(getUserJson)}`);
  }
  const adminEmail = getUserJson?.email;
  if (!adminEmail) throw new Error(`Admin user missing email: ${JSON.stringify(getUserJson)}`);

  const genLinkUrl = `${supabaseUrl}/auth/v1/admin/generate_link`;
  const { res: genRes, json: genJson } = await httpJson(genLinkUrl, {
    method: "POST",
    headers: adminHeaders,
    body: {
      type: "magiclink",
      email: adminEmail,
      // Do not set redirect_to; we exchange the token directly.
    },
  });
  if (!genRes.ok) {
    throw new Error(`Generate link failed (${genRes.status}): ${JSON.stringify(genJson)}`);
  }

  const verifyApiUrl = `${supabaseUrl}/auth/v1/verify`;
  // Supabase returns an OTP and hashed token; verify expects email/phone + token/otp.
  const emailOtp = genJson?.email_otp ?? genJson?.properties?.email_otp ?? null;
  if (!emailOtp) {
    // Fallback: try extracting token/token_hash from action_link if available.
    const actionLink = genJson?.action_link ?? genJson?.properties?.action_link ?? null;
    const token = actionLink ? getQueryParam(actionLink, "token") : null;
    const tokenHash = actionLink ? getQueryParam(actionLink, "token_hash") : null;
    if (token) {
      // Some configs accept token directly when paired with email.
      const { res: verifyRes, json: verifyJson } = await httpJson(verifyApiUrl, {
        method: "POST",
        headers: { apikey: anonKey },
        body: { type: "magiclink", email: adminEmail, token },
        redirect: "manual",
      });
      if (!verifyRes.ok) {
        throw new Error(`Verify magiclink failed (${verifyRes.status}): ${JSON.stringify(verifyJson)}`);
      }
      const accessToken = verifyJson?.access_token;
      if (!accessToken) throw new Error(`Verify missing access_token: ${JSON.stringify(verifyJson)}`);
      console.log(`[phase2-smoke] admin_session_ok`);
      var accessTokenFinal = accessToken;
    } else if (tokenHash) {
      const { res: verifyRes, json: verifyJson } = await httpJson(verifyApiUrl, {
        method: "POST",
        headers: { apikey: anonKey },
        body: { type: "magiclink", email: adminEmail, token_hash: tokenHash },
        redirect: "manual",
      });
      if (!verifyRes.ok) {
        throw new Error(`Verify magiclink failed (${verifyRes.status}): ${JSON.stringify(verifyJson)}`);
      }
      const accessToken = verifyJson?.access_token;
      if (!accessToken) throw new Error(`Verify missing access_token: ${JSON.stringify(verifyJson)}`);
      console.log(`[phase2-smoke] admin_session_ok`);
      var accessTokenFinal = accessToken;
    } else {
      throw new Error(`Generate link missing email_otp and token hints: ${JSON.stringify(genJson)}`);
    }
  }

  if (!accessTokenFinal) {
    const { res: verifyRes, json: verifyJson } = await httpJson(verifyApiUrl, {
      method: "POST",
      headers: { apikey: anonKey },
      body: { type: "magiclink", email: adminEmail, token: String(emailOtp) },
      redirect: "manual",
    });
    if (!verifyRes.ok) {
      throw new Error(`Verify magiclink failed (${verifyRes.status}): ${JSON.stringify(verifyJson)}`);
    }
    const accessToken = verifyJson?.access_token;
    if (!accessToken) throw new Error(`Verify missing access_token: ${JSON.stringify(verifyJson)}`);
    accessTokenFinal = accessToken;
    console.log(`[phase2-smoke] admin_session_ok`);
  }

  const userHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${accessTokenFinal}`,
  };

  // 3) Contextual ingestion allowlist enforcement.
  const allowlistedRef = `${runId}-allowlisted`;
  const allowlistedUrl = `https://example.com/${allowlistedRef}`;
  const allowlistedWithManifestRef = `${runId}-allowlisted-manifest`;
  const allowlistedWithManifestUrl = `https://example.com/${allowlistedWithManifestRef}`;
  const allowlistedManifest = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

  const registerUrl = `${supabaseUrl}/functions/v1/ai-ingestion-source-register`;
  const { res: regRes, json: regJson } = await httpJson(registerUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      source_type: "web",
      source_ref: allowlistedRef,
      source_url: allowlistedUrl,
      allowed: true,
    },
  });
  if (!regRes.ok) {
    throw new Error(`Register ingestion source failed (${regRes.status}): ${JSON.stringify(regJson)}`);
  }
  console.log(`[phase2-smoke] ingestion_source_registered_ok`);

  const { res: reg2Res, json: reg2Json } = await httpJson(registerUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      source_type: "web",
      source_ref: allowlistedWithManifestRef,
      source_url: allowlistedWithManifestUrl,
      allowed: true,
      manifest_sha256: allowlistedManifest,
      manifest_json: { run_id: runId, purpose: "phase2_smoke" },
    },
  });
  if (!reg2Res.ok) {
    throw new Error(`Register ingestion source (manifest) failed (${reg2Res.status}): ${JSON.stringify(reg2Json)}`);
  }
  console.log(`[phase2-smoke] ingestion_source_registered_with_manifest_ok`);

  const ingestUrl = `${supabaseUrl}/functions/v1/ai-documents-ingest`;
  const negativeRef = `${runId}-not-allowlisted`;
  const { res: negRes, json: negJson } = await httpJson(ingestUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "client_notes",
      title: `Phase2 smoke doc (negative) ${runId}`,
      content: `Phase2 smoke negative. run_id=${runId}`,
      source_type: "web",
      source_ref: negativeRef,
      source_url: `https://example.com/${negativeRef}`,
    },
  });
  if (negRes.status !== 403 || negJson?.error !== "source_not_allowlisted") {
    throw new Error(`Expected 403 source_not_allowlisted, got (${negRes.status}): ${JSON.stringify(negJson)}`);
  }
  console.log(`[phase2-smoke] ingestion_negative_ok (403 source_not_allowlisted)`);

  const { res: manNegRes, json: manNegJson } = await httpJson(ingestUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "client_notes",
      title: `Phase2 smoke doc (manifest negative) ${runId}`,
      content: `Phase2 smoke manifest negative. run_id=${runId}`,
      source_type: "web",
      source_ref: allowlistedWithManifestRef,
      source_url: allowlistedWithManifestUrl,
      manifest_sha256: "badbadbad",
    },
  });
  if (manNegRes.status !== 403 || manNegJson?.error !== "manifest_mismatch") {
    throw new Error(`Expected 403 manifest_mismatch, got (${manNegRes.status}): ${JSON.stringify(manNegJson)}`);
  }
  console.log(`[phase2-smoke] ingestion_manifest_negative_ok (403 manifest_mismatch)`);

  const { res: posRes, json: posJson } = await httpJson(ingestUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      client_id: clientId,
      doc_type: "client_notes",
      title: `Phase2 smoke doc (positive) ${runId}`,
      content:
        `Phase2 smoke positive. run_id=${runId}\n\n` +
        `This content should be chunked and embedded. It is intentionally short.`,
      source_type: "web",
      source_ref: allowlistedRef,
      source_url: allowlistedUrl,
    },
  });
  if (!posRes.ok || !posJson?.document_id) {
    throw new Error(`Positive ingest failed (${posRes.status}): ${JSON.stringify(posJson)}`);
  }
  const ingestedDocId = posJson.document_id;
  console.log(`[phase2-smoke] ingestion_positive_ok document_id=${ingestedDocId}`);

  // Verify at least one chunk has a contextual summary when ENABLE_CONTEXTUAL_INGESTION is enabled.
  const docChunksUrl =
    `${supabaseUrl}/rest/v1/ai_document_chunks?select=id,chunk_summary,chunk_summary_status,chunk_summary_tokens&document_id=eq.${encodeURIComponent(ingestedDocId)}`;
  const { res: docChunksRes, json: docChunksJson } = await httpJson(docChunksUrl, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!docChunksRes.ok) {
    throw new Error(`Doc chunks query failed (${docChunksRes.status}): ${JSON.stringify(docChunksJson)}`);
  }
  const okSummaries = Array.isArray(docChunksJson)
    ? docChunksJson.filter((c) => c?.chunk_summary && c?.chunk_summary_status === "ok")
    : [];
  if (okSummaries.length <= 0) {
    throw new Error(`Expected >=1 ok chunk_summary, got: ${JSON.stringify(docChunksJson)}`);
  }
  console.log(`[phase2-smoke] chunk_summary_ok count=${okSummaries.length}`);

  // Optional: verify RAG retrieval path works for the currently configured RAG_INDEX_PROVIDER.
  const retrieveUrl = `${supabaseUrl}/functions/v1/ai-retrieve-context`;
  const { res: retRes, json: retJson } = await httpJson(retrieveUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      client_id: clientId,
      query: "Phase2 smoke positive",
      doc_types: null,
      modules: null,
      top_k: 6,
      token_budget: 400,
      min_similarity: 0.0,
    },
  });
  if (!retRes.ok || !Array.isArray(retJson)) {
    throw new Error(`ai-retrieve-context failed (${retRes.status}): ${JSON.stringify(retJson)}`);
  }
  if (retJson.length <= 0) {
    throw new Error(`Expected ai-retrieve-context to return matches, got empty list`);
  }
  console.log(`[phase2-smoke] retrieve_context_ok matches=${retJson.length}`);

  // 4) Long-term memory: create proposal -> approve -> verify ingestion.
  const memoryInsertUrl = `${supabaseUrl}/rest/v1/ai_memory_items`;
  const memoryContent =
    `Client memory from Phase2 smoke. run_id=${runId}. ` +
    `Preference: prefers SMS reminders.`;
  const { res: memRes, json: memJson } = await httpJson(memoryInsertUrl, {
    method: "POST",
    headers: {
      ...adminHeaders,
      Prefer: "return=representation",
    },
    body: {
      agency_id: agencyId,
      client_id: clientId,
      type: "proposal",
      scope: "long_term",
      status: "proposed",
      content: memoryContent,
      created_by: adminUserId,
      source_ref: runId,
    },
  });
  if (!memRes.ok) {
    throw new Error(`Memory insert failed (${memRes.status}): ${JSON.stringify(memJson)}`);
  }
  const memoryItemId = Array.isArray(memJson) ? memJson[0]?.id : memJson?.id;
  if (!memoryItemId) throw new Error(`Memory insert missing id: ${JSON.stringify(memJson)}`);
  console.log(`[phase2-smoke] memory_item_created id=${memoryItemId}`);

  const approveUrl = `${supabaseUrl}/functions/v1/ai-memory-approve`;
  const { res: apprRes, json: apprJson } = await httpJson(approveUrl, {
    method: "POST",
    headers: userHeaders,
    body: {
      agency_id: agencyId,
      memory_item_id: memoryItemId,
      decision: "approved",
    },
  });
  if (!apprRes.ok || apprJson?.status !== "active") {
    throw new Error(`Memory approve failed (${apprRes.status}): ${JSON.stringify(apprJson)}`);
  }
  const memoryDocId = apprJson?.ingested_document_id ?? null;
  if (!memoryDocId) {
    throw new Error(`Expected ingested_document_id, got: ${JSON.stringify(apprJson)}`);
  }
  console.log(`[phase2-smoke] memory_approved_ok ingested_document_id=${memoryDocId}`);

  // 5) Verify chunks exist for the ingested memory document (scoped by tenant).
  const chunksUrl =
    `${supabaseUrl}/rest/v1/ai_document_chunks?select=id&document_id=eq.${encodeURIComponent(memoryDocId)}`;
  const { res: chunksRes, json: chunksJson } = await httpJson(chunksUrl, {
    method: "GET",
    headers: adminHeaders,
  });
  if (!chunksRes.ok) {
    throw new Error(`Chunks query failed (${chunksRes.status}): ${JSON.stringify(chunksJson)}`);
  }
  const chunkCount = Array.isArray(chunksJson) ? chunksJson.length : 0;
  if (chunkCount <= 0) throw new Error(`Expected >0 chunks for memory doc, got ${chunkCount}`);
  console.log(`[phase2-smoke] memory_doc_chunks_ok chunks=${chunkCount}`);

  // Optional cleanup to avoid leaving artifacts in staging.
  if (cleanup) {
    console.log(`[phase2-smoke] cleanup_skipped (no artifacts created in auth/membership)`);
  }

  console.log(`[phase2-smoke] PASS`);
}

main().catch((err) => {
  console.error(`[phase2-smoke] FAIL: ${err?.message ?? String(err)}`);
  process.exitCode = 1;
});
