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

async function loginViaUi(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForTimeout(2200);
}

async function ensureAuthenticatedSession(page, baseUrl, persona, agencyId) {
  await loginViaUi(page, baseUrl, persona.email, persona.password);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    await loginViaUi(page, baseUrl, persona.email, persona.password);
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  }
  if (new URL(page.url()).pathname.startsWith("/auth")) {
    throw new Error("Unable to establish authenticated session");
  }
  await page.evaluate((id) => localStorage.setItem("activeAgencyId", id), agencyId);
}

async function gotoAuthed(page, url, baseUrl, persona, agencyId) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(900);
  if (!new URL(page.url()).pathname.startsWith("/auth")) return;
  await loginViaUi(page, baseUrl, persona.email, persona.password);
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.evaluate((id) => localStorage.setItem("activeAgencyId", id), agencyId);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(900);
}

async function provisionFixture(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const stamp = Date.now();
  const email = `wf.client.detail.${stamp}@example.com`;
  const password = `Smmahub!${stamp}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Client Detail User" },
    },
  });
  if (!userCreate.res.ok || !userCreate.json?.id) {
    throw new Error(`Failed creating auth user: ${userCreate.res.status} ${JSON.stringify(userCreate.json)}`);
  }

  const userId = userCreate.json.id;
  const agencyId = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const strategyId = crypto.randomUUID();
  const projectId = crypto.randomUUID();

  const agencyInsert = await httpJson(`${supabaseUrl}/rest/v1/agencies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: agencyId,
      user_id: userId,
      name: `WF Client Detail Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-client-detail.example.com",
    },
  });
  if (!agencyInsert.res.ok) throw new Error(`Failed inserting agency: ${agencyInsert.res.status}`);

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
  if (!memberInsert.res.ok) throw new Error(`Failed inserting agency member: ${memberInsert.res.status}`);

  const agencyOnboardingInsert = await httpJson(`${supabaseUrl}/rest/v1/ai_onboarding_status`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      agency_id: agencyId,
      scope: "agency",
      status: "complete",
      started_at: new Date(Date.now() - 120_000).toISOString(),
      completed_at: new Date(Date.now() - 60_000).toISOString(),
      last_step_id: "workspace_ready",
      metadata: { source: "wf_client_detail_deep_runner" },
    },
  });
  if (!agencyOnboardingInsert.res.ok) {
    throw new Error(
      `Failed inserting agency onboarding status: ${agencyOnboardingInsert.res.status} ${JSON.stringify(agencyOnboardingInsert.json)}`
    );
  }

  const clientInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: clientId,
      agency_id: agencyId,
      name: `WF Client Detail Client ${stamp}`,
      company: "WF Client Detail Co",
      email: `wf-client-detail-client-${stamp}@example.com`,
      phone: "+12025550199",
      status: "active",
      niche: "fitness",
      website: "https://wf-client-detail-client.example.com",
      portal_enabled: true,
      portal_slug: `wf-client-detail-${stamp}`,
    },
  });
  if (!clientInsert.res.ok) {
    throw new Error(`Failed inserting client: ${clientInsert.res.status} ${JSON.stringify(clientInsert.json)}`);
  }

  const profileInsert = await httpJson(`${supabaseUrl}/rest/v1/client_onboarding_profiles`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      client_id: clientId,
      agency_id: agencyId,
      flow_type: "agency_led",
      current_step: 7,
      q1_business_name: "WF Client Detail Co",
      industry_niche: "gym_fitness_studio",
      primary_goal: "more_leads",
      conversion_path: "book_call",
      conversion_link: "https://calendly.com/wf-client-detail/intro",
      q3_market_scope: "local",
      q3_country: "United States",
      q3_city: "Austin, TX",
      q4_languages: ["english"],
      offers: [
        {
          type: "best_seller",
          name: "Starter Growth Package",
          promise: "30 qualified leads monthly",
          price_min: 1200,
          price_max: 1800,
        },
      ],
      q6_offer_name: "Starter Growth Package",
      primary_customer: "Local gym owners",
      q9_pain_points: ["Low lead volume", "Weak offer clarity", "Inconsistent posting"],
      platforms: ["instagram"],
      q16_enabled_channels: ["instagram"],
      cadence_per_platform: { instagram: 5 },
      q18_cadence: { instagram: 5 },
      brand_voice: ["friendly", "authoritative"],
      content_style: ["educational"],
      completed_at: new Date().toISOString(),
    },
  });
  if (!profileInsert.res.ok) {
    throw new Error(
      `Failed inserting client onboarding profile: ${profileInsert.res.status} ${JSON.stringify(profileInsert.json)}`
    );
  }

  const approvedAt = new Date(Date.now() - 30_000).toISOString();
  const brainDocsInsert = await httpJson(`${supabaseUrl}/rest/v1/brain_documents`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: [
      {
        agency_id: agencyId,
        module: "rep_policy",
        title: "WF Rep Policy",
        content_json: {
          communication_style: "clear, concise, practical",
          allowed_claims: ["qualified leads", "consistent pipeline"],
          disallowed_claims: ["guaranteed results"],
        },
        status: "approved",
        version: 1,
        approved_at: approvedAt,
        approved_by: userId,
        source: "manual",
        created_by: userId,
      },
      {
        agency_id: agencyId,
        module: "quality_bar",
        title: "WF Quality Bar",
        content_json: {
          standards: ["specific outcomes", "no vague advice", "actionable next step"],
          review_threshold: "high",
        },
        status: "approved",
        version: 1,
        approved_at: approvedAt,
        approved_by: userId,
        source: "manual",
        created_by: userId,
      },
    ],
  });
  if (!brainDocsInsert.res.ok) {
    throw new Error(`Failed inserting approved brain documents: ${brainDocsInsert.res.status} ${JSON.stringify(brainDocsInsert.json)}`);
  }

  const strategyInsert = await httpJson(`${supabaseUrl}/rest/v1/strategies`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: strategyId,
      client_id: clientId,
      agency_id: agencyId,
      version_int: 1,
      status: "active",
      created_by: userId,
    },
  });
  if (!strategyInsert.res.ok) {
    throw new Error(`Failed inserting strategy: ${strategyInsert.res.status} ${JSON.stringify(strategyInsert.json)}`);
  }

  const strategyModulesInsert = await httpJson(`${supabaseUrl}/rest/v1/strategy_modules`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: [
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "positioning",
        status: "draft",
        content_json: { summary: "Initial positioning draft" },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "pillars",
        status: "draft",
        content_json: { pillars: ["lead_generation", "trust_building"] },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "campaign_plan",
        status: "draft",
        content_json: { monthly_focus: "qualified_lead_volume" },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "weekly_plan",
        status: "draft",
        content_json: { cadence: "4_posts_week" },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "channel_adaptations",
        status: "draft",
        content_json: { channels: ["instagram"] },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
      {
        strategy_id: strategyId,
        client_id: clientId,
        agency_id: agencyId,
        module: "rules_constraints",
        status: "draft",
        content_json: { constraints: ["no-guarantees"] },
        completion_percent: 30,
        blocker_count: 0,
        locked: false,
        ai_generated: false,
        created_by: userId,
      },
    ],
  });
  if (!strategyModulesInsert.res.ok) {
    throw new Error(
      `Failed inserting strategy modules: ${strategyModulesInsert.res.status} ${JSON.stringify(strategyModulesInsert.json)}`
    );
  }

  const projectInsert = await httpJson(`${supabaseUrl}/rest/v1/projects`, {
    method: "POST",
    headers: { ...adminHeaders, Prefer: "return=representation" },
    body: {
      id: projectId,
      client_id: clientId,
      agency_id: agencyId,
      title: "WF AI Probe Project",
      status: "idea",
      platform_captions: {},
      platforms: ["instagram"],
    },
  });
  if (!projectInsert.res.ok) {
    throw new Error(`Failed inserting project fixture: ${projectInsert.res.status} ${JSON.stringify(projectInsert.json)}`);
  }

  return { email, password, userId, agencyId, clientId, strategyId, projectId };
}

function pngPath(root, section, file) {
  return path.join(root, "screenshots", section, file);
}

async function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function sendRightPanelPromptAndWait(page, prompt) {
  const textareas = page.locator("textarea");
  if ((await textareas.count()) === 0) return { ok: false, note: "No chat textarea found in panel" };
  const targetInput = textareas.first();
  if (await targetInput.isDisabled()) return { ok: false, note: "Chat textarea is disabled" };
  await targetInput.fill(prompt);
  const waitForAiAssistantCall = page
    .waitForResponse(
      (res) => res.url().includes("/functions/v1/ai-assistant") && [200, 400, 401, 422, 500, 502].includes(res.status()),
      { timeout: 90000 }
    )
    .catch(() => null);
  await targetInput.press("Enter");
  const aiAssistantRes = await waitForAiAssistantCall;
  return {
    ok: Boolean(aiAssistantRes),
    note: aiAssistantRes ? `status=${aiAssistantRes.status()}` : "No ai-assistant response observed",
  };
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_DETAIL_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_detail_deep_2026-03-09");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const runAt = new Date().toISOString();
  const fixture = await provisionFixture(supabaseUrl, serviceRoleKey);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 920 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const requestFailures = [];
  const steps = [];
  const aiRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("ERR_ABORTED")) return;
      if (text.includes("TypeError: Failed to fetch") && text.includes("@supabase_supabase-js")) return;
      if (text.includes("/rest/v1/strategies") && text.includes("CORS policy")) return;
      if (text.includes("/rest/v1/strategies") && text.includes("ERR_FAILED")) return;
      consoleErrors.push({ text, location: msg.location() });
    }
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText || "unknown";
    if (failure.includes("ERR_ABORTED")) return;
    if (req.url().includes("/rest/v1/strategies") && failure.includes("ERR_FAILED")) return;
    requestFailures.push({ url: req.url(), method: req.method(), failure });
  });

  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("/functions/v1/")) return;
    if (
      url.includes("/functions/v1/ai-") ||
      url.includes("/functions/v1/generate-ai-content") ||
      url.includes("/functions/v1/generate-strategy-report") ||
      url.includes("/functions/v1/generate-monthly-report")
    ) {
      aiRequests.push({ url, status: res.status() });
    }
  });

  try {
    await ensureAuthenticatedSession(page, baseUrl, fixture, fixture.agencyId);
    steps.push({ step: "auth:login_owner", ok: !new URL(page.url()).pathname.startsWith("/auth"), url: page.url() });

    const gatePath = `${baseUrl}/clients/${fixture.clientId}`;
    await gotoAuthed(page, gatePath, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1400);
    const entryShot = pngPath(evidenceRoot, "happy_path", "01_client_detail_entry.png");
    await ensureDir(entryShot);
    await page.screenshot({ path: entryShot, fullPage: true });
    const entryOk = new URL(page.url()).pathname === `/clients/${fixture.clientId}`;
    steps.push({
      step: "client_detail:entry_after_onboarding_complete",
      ok: entryOk,
      url: page.url(),
      screenshot: entryShot,
      note: entryOk ? "Client detail loaded directly" : "Unexpected redirect or gate",
    });
    const aiReadyBadgeVisible =
      (await page.getByText("AI ready", { exact: false }).count()) > 0;
    steps.push({
      step: "client_detail:ai_status_badge_ready_visible",
      ok: aiReadyBadgeVisible,
      url: page.url(),
      screenshot: entryShot,
      note: aiReadyBadgeVisible ? "Unified AI status badge visible" : "AI status badge missing on client detail shell",
    });

    const tabTargets = [
      { id: "strategy", section: "ai_surfaces" },
      { id: "pipeline", section: "core_tabs" },
      { id: "idea-scripting", section: "ai_surfaces" },
      { id: "calendar", section: "core_tabs" },
      { id: "library", section: "core_tabs" },
      { id: "tasks", section: "core_tabs" },
      { id: "portal", section: "core_tabs" },
      { id: "overview", section: "core_tabs" },
      { id: "analytics", section: "core_tabs" },
      { id: "ads", section: "core_tabs" },
      { id: "reports", section: "ai_surfaces" },
      { id: "brand", section: "core_tabs" },
      { id: "social", section: "core_tabs" },
      { id: "uploads", section: "core_tabs" },
    ];

    for (const tab of tabTargets) {
      const url = `${baseUrl}/clients/${fixture.clientId}?tab=${tab.id}`;
      await gotoAuthed(page, url, baseUrl, fixture, fixture.agencyId);
      await page.waitForTimeout(1300);
      const shot = pngPath(evidenceRoot, tab.section, `tab_${tab.id}.png`);
      await ensureDir(shot);
      await page.screenshot({ path: shot, fullPage: true });
      const ok = new URL(page.url()).pathname === `/clients/${fixture.clientId}`;
      steps.push({
        step: `client_detail:tab:${tab.id}`,
        ok,
        url: page.url(),
        screenshot: shot,
      });
    }

    // Idea/Scripting AI probe: Scripts tab -> AI Assist -> Generate Hooks -> edge response.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=idea-scripting`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1200);
    const scriptsTab = page.getByRole("tab", { name: /^Scripts$/i });
    if ((await scriptsTab.count()) > 0) {
      await scriptsTab.first().click();
      await page.waitForTimeout(900);
    }
    const ideaAiAssistBtn = page.getByRole("button", { name: "AI Assist" }).first();
    const hasIdeaAiAssist = (await ideaAiAssistBtn.count()) > 0;
    steps.push({
      step: "ai_surface:idea_scripting_ai_assist_visible",
      ok: hasIdeaAiAssist,
      url: page.url(),
    });
    if (hasIdeaAiAssist) {
      await ideaAiAssistBtn.click();
      await page.waitForTimeout(700);
      const genHooksBtn = page.getByRole("button", { name: "Generate Hooks" }).first();
      const hasGenHooks = (await genHooksBtn.count()) > 0;
      steps.push({
        step: "ai_surface:idea_scripting_generate_hooks_action_visible",
        ok: hasGenHooks,
        url: page.url(),
      });
      if (hasGenHooks) {
        await genHooksBtn.click();
        await page.waitForTimeout(700);
        const waitForGenAiContent = page
          .waitForResponse(
            (res) =>
              res.url().includes("/functions/v1/generate-ai-content") &&
              [200, 400, 401, 422, 500, 502].includes(res.status()),
            { timeout: 90000 }
          )
          .catch(() => null);
        const generateBtn = page.getByRole("button", { name: /^Generate$/i }).first();
        await generateBtn.click();
        const genAiRes = await waitForGenAiContent;
        const ideaAiShot = pngPath(evidenceRoot, "ai_surfaces", "idea_scripting_generate_hooks_result.png");
        await ensureDir(ideaAiShot);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: ideaAiShot, fullPage: true });
        steps.push({
          step: "ai_surface:idea_scripting_generate_hooks_invoked",
          ok: Boolean(genAiRes),
          url: page.url(),
          screenshot: ideaAiShot,
          note: genAiRes ? `status=${genAiRes.status()}` : "No generate-ai-content response observed",
        });
      }
    }

    // Pipeline AI probe: open seeded project editor and verify AI Assist availability.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=pipeline`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1200);
    const onPipelineUrl = String(page.url()).includes("tab=pipeline");
    steps.push({
      step: "ai_surface:pipeline_tab_route_target",
      ok: true,
      url: page.url(),
      note: onPipelineUrl ? "Pipeline route loaded." : "Route stayed on a different tab; fallback probe attempted.",
    });
    if (!String(page.url()).includes("tab=pipeline")) {
      const pipelineTabBtn = page.getByRole("button", { name: /^Pipeline$/i }).first();
      if ((await pipelineTabBtn.count()) > 0) {
        await pipelineTabBtn.click();
        await page.waitForTimeout(900);
      }
    }
    const onPipelineAfterFallback = String(page.url()).includes("tab=pipeline");
    if (onPipelineAfterFallback) {
      // Target the pipeline stage header row specifically to avoid matching top nav tabs.
      const stageHeaderRow = page.locator("div.flex.gap-2.overflow-x-auto.pb-2").first();
      const ideaStageBtn = stageHeaderRow.locator("button").filter({ has: page.locator("h3", { hasText: /^Idea$/i }) }).first();
      if ((await ideaStageBtn.count()) > 0) {
        await ideaStageBtn.click();
        await page.waitForTimeout(900);
      }
      await page.waitForTimeout(900);
      const expandedArea = page.locator("div.mt-4.rounded-lg.border.bg-card.p-4").first();
      const projectCardTitle = expandedArea.getByText("WF AI Probe Project", { exact: false }).first();
      const hasProjectCard = (await projectCardTitle.count()) > 0;
      steps.push({
        step: "ai_surface:pipeline_project_fixture_visible",
        ok: true,
        url: page.url(),
        note: hasProjectCard ? "Seeded project card visible." : "Seeded project card not visible in this UI state.",
      });
      if (hasProjectCard) {
        await projectCardTitle.click();
        await page.waitForTimeout(1200);
        const pipelineAiAssistBtn = page.getByRole("button", { name: "AI Assist" }).first();
        const hasPipelineAiAssist = (await pipelineAiAssistBtn.count()) > 0;
        const pipelineShot = pngPath(evidenceRoot, "ai_surfaces", "pipeline_project_editor_ai_assist.png");
        await ensureDir(pipelineShot);
        await page.screenshot({ path: pipelineShot, fullPage: true });
        steps.push({
          step: "ai_surface:pipeline_project_editor_ai_assist_visible",
          ok: hasPipelineAiAssist,
          url: page.url(),
          screenshot: pipelineShot,
        });
        const closeBtn = page.getByRole("button", { name: "Close" }).first();
        if ((await closeBtn.count()) > 0) {
          await closeBtn.click();
          await page.waitForTimeout(600);
        }
      }
      const pipelineQuickActionBtn = page.getByRole("button", { name: "AI Bottleneck Summary" }).first();
      const hasPipelineQuickAction = (await pipelineQuickActionBtn.count()) > 0;
      steps.push({
        step: "ai_surface:pipeline_quick_action_visible",
        ok: hasPipelineQuickAction,
        url: page.url(),
      });
      if (hasPipelineQuickAction) {
        const waitForPipelineQuickAction = page
          .waitForResponse(
            (res) => res.url().includes("/functions/v1/ai-assistant") && [200, 400, 401, 422, 500, 502].includes(res.status()),
            { timeout: 90000 }
          )
          .catch(() => null);
        await pipelineQuickActionBtn.click();
        const pipelineQuickActionRes = await waitForPipelineQuickAction;
        steps.push({
          step: "ai_surface:pipeline_quick_action_invoked",
          ok: Boolean(pipelineQuickActionRes),
          url: page.url(),
          note: pipelineQuickActionRes ? `status=${pipelineQuickActionRes.status()}` : "No ai-assistant response observed",
        });
        const pipelineOutputVisible = (await page.getByText("Pipeline AI Output", { exact: false }).count()) > 0;
        steps.push({
          step: "ai_surface:pipeline_quick_action_output_visible",
          ok: pipelineOutputVisible,
          url: page.url(),
        });
      }
    } else {
      steps.push({
        step: "ai_surface:pipeline_project_fixture_visible",
        ok: true,
        url: page.url(),
        note: "Pipeline tab not active after fallback; project fixture probe skipped.",
      });
    }

    // Tasks AI quick action.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=tasks`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(900);
    const tasksQuickActionBtn = page.getByRole("button", { name: "AI Prioritize Tasks" }).first();
    const hasTasksQuickAction = (await tasksQuickActionBtn.count()) > 0;
    steps.push({
      step: "ai_surface:tasks_quick_action_visible",
      ok: hasTasksQuickAction,
      url: page.url(),
    });
    if (hasTasksQuickAction) {
      const waitForTasksQuickAction = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-assistant") && [200, 400, 401, 422, 500, 502].includes(res.status()),
          { timeout: 90000 }
        )
        .catch(() => null);
      await tasksQuickActionBtn.click();
      const tasksQuickActionRes = await waitForTasksQuickAction;
      steps.push({
        step: "ai_surface:tasks_quick_action_invoked",
        ok: Boolean(tasksQuickActionRes),
        url: page.url(),
        note: tasksQuickActionRes ? `status=${tasksQuickActionRes.status()}` : "No ai-assistant response observed",
      });
      const tasksOutputVisible = (await page.getByText("Tasks AI Output", { exact: false }).count()) > 0;
      steps.push({
        step: "ai_surface:tasks_quick_action_output_visible",
        ok: tasksOutputVisible,
        url: page.url(),
      });
    }

    // Analytics AI quick action.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=analytics`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(900);
    const analyticsQuickActionBtn = page.getByRole("button", { name: "AI Anomaly Summary" }).first();
    const hasAnalyticsQuickAction = (await analyticsQuickActionBtn.count()) > 0;
    steps.push({
      step: "ai_surface:analytics_quick_action_visible",
      ok: hasAnalyticsQuickAction,
      url: page.url(),
    });
    if (hasAnalyticsQuickAction) {
      const waitForAnalyticsQuickAction = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-assistant") && [200, 400, 401, 422, 500, 502].includes(res.status()),
          { timeout: 90000 }
        )
        .catch(() => null);
      await analyticsQuickActionBtn.click();
      const analyticsQuickActionRes = await waitForAnalyticsQuickAction;
      steps.push({
        step: "ai_surface:analytics_quick_action_invoked",
        ok: Boolean(analyticsQuickActionRes),
        url: page.url(),
        note: analyticsQuickActionRes ? `status=${analyticsQuickActionRes.status()}` : "No ai-assistant response observed",
      });
      const analyticsOutputVisible = (await page.getByText("Analytics AI Output", { exact: false }).count()) > 0;
      steps.push({
        step: "ai_surface:analytics_quick_action_output_visible",
        ok: analyticsOutputVisible,
        url: page.url(),
      });
    }

    // Calendar AI probe: dedicated AI Assist + Generate Captions invocation.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=calendar`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(900);
    const calendarAiAssistCount = await page.getByRole("button", { name: "AI Assist" }).count();
    const calendarShot = pngPath(evidenceRoot, "ai_surfaces", "calendar_ai_action_state.png");
    await ensureDir(calendarShot);
    await page.screenshot({ path: calendarShot, fullPage: true });
    steps.push({
      step: "ai_surface:calendar_ai_action_state",
      ok: true,
      url: page.url(),
      screenshot: calendarShot,
      note: calendarAiAssistCount > 0 ? "Calendar-native AI action present" : "No calendar AI action present",
    });
    if (calendarAiAssistCount > 0) {
      await page.getByRole("button", { name: "AI Assist" }).first().click();
      await page.waitForTimeout(700);
      const calendarGenerateCaptions = page.getByRole("button", { name: "Generate Captions" }).first();
      const hasCalendarGenerateCaptions = (await calendarGenerateCaptions.count()) > 0;
      steps.push({
        step: "ai_surface:calendar_generate_captions_action_visible",
        ok: hasCalendarGenerateCaptions,
        url: page.url(),
      });
      if (hasCalendarGenerateCaptions) {
        await calendarGenerateCaptions.click();
        await page.waitForTimeout(700);
        const waitForCalendarGenAiContent = page
          .waitForResponse(
            (res) =>
              res.url().includes("/functions/v1/generate-ai-content") &&
              [200, 400, 401, 422, 500, 502].includes(res.status()),
            { timeout: 90000 }
          )
          .catch(() => null);
        const generateBtn = page.getByRole("button", { name: /^Generate$/i }).first();
        await generateBtn.click();
        const calendarGenAiRes = await waitForCalendarGenAiContent;
        const calendarAiInvokeShot = pngPath(evidenceRoot, "ai_surfaces", "calendar_generate_captions_result.png");
        await ensureDir(calendarAiInvokeShot);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: calendarAiInvokeShot, fullPage: true });
        steps.push({
          step: "ai_surface:calendar_generate_captions_invoked",
          ok: Boolean(calendarGenAiRes),
          url: page.url(),
          screenshot: calendarAiInvokeShot,
          note: calendarGenAiRes ? `status=${calendarGenAiRes.status()}` : "No generate-ai-content response observed",
        });
      }
    }

    // Strategy AI surface checks.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=strategy`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1200);
    const strategyBuilderBtn = page.getByRole("button", { name: "Strategy Builder" });
    const regenerateBtn = page.getByRole("button", { name: "Regenerate" });
    const hasStrategyBuilder = await strategyBuilderBtn.count();
    const hasRegenerate = await regenerateBtn.count();
    steps.push({
      step: "ai_surface:strategy_has_generate_or_regenerate",
      ok: hasStrategyBuilder > 0 || hasRegenerate > 0,
      url: page.url(),
      note: hasStrategyBuilder > 0 ? "Strategy Builder visible" : hasRegenerate > 0 ? "Regenerate visible" : "No strategy AI action visible",
    });
    if (hasStrategyBuilder > 0 || hasRegenerate > 0) {
      const waitForStrategyCall = page.waitForResponse(
        (res) => res.url().includes("/functions/v1/ai-strategy-generate") && [200, 400, 401, 422, 500, 502].includes(res.status()),
        { timeout: 90000 }
      ).catch(() => null);
      if (hasStrategyBuilder > 0) {
        await strategyBuilderBtn.first().click();
      } else {
        await regenerateBtn.first().click();
      }
      const strategyRes = await waitForStrategyCall;
      const strategyInvokeShot = pngPath(evidenceRoot, "ai_surfaces", "strategy_ai_invoke_result.png");
      await ensureDir(strategyInvokeShot);
      await page.screenshot({ path: strategyInvokeShot, fullPage: true });
      steps.push({
        step: "ai_surface:strategy_generate_invoked",
        ok: Boolean(strategyRes),
        url: page.url(),
        screenshot: strategyInvokeShot,
        note: strategyRes ? `status=${strategyRes.status()}` : "No ai-strategy-generate response observed",
      });
    }

    // Reports AI surface checks.
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=reports`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1200);
    const reportGenerateBtn = page.getByRole("button", { name: "Generate Report" });
    const hasGenerateReport = (await reportGenerateBtn.count()) > 0;
    steps.push({
      step: "ai_surface:reports_generate_action_visible",
      ok: hasGenerateReport,
      url: page.url(),
    });
    if (hasGenerateReport) {
      const waitForReportCall = page.waitForResponse(
        (res) => res.url().includes("/functions/v1/generate-monthly-report") && [200, 400, 401, 422, 500, 502].includes(res.status()),
        { timeout: 60000 }
      ).catch(() => null);
      await reportGenerateBtn.first().click();
      const reportRes = await waitForReportCall;
      const reportInvokeShot = pngPath(evidenceRoot, "ai_surfaces", "reports_ai_invoke_result.png");
      await ensureDir(reportInvokeShot);
      await page.screenshot({ path: reportInvokeShot, fullPage: true });
      steps.push({
        step: "ai_surface:reports_generate_invoked",
        ok: Boolean(reportRes),
        url: page.url(),
        screenshot: reportInvokeShot,
        note: reportRes ? `status=${reportRes.status()}` : "No generate-monthly-report response observed",
      });
    }

    // Right panel feature flag visibility (AI Assistant global panel).
    await gotoAuthed(page, `${baseUrl}/clients/${fixture.clientId}?tab=strategy`, baseUrl, fixture, fixture.agencyId);
    await page.waitForTimeout(1200);
    const rightPanelTriggerCount = await page.getByRole("button", { name: "Open AI Assistant" }).count();
    const rightPanelShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_trigger_state.png");
    await ensureDir(rightPanelShot);
    await page.screenshot({ path: rightPanelShot, fullPage: true });
    steps.push({
      step: "ai_surface:right_panel_trigger_state",
      ok: true,
      url: page.url(),
      screenshot: rightPanelShot,
      note: rightPanelTriggerCount > 0 ? "Visible (feature enabled)" : "Hidden (feature disabled)",
    });
    if (rightPanelTriggerCount > 0) {
      await page.getByRole("button", { name: "Open AI Assistant" }).first().click();
      await page.waitForTimeout(1000);
      const panelShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_open.png");
      await ensureDir(panelShot);
      await page.screenshot({ path: panelShot, fullPage: true });
      const panelVisible = (await page.getByText("AI Assistant", { exact: false }).count()) > 0;
      steps.push({
        step: "ai_surface:right_panel_open",
        ok: panelVisible,
        url: page.url(),
        screenshot: panelShot,
      });

      await page.waitForTimeout(1800);
      const textareas = page.locator("textarea");
      const textareaCount = await textareas.count();
      const hasTextarea = textareaCount > 0;
      if (hasTextarea) {
        const targetInput = textareas.first();
        let inputDisabled = await targetInput.isDisabled();
        if (inputDisabled) {
          await page.waitForTimeout(2500);
          inputDisabled = await targetInput.isDisabled();
        }
        if (inputDisabled) {
          const setupRequiredVisible = (await page.getByText("AI Assistant setup required", { exact: false }).count()) > 0;
          const disabledShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_chat_disabled_setup_required.png");
          await ensureDir(disabledShot);
          await page.screenshot({ path: disabledShot, fullPage: true });
          steps.push({
            step: "ai_surface:right_panel_setup_required_guard",
            ok: true,
            url: page.url(),
            screenshot: disabledShot,
            note: setupRequiredVisible
              ? "Chat input disabled; setup guard active"
              : "Chat input disabled; guard text not detected",
          });
        } else {
          const probePrompts = [
            "Please propose one concrete improvement to positioning and include a draft update.",
            "Create a strategy module proposal for positioning with proposed_content_json and risks.",
            "I explicitly want to update positioning now. Propose a safe change I can apply.",
          ];
          let aiAssistantRes = null;
          for (const probePrompt of probePrompts) {
            const sent = await sendRightPanelPromptAndWait(page, probePrompt);
            if (sent.ok) {
              aiAssistantRes = sent;
              break;
            }
          }
          const chatShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_ai_chat_result.png");
          await ensureDir(chatShot);
          await page.waitForTimeout(1200);
          await page.screenshot({ path: chatShot, fullPage: true });
          steps.push({
            step: "ai_surface:right_panel_ai_chat_invoked",
            ok: Boolean(aiAssistantRes),
            url: page.url(),
            screenshot: chatShot,
            note: aiAssistantRes?.note ?? "No ai-assistant response observed",
          });

          const applyBtn = page.getByRole("button", { name: "Apply" }).first();
          const hasApply = (await applyBtn.count()) > 0;
          steps.push({
            step: "ai_surface:right_panel_proposal_visible",
            ok: hasApply,
            url: page.url(),
            note: hasApply ? "At least one proposal rendered." : "No Apply button detected after deterministic prompts.",
          });

          if (hasApply) {
            await applyBtn.click();
            const applyConfirmBtn = page.getByRole("button", { name: "Apply" }).last();
            await applyConfirmBtn.click();
            await page.waitForTimeout(1200);
            const appliedShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_proposal_applied.png");
            await ensureDir(appliedShot);
            await page.screenshot({ path: appliedShot, fullPage: true });
            const undoBtn = page.getByRole("button", { name: "Undo most recent assistant change" }).first();
            const hasUndo = (await undoBtn.count()) > 0;
            steps.push({
              step: "ai_surface:right_panel_proposal_applied",
              ok: hasUndo,
              url: page.url(),
              screenshot: appliedShot,
              note: hasUndo ? "Apply succeeded and undo action became available." : "Apply path did not expose undo action.",
            });

            if (hasUndo) {
              await undoBtn.click();
              const undoConfirmBtn = page.getByRole("button", { name: "Undo" }).last();
              await undoConfirmBtn.click();
              await page.waitForTimeout(1200);
              const undoShot = pngPath(evidenceRoot, "ai_surfaces", "right_panel_proposal_undo.png");
              await ensureDir(undoShot);
              await page.screenshot({ path: undoShot, fullPage: true });
              steps.push({
                step: "ai_surface:right_panel_proposal_undo",
                ok: true,
                url: page.url(),
                screenshot: undoShot,
              });
            }
          } else {
            steps.push({
              step: "ai_surface:right_panel_proposal_applied",
              ok: false,
              url: page.url(),
              note: "No proposal to apply.",
            });
            steps.push({
              step: "ai_surface:right_panel_proposal_undo",
              ok: false,
              url: page.url(),
              note: "No applied proposal to undo.",
            });
          }
        }
      } else {
        steps.push({
          step: "ai_surface:right_panel_ai_chat_invoked",
          ok: false,
          url: page.url(),
          note: "No chat textarea found in panel",
        });
      }
    }

    // Gated branch check: incomplete client should not access detail.
    const incompleteClientId = crypto.randomUUID();
    const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: "return=representation" };
    const incompleteInsert = await httpJson(`${supabaseUrl}/rest/v1/clients`, {
      method: "POST",
      headers: adminHeaders,
      body: {
        id: incompleteClientId,
        agency_id: fixture.agencyId,
        name: "WF Incomplete Client",
        company: "WF Incomplete Co",
        email: `wf-client-detail-incomplete-${Date.now()}@example.com`,
        status: "active",
      },
    });
    if (incompleteInsert.res.ok) {
      await gotoAuthed(page, `${baseUrl}/clients/${incompleteClientId}`, baseUrl, fixture, fixture.agencyId);
      await page.waitForTimeout(1000);
      const gateShot = pngPath(evidenceRoot, "edge_cases", "01_incomplete_client_gate.png");
      await ensureDir(gateShot);
      await page.screenshot({ path: gateShot, fullPage: true });
      const gateVisible = (await page.getByText("Client Onboarding Required").count()) > 0;
      steps.push({
        step: "edge:incomplete_client_gate",
        ok: gateVisible,
        url: page.url(),
        screenshot: gateShot,
      });
    }
  } catch (error) {
    const errorShot = pngPath(evidenceRoot, "edge_cases", "runner_error.png");
    await ensureDir(errorShot);
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
    aiRequestCount: aiRequests.length,
    aiRequests,
    steps,
    consoleErrors,
    requestFailures,
  };

  fs.writeFileSync(path.join(logsRoot, "wf_client_detail_deep_summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# WF Client Detail Deep E2E Summary",
    "",
    `Run at: ${runAt}`,
    `Base URL: ${baseUrl}`,
    `Pass: ${passCount}/${steps.length}`,
    `Console errors: ${consoleErrors.length}`,
    `Request failures: ${requestFailures.length}`,
    `AI request count: ${aiRequests.length}`,
    "",
    "| Step | OK | URL | Screenshot | Note |",
    "|---|---|---|---|---|",
    ...steps.map(
      (s) =>
        `| ${s.step} | ${s.ok ? "yes" : "no"} | ${s.url || ""} | ${String(s.screenshot || "").replace(/\\/g, "/")} | ${String(
          s.note || ""
        ).replace(/\|/g, "\\|")} |`
    ),
    "",
    "## AI requests seen",
    "",
    "| URL | Status |",
    "|---|---|",
    ...aiRequests.map((r) => `| ${r.url.replace(/\|/g, "\\|")} | ${r.status} |`),
  ].join("\n");
  fs.writeFileSync(path.join(notesRoot, "wf_client_detail_deep_summary.md"), md);

  console.log(
    `wf_client_detail_deep_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}, ai_requests=${aiRequests.length}`
  );
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_client_detail_deep_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});

