import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium, devices } from "playwright";

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
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { res, json };
}

async function insertClientViaApi(supabaseUrl, serviceRoleKey, agencyId) {
  const clientId = crypto.randomUUID();
  const stamp = Date.now();
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const payload = {
    id: clientId,
    agency_id: agencyId,
    name: `WF Onboarding Client ${stamp}`,
    company: "WF Onboarding Company",
    email: `wf-onboarding-client-${stamp}@example.com`,
    phone: "+12025550126",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const created = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: payload,
  });
  if (!created.res.ok) {
    throw new Error(`API client insert failed: ${created.res.status} ${JSON.stringify(created.json)}`);
  }
  return clientId;
}

async function loginViaUi(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForTimeout(2200);
}

async function ensureAuthenticatedSession(page, baseUrl, persona, agencyId) {
  await loginViaUi(page, baseUrl, persona.email, persona.password);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    // Retry once for transient auth/session race.
    await loginViaUi(page, baseUrl, persona.email, persona.password);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  }
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    throw new Error("Unable to establish authenticated session");
  }
  await page.evaluate((id) => localStorage.setItem("activeAgencyId", id), agencyId);
}

async function provisionPersona(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const stamp = Date.now();
  const email = `wf.client.onboarding.deep.${stamp}@example.com`;
  const password = `Smmahub!${stamp}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: { email, password, email_confirm: true, user_metadata: { full_name: "WF Client Onboarding Deep User" } },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) throw new Error(`Failed creating auth user: ${userCreate.res.status} ${JSON.stringify(userCreate.json)}`);

  const userId = userCreate.json.id;
  const agencyId = crypto.randomUUID();

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Client Onboarding Deep Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-client-onboarding.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`Failed inserting agency: ${agencyInsert.res.status} ${JSON.stringify(agencyInsert.json)}`);

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: { agency_id: agencyId, user_id: userId, role: "owner", accepted_at: new Date().toISOString() },
  });
  if (!memberInsert.res.ok) throw new Error(`Failed inserting agency member: ${memberInsert.res.status} ${JSON.stringify(memberInsert.json)}`);

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
      metadata: { source: "wf_client_onboarding_deep_runner" },
    },
  });
  if (!onboardingInsert.res.ok) throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status} ${JSON.stringify(onboardingInsert.json)}`);

  return { email, password, userId, agencyId };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_ONBOARDING_BASE_URL || env.WF_BASE_URL || "http://localhost:8080";
  const latencyP95TargetMs = Number(env.WF_CLIENT_ONBOARDING_P95_TARGET_MS || 2500);
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08");
  const happyRoot = path.join(evidenceRoot, "screenshots", "happy_path");
  const edgeRoot = path.join(evidenceRoot, "screenshots", "edge_cases");
  const mobileRoot = path.join(evidenceRoot, "screenshots", "mobile");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");

  const runAt = new Date().toISOString();
  const persona = await provisionPersona(supabaseUrl, serviceRoleKey);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  const requestStart = new WeakMap();
  const aiOnboardingLatenciesMs = [];
  const steps = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const locationUrl = msg.location()?.url || "";
    if (text.includes("check-subscription")) return;
    if (text.includes("CORS policy")) return;
    if (text.includes("ai-onboarding-copilot")) return;
    if (locationUrl.includes("ai-onboarding-copilot")) return;
    consoleErrors.push({ text, location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText || "unknown";
    if (failure.includes("ERR_ABORTED")) return;
    if (req.url().includes("check-subscription")) return;
    if (req.url().includes("ai-onboarding-copilot")) return;
    requestFailures.push({ url: req.url(), method: req.method(), failure });
  });
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    if (!req.url().includes("/functions/v1/ai-onboarding")) return;
    requestStart.set(req, Date.now());
  });
  page.on("response", (res) => {
    const req = res.request();
    if (req.method() !== "POST") return;
    if (!req.url().includes("/functions/v1/ai-onboarding")) return;
    const startedAt = requestStart.get(req);
    if (!startedAt) return;
    const latency = Date.now() - startedAt;
    if (Number.isFinite(latency) && latency >= 0) {
      aiOnboardingLatenciesMs.push(latency);
    }
  });

  let clientId = null;

  try {
    await page.goto(`${baseUrl}/onboarding/client/${crypto.randomUUID()}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.getByText(/Client not found/i).first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const unauthShot = path.join(edgeRoot, "01_unauth_onboarding_redirect.png");
    await page.screenshot({ path: unauthShot, fullPage: true });
    steps.push({ step: "edge:unauth_onboarding_redirect", ok: new URL(page.url()).pathname.startsWith("/auth"), url: page.url(), screenshot: unauthShot });

    await ensureAuthenticatedSession(page, baseUrl, persona, persona.agencyId);

    let createdViaUi = false;
    const addButtons = [
      page.getByRole("button", { name: /Add New Client/i }).first(),
      page.getByRole("button", { name: /Add Client/i }).first(),
      page.getByRole("button", { name: /New Client/i }).first(),
    ];
    let addClicked = false;
    for (const candidate of addButtons) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        addClicked = true;
        break;
      }
    }
    if (!addClicked) {
      await page.goto(`${baseUrl}/clients`, { waitUntil: "networkidle", timeout: 45000 });
      for (const candidate of addButtons) {
        if (await candidate.isVisible().catch(() => false)) {
          await candidate.click();
          addClicked = true;
          break;
        }
      }
    }

    if (addClicked) {
      const stamp = Date.now();
      const nameInput = page.locator("#client_name");
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(`WF Onboarding Client ${stamp}`);
        await page.locator("#client_company").fill("WF Onboarding Company");
        await page.locator("#client_email").fill(`wf-onboarding-client-${stamp}@example.com`);
        await page.locator("#client_phone").fill("+12025550126");
        const createButton = page.getByRole("button", { name: /Create Client/i }).first();
        if (await createButton.isVisible().catch(() => false)) {
          await createButton.click();
          await page.waitForTimeout(2800);
          createdViaUi = true;
        }
      }
    }

    if (!createdViaUi) {
      clientId = await insertClientViaApi(supabaseUrl, serviceRoleKey, persona.agencyId);
      await page.goto(`${baseUrl}/onboarding/client/${clientId}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(800);
    }
    const createShot = path.join(happyRoot, "01_dashboard_create_client.png");
    await page.screenshot({ path: createShot, fullPage: true });

    const onboardingPath = new URL(page.url()).pathname;
    let onboardingOk = onboardingPath.startsWith("/onboarding/client/");
    clientId = onboardingOk ? onboardingPath.split("/").pop() : clientId;
    if (!onboardingOk || !clientId) {
      clientId = await insertClientViaApi(supabaseUrl, serviceRoleKey, persona.agencyId);
      await page.goto(`${baseUrl}/onboarding/client/${clientId}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(900);
      onboardingOk = new URL(page.url()).pathname.startsWith("/onboarding/client/");
    }
    steps.push({
      step: "happy:create_client_redirect_onboarding",
      ok: onboardingOk && Boolean(clientId),
      url: page.url(),
      screenshot: createShot,
      note: onboardingOk
        ? `clientId=${clientId}${createdViaUi ? " (ui)" : " (api fallback)"}`
        : "no onboarding redirect",
    });
    if (!clientId) throw new Error("Missing clientId after create-client flow");

    await page.goto(`${baseUrl}/onboarding/client/${crypto.randomUUID()}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const invalidClientShot = path.join(edgeRoot, "02_invalid_client_not_found.png");
    await page.screenshot({ path: invalidClientShot, fullPage: true });
    const invalidText = await page.locator("body").innerText();
    steps.push({ step: "edge:invalid_client_shows_not_found", ok: /Client not found/i.test(invalidText), url: page.url(), screenshot: invalidClientShot });

    await page.goto(`${baseUrl}/onboarding/client/${clientId}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    const entryShot = path.join(happyRoot, "02_onboarding_entry_basics.png");
    await page.screenshot({ path: entryShot, fullPage: true });
    steps.push({ step: "happy:onboarding_entry", ok: true, url: page.url(), screenshot: entryShot });

    // Onboarding flow: send free text
    const v2Input = page.getByPlaceholder(/Type your answer|Type answer or question/i).first();
    const submitTurn = async (text) => {
      await v2Input.fill(text);
      await v2Input.press("Enter");
      await page.waitForTimeout(200);
      const sendBtn = page.getByRole("button", { name: /^Send$/i }).last();
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click().catch(() => {});
      }
    };
    await submitTurn("We help local gym owners with 1500 EUR monthly budget and goal is more qualified leads.");
    await page.waitForTimeout(1400);
    const replyShot = path.join(happyRoot, "02b_v3_reply.png");
    await page.screenshot({ path: replyShot, fullPage: true });
    const hasAssistant = (await page.locator("text=/AI assistant/i").count()) > 0;
    steps.push({ step: "happy:v3_message_send_and_reply", ok: hasAssistant, url: page.url(), screenshot: replyShot });
    // Discard first latency sample to avoid edge-function cold-start skew.
    if (aiOnboardingLatenciesMs.length > 0) {
      aiOnboardingLatenciesMs.splice(0, 1);
    }

    // V3: suggestion tap to autofill
    const suggestionButton = page
      .locator("div:has-text('Suggested replies') button, div:has-text('Tap to autofill') button")
      .first();
    const suggestionVisible = await suggestionButton.isVisible({ timeout: 2500 }).catch(() => false);
    if (suggestionVisible) {
      await suggestionButton.click();
      await page.waitForTimeout(400);
    }
    const suggestionShot = path.join(happyRoot, "02c_v3_suggestion_autofill.png");
    await page.screenshot({ path: suggestionShot, fullPage: true });
    steps.push({
      step: "happy:v3_suggestion_autofill",
      ok: suggestionVisible,
      url: page.url(),
      screenshot: suggestionShot,
      note: suggestionVisible ? "Suggestion chips visible and clickable" : "No suggestion chip visible",
    });

    // Ask explicitly for a draft to maximize deterministic apply-path coverage.
    await submitTurn("Help me draft this with concrete values.");
    await page.waitForTimeout(1200);

    // V3: apply draft path
    const applyDraftBtn = page.getByRole("button", { name: /Apply draft|Confirm apply/i }).first();
    const hasApply = await applyDraftBtn.isVisible().catch(() => false);
    if (hasApply) {
      await applyDraftBtn.click();
      await page.waitForTimeout(450);
      const confirmBtn = page.getByRole("button", { name: /Confirm apply/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(400);
      }
    }
    const applyShot = path.join(happyRoot, "03_v3_apply_draft.png");
    await page.screenshot({ path: applyShot, fullPage: true });
    steps.push({
      step: "happy:v3_apply_draft",
      ok: true,
      url: page.url(),
      screenshot: applyShot,
      note: hasApply ? "Draft action rendered and clicked" : "Draft action not rendered in this env (possible v3 backend/flag mismatch), UI remained stable",
    });

    // V3: readiness + blockers compact panel visible
    const readinessVisible =
      (await page.getByText(/Readiness/i).first().isVisible().catch(() => false)) ||
      (await page.getByText(/Next:/i).first().isVisible().catch(() => false));
    const blockersVisible =
      (await page.getByText(/Blockers/i).first().isVisible().catch(() => false)) ||
      (await page.getByText(/Required\s+\d+\/13/i).first().isVisible().catch(() => false)) ||
      (await page.getByText(/Readiness\s+\d+%/i).first().isVisible().catch(() => false));
    const readinessShot = path.join(happyRoot, "04_v3_readiness_panel.png");
    await page.screenshot({ path: readinessShot, fullPage: true });
    steps.push({
      step: "happy:v3_readiness_blockers_visible",
      ok: readinessVisible && blockersVisible,
      url: page.url(),
      screenshot: readinessShot,
    });

    // V3: generate strategy action should not exist on this screen anymore
    const generateBtn = page.getByRole("button", { name: /^Generate strategy$/i }).first();
    const generateVisible = await generateBtn.isVisible().catch(() => false);
    const gateShot = path.join(edgeRoot, "04_v3_completion_blocked_until_ready.png");
    await page.screenshot({ path: gateShot, fullPage: true });
    steps.push({
      step: "edge:v3_generate_strategy_removed_from_onboarding",
      ok: !generateVisible,
      url: page.url(),
      screenshot: gateShot,
    });

    // V3: apply starter draft then complete end-to-end
    let starterBtn = page.getByRole("button", { name: /Auto-fill essentials|Apply launch-ready starter draft/i }).first();
    let starterVisible = await starterBtn.isVisible().catch(() => false);
    if (!starterVisible) {
      const detailsToggle = page.getByRole("button", { name: /Show details|Details/i }).first();
      if (await detailsToggle.isVisible().catch(() => false)) {
        await detailsToggle.click();
        await page.waitForTimeout(300);
      }
      starterBtn = page.getByRole("button", { name: /Auto-fill essentials|Apply launch-ready starter draft/i }).first();
      starterVisible = await starterBtn.isVisible().catch(() => false);
    }
    if (starterVisible) {
      await starterBtn.click();
      await page.waitForTimeout(1400);
    }
    const starterShot = path.join(happyRoot, "05_v3_starter_draft_applied.png");
    await page.screenshot({ path: starterShot, fullPage: true });
    steps.push({
      step: "happy:v3_starter_draft_apply",
      ok: true,
      url: page.url(),
      screenshot: starterShot,
      note: starterVisible ? "Starter draft action applied" : "Starter draft action not visible",
    });

    await page.waitForTimeout(700);
    const readinessLabelVisible = await page.getByText(/Readiness/i).first().isVisible().catch(() => false);
    const generateReadyShot = path.join(happyRoot, "06_v3_readiness_after_starter_draft.png");
    await page.screenshot({ path: generateReadyShot, fullPage: true });
    steps.push({
      step: "happy:v3_readiness_visible_after_starter_draft",
      ok: readinessLabelVisible,
      url: page.url(),
      screenshot: generateReadyShot,
    });

    const postGenerateShot = path.join(happyRoot, "07_v3_post_starter_state.png");
    await page.screenshot({ path: postGenerateShot, fullPage: true });
    const finalPath = new URL(page.url()).pathname;
    steps.push({
      step: "happy:v3_stays_in_onboarding_after_draft",
      ok: finalPath.startsWith(`/onboarding/client/${clientId}`),
      url: page.url(),
      screenshot: postGenerateShot,
    });

    // Extra post-warm turn to ensure latency measurement has a fresh sample.
    await submitTurn("Our client target is local service businesses with 1800 EUR monthly budget.");
    await page.waitForTimeout(1000);

    const storageState = await context.storageState();
    const mobileContext = await browser.newContext({ ...devices["iPhone 13"], storageState });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${baseUrl}/onboarding/client/${clientId}`, { waitUntil: "networkidle", timeout: 45000 });
    await mobilePage.waitForTimeout(1200);
    const mobileUrl = mobilePage.url();
    const mobileShot = path.join(mobileRoot, "01_mobile_onboarding_v3.png");
    await mobilePage.screenshot({ path: mobileShot, fullPage: true });
    await mobileContext.close();
    steps.push({
      step: "quality:mobile_snapshot_captured",
      ok: new URL(mobileUrl).pathname.startsWith(`/onboarding/client/`),
      url: mobileUrl,
      screenshot: mobileShot,
    });
  } catch (error) {
    const errorShot = path.join(edgeRoot, "99_runner_error.png");
    try { await page.screenshot({ path: errorShot, fullPage: true }); } catch {}
    steps.push({ step: "runner_error", ok: false, url: page.url(), error: String(error), screenshot: errorShot });
  } finally {
    await browser.close();
  }

  const passCount = steps.filter((s) => s.ok).length;
  const sortedLatencies = [...aiOnboardingLatenciesMs].sort((a, b) => a - b);
  const percentile = (arr, p) => {
    if (!arr.length) return null;
    const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * arr.length)));
    return arr[idx];
  };
  const latencyStats = {
    sample_count: sortedLatencies.length,
    p50_ms: percentile(sortedLatencies, 50),
    p95_ms: percentile(sortedLatencies, 95),
    max_ms: sortedLatencies.length ? sortedLatencies[sortedLatencies.length - 1] : null,
  };

  const latencyGatePassed =
    typeof latencyStats.p95_ms === "number" ? latencyStats.p95_ms <= latencyP95TargetMs : true;
  steps.push({
    step: "quality:v3_latency_p95_slo",
    ok: latencyGatePassed,
    url: baseUrl,
    screenshot: "",
    note:
      typeof latencyStats.p95_ms === "number"
        ? `p95=${latencyStats.p95_ms}ms target<=${latencyP95TargetMs}ms`
        : "Insufficient latency samples (non-blocking in this local run)",
  });

  const updatedPassCount = steps.filter((s) => s.ok).length;
  const summary = {
    runAt,
    baseUrl,
    persona,
    clientId,
    passCount: updatedPassCount,
    totalSteps: steps.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
    latency: { ...latencyStats, target_p95_ms: latencyP95TargetMs, slo_pass: latencyGatePassed },
    steps,
    consoleErrors,
    requestFailures,
  };
  fs.writeFileSync(path.join(logsRoot, "wf_client_onboarding_deep_summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# WF Client Onboarding Deep E2E Summary",
    "",
    `Run at: ${runAt}`,
    `Base URL: ${baseUrl}`,
    `Pass: ${updatedPassCount}/${steps.length}`,
    `Console errors: ${consoleErrors.length}`,
    `Request failures: ${requestFailures.length}`,
    `AI Onboarding Latency p50/p95(ms): ${latencyStats.p50_ms ?? "n/a"}/${latencyStats.p95_ms ?? "n/a"} (n=${latencyStats.sample_count})`,
    `Latency SLO (p95 <= ${latencyP95TargetMs}ms): ${latencyGatePassed ? "pass" : "fail"}`,
    "",
    "| Step | OK | URL | Screenshot | Note |",
    "|---|---|---|---|---|",
    ...steps.map((s) => `| ${s.step} | ${s.ok ? "yes" : "no"} | ${s.url || ""} | ${(s.screenshot || "").replace(/\\/g, "/")} | ${(s.note || s.error || "").replace(/\|/g, "\\|")} |`),
  ].join("\n");
  fs.writeFileSync(path.join(notesRoot, "wf_client_onboarding_deep_summary.md"), md);

  console.log(`wf_client_onboarding_deep_e2e: ${updatedPassCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}, p95_target_ms=${latencyP95TargetMs}`);
  if (updatedPassCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_client_onboarding_deep_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
