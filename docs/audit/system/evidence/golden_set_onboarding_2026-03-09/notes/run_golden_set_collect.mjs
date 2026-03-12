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

function requireEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

function asUpdatesFromCase(testCase) {
  const base = {
    client_id: testCase.client_id,
    agency_id: testCase.agency_id,
    flow_type: "agency_led",
    current_step: 1,
    readiness_score: 0,
    blockers: [],
    updated_at: new Date().toISOString(),
  };
  return { ...base, ...(testCase.current_state || {}) };
}

async function provisionGoldenPersona(supabaseUrl, serviceRoleKey) {
  const adminHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const stamp = Date.now();
  const email = `wf.golden.onboarding.${stamp}@example.com`;
  const password = `Smmahub!${stamp}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Golden Onboarding User" },
    },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) {
    throw new Error(`Failed creating auth user: ${userCreate.res.status} ${JSON.stringify(userCreate.json)}`);
  }

  const userId = userCreate.json.id;
  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Golden Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-golden.example.com",
    },
  });
  if (!agencyInsert.res.ok) {
    throw new Error(`Failed inserting agency: ${agencyInsert.res.status} ${JSON.stringify(agencyInsert.json)}`);
  }

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: { agency_id: agencyId, user_id: userId, role: "owner", accepted_at: new Date().toISOString() },
  });
  if (!memberInsert.res.ok) {
    throw new Error(`Failed inserting agency member: ${memberInsert.res.status} ${JSON.stringify(memberInsert.json)}`);
  }

  const onboardingInsert = await httpJson(`${supabaseUrl}/rest/v1/ai_onboarding_status`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      agency_id: agencyId,
      scope: "agency",
      status: "complete",
      started_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: new Date().toISOString(),
      last_step_id: "workspace_ready",
      metadata: { source: "run_golden_set_collect" },
    },
  });
  if (!onboardingInsert.res.ok) {
    throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status} ${JSON.stringify(onboardingInsert.json)}`);
  }

  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: `WF Golden Client ${stamp}`,
      company: "WF Golden Company",
      email: `wf-golden-client-${stamp}@example.com`,
      phone: "+12025550126",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  if (!clientInsert.res.ok) {
    throw new Error(`Failed inserting client: ${clientInsert.res.status} ${JSON.stringify(clientInsert.json)}`);
  }

  return { email, password, agencyId, clientId };
}

async function main() {
  const env = loadEnv();
  const root = process.cwd();

  const supabaseUrl = requireEnv(env, "SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requireEnv(env, "SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  let userEmail = env.WF_GOLDEN_USER_EMAIL || "";
  let userPassword = env.WF_GOLDEN_USER_PASSWORD || "";
  let agencyId = env.WF_GOLDEN_AGENCY_ID || "";
  let clientId = env.WF_GOLDEN_CLIENT_ID || "";

  if (!userEmail || !userPassword || !agencyId || !clientId) {
    const provisioned = await provisionGoldenPersona(supabaseUrl, serviceRoleKey);
    userEmail = provisioned.email;
    userPassword = provisioned.password;
    agencyId = provisioned.agencyId;
    clientId = provisioned.clientId;
  }

  const datasetPath = path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/dataset/golden_cases.json");
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

  const login = await httpJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey },
    body: { email: userEmail, password: userPassword },
  });

  if (!login.res.ok || !login.json?.access_token) {
    throw new Error(`Auth failed: ${login.res.status} ${JSON.stringify(login.json)}`);
  }
  const accessToken = login.json.access_token;

  const results = [];
  for (const testCase of dataset.cases || []) {
    const statePayload = {
      ...testCase,
      agency_id: agencyId,
      client_id: clientId,
      current_state: testCase.current_state || {},
    };

    const seeded = await httpJson(`${supabaseUrl}/rest/v1/client_onboarding_profiles?on_conflict=client_id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: asUpdatesFromCase(statePayload),
    });

    if (!seeded.res.ok) {
      throw new Error(`Seed failed (${testCase.id}): ${seeded.res.status} ${JSON.stringify(seeded.json)}`);
    }

    const body = {
      version: "v2",
      agency_id: agencyId,
      client_id: clientId,
      client_turn_id: `${testCase.id}-${Date.now()}`,
      messages: [{ role: "user", content: testCase.user_message }],
      current_state_version: null,
      ui_context: { locale: "en-US", timezone: "UTC" },
    };

    const invoked = await httpJson(`${supabaseUrl}/functions/v1/ai-onboarding`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    });

    const payload = invoked.json || {};
    results.push({
      id: testCase.id,
      status_code: invoked.res.status,
      assistant_message: payload.assistant_message ?? "",
      intent: payload.intent ?? "",
      confidence: typeof payload.confidence === "number" ? payload.confidence : null,
      suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
      updates: payload.updates && typeof payload.updates === "object" ? payload.updates : {},
      raw: payload,
    });
  }

  const out = {
    meta: {
      generated_at: new Date().toISOString(),
      source: "run_golden_set_collect.mjs",
      agency_id: agencyId,
      client_id: clientId,
    },
    results,
  };

  const outputPath = path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/dataset/golden_actuals.json");
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));

  console.log(`golden_set_collect: wrote ${results.length} cases -> ${outputPath}`);
}

main().catch((error) => {
  console.error(`golden_set_collect failed: ${error.message}`);
  process.exitCode = 1;
});
