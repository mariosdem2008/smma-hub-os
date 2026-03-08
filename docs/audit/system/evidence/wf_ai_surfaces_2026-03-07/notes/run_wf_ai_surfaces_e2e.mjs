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

async function createAuthUser({ supabaseUrl, adminHeaders, email, password, fullName }) {
  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) {
    throw new Error(`Failed creating auth user (${email}): ${userCreate.res.status} ${JSON.stringify(userCreate.json)}`);
  }
  return userCreate.json.id;
}

async function provisionFixture(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const now = Date.now();

  const ownerEmail = `wf.ai.owner.${now}@example.com`;
  const ownerPassword = `Smmahub!${now}`;
  const memberEmail = `wf.ai.member.${now}@example.com`;
  const memberPassword = `Smmahub!${now}`;
  const portalEmail = `wf.ai.portal.${now}@example.com`;
  const portalPassword = "Smmahub!1234";

  const ownerId = await createAuthUser({
    supabaseUrl,
    adminHeaders,
    email: ownerEmail,
    password: ownerPassword,
    fullName: "WF AI Owner",
  });
  const memberId = await createAuthUser({
    supabaseUrl,
    adminHeaders,
    email: memberEmail,
    password: memberPassword,
    fullName: "WF AI Member",
  });

  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const portalSlug = `wf-ai-${now}`;
  const inviteToken = crypto.randomUUID().replace(/-/g, "");

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: ownerId,
      name: `WF AI Agency ${now}`,
      niche: "Marketing",
      website: "https://wf-ai.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`Failed inserting agency: ${agencyInsert.res.status}`);

  const membersInsert = await httpJson(`${supabaseUrl}/rest/v1/agency_members`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: [
      { agency_id: agencyId, user_id: ownerId, role: "owner", accepted_at: new Date().toISOString() },
      { agency_id: agencyId, user_id: memberId, role: "member", accepted_at: new Date().toISOString() },
    ],
  });
  if (!membersInsert.res.ok) throw new Error(`Failed inserting agency members: ${membersInsert.res.status}`);

  const onboardingInsert = await httpJson(`${supabaseUrl}/rest/v1/ai_onboarding_status`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=minimal" },
    body: {
      agency_id: agencyId,
      scope: "agency",
      status: "complete",
      started_at: new Date(Date.now() - 60_000).toISOString(),
      completed_at: new Date().toISOString(),
      last_step_id: "workspace_ready",
      metadata: { source: "wf_ai_surfaces_runner" },
    },
  });
  if (!onboardingInsert.res.ok) throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status}`);

  await httpJson(`${supabaseUrl}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "resolution=merge-duplicates" },
    body: {
      user_id: ownerId,
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
      name: "WF AI Client",
      company: "WF AI Co",
      email: "wf-ai-client@example.com",
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
      email: portalEmail,
      full_name: "WF AI Portal User",
      invite_token: inviteToken,
      role: "client",
      accepted: false,
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    },
  });
  if (!inviteInsert.res.ok) {
    throw new Error(`Failed inserting client invite: ${inviteInsert.res.status} ${JSON.stringify(inviteInsert.json)}`);
  }

  return {
    agencyId,
    clientId,
    portalSlug,
    inviteToken,
    owner: { email: ownerEmail, password: ownerPassword, userId: ownerId },
    member: { email: memberEmail, password: memberPassword, userId: memberId },
    portalUser: { email: portalEmail, password: portalPassword },
  };
}

function pushStep(steps, step) {
  steps.push(step);
}

function shouldTrackRequestFailure(req) {
  const failureText = req.failure()?.errorText || "unknown";
  // Browser-canceled requests during route transitions are expected churn noise.
  if (failureText.includes("ERR_ABORTED")) return false;
  return true;
}

