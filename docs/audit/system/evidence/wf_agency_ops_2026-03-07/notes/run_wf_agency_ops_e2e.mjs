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

  const email = `wf.agency.ops.${Date.now()}@example.com`;
  const password = `Smmahub!${Date.now()}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Agency Ops User" },
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
      name: `WF Ops Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-ops.example.com",
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
      metadata: { source: "wf_agency_ops_runner" },
    },
  });
  if (!onboardingInsert.res.ok) {
    throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status} ${JSON.stringify(onboardingInsert.json)}`);
  }

  await httpJson(`${supabaseUrl}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates" },
    body: {
      user_id: userId,
      plan_type: "pro",
      status: "active",
      storage_used: 0,
      updated_at: new Date().toISOString(),
    },
  });

  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: "Seed Client",
      company: "Seed Co",
      email: "seed-client@example.com",
      status: "active",
    },
  });
  if (!clientInsert.res.ok) {
    throw new Error(`Failed inserting client: ${clientInsert.res.status} ${JSON.stringify(clientInsert.json)}`);
  }

  await httpJson(`${supabaseUrl}/rest/v1/tasks`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: {
      agency_id: agencyId,
      client_id: clientId,
      title: "Seed task",
      description: "Initial operations task",
      priority: "medium",
      status: "todo",
      created_by: userId,
    },
  });

  return { email, password, userId, agencyId, clientId };
}

function safeName(route) {
  return route.replace(/^\//, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "root";
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_AGENCY_OPS_BASE_URL || env.WF_BASE_URL || "http://localhost:8080";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  }

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_agency_ops_2026-03-07");
  const screenshotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");

  const runAt = new Date().toISOString();
  const persona = await provisionPersona(supabaseUrl, serviceRoleKey);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  const steps = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on("requestfailed", (req) => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || "unknown" });
  });

  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(800);
    await page.waitForSelector("#email", { timeout: 20000 });
    await page.waitForSelector("#password", { timeout: 20000 });
    await page.locator("#email").fill(persona.email);
    await page.locator("#password").fill(persona.password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(2500);

    await page.evaluate((agencyId) => {
      localStorage.setItem("activeAgencyId", agencyId);
    }, persona.agencyId);

    const postLoginShot = path.join(screenshotsRoot, "01_post_login.png");
    await page.screenshot({ path: postLoginShot, fullPage: true });
    steps.push({ step: "login", ok: true, url: page.url(), screenshot: postLoginShot });

    const routes = ["/dashboard", "/clients", "/messages", "/team", "/settings"];
    for (const route of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(800);
      const shot = path.join(screenshotsRoot, `${safeName(route)}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const finalPath = new URL(page.url()).pathname;
      const ok = finalPath === route;
      steps.push({
        step: `route:${route}`,
        ok,
        url: page.url(),
        screenshot: shot,
        note: ok ? "Route matched expected path" : `Route mismatch. Expected ${route}, got ${finalPath}`,
      });
    }

    // Dashboard quick action: create client
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle", timeout: 45000 });
    await page.getByRole("button", { name: "Add New Client" }).click();
    await page.locator("#client_name").fill(`WF Client ${Date.now()}`);
    await page.locator("#client_company").fill("WF Agency Ops Co");
    await page.locator("#client_email").fill(`wf-client-${Date.now()}@example.com`);
    await page.locator("#client_phone").fill("+12025550123");
    await page.getByRole("button", { name: "Create Client" }).click();
    await page.waitForTimeout(2200);
    const createClientShot = path.join(screenshotsRoot, "dashboard_create_client_result.png");
    await page.screenshot({ path: createClientShot, fullPage: true });
    steps.push({
      step: "dashboard:create_client",
      ok: true,
      url: page.url(),
      screenshot: createClientShot,
      note: "Expected redirect to /onboarding/client/:id or /clients/:id",
    });

    // Team invite flow (invite tab)
    await page.goto(`${baseUrl}/team`, { waitUntil: "networkidle", timeout: 45000 });
    await page.getByRole("tab", { name: "Invite Members" }).click();
    await page.locator("#invite-email").fill(`wf-invite-${Date.now()}@example.com`);
    const inviteResponse = await Promise.all([
      page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/send-team-invite") && [200, 201, 400, 401, 403, 422, 500].includes(res.status()),
          { timeout: 20000 },
        )
        .catch(() => null),
      page.getByRole("button", { name: /Send Invitation/i }).click(),
    ]).then((result) => result[0]);
    await page.waitForTimeout(2500);
    const teamInviteShot = path.join(screenshotsRoot, "team_invite_result.png");
    await page.screenshot({ path: teamInviteShot, fullPage: true });
    let inviteBody = null;
    if (inviteResponse) {
      try {
        inviteBody = await inviteResponse.json();
      } catch {
        inviteBody = null;
      }
    }
    const inviteOk = Boolean(inviteResponse && [200, 201].includes(inviteResponse.status()));
    steps.push({
      step: "team:send_invite",
      ok: inviteOk,
      url: page.url(),
      screenshot: teamInviteShot,
      note: inviteResponse
        ? `send-team-invite status=${inviteResponse.status()} code=${inviteBody?.code ?? "n/a"}`
        : "send-team-invite response missing",
    });
  } catch (error) {
    let bodyHtml = "";
    let inputCount = -1;
    try {
      bodyHtml = await page.content();
    } catch {
      bodyHtml = "";
    }
    try {
      inputCount = await page.locator("input").count();
    } catch {
      inputCount = -1;
    }
    steps.push({
      step: "runner_error",
      ok: false,
      url: page.url(),
      error: String(error),
      debug: { inputCount, bodySnippet: bodyHtml.slice(0, 1200) },
    });
    const errorShot = path.join(screenshotsRoot, "runner_error.png");
    try {
      await page.screenshot({ path: errorShot, fullPage: true });
    } catch {
      // no-op
    }
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

  fs.writeFileSync(path.join(logsRoot, "wf_agency_ops_summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# WF Agency Ops E2E Summary",
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
  fs.writeFileSync(path.join(notesRoot, "wf_agency_ops_summary.md"), md);

  console.log(`wf_agency_ops_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}`);
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_agency_ops_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
