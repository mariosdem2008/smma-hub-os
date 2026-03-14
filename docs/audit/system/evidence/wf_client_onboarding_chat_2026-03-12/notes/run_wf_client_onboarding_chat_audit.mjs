import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

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

async function provisionPersonaAndClient(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const stamp = Date.now();
  const nonce = crypto.randomUUID().slice(0, 8);
  const email = `wf.client.chat.audit.${stamp}.${nonce}@example.com`;
  const password = `Smmahub!${stamp}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: { email, password, email_confirm: true, user_metadata: { full_name: "WF Client Chat Audit User" } },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) throw new Error(`Failed creating auth user: ${userCreate.res.status}`);
  const userId = userCreate.json.id;

  const agencyId = crypto.randomUUID();
  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Client Chat Audit Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-client-chat-audit.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`Failed inserting agency: ${agencyInsert.res.status}`);

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: { agency_id: agencyId, user_id: userId, role: "owner", accepted_at: new Date().toISOString() },
  });
  if (!memberInsert.res.ok) throw new Error(`Failed inserting agency member: ${memberInsert.res.status}`);

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
      metadata: { source: "wf_client_onboarding_chat_audit_runner" },
    },
  });
  if (!onboardingInsert.res.ok) throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status}`);

  const clientId = crypto.randomUUID();
  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: `WF Chat Audit Client ${stamp}`,
      company: "Audit Demo Co",
      email: `wf-client-chat-audit-client-${stamp}@example.com`,
      status: "active",
    },
  });
  if (!clientInsert.res.ok) throw new Error(`Failed inserting client: ${clientInsert.res.status}`);

  return { email, password, userId, agencyId, clientId };
}

async function loginViaUi(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForTimeout(1800);
}

async function ensureSession(page, baseUrl, persona) {
  await loginViaUi(page, baseUrl, persona.email, persona.password);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    await loginViaUi(page, baseUrl, persona.email, persona.password);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
  }
  if (new URL(page.url()).pathname.startsWith("/auth")) throw new Error("Unable to establish authenticated session");
  await page.evaluate((id) => localStorage.setItem("activeAgencyId", id), persona.agencyId);
}

async function selectByLabel(page, card, labelText, optionPattern) {
  const row = card.locator(`div:has(> label:has-text("${labelText}"))`).first();
  await row.locator('[role="combobox"]').click();
  await page.getByRole("option", { name: optionPattern }).first().click();
}

async function fillByLabel(card, labelText, value) {
  const row = card.locator(`div:has(> label:has-text("${labelText}"))`).first();
  await row.locator("input").first().fill(value);
}

async function fillTextAreaByLabel(card, labelText, value) {
  const row = card.locator(`div:has(> label:has-text("${labelText}"))`).first();
  await row.locator("textarea").first().fill(value);
}

async function clickFirstNButtons(card, sectionLabel, n) {
  const row = card.locator(`div:has(> label:has-text("${sectionLabel}"))`).first();
  const btns = row.getByRole("button");
  const count = await btns.count();
  for (let i = 0; i < Math.min(n, count); i += 1) {
    await btns.nth(i).click();
  }
}

function nowIso() {
  return new Date().toISOString();
}