async function runOwnerAdminFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ scope: "owner", text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    if (!shouldTrackRequestFailure(req)) return;
    requestFailures.push({
      scope: "owner",
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || "unknown",
    });
  });

  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
    await page.locator("#email").fill(fixture.owner.email);
    await page.locator("#password").fill(fixture.owner.password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(2500);
    await page.evaluate((agencyId) => {
      localStorage.setItem("activeAgencyId", agencyId);
    }, fixture.agencyId);

    await page.goto(`${baseUrl}/ai/admin`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const adminRouteShot = path.join(screenshotsRoot, "01_owner_ai_admin_route.png");
    await page.screenshot({ path: adminRouteShot, fullPage: true });
    const adminPath = new URL(page.url()).pathname;
    pushStep(steps, {
      step: "ai_admin:owner_route",
      ok: adminPath === "/ai/admin",
      url: page.url(),
      screenshot: adminRouteShot,
      note: adminPath === "/ai/admin" ? "Route matched" : `Expected /ai/admin, got ${adminPath}`,
    });

    const chatBox = page.getByPlaceholder("Message the agency AI");
    await chatBox.fill("Give me one short recommendation to improve agency onboarding quality.");

    const adminResponse = await Promise.all([
      page
        .waitForResponse(
          (res) =>
            res.url().includes("/functions/v1/ai-agency-admin-chat") &&
            [200, 400, 401, 403, 422, 429, 500].includes(res.status()),
          { timeout: 30000 },
        )
        .catch(() => null),
      page.getByRole("button", { name: /^Send$/ }).click(),
    ]).then((r) => r[0]);

    await page.waitForTimeout(3500);
    const adminSendShot = path.join(screenshotsRoot, "02_owner_ai_admin_after_send.png");
    await page.screenshot({ path: adminSendShot, fullPage: true });
    pushStep(steps, {
      step: "ai_admin:owner_send_message",
      ok: Boolean(adminResponse && adminResponse.status() === 200),
      url: page.url(),
      screenshot: adminSendShot,
      note: adminResponse
        ? `ai-agency-admin-chat status=${adminResponse.status()}`
        : "ai-agency-admin-chat response missing",
    });
  } catch (error) {
    const shot = path.join(screenshotsRoot, "owner_runner_error.png");
    try {
      await page.screenshot({ path: shot, fullPage: true });
    } catch {
      // no-op
    }
    pushStep(steps, {
      step: "ai_admin:owner_runner_error",
      ok: false,
      url: page.url(),
      screenshot: shot,
      error: String(error),
    });
  } finally {
    await browser.close();
  }
}

async function runMemberGuardFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ scope: "member", text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    if (!shouldTrackRequestFailure(req)) return;
    requestFailures.push({
      scope: "member",
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || "unknown",
    });
  });

  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
    await page.locator("#email").fill(fixture.member.email);
    await page.locator("#password").fill(fixture.member.password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(2500);
    await page.evaluate((agencyId) => {
      localStorage.setItem("activeAgencyId", agencyId);
    }, fixture.agencyId);

    await page.goto(`${baseUrl}/ai/admin`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const guardShot = path.join(screenshotsRoot, "03_member_ai_admin_guard.png");
    await page.screenshot({ path: guardShot, fullPage: true });
    const finalPath = new URL(page.url()).pathname;
    pushStep(steps, {
      step: "ai_admin:member_guard_redirect",
      ok: finalPath === "/dashboard",
      url: page.url(),
      screenshot: guardShot,
      note: finalPath === "/dashboard" ? "Guard redirect matched" : `Expected /dashboard, got ${finalPath}`,
    });
  } catch (error) {
    const shot = path.join(screenshotsRoot, "member_runner_error.png");
    try {
      await page.screenshot({ path: shot, fullPage: true });
    } catch {
      // no-op
    }
    pushStep(steps, {
      step: "ai_admin:member_runner_error",
      ok: false,
      url: page.url(),
      screenshot: shot,
      error: String(error),
    });
  } finally {
    await browser.close();
  }
}

