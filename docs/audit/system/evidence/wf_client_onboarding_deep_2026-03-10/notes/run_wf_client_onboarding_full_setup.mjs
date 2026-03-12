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

async function provisionPersona(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const stamp = Date.now();
  const nonce = crypto.randomUUID().slice(0, 8);
  const email = `wf.client.full.${stamp}.${nonce}@example.com`;
  const password = `Smmahub!${stamp}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: { email, password, email_confirm: true, user_metadata: { full_name: "WF Client Full Setup User" } },
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
      name: `WF Client Full Setup Agency ${stamp}`,
      niche: "Marketing",
      website: "https://wf-client-full.example.com",
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
      metadata: { source: "wf_client_onboarding_full_runner" },
    },
  });
  if (!onboardingInsert.res.ok) throw new Error(`Failed inserting onboarding status: ${onboardingInsert.res.status} ${JSON.stringify(onboardingInsert.json)}`);

  return { email, password, userId, agencyId };
}

async function loginViaUi(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^Login$/i }).click();
  await page.waitForTimeout(2200);
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

function nowIso() {
  return new Date().toISOString();
}

const BANNED_VISIBLE_PHRASES = [
  "Captured. We are building a complete profile.",
  "resolver",
  "mapped draft",
  "internal task",
];

const ANSWER_PROFILES = {
  fitness: {
    label: "fitness",
    clientName: "WF Full Setup Fitness Client",
    company: "MyFitBody",
    answers: [
      "Business name: MyFitBody",
      "Industry / niche: gym_fitness_studio",
      "Primary goal: more_qualified_leads",
      "Conversion path: book_call",
      "Conversion link: https://myfitbody.com/book",
      "Core offer: 12-week body transformation coaching",
      "Ideal customer: Busy professionals age 28-45 | Budget: 1200 EUR/month | Goal: lose fat and build strength",
      "Top pain points: Inconsistent leads, Low booking rate, Weak follow-up",
      "Platforms: instagram, tiktok",
      "Formats: reels, stories, testimonials",
      "instagram: 5, tiktok: 3",
      "Brand voice: Confident, practical, motivating",
      "Content style: Educational with transformation proof",
    ],
  },
  medspa: {
    label: "medspa",
    clientName: "WF Full Setup MedSpa Client",
    company: "GlowLab Aesthetics",
    answers: [
      "Business name: GlowLab Aesthetics",
      "Industry / niche: gym_fitness_studio",
      "Primary goal: more_qualified_leads",
      "Conversion path: book_call",
      "Conversion link: https://glowlabaesthetics.com/book",
      "Core offer: 6-session skin rejuvenation package",
      "Ideal customer: Women age 30-55 | Budget: 2000 EUR/month | Goal: clearer skin and anti-aging support",
      "Top pain points: Last-minute cancellations, low repeat treatments, unclear treatment education",
      "Platforms: instagram, tiktok",
      "Formats: reels, stories, testimonials",
      "instagram: 4, tiktok: 3",
      "Brand voice: Confident, practical, motivating",
      "Content style: Educational with transformation proof",
    ],
  },
  realtor: {
    label: "realtor",
    clientName: "WF Full Setup Realty Client",
    company: "NorthCity Realty Group",
    answers: [
      "Business name: NorthCity Realty Group",
      "Industry / niche: gym_fitness_studio",
      "Primary goal: more_qualified_leads",
      "Conversion path: book_call",
      "Conversion link: https://northcityrealtygroup.com/book",
      "Core offer: Full-service home listing acceleration program",
      "Ideal customer: Homeowners age 35-65 | Budget: 3000 EUR/month | Goal: sell faster at better market price",
      "Top pain points: Unqualified inquiries, low listing visibility, delayed follow-up",
      "Platforms: instagram, tiktok",
      "Formats: reels, stories, testimonials",
      "instagram: 4, tiktok: 2",
      "Brand voice: Confident, practical, motivating",
      "Content style: Educational with transformation proof",
    ],
  },
};

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_CLIENT_ONBOARDING_BASE_URL || env.WF_BASE_URL || "http://localhost:8080";
  const requestedProfile = (env.WF_CLIENT_ONBOARDING_ANSWER_PROFILE || "fitness").toLowerCase();
  const profile = ANSWER_PROFILES[requestedProfile] || ANSWER_PROFILES.fitness;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10");
  const shotsRoot = path.join(evidenceRoot, "screenshots", "full_setup");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(shotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const persona = await provisionPersona(supabaseUrl, serviceRoleKey);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();

  const requestFailures = [];
  const steps = [];
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText || "unknown";
    if (failure.includes("ERR_ABORTED")) return;
    requestFailures.push({ url: req.url(), method: req.method(), failure });
  });

  let clientId = null;

  try {
    await ensureSession(page, baseUrl, persona);

    await page.goto(`${baseUrl}/clients`, { waitUntil: "networkidle", timeout: 45000 });
    const clientsShot = path.join(shotsRoot, "01_clients_tab.png");
    await page.screenshot({ path: clientsShot, fullPage: true });
    steps.push({ step: "clients_tab_open", ok: true, screenshot: clientsShot, at: nowIso() });

    const addButtons = [
      page.getByRole("button", { name: /Add New Client/i }).first(),
      page.getByRole("button", { name: /Add Client/i }).first(),
      page.getByRole("button", { name: /New Client/i }).first(),
    ];
    let addClicked = false;
    for (const btn of addButtons) {
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        addClicked = true;
        break;
      }
    }
    if (!addClicked) throw new Error("Could not find Add Client button in clients tab");

    const stamp = Date.now();
    await page.locator("#name").fill(`${profile.clientName} ${stamp}`);
    await page.locator("#company").fill(profile.company);
    await page.locator("#email").fill(`wf-full-setup-client-${stamp}@example.com`);
    await page.locator("#phone").fill("+12025550126");
    await page.getByRole("button", { name: /Create Client/i }).first().click();
    await page.waitForTimeout(2500);

    const onboardingUrl = page.url();
    const match = onboardingUrl.match(/\/onboarding\/client\/([a-f0-9-]+)/i);
    if (!match) throw new Error(`Expected onboarding redirect, got ${onboardingUrl}`);
    clientId = match[1];

    const entryShot = path.join(shotsRoot, "02_onboarding_entry.png");
    await page.screenshot({ path: entryShot, fullPage: true });
    steps.push({ step: "create_client_redirect_onboarding", ok: true, screenshot: entryShot, url: onboardingUrl, at: nowIso(), note: `clientId=${clientId}` });

    const answers = profile.answers;

    const waitForSendIdle = async () => {
      for (let i = 0; i < 40; i += 1) {
        const sendingVisible = await page.getByRole("button", { name: /^Sending$/i }).first().isVisible().catch(() => false);
        if (!sendingVisible) return;
        await page.waitForTimeout(250);
      }
    };

    for (let i = 0; i < answers.length; i += 1) {
      const applyBtn = page.getByRole("button", { name: /Save this answer|Apply mapped values/i }).first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(700);
      }

      await waitForSendIdle();
      const beforeAssistantCount = await page.locator("text=AI Assistant").count();
      const box = page.getByPlaceholder("Type your answer or ask for help...");
      await box.fill(answers[i]);
      await page.getByRole("button", { name: /^Send$/i }).first().click();
      await page.waitForTimeout(1200);

      await page
        .waitForFunction(
          (prev) => document.body.innerText.split("AI Assistant").length - 1 > prev || document.body.innerText.includes("Request failed"),
          beforeAssistantCount,
          { timeout: 15000 },
        )
        .catch(() => {});

      const requestFailedBanner = page.locator("text=Request failed. Please retry.").first();
      if (await requestFailedBanner.isVisible().catch(() => false)) {
        await waitForSendIdle();
        await page.getByRole("button", { name: /^Send$/i }).first().click().catch(() => {});
        await page.waitForTimeout(1000);
      }

      if (i === 0 || i === 5 || i === 10 || i === 12) {
        const shot = path.join(shotsRoot, `03_turn_${String(i + 1).padStart(2, "0")}.png`);
        await page.screenshot({ path: shot, fullPage: true });
      }

      const failed = await page.locator("text=Request failed. Please retry.").count();
      steps.push({ step: `turn_${i + 1}`, ok: failed === 0, at: nowIso(), note: failed === 0 ? "assistant responded" : "request failed" });
      if (failed > 0) break;
    }

    await page.waitForTimeout(1500);
    const finalShot = path.join(shotsRoot, "04_onboarding_after_full_answers.png");
    await page.screenshot({ path: finalShot, fullPage: true });

    const requiredText = (await page.locator("text=/Required\\s+\\d+\\/13/i").first().textContent().catch(() => null)) || null;
    const readinessLine = (await page.locator("text=/Readiness\\s*\\d+%/i").first().textContent().catch(() => null)) || null;

    steps.push({ step: "full_answer_batch_complete", ok: true, screenshot: finalShot, requiredText, readinessLine, at: nowIso() });

    const completionCta = page.getByRole("button", { name: /Open client workspace/i }).first();
    const completionCtaVisible = await completionCta.isVisible().catch(() => false);
    steps.push({
      step: "quality:completion_handoff_cta_visible",
      ok: completionCtaVisible,
      at: nowIso(),
      note: completionCtaVisible ? "completion CTA visible" : "completion CTA missing",
    });

    if (completionCtaVisible) {
      await completionCta.click();
      await page.waitForTimeout(1200);
    }
    const handoffPath = new URL(page.url()).pathname;
    const handoffShot = path.join(shotsRoot, "05_post_handoff_workspace.png");
    await page.screenshot({ path: handoffShot, fullPage: true });
    steps.push({
      step: "quality:completion_handoff_navigation",
      ok: handoffPath.startsWith(`/clients/${clientId}`),
      screenshot: handoffShot,
      at: nowIso(),
      note: handoffPath,
    });

    const uiText = (await page.locator("body").innerText().catch(() => "")) || "";
    const bannedHits = BANNED_VISIBLE_PHRASES.filter((phrase) => uiText.toLowerCase().includes(phrase.toLowerCase()));
    steps.push({
      step: "quality:premium_phrase_lint",
      ok: bannedHits.length === 0,
      at: nowIso(),
      note: bannedHits.length === 0 ? "no banned phrases found" : `found: ${bannedHits.join(" | ")}`,
    });

    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto(`${baseUrl}/onboarding/client/${clientId}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1000);
    const mobileShot = path.join(shotsRoot, "06_mobile_completion.png");
    await page.screenshot({ path: mobileShot, fullPage: true });
    const mobileComposerVisible = await page.getByPlaceholder("Type your answer or ask for help...").isVisible().catch(() => false);
    const mobileSendVisible = await page.getByRole("button", { name: /^Send$/i }).first().isVisible().catch(() => false);
    steps.push({
      step: "quality:mobile_composer_visible",
      ok: mobileComposerVisible && mobileSendVisible,
      screenshot: mobileShot,
      at: nowIso(),
      note: `composer=${mobileComposerVisible},send=${mobileSendVisible}`,
    });
    await page.setViewportSize({ width: 1536, height: 960 });

    const profileRes = await httpJson(`${supabaseUrl}/rest/v1/client_onboarding_profiles?client_id=eq.${clientId}&select=*`, {
      method: "GET",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });

    const row = Array.isArray(profileRes.json) ? profileRes.json[0] : null;
    const requiredFields = [
      "q1_business_name",
      "industry_niche",
      "primary_goal",
      "conversion_path",
      "conversion_link",
      "q6_offer_name",
      "primary_customer",
      "q9_pain_points",
      "platforms",
      "formats",
      "cadence_per_platform",
      "brand_voice",
      "content_style",
    ];
    const filled = row
      ? requiredFields.filter((k) => {
          const v = row[k];
          if (v === null || v === undefined) return false;
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === "object") return Object.keys(v).length > 0;
          return String(v).trim().length > 0;
        }).length
      : 0;

    const summary = {
      runAt: nowIso(),
      baseUrl,
      answerProfile: profile.label,
      persona,
      clientId,
      passCount: steps.filter((s) => s.ok).length,
      totalSteps: steps.length,
      requestFailureCount: requestFailures.length,
      ui: { requiredText, readinessLine },
      premium: {
        bannedPhrasesChecked: BANNED_VISIBLE_PHRASES,
        bannedPhrasesFound: bannedHits,
        completionHandoffVisible: completionCtaVisible,
      },
      storage: {
        profileFound: !!row,
        requiredFieldCount: requiredFields.length,
        requiredFieldFilled: filled,
        requiredFieldCoveragePct: Math.round((filled / requiredFields.length) * 100),
        row,
      },
      steps,
      requestFailures,
      screenshotsRoot: shotsRoot,
    };

    const summaryJsonPath = path.join(logsRoot, "wf_client_onboarding_full_setup_summary.json");
    fs.writeFileSync(summaryJsonPath, JSON.stringify(summary, null, 2));

    const md = `# WF Client Onboarding Full Setup Summary\n\nRun at: ${summary.runAt}\nBase URL: ${baseUrl}\nClient ID: ${clientId}\nPass: ${summary.passCount}/${summary.totalSteps}\nRequest failures: ${summary.requestFailureCount}\nUI Required text: ${requiredText ?? "n/a"}\nUI Readiness text: ${readinessLine ?? "n/a"}\nCompletion CTA visible: ${completionCtaVisible}\nPremium phrase lint: ${bannedHits.length === 0 ? "pass" : `fail (${bannedHits.join(" | ")})`}\nStored required field coverage: ${summary.storage.requiredFieldFilled}/${summary.storage.requiredFieldCount} (${summary.storage.requiredFieldCoveragePct}%)\nScreenshots: ${shotsRoot}\n`;
    const summaryMdPath = path.join(notesRoot, "wf_client_onboarding_full_setup_summary.md");
    fs.writeFileSync(summaryMdPath, md);

    console.log(`wf_client_onboarding_full_setup: ${summary.passCount}/${summary.totalSteps} steps passed, request_failures=${summary.requestFailureCount}, required_coverage=${summary.storage.requiredFieldCoveragePct}%`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("wf_client_onboarding_full_setup failed:", error);
  process.exit(1);
});
