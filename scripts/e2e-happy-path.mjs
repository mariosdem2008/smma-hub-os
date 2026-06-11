#!/usr/bin/env node

const SUPABASE_URL = trimTrailingSlash(process.env.SUPABASE_URL);
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

const requiredEnv = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
};

const missingEnv = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnv.length > 0) {
  console.error(`Missing required env: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

const state = {
  email: "",
  password: "E2eFounder!2026xZ",
  userId: "",
  agencyId: "",
  clientId: "",
  strategyId: "",
};

const counters = {
  passed: 0,
  total: 0,
};

const serviceHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const publishableHeaders = {
  apikey: PUBLISHABLE_KEY,
  "Content-Type": "application/json",
};

function trimTrailingSlash(value) {
  return typeof value === "string" ? value.replace(/\/+$/, "") : value;
}

function stage(name) {
  console.log(`\n== ${name} ==`);
}

function pass(name) {
  counters.total += 1;
  counters.passed += 1;
  console.log(`[PASS] ${name}`);
}

function fail(name, detail = "") {
  counters.total += 1;
  console.log(`[FAIL] ${name}${detail ? ` :: ${detail}` : ""}`);
}

function assert(name, condition, detail = "") {
  if (condition) {
    pass(name);
    return true;
  }
  fail(name, detail);
  return false;
}

function assertEqual(name, actual, expected) {
  return assert(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function fatal(message) {
  throw new Error(message);
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function encodeEq(value) {
  return encodeURIComponent(value);
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function httpJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
    },
    body: options.body === undefined || typeof options.body === "string" ? options.body : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    response,
    text,
    json: parseJson(text),
  };
}

function describeHttpFailure(result) {
  const body = typeof result.json === "string" ? result.json : JSON.stringify(result.json);
  return `HTTP ${result.response.status}: ${body || result.text || result.response.statusText}`;
}

async function rest(path, options = {}) {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers = {
    ...serviceHeaders,
    ...(options.prefer ? { Prefer: options.prefer } : {}),
    ...(options.headers ?? {}),
  };
  const result = await httpJson(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: options.body,
  });
  if (!result.response.ok) {
    fatal(`${path} failed: ${describeHttpFailure(result)}`);
  }
  return result.json;
}

async function rpc(name, body) {
  return rest(`rpc/${name}`, {
    method: "POST",
    body,
  });
}

async function createOwner() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.email = `e2e-happy-founder+${stamp}@smmahub-qa.dev`;

  const result = await httpJson(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders,
    body: {
      email: state.email,
      password: state.password,
      email_confirm: true,
      user_metadata: { full_name: "E2E Happy Path Founder" },
    },
  });

  if (!assert("owner auth user create returns 2xx", result.response.ok, describeHttpFailure(result))) {
    fatal("owner auth user creation failed");
  }

  state.userId = result.json?.id ?? "";
  if (!assert("owner auth user id returned", Boolean(state.userId), JSON.stringify(result.json))) {
    fatal("owner auth user id missing");
  }
}

async function seedTenant() {
  stage("Tenant");
  await createOwner();

  const agency = await rest("agencies", {
    method: "POST",
    prefer: "return=representation",
    body: {
      user_id: state.userId,
      name: `E2E Happy Path Agency ${state.email}`,
      niche: "fitness",
      website: "https://e2e-happy-path-agency.example.com",
    },
  });
  state.agencyId = Array.isArray(agency) ? agency[0]?.id : agency?.id;
  if (!assert("agency created", Boolean(state.agencyId), JSON.stringify(agency))) {
    fatal("agency creation failed");
  }

  const membership = await rest("agency_members", {
    method: "POST",
    prefer: "return=representation",
    body: {
      agency_id: state.agencyId,
      user_id: state.userId,
      role: "owner",
      accepted_at: nowIso(),
    },
  });
  const membershipId = Array.isArray(membership) ? membership[0]?.id : membership?.id;
  assert("owner membership created", Boolean(membershipId), JSON.stringify(membership));

  const onboarding = await rest("ai_onboarding_status", {
    method: "POST",
    prefer: "return=representation",
    body: {
      agency_id: state.agencyId,
      scope: "agency",
      client_id: null,
      status: "complete",
      started_at: nowIso(),
      completed_at: nowIso(),
      last_step_id: "review",
    },
  });
  const onboardingId = Array.isArray(onboarding) ? onboarding[0]?.id : onboarding?.id;
  assert("agency onboarding status complete row created", Boolean(onboardingId), JSON.stringify(onboarding));

  const gateRows = await rest(
    `ai_onboarding_status?agency_id=eq.${encodeEq(state.agencyId)}&scope=eq.agency&client_id=is.null&status=eq.complete&select=id,status,completed_at&limit=1`,
  );
  assert("agency dashboard gate would pass", Array.isArray(gateRows) && gateRows.length === 1 && gateRows[0].status === "complete");
}

function realisticBrain() {
  return {
    brand_basics: {
      name: "Northstar Performance Studio",
      business_name: "Northstar Performance Studio",
      niche: "fitness coaching",
      voice: "direct, evidence-led, encouraging",
    },
    offer_details: {
      core_offer: "12-week body recomposition coaching program",
      products_services: ["12-week coaching", "nutrition planning", "strength programming"],
      cta: "Book a free performance audit",
    },
    audience: {
      primary: "busy professionals aged 30-45 who want visible fitness progress without extreme dieting",
      problems: ["inconsistent routines", "low energy", "unclear nutrition plan"],
      pain_points: ["no time to plan workouts", "plateaus after short bursts of motivation"],
    },
    goals: ["generate qualified consult bookings", "increase proof-led content engagement"],
    pillars: [
      { id: "proof", name: "Client Proof", coverage_percent: 50 },
      { id: "education", name: "Simple Training Education", coverage_percent: 30 },
      { id: "conversion", name: "Audit Offer", coverage_percent: 20 },
    ],
  };
}

async function seedClientAndBrain() {
  stage("Client + Brain");
  state.clientId = uuid();
  const portalSlug = `e2e-happy-${Date.now()}`;

  await rest("clients", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: state.clientId,
      agency_id: state.agencyId,
      name: "Northstar Performance Studio",
      niche: "fitness",
      status: "active",
      portal_enabled: true,
      portal_slug: portalSlug,
      website: "https://northstar-performance.example.com",
    },
  });
  assert("client created", Boolean(state.clientId));

  const brainPayload = {
    agency_id: state.agencyId,
    client_id: state.clientId,
    version: 1,
    status: "usable",
    usable: true,
    locked: false,
    confidence: 88,
    brain_json: realisticBrain(),
  };

  const brain = await rest("client_brains?on_conflict=agency_id,client_id,version", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: brainPayload,
  });
  const brainRow = Array.isArray(brain) ? brain[0] : brain;
  assert("client brain row set usable=true", brainRow?.usable === true && brainRow?.status === "usable", JSON.stringify(brainRow));

  const statusRows = await rpc("get_client_brain_status", { p_client_id: state.clientId });
  const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;
  assert("get_client_brain_status returns usable=true", status?.usable === true, JSON.stringify(status));
}

function bridgePlan() {
  const start = addDays(startOfUtcDay(), 7);
  const weekEnd = addDays(start, 6);
  const firstSlot = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 15, 0, 0));
  const secondSlot = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 2, 16, 0, 0));

  const planItems = [
    {
      dedupe_key: "week-01:slot-01",
      week_index: 1,
      sequence_index: 1,
      window_start: dateOnly(start),
      window_end: dateOnly(weekEnd),
      scheduled_for: firstSlot.toISOString(),
      pillar_id: "proof",
      pillar_name: "Client Proof",
      pillar_coverage_percent: 50,
      channel: "instagram",
      calendar_platform: "instagram",
      content_type: "Short-form video",
      working_title: "Client Proof: The 12-week audit result",
      hook: "The fastest way to fix a plateau is to audit the routine, not add more effort.",
      cta: "Book a free performance audit",
      status: "planned",
      campaign_id: "audit-sprint",
      campaign_name: "Performance Audit Sprint",
      source_modules: ["pillars", "campaign_plan", "channel_adaptations", "rules_constraints"],
    },
    {
      dedupe_key: "week-01:slot-02",
      week_index: 1,
      sequence_index: 2,
      window_start: dateOnly(start),
      window_end: dateOnly(weekEnd),
      scheduled_for: secondSlot.toISOString(),
      pillar_id: "education",
      pillar_name: "Simple Training Education",
      pillar_coverage_percent: 50,
      channel: "linkedin",
      calendar_platform: "linkedin",
      content_type: "Carousel",
      working_title: "Simple Training Education: Three checks before changing your plan",
      hook: "Before changing workouts again, check recovery, progression, and protein consistency.",
      cta: "Book a free performance audit",
      status: "planned",
      campaign_id: "audit-sprint",
      campaign_name: "Performance Audit Sprint",
      source_modules: ["pillars", "campaign_plan", "channel_adaptations", "rules_constraints"],
    },
  ];

  const contentBriefs = [
    {
      brief_key: "brief:week-01:slot-01",
      plan_item_dedupe_key: "week-01:slot-01",
      angle: "Use a client plateau audit to show the method behind the result.",
      key_message: "Northstar fixes fitness plateaus by diagnosing constraints before prescribing more work.",
      proof_to_use: "12-week client transformation audit and weekly adherence review.",
      format_spec: "Short-form video on instagram | 35-45 seconds | hook-result-process-CTA",
      dos: ["Show the audit steps", "Use specific before/after constraints", "End with one consult CTA"],
      donts: ["Do not promise guaranteed weight loss", "Do not use shaming language"],
      status: "draft",
    },
  ];

  return { planItems, contentBriefs };
}

async function seedStrategyAndBridge() {
  stage("Strategy Row + Bridge");
  state.strategyId = uuid();
  const strategy = await rest("strategies", {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: state.strategyId,
      client_id: state.clientId,
      agency_id: state.agencyId,
      version_int: 1,
      status: "active",
      created_by: state.userId,
    },
  });
  const strategyRow = Array.isArray(strategy) ? strategy[0] : strategy;
  assert("strategy row inserted", strategyRow?.id === state.strategyId, JSON.stringify(strategyRow));

  const { planItems, contentBriefs } = bridgePlan();
  const bridge = await rpc("persist_strategy_execution_bridge", {
    p_agency_id: state.agencyId,
    p_client_id: state.clientId,
    p_strategy_id: state.strategyId,
    p_user_id: state.userId,
    p_plan_items: planItems,
    p_content_briefs: contentBriefs,
  });

  assert("bridge RPC returns ok=true", bridge?.ok === true, JSON.stringify(bridge));
  assertEqual("bridge plan_items_upserted=2", bridge?.plan_items_upserted, 2);
  assertEqual("bridge content_briefs_upserted=1", bridge?.content_briefs_upserted, 1);
  assertEqual("bridge calendar_entries_upserted=2", bridge?.calendar_entries_upserted, 2);
}

async function loadWorkRows() {
  const strategyFilter = `strategy_id=eq.${encodeEq(state.strategyId)}`;
  const [planItems, briefs, projects, scheduledPosts] = await Promise.all([
    rest(`content_plan_items?${strategyFilter}&select=id,dedupe_key,status,calendar_platform,scheduled_for&order=sequence_index.asc`),
    rest(`content_briefs?${strategyFilter}&select=id,brief_key,status,content_plan_item_id`),
    rest(`projects?${strategyFilter}&select=id,status,pipeline_stage,strategy_id,content_plan_item_id`),
    rest(`scheduled_posts?${strategyFilter}&select=id,status,platform,strategy_id,content_plan_item_id`),
  ]);

  return { planItems, briefs, projects, scheduledPosts };
}

async function assertWorkCreated() {
  stage("Work Created");
  const work = await loadWorkRows();

  assertEqual("content_plan_items count is 2", work.planItems.length, 2);
  assert("content_plan_items all status=planned", work.planItems.every((row) => row.status === "planned"), JSON.stringify(work.planItems));
  assertEqual("content_briefs count is 1", work.briefs.length, 1);
  assertEqual("projects count is 2", work.projects.length, 2);
  assert("projects are linked by strategy_id", work.projects.every((row) => row.strategy_id === state.strategyId), JSON.stringify(work.projects));
  assertEqual("scheduled_posts count is 2", work.scheduledPosts.length, 2);
  assert("scheduled_posts all status=draft", work.scheduledPosts.every((row) => row.status === "draft"), JSON.stringify(work.scheduledPosts));
  assert("autopublish safety: scheduled_posts are not pending", work.scheduledPosts.every((row) => row.status !== "pending"), JSON.stringify(work.scheduledPosts));

  return work;
}

async function assertIdempotency(beforeWork) {
  stage("Idempotency");
  const { planItems, contentBriefs } = bridgePlan();
  const bridge = await rpc("persist_strategy_execution_bridge", {
    p_agency_id: state.agencyId,
    p_client_id: state.clientId,
    p_strategy_id: state.strategyId,
    p_user_id: state.userId,
    p_plan_items: planItems,
    p_content_briefs: contentBriefs,
  });

  assert("second bridge RPC returns ok=true", bridge?.ok === true, JSON.stringify(bridge));

  const afterWork = await loadWorkRows();
  assertEqual("idempotency: content_plan_items count unchanged", afterWork.planItems.length, beforeWork.planItems.length);
  assertEqual("idempotency: scheduled_posts count unchanged", afterWork.scheduledPosts.length, beforeWork.scheduledPosts.length);
  assertEqual("idempotency: content_plan_items remain 2", afterWork.planItems.length, 2);
  assertEqual("idempotency: scheduled_posts remain 2", afterWork.scheduledPosts.length, 2);
}

async function loginOwner() {
  const result = await httpJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: publishableHeaders,
    body: {
      email: state.email,
      password: state.password,
    },
  });

  if (!assert("owner password grant returns 2xx", result.response.ok, describeHttpFailure(result))) {
    fatal("owner login failed");
  }

  const accessToken = result.json?.access_token ?? "";
  if (!assert("owner session access_token returned", Boolean(accessToken), JSON.stringify(result.json))) {
    fatal("owner access token missing");
  }
  return accessToken;
}

async function invokeFunction(functionName, accessToken, body) {
  return httpJson(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      ...publishableHeaders,
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });
}

async function assertBlockerScan(accessToken) {
  stage("Blocker Scan");
  const result = await invokeFunction("ai-blocker-scan", accessToken, {
    agency_id: state.agencyId,
    client_id: state.clientId,
    run_llm: false,
  });

  assertEqual("ai-blocker-scan HTTP 200", result.response.status, 200);
  if (!result.response.ok) {
    fatal(`ai-blocker-scan failed: ${describeHttpFailure(result)}`);
  }

  const blockerRows = await rest(
    `client_blockers?agency_id=eq.${encodeEq(state.agencyId)}&client_id=eq.${encodeEq(state.clientId)}&select=id,delivery_state,blockers,counts,scanned_at&limit=1`,
  );
  const blocker = blockerRows[0];
  assert("client_blockers row exists for client", Boolean(blocker?.id), JSON.stringify(blockerRows));
  assert(
    "client_blockers row has delivery_state",
    ["on_track", "at_risk", "blocked"].includes(blocker?.delivery_state),
    JSON.stringify(blocker),
  );
}

async function assertAgencyPulse(accessToken) {
  stage("Agency Pulse");
  const result = await invokeFunction("ai-agency-pulse", accessToken, {
    agency_id: state.agencyId,
  });

  assertEqual("ai-agency-pulse HTTP 200", result.response.status, 200);
  if (!result.response.ok) {
    fatal(`ai-agency-pulse failed: ${describeHttpFailure(result)}`);
  }

  assert("agency pulse has summary object", result.json?.summary && typeof result.json.summary === "object", JSON.stringify(result.json));
  assert(
    "agency pulse summary.clients_total>=1",
    Number(result.json?.summary?.clients_total ?? 0) >= 1,
    JSON.stringify(result.json?.summary),
  );
  assert("agency pulse attention is an array", Array.isArray(result.json?.attention), JSON.stringify(result.json));
}

function isPermissionDenied(result) {
  const text = `${result.text} ${JSON.stringify(result.json ?? {})}`;
  return (
    !result.response.ok &&
    (result.response.status === 401 ||
      result.response.status === 403 ||
      /permission denied|not authorized|unauthorized|row-level security|invalid jwt|jwt/i.test(text))
  );
}

async function anonSelect(path) {
  const headers = {
    apikey: PUBLISHABLE_KEY,
    Accept: "application/json",
  };
  if (PUBLISHABLE_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${PUBLISHABLE_KEY}`;
  }

  return httpJson(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers,
  });
}

