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

async function provisionPortalFixture(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const ownerEmail = `wf.portal.owner.${Date.now()}@example.com`;
  const ownerPassword = `Smmahub!${Date.now()}`;

  const ownerCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { full_name: "WF Portal Owner" },
    },
  });
  if (!ownerCreate.res.ok || !ownerCreate.json?.id) {
    throw new Error(`Failed creating owner auth user: ${ownerCreate.res.status} ${JSON.stringify(ownerCreate.json)}`);
  }

  const ownerId = ownerCreate.json.id;
  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const portalSlug = `wf-portal-${Date.now()}`;
  const inviteToken = crypto.randomUUID().replace(/-/g, "");
  const inviteEmail = `wf.portal.user.${Date.now()}@example.com`;

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: ownerId,
      name: `WF Portal Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-portal.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`Failed inserting agency: ${agencyInsert.res.status}`);

  const memberInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      agency_id: agencyId,
      user_id: ownerId,
      role: "owner",
      accepted_at: new Date().toISOString(),
    },
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
      metadata: { source: "wf_client_portal_runner" },
    },
  });
  if (!onboardingInsert.res.ok) throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status}`);

  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: "WF Portal Client",
      company: "WF Portal Co",
      email: "wf-portal-client@example.com",
      status: "active",
      portal_enabled: true,
      portal_slug: portalSlug,
    },
  });
  if (!clientInsert.res.ok) {
    throw new Error(`Failed inserting client: ${clientInsert.res.status} ${JSON.stringify(clientInsert.json)}`);
  }

  const inviteInsert = await httpJson(`${supabaseUrl}/rest/v1/client_invites`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      agency_id: agencyId,
      client_id: clientId,
      email: inviteEmail,
      full_name: "WF Portal User",
      invite_token: inviteToken,
      role: "client",
      accepted: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    },
  });
  if (!inviteInsert.res.ok) {
    throw new Error(`Failed inserting client invite: ${inviteInsert.res.status} ${JSON.stringify(inviteInsert.json)}`);
  }

  return { agencyId, clientId, portalSlug, inviteToken, inviteEmail };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_PORTAL_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_portal_2026-03-07");
  const screenshotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const runAt = new Date().toISOString();
  const fixture = await provisionPortalFixture(supabaseUrl, serviceRoleKey);

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
    await page.goto(`${baseUrl}/client/accept-invite?token=${fixture.inviteToken}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    const acceptShot = path.join(screenshotsRoot, "01_accept_invite_page.png");
    await page.screenshot({ path: acceptShot, fullPage: true });
    steps.push({ step: "portal:accept_invite_page", ok: true, url: page.url(), screenshot: acceptShot });

    await page.locator("#password").fill("Smmahub!1234");
    await page.locator("#confirmPassword").fill("Smmahub!1234");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(3500);
    const postSignupShot = path.join(screenshotsRoot, "02_post_signup_redirect.png");
    await page.screenshot({ path: postSignupShot, fullPage: true });
    const postSignupPath = new URL(page.url()).pathname;
    const signupOk = postSignupPath.startsWith(`/client/portal/${fixture.portalSlug}`) || postSignupPath === "/client/portal";
    steps.push({ step: "portal:signup_and_redirect", ok: signupOk, url: page.url(), screenshot: postSignupShot });

    const routes = [
      "",
      "approvals",
      "content-calendar",
      "performance",
      "messages",
      "ai-assistant",
      "assets",
      "social-profiles",
    ];
    for (const route of routes) {
      const url = route
        ? `${baseUrl}/client/portal/${fixture.portalSlug}/${route}`
        : `${baseUrl}/client/portal/${fixture.portalSlug}`;
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1300);
      const shot = path.join(screenshotsRoot, `route_${route || "root"}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      const finalPath = new URL(page.url()).pathname;
      const expectedPath = route ? `/client/portal/${fixture.portalSlug}/${route}` : `/client/portal/${fixture.portalSlug}`;
      steps.push({
        step: `portal:route:${route || "root"}`,
        ok: finalPath === expectedPath,
        url: page.url(),
        screenshot: shot,
        note: finalPath === expectedPath ? "Route matched" : `Expected ${expectedPath}, got ${finalPath}`,
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
    fixture,
    passCount,
    totalSteps: steps.length,
    consoleErrorCount: consoleErrors.length,
    requestFailureCount: requestFailures.length,
    steps,
    consoleErrors,
    requestFailures,
  };

  fs.writeFileSync(path.join(logsRoot, "wf_client_portal_summary.json"), JSON.stringify(summary, null, 2));
  const md = [
    "# WF Client Portal E2E Summary",
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
  fs.writeFileSync(path.join(notesRoot, "wf_client_portal_summary.md"), md);

  console.log(
    `wf_client_portal_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}`
  );
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_client_portal_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