function isBenignRequestFailure(entry) {
  const failure = String(entry?.failure || "").toLowerCase();
  const url = String(entry?.url || "").toLowerCase();
  return (
    failure.includes("err_aborted") ||
    failure.includes("net::err_aborted") ||
    (url.includes("/clients/") && failure.includes("aborted"))
  );
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_ONBOARDING_BASE_URL || env.WF_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12");
  const shotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(shotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const persona = await provisionPersonaAndClient(supabaseUrl, serviceRoleKey);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();

  const requestFailures = [];
  const consoleErrors = [];
  const non2xxApiResponses = [];
  const steps = [];
  const findings = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ text: msg.text(), at: nowIso() });
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText || "unknown";
    requestFailures.push({ url: req.url(), method: req.method(), failure, at: nowIso() });
  });
  page.on("response", (res) => {
    if (res.url().includes("/functions/v1/ai-onboarding-client-chat") && res.status() >= 400) {
      non2xxApiResponses.push({ status: res.status(), url: res.url(), at: nowIso() });
    }
  });

  try {
    await ensureSession(page, baseUrl, persona);
    await page.goto(`${baseUrl}/onboarding/client/${persona.clientId}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);

    const formCard = page.locator("div.rounded-2xl:has-text('Active step')").first();

    const entryShot = path.join(shotsRoot, "01_entry.png");
    await page.screenshot({ path: entryShot, fullPage: true });
    steps.push({ step: "entry", ok: true, screenshot: entryShot, at: nowIso() });

    const fillAndContinue = async (name, fillFn, shotName) => {
      await fillFn();
      const shot = path.join(shotsRoot, shotName);
      await page.screenshot({ path: shot, fullPage: true });
      await formCard.getByRole("button", { name: /Save and continue|Generate strategy/i }).first().click();
      await page.waitForTimeout(1300);
      steps.push({ step: name, ok: true, screenshot: shot, at: nowIso() });
      const saveIndicatorVisible = await page.getByText(/^Saved$/i).first().isVisible().catch(() => false);
      const summaryVisible = await page
        .locator("div.inline-block")
        .filter({ hasText: /Saved|Captured|Locked in|Added|Ready/i })
        .first()
        .isVisible()
        .catch(() => false);
      steps.push({ step: `${name}:save_indicator`, ok: saveIndicatorVisible, at: nowIso() });
      steps.push({ step: `${name}:saved_summary`, ok: summaryVisible, at: nowIso() });
    };

    await fillAndContinue("business_essentials", async () => {
      await fillByLabel(formCard, "Business name", "That Business");
      await selectByLabel(page, formCard, "Industry / niche", /Gym/i);
      await fillByLabel(formCard, "Website URL", "https://thatbusiness.example.com");
      await fillByLabel(formCard, "Main social profile", "https://instagram.com/thatbusiness");
    }, "02_business_essentials.png");

    await fillAndContinue("market_scope", async () => {
      await selectByLabel(page, formCard, "Scope", /National|Global|Local/i);
      await fillByLabel(formCard, "Country", "United States");
      await fillByLabel(formCard, "City", "Austin");
      await formCard.getByRole("button", { name: /english/i }).first().click();
    }, "03_market_scope.png");

    await fillAndContinue("goal_conversion", async () => {
      await selectByLabel(page, formCard, "Primary goal", /Leads|Calls|Sales/i);
      await selectByLabel(page, formCard, "Conversion path", /Book call|DM keyword|Website checkout/i);
      await fillByLabel(formCard, "Conversion link", "https://thatbusiness.example.com/book");
      await fillByLabel(formCard, "DM keyword", "START");
    }, "04_goal_conversion.png");

    await fillAndContinue("offers", async () => {
      await formCard.locator("input[placeholder='Offer name']").first().fill("12-week transformation");
      await formCard.locator("input[placeholder='Price min']").first().fill("1000");
      await formCard.locator("input[placeholder='Price max']").first().fill("1800");
    }, "05_offers.png");

    await fillAndContinue("audience", async () => {
      await formCard.locator('[role="combobox"]').first().click();
      await page.getByRole("option").first().click();
      await formCard.locator("input[placeholder='Primary customer']").first().fill("Busy professionals 28-45");
      await formCard.locator('[role="combobox"]').nth(1).click();
      await page.getByRole("option").first().click();
      const painButtons = formCard.locator("div:has(> label:has-text('Pain points')) button");
      for (let i = 0; i < 3; i += 1) await painButtons.nth(i).click();
    }, "06_audience.png");

    await fillAndContinue("brand", async () => {
      await clickFirstNButtons(formCard, "Brand voice", 2);
      await clickFirstNButtons(formCard, "Content style", 1);
      await formCard.getByRole("combobox").first().click();
      await page.getByRole("option", { name: /Yes \\(owner\\)|Yes \\(team\\)|No \\(faceless only\\)|Not sure/i }).first().click();
      await clickFirstNButtons(formCard, "Available assets", 1);
    }, "07_brand.png");

    await fillAndContinue("proof", async () => {
      await clickFirstNButtons(formCard, "Proof types", 1);
      await formCard.locator("input[placeholder='Competitor link']").first().fill("https://example-competitor.com");
      await fillTextAreaByLabel(formCard, "Differentiators", "Fast turnaround\nCustom strategy");
    }, "08_proof.png");

    await fillAndContinue("channels", async () => {
      await clickFirstNButtons(formCard, "Platforms", 2);
      await clickFirstNButtons(formCard, "Formats", 1);
      const channelCombos = formCard.getByRole("combobox");
      await channelCombos.nth(0).click();
      await page.getByRole("option", { name: /Standard|Light|Aggressive|Custom/i }).first().click();
      await channelCombos.nth(1).click();
      await page.getByRole("option", { name: /Agency|Owner|Team|Nobody yet/i }).first().click();
    }, "09_channels.png");

    await fillAndContinue("review", async () => {}, "10_review.png");

    await page.waitForTimeout(1500);
    const handoffShot = path.join(shotsRoot, "11_post_submit.png");
    await page.screenshot({ path: handoffShot, fullPage: true });
    const handoffMessageVisible = await page
      .getByText(/strategy generation is in progress|strategy generation is still running/i)
      .first()
      .isVisible()
      .catch(() => false);
    steps.push({
      step: "handoff",
      ok: new URL(page.url()).pathname.startsWith(`/clients/${persona.clientId}`),
      screenshot: handoffShot,
      at: nowIso(),
      note: page.url(),
    });
    steps.push({ step: "handoff:message_visible", ok: handoffMessageVisible, screenshot: handoffShot, at: nowIso() });

    await page.goto(`${baseUrl}/onboarding/client/${persona.clientId}`, { waitUntil: "networkidle", timeout: 45000 });
    const uiChecks = await page.evaluate(() => {
      const s = document.scrollingElement;
      return {
        pageScrollable: !!s && s.scrollHeight > s.clientHeight,
        hasProgress: /\d+%\s+complete/i.test(document.body.innerText),
      };
    });

    const titleCount = await page.getByText(/Business essentials/i).count();
    const benignRequestFailures = requestFailures.filter(isBenignRequestFailure);
    const actionableRequestFailures = requestFailures.filter((entry) => !isBenignRequestFailure(entry));
    if (titleCount > 1) findings.push({ severity: "medium", area: "UX clarity", issue: `Business essentials appears ${titleCount} times in active viewport.` });
    if (uiChecks.pageScrollable) findings.push({ severity: "medium", area: "Layout", issue: "Main page scroll detected; should be non-scrolling shell." });
    if (consoleErrors.length > 0) findings.push({ severity: "high", area: "Reliability", issue: `${consoleErrors.length} console errors observed.` });
    if (actionableRequestFailures.length > 0 || non2xxApiResponses.length > 0) findings.push({ severity: "high", area: "Network", issue: `${actionableRequestFailures.length} actionable request failures, ${non2xxApiResponses.length} non-2xx edge responses.` });
    if (!steps.every((step) => !step.step.includes(":save_indicator") || step.ok)) findings.push({ severity: "high", area: "Save confidence", issue: "One or more steps did not show the Saved confirmation indicator." });
    if (!steps.every((step) => !step.step.includes(":saved_summary") || step.ok)) findings.push({ severity: "high", area: "Save confidence", issue: "One or more steps did not render a saved-summary confirmation bubble." });
    if (!handoffMessageVisible) findings.push({ severity: "high", area: "Handoff", issue: "Strategy generation handoff message was not visible after completion." });

    const summary = {
      runAt: nowIso(),
      baseUrl,
      persona,
      steps,
      passCount: steps.filter((s) => s.ok).length,
      totalSteps: steps.length,
      consoleErrors,
      requestFailures,
      benignRequestFailures,
      actionableRequestFailures,
      non2xxApiResponses,
      uiChecks,
      findings,
      screenshotsRoot: shotsRoot,
    };

    fs.writeFileSync(path.join(logsRoot, "wf_client_onboarding_chat_audit_summary.json"), JSON.stringify(summary, null, 2));

    const findingsMd = findings.length
      ? findings.map((f, idx) => `${idx + 1}. [${f.severity.toUpperCase()}] ${f.area}: ${f.issue}`).join("\n")
      : "1. No critical UX/professionalism defects found in this run.";

    const md = `# WF Client Onboarding Chat UX Audit Summary (2026-03-12)\n\nRun at: ${summary.runAt}\nBase URL: ${baseUrl}\nPass: ${summary.passCount}/${summary.totalSteps}\nConsole errors: ${consoleErrors.length}\nRequest failures: ${requestFailures.length}\nActionable request failures: ${actionableRequestFailures.length}\nBenign request failures: ${benignRequestFailures.length}\nNon-2xx onboarding responses: ${non2xxApiResponses.length}\nMain page scrollable: ${uiChecks.pageScrollable}\n\n## Findings\n${findingsMd}\n\n## Screenshots\n${shotsRoot}\n\n## Improvement Notes\n1. Keep save confirmation and post-submit summary bubbles covered in this audit path.\n2. Maintain explicit strategy handoff messaging on the client detail landing state.\n3. Continue filtering benign navigation aborts out of actionable reliability scoring.\n4. Preserve the single active-step framing to avoid duplicate onboarding prompts.\n`;
    fs.writeFileSync(path.join(notesRoot, "wf_client_onboarding_chat_audit_summary.md"), md);

    console.log(`wf_client_onboarding_chat_audit: ${summary.passCount}/${summary.totalSteps} steps passed, findings=${findings.length}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("wf_client_onboarding_chat_audit failed:", error);
  process.exit(1);
});