async function runPortalAssistantFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ scope: "portal", text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    if (!shouldTrackRequestFailure(req)) return;
    requestFailures.push({
      scope: "portal",
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || "unknown",
    });
  });

  try {
    await page.goto(`${baseUrl}/client/accept-invite?token=${fixture.inviteToken}`, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(1200);
    const acceptShot = path.join(screenshotsRoot, "04_portal_accept_invite.png");
    await page.screenshot({ path: acceptShot, fullPage: true });
    pushStep(steps, {
      step: "portal_ai:accept_invite_page",
      ok: true,
      url: page.url(),
      screenshot: acceptShot,
    });

    await page.locator("#password").fill(fixture.portalUser.password);
    await page.locator("#confirmPassword").fill(fixture.portalUser.password);

    const signupResponse = await Promise.all([
      page
        .waitForResponse(
          (res) =>
            res.url().includes("/functions/v1/client-auth-signup") &&
            [200, 400, 401, 403, 409, 422, 429, 500].includes(res.status()),
          { timeout: 45000 },
        )
        .catch(() => null),
      page.getByRole("button", { name: "Create Account" }).click(),
    ]).then((r) => r[0]);

    const signupOk = Boolean(signupResponse && signupResponse.status() === 200);
    if (!signupOk) {
      const signupFailShot = path.join(screenshotsRoot, "05_portal_signup_failed.png");
      await page.waitForTimeout(1000);
      await page.screenshot({ path: signupFailShot, fullPage: true });
      pushStep(steps, {
        step: "portal_ai:signup",
        ok: false,
        url: page.url(),
        screenshot: signupFailShot,
        note: signupResponse
          ? `client-auth-signup status=${signupResponse.status()}`
          : "client-auth-signup response missing",
      });
      return;
    }

    pushStep(steps, {
      step: "portal_ai:signup",
      ok: true,
      url: page.url(),
      note: `client-auth-signup status=${signupResponse.status()}`,
    });

    const expectedPortalRoot = `/client/portal/${fixture.portalSlug}`;
    await page
      .waitForURL((url) => url.pathname.startsWith(expectedPortalRoot), {
        timeout: 15000,
      })
      .catch(() => null);

    const aiLink = page.getByRole("link", { name: /AI Assistant/i }).first();
    if (await aiLink.isVisible().catch(() => false)) {
      await aiLink.click();
      await page.waitForURL((url) => url.pathname.includes(`/client/portal/${fixture.portalSlug}/ai-assistant`), {
        timeout: 20000,
      }).catch(() => null);
    } else {
      const route = `${baseUrl}/client/portal/${fixture.portalSlug}/ai-assistant`;
      await page.goto(route, { waitUntil: "networkidle", timeout: 45000 });
    }

    await page.waitForTimeout(1300);
    const routeShot = path.join(screenshotsRoot, "05_portal_ai_assistant_route.png");
    await page.screenshot({ path: routeShot, fullPage: true });
    const finalPath = new URL(page.url()).pathname;
    const expectedPath = `/client/portal/${fixture.portalSlug}/ai-assistant`;
    const loginFallbackPath = `/client/login/${fixture.portalSlug}`;

    if (finalPath !== expectedPath) {
      await page.goto(`${baseUrl}${loginFallbackPath}`, { waitUntil: "networkidle", timeout: 45000 });
      const hasLoginForm =
        (await page.locator("#email").isVisible().catch(() => false)) &&
        (await page.locator("#password").isVisible().catch(() => false));
      if (hasLoginForm) {
        await page.locator("#email").fill(fixture.portalUser.email);
        await page.locator("#password").fill(fixture.portalUser.password);
        await page.getByRole("button", { name: /(Sign In|Login)/i }).click();
      await page
        .waitForURL((url) => url.pathname.startsWith(`/client/portal/${fixture.portalSlug}`), {
          timeout: 20000,
        })
        .catch(() => null);
      if (!page.url().includes(`/client/portal/${fixture.portalSlug}/ai-assistant`)) {
        await page.goto(`${baseUrl}/client/portal/${fixture.portalSlug}/ai-assistant`, {
          waitUntil: "networkidle",
          timeout: 45000,
        });
      }
      }
    }

    const finalPathAfterFallback = new URL(page.url()).pathname;
    pushStep(steps, {
      step: "portal_ai:route",
      ok: finalPathAfterFallback === expectedPath,
      url: page.url(),
      screenshot: routeShot,
      note:
        finalPathAfterFallback === expectedPath
          ? finalPath === loginFallbackPath
            ? "Route matched after login fallback"
            : "Route matched"
          : `Expected ${expectedPath}, got ${finalPathAfterFallback}`,
    });

    await page.locator("textarea").first().fill("What should we prioritize this week for content performance?");
    const repResponse = await Promise.all([
      page
        .waitForResponse(
          (res) =>
            res.url().includes("/functions/v1/ai-rep-chat") &&
            [200, 400, 401, 403, 422, 429, 500].includes(res.status()),
          { timeout: 30000 },
        )
        .catch(() => null),
      page.getByRole("button", { name: /^Send$/ }).click(),
    ]).then((r) => r[0]);

    await page.waitForTimeout(3000);
    const sendShot = path.join(screenshotsRoot, "06_portal_ai_assistant_after_send.png");
    await page.screenshot({ path: sendShot, fullPage: true });
    pushStep(steps, {
      step: "portal_ai:send_message",
      ok: Boolean(repResponse && repResponse.status() === 200),
      url: page.url(),
      screenshot: sendShot,
      note: repResponse ? `ai-rep-chat status=${repResponse.status()}` : "ai-rep-chat response missing",
    });
  } catch (error) {
    const shot = path.join(screenshotsRoot, "portal_runner_error.png");
    try {
      await page.screenshot({ path: shot, fullPage: true });
    } catch {
      // no-op
    }
    pushStep(steps, {
      step: "portal_ai:runner_error",
      ok: false,
      url: page.url(),
      screenshot: shot,
      error: String(error),
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_AI_SURFACES_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_ai_surfaces_2026-03-07");
  const screenshotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const runAt = new Date().toISOString();
  const fixture = await provisionFixture(supabaseUrl, serviceRoleKey);
  const steps = [];
  const consoleErrors = [];
  const requestFailures = [];

  await runOwnerAdminFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures });
  await runMemberGuardFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures });
  await runPortalAssistantFlow({ baseUrl, fixture, screenshotsRoot, steps, consoleErrors, requestFailures });

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

  fs.writeFileSync(path.join(logsRoot, "wf_ai_surfaces_summary.json"), JSON.stringify(summary, null, 2));
  const md = [
    "# WF AI Surfaces E2E Summary",
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
  fs.writeFileSync(path.join(notesRoot, "wf_ai_surfaces_summary.md"), md);

  console.log(
    `wf_ai_surfaces_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}`,
  );
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_ai_surfaces_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
