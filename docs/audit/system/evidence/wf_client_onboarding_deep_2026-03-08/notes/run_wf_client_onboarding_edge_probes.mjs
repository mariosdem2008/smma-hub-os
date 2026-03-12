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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
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
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
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

async function provision(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const stamp = Date.now();
  const email = `wf.client.onboarding.edge.${stamp}@example.com`;
  const password = `Smmahub!${stamp}`;
  const userId = crypto.randomUUID();
  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: { id: userId, email, password, email_confirm: true },
  });
  if (!userCreate.res.ok) throw new Error(`create user failed ${userCreate.res.status}: ${JSON.stringify(userCreate.json)}`);

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Client Onboarding Edge Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-client-onboarding-edge.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`insert agency failed ${agencyInsert.res.status}: ${JSON.stringify(agencyInsert.json)}`);

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: { agency_id: agencyId, user_id: userId, role: "owner", accepted_at: new Date().toISOString() },
  });
  if (!memberInsert.res.ok) throw new Error(`insert member failed ${memberInsert.res.status}: ${JSON.stringify(memberInsert.json)}`);

  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: `WF Edge Client ${stamp}`,
      company: `WF Edge Company ${stamp}`,
      email: `wf-edge-client-${stamp}@example.com`,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  if (!clientInsert.res.ok) throw new Error(`insert client failed ${clientInsert.res.status}: ${JSON.stringify(clientInsert.json)}`);

  const login = await httpJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: serviceRoleKey },
    body: { email, password },
  });
  if (!login.res.ok || !login.json?.access_token) throw new Error(`login failed ${login.res.status}: ${JSON.stringify(login.json)}`);

  return { agencyId, clientId, accessToken: login.json.access_token, email };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  const runAt = new Date().toISOString();

  const persona = await provision(supabaseUrl, serviceRoleKey);
  const fnUrl = `${supabaseUrl}/functions/v1/ai-onboarding`;
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${persona.accessToken}` };

  const messages = [
    { role: "assistant", content: "Tell me about your ideal customer first: niche, budget, and primary business goal." },
  ];

  const cases = [
    {
      id: "edge:direct_answer_maps_updates",
      user: "We help local gym owners with 1500 EUR monthly budget and goal is more qualified leads.",
      assert: (json) =>
        json?.intent === "direct_answer" &&
        json?.status !== "error" &&
        typeof json?.assistant_message === "string" &&
        json.assistant_message.length > 10,
    },
    {
      id: "edge:vague_answer_clarifies",
      user: "not sure",
      assert: (json) =>
        json?.intent === "vague_answer" &&
        (json?.status === "calibration_needed" || Number(json?.confidence) < 0.6),
    },
    {
      id: "edge:question_intent_helpful",
      user: "can you suggest one for me?",
      assert: (json) =>
        (json?.intent === "question" || json?.intent === "help_request") &&
        typeof json?.assistant_message === "string" &&
        /next|draft|suggest|help/i.test(json.assistant_message),
    },
    {
      id: "edge:offtopic_redirected",
      user: "what is the weather tomorrow?",
      assert: (json) => json?.intent === "off_topic",
    },
  ];

  const results = [];
  const latencies = [];
  for (const c of cases) {
    const body = {
      version: "v2",
      agency_id: persona.agencyId,
      client_id: persona.clientId,
      client_turn_id: crypto.randomUUID(),
      messages: [...messages, { role: "user", content: c.user }],
      current_state_version: null,
      ui_context: { locale: "en-US", timezone: "UTC" },
      // Backward-compatible fields.
      scope: "client",
      user_message: c.user,
      selected_suggestion: c.user,
      tap_to_send: false,
    };

    const started = Date.now();
    const { res, json } = await httpJson(fnUrl, { method: "POST", headers, body });
    const latencyMs = Date.now() - started;
    latencies.push(latencyMs);

    const ok = res.ok && c.assert(json);
    const updateKeys = json && typeof json === "object" && json.updates && typeof json.updates === "object"
      ? Object.keys(json.updates)
      : [];
    results.push({
      id: c.id,
      ok,
      status: res.status,
      latency_ms: latencyMs,
      intent: json?.intent ?? null,
      response_status: json?.status ?? null,
      confidence: typeof json?.confidence === "number" ? json.confidence : null,
      update_keys: updateKeys,
      assistant_preview: typeof json?.assistant_message === "string" ? json.assistant_message.slice(0, 140) : null,
    });

    if (res.ok && typeof json?.assistant_message === "string") {
      messages.push({ role: "user", content: c.user });
      messages.push({ role: "assistant", content: json.assistant_message });
    }
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))] : null;
  const passCount = results.filter((r) => r.ok).length;
  const summary = {
    runAt,
    persona: { email: persona.email, agencyId: persona.agencyId, clientId: persona.clientId },
    passCount,
    total: results.length,
    latency: {
      sample_count: latencies.length,
      p50_ms: sorted.length ? sorted[Math.floor(0.5 * sorted.length)] : null,
      p95_ms: p95,
    },
    results,
  };

  const jsonPath = path.join(logsRoot, "wf_client_onboarding_edge_probes_summary.json");
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    "# WF Client Onboarding Edge Probes Summary",
    "",
    `Run at: ${runAt}`,
    `Pass: ${passCount}/${results.length}`,
    `Latency p50/p95 (ms): ${summary.latency.p50_ms ?? "n/a"}/${summary.latency.p95_ms ?? "n/a"} (n=${summary.latency.sample_count})`,
    "",
    "| Case | OK | HTTP | Intent | Status | Confidence | Latency(ms) | Update keys | Assistant preview |",
    "|---|---|---|---|---|---:|---:|---|",
    ...results.map(
      (r) =>
        `| ${r.id} | ${r.ok ? "yes" : "no"} | ${r.status} | ${r.intent ?? ""} | ${r.response_status ?? ""} | ${r.confidence ?? ""} | ${r.latency_ms} | ${(r.update_keys ?? []).join(", ")} | ${(r.assistant_preview ?? "").replace(/\|/g, "\\|")} |`
    ),
  ].join("\n");
  fs.writeFileSync(path.join(notesRoot, "wf_client_onboarding_edge_probes_summary.md"), md);

  console.log(`wf_client_onboarding_edge_probes: ${passCount}/${results.length} passed, p95_ms=${summary.latency.p95_ms ?? "n/a"}`);
  if (passCount !== results.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_client_onboarding_edge_probes failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
