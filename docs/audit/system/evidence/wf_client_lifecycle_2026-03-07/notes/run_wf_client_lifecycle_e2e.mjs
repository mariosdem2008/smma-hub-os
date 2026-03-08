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
  return { res, json };
}

async function provisionPersona(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const email = `wf.client.lifecycle.${Date.now()}@example.com`;
  const password = `Smmahub!${Date.now()}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Client Lifecycle User" },
    },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) {
    throw new Error(`Failed creating auth user: ${userCreate.res.status} ${JSON.stringify(userCreate.json)}`);
  }

  const userId = userCreate.json.id;
  const agencyId = crypto.randomUUID();

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Lifecycle Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-lifecycle.example.com",
    },
  });
  if (!agencyInsert.res.ok) {
    throw new Error(`Failed inserting agency: ${agencyInsert.res.status} ${JSON.stringify(agencyInsert.json)}`);
  }

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      agency_id: agencyId,
      user_id: userId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    },
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
      metadata: { source: "wf_client_lifecycle_runner" },
    },
  });
  if (!onboardingInsert.res.ok) {
    throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status} ${JSON.stringify(onboardingInsert.json)}`);
  }

  return { email, password, userId, agencyId };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_LIFECYCLE_BASE_URL || "http://localhost:8080";

  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_lifecycle_2026-03-07");
  const screenshotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const runAt = new Date().toISOString();
  const persona = await provisionPersona(supabaseUrl, serviceRoleKey);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  const steps = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || "unknown" });
  });

  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
    await page.locator("#email").fill(persona.email);
    await page.locator("#password").fill(persona.password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(2200);
    await page.evaluate((agencyId) => {
      localStorage.setItem("activeAgencyId", agencyId);
    }, persona.agencyId);
    steps.push({ step: "login", ok: true, url: page.url() });

    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
    await page.getByRole("button", { name: "Add New Client" }).click();
    const stamp = Date.now();
    await page.locator("#client_name").fill(`WF Lifecycle Client ${stamp}`);
    await page.locator("#client_company").fill("WF Lifecycle Co");
    await page.locator("#client_email").fill(`wf-lifecycle-client-${stamp}@example.com`);
    await page.locator("#client_phone").fill("+12025550124");
    await page.getByRole("button", { name: "Create Client" }).click();
    await page.waitForTimeout(3000);
    const createShot = path.join(screenshotsRoot, "01_create_client_result.png");
    await page.screenshot({ path: createShot, fullPage: true });

    const onboardingPath = new URL(page.url()).pathname;
    const onboardingOk = onboardingPath.startsWith("/onboarding/client/");
    const clientId = onboardingOk ? onboardingPath.split("/").pop() : null;
    steps.push({
      step: "client:create_and_redirect_to_onboarding",
      ok: onboardingOk,
      url: page.url(),
      screenshot: createShot,
      note: onboardingOk ? `Client id: ${clientId}` : "Did not redirect to /onboarding/client/:id",
    });

    if (!clientId) {
      throw new Error("Client ID missing after create flow");
    }

    const onboardingShot = path.join(screenshotsRoot, "02_client_onboarding_entry.png");
    await page.screenshot({ path: onboardingShot, fullPage: true });
    steps.push({ step: "client:onboarding_entry", ok: true, url: page.url(), screenshot: onboardingShot });

    const tabsToCheck = ["strategy", "pipeline", "portal", "reports", "uploads", "overview"];
    for (const tab of tabsToCheck) {
      await page.goto(`${baseUrl}/clients/${clientId}?tab=${tab}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1600);
      const shot = path.join(screenshotsRoot, `tab_${tab}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const currentPath = new URL(page.url()).pathname;
      const ok = currentPath === `/clients/${clientId}`;
      steps.push({
        step: `client:detail_tab:${tab}`,
        ok,
        url: page.url(),
        screenshot: shot,
        note: ok ? "Client detail route loaded" : `Unexpected route: ${currentPath}`,
      });
    }
  } catch (error) {
    const errorShot = path.join(screenshotsRoot, "runner_error.png");
    try {
      await page.screenshot({ path: errorShot, fullPage: true });
    } catch {
      // no-op
    }
    steps.push({ step: "runner_error", ok: false, url: page.url(), error: String(error), screenshot: errorShot });
  } finally {
    await browser.close();
  }

  const passCount = steps.filter((s) => s.ok).length;
  const summary = {
    runAt,
    baseUrl,
    persona,
    passCount,
    totalSteps: steps.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
    steps,
    consoleErrors,
    requestFailures,
  };

  fs.writeFileSync(path.join(logsRoot, "wf_client_lifecycle_summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# WF Client Lifecycle E2E Summary",
    "",
    `Run at: ${runAt}`,
    `Base URL: ${baseUrl}`,
    `Pass: ${passCount}/${steps.length}`,
    `Console errors: ${consoleErrors.length}`,
    `Request failures: ${requestFailures.length}`,
    "",
    "| Step | OK | URL | Screenshot |",
    "|---|---|---|---|",
    ...steps.map((s) => `| ${s.step} | ${s.ok ? "yes" : "no"} | ${s.url || ""} | ${(s.screenshot || "").replace(/\\/g, "/")} |`),
  ].join("\n");
  fs.writeFileSync(path.join(notesRoot, "wf_client_lifecycle_summary.md"), md);

  console.log(
    `wf_client_lifecycle_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}`
  );
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_client_lifecycle_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