async function assertIsolation() {
  stage("Isolation Spot-Check");
  const planItems = await anonSelect(
    `content_plan_items?strategy_id=eq.${encodeEq(state.strategyId)}&select=id&limit=1`,
  );
  assert(
    "publishable/anon key denied on content_plan_items",
    isPermissionDenied(planItems),
    describeHttpFailure(planItems),
  );

  const blockers = await anonSelect(
    `client_blockers?client_id=eq.${encodeEq(state.clientId)}&select=id&limit=1`,
  );
  assert(
    "publishable/anon key denied on client_blockers",
    isPermissionDenied(blockers),
    describeHttpFailure(blockers),
  );
}

async function deleteAgency() {
  if (!state.agencyId) return false;
  const result = await httpJson(`${SUPABASE_URL}/rest/v1/agencies?id=eq.${encodeEq(state.agencyId)}`, {
    method: "DELETE",
    headers: {
      ...serviceHeaders,
      Prefer: "return=minimal",
    },
  });
  assert("cleanup agency delete returns 2xx", result.response.ok, describeHttpFailure(result));
  return result.response.ok;
}

async function deleteOwner() {
  if (!state.userId) return false;
  const result = await httpJson(`${SUPABASE_URL}/auth/v1/admin/users/${encodeEq(state.userId)}`, {
    method: "DELETE",
    headers: serviceHeaders,
  });
  assert("cleanup auth user delete returns 2xx", result.response.ok, describeHttpFailure(result));
  return result.response.ok;
}

async function verifyCleanup() {
  if (state.agencyId) {
    const agencies = await rest(`agencies?id=eq.${encodeEq(state.agencyId)}&select=id`);
    assertEqual("cleanup verifies agency gone", agencies.length, 0);
  }

  if (state.clientId) {
    const clients = await rest(`clients?id=eq.${encodeEq(state.clientId)}&select=id`);
    assertEqual("cleanup verifies client gone", clients.length, 0);
  }

  if (state.strategyId) {
    const planItems = await rest(`content_plan_items?strategy_id=eq.${encodeEq(state.strategyId)}&select=id`);
    assertEqual("cleanup verifies content_plan_items gone", planItems.length, 0);
  }

  if (state.clientId) {
    const blockers = await rest(`client_blockers?client_id=eq.${encodeEq(state.clientId)}&select=id`);
    assertEqual("cleanup verifies client_blockers gone", blockers.length, 0);
  }
}

async function cleanup() {
  stage("Cleanup");
  const agencyDeleted = await deleteAgency();
  if (agencyDeleted) {
    await verifyCleanup();
  }
  await deleteOwner();
}

async function main() {
  let fatalError = null;

  try {
    await seedTenant();
    await seedClientAndBrain();
    await seedStrategyAndBridge();
    const work = await assertWorkCreated();
    await assertIdempotency(work);
    const accessToken = await loginOwner();
    await assertBlockerScan(accessToken);
    await assertAgencyPulse(accessToken);
    await assertIsolation();
  } catch (error) {
    fatalError = error;
    fail("harness fatal error", error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await cleanup();
    } catch (error) {
      fail("cleanup fatal error", error instanceof Error ? error.message : String(error));
    }
  }

  console.log(`\n${counters.passed}/${counters.total} passed`);
  if (fatalError || counters.passed !== counters.total) {
    process.exitCode = 1;
  }
}

main();
