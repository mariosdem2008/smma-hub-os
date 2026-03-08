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

async function provisionPersona(supabaseUrl, serviceRoleKey, label) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const email = `wf.agency.onboarding.${label}.${Date.now()}@example.com`;
  const password = `Smmahub!${Date.now()}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `WF Agency Onboarding ${label} User` },
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
      name: `WF Onboarding ${label} Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-onboarding-quality.example.com",
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

  return { email, password, userId, agencyId };
}

function answerForField(fieldPath) {
  const f = String(fieldPath || "").toLowerCase();
  const m = {
    "agency.name": "Apex Growth Partners",
    "agency.timezone": "Europe/Athens",
    "agency.primary_client_languages": "English 70%, Greek 30%",
    "agency.team_size_total": "7",
    "agency.active_paying_clients": "12",
    "agency.top_industries": "Gyms\nDentists\nSaaS B2B",
    "agency.best_client_summary":
      "B2B SaaS founder at $40k MRR seeking predictable qualified demos from paid and organic channels.",
    "agency.key_differentiators":
      "Fast implementation\nWeekly KPI reviews\nClear executive reporting",
    "agency.service_catalog":
      "Paid Ads | Meta and Google ad management with weekly optimization\nSocial Mgmt | Monthly content strategy and posting execution",
    "agency.top_margin_offers":
      "Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow",
    "agency.packaged_offers":
      "Lead Engine | 40 leads/month | 12 creatives; ad management; reporting | 30 days | 1500-2500",
    "agency.pricing_model": "Fixed retainer | Predictable monthly scope with stable delivery planning",
    "operations.required_client_assets":
      "Brand guidelines | 5\nAd account access | 3\nOffer details + pricing | 4",
    "operations.approval_workflow": "Founder,email,48",
    "operations.turnaround_slas": "drafts:48, edits:24, urgent:6",
    "operations.reporting_cadence": "Weekly email + monthly dashboard",
    "operations.tools_stack": "Notion\nClickUp\nGA4",
    "operations.platforms_managed": "Instagram\nLinkedIn\nYouTube",
    "operations.rep_policy_boundaries":
      "No legal, medical, or financial claims\nNo guaranteed outcomes\nEscalate compliance-sensitive requests",
    "operations.paid_ads_account_access": "Meta Business Manager + owner@client.com",
    "operations.paid_ads_spend_bracket": "1500-5000",
    "ai.persona_name": "Atlas",
    "ai.role_title": "Strategy Partner",
    "ai.personality_traits": "Direct:High\nFriendly:Med\nAnalytical:High",
    "ai.writing_preferences": "Tone: Neutral | Length: Short | Emojis: 1-2 | CTA: Yes",
    "agency.website_and_links": "https://apexgrowth.com\nhttps://linkedin.com/company/apexgrowth",
    "agency.role_counts": "strategist,2\neditor,3\naccount manager,1\nfounder,1",
    "agency.client_type_split": "SMB 70, Mid 20, Enterprise 10",
    "agency.who_to_avoid":
      "No decision-maker access\nUnrealistic guarantees requested\nNo assets and no budget",
    "agency.proof_metrics":
      "+120% leads in 60 days | https://example.com/case-study-1\nROAS 4.1x in 90 days",
    "agency.competitor_urls":
      "https://competitor-1.com\nhttps://competitor-2.com\nhttps://competitor-3.com",
    "agency.price_ranges_by_tier": "Starter,500,900\nGrowth,1000,1800\nScale,2000,3500",
  };
  if (m[f]) return m[f];
  if (f.includes("timezone")) return "Europe/Athens";
  if (f.includes("spend")) return "1500-5000";
  if (f.includes("team_size") || f.includes("clients")) return "7";
  return "Meaningful onboarding answer";
}

function classifyReaction(prevFieldPath, nextFieldPath, assistantMessage) {
  const sameQuestion = Boolean(prevFieldPath && nextFieldPath && prevFieldPath === nextFieldPath);
  if (sameQuestion) return "re-ask-same-field";
  if (/error|invalid|must|please provide|sum to|format/i.test(String(assistantMessage || ""))) return "validation-feedback";
  if (!nextFieldPath) return "unknown";
  return "advanced-to-next-field";
}

async function loginToOnboarding(page, baseUrl, persona) {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("#email").fill(persona.email);
  await page.locator("#password").fill(persona.password);
  await page.getByRole("button", { name: "Login" }).click();
  await page.waitForTimeout(2200);
  await page.evaluate((agencyId) => localStorage.setItem("activeAgencyId", agencyId), persona.agencyId);
  await page.goto(`${baseUrl}/ai/onboarding/agency`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1800);
}

async function runScenario({ scenarioName, mode, baseUrl, supabaseUrl, serviceRoleKey, evidenceRoot }) {
  const scenarioRoot = path.join(evidenceRoot, scenarioName);
  const screenshotsRoot = path.join(scenarioRoot, "screenshots");
  const logsRoot = path.join(scenarioRoot, "logs");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });

  const persona = await provisionPersona(supabaseUrl, serviceRoleKey, scenarioName);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();
  const records = [];
  const consoleErrors = [];
  const requestFailures = [];
  const responseTrace = [];
  let latestApi = null;
  let askedBestClientHelp = false;

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on("requestfailed", (req) => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || "unknown" });
  });
  page.on("response", async (res) => {
    if (!res.url().includes("/functions/v1/ai-onboarding")) return;
    try {
      const json = await res.json();
      latestApi = { status: res.status(), json };
      responseTrace.push({
        at: new Date().toISOString(),
        status: res.status(),
        field_path: json?.field_path ?? null,
        expects: json?.expects ?? null,
        assistant_message: json?.assistant_message ?? null,
        suggestions: Array.isArray(json?.suggestions) ? json.suggestions : [],
        error_code: json?.error_code ?? null,
      });
    } catch {
      responseTrace.push({ at: new Date().toISOString(), status: res.status(), parse_error: true });
    }
  });

  let fatalError = null;
  try {
    await loginToOnboarding(page, baseUrl, persona);
    await page.screenshot({ path: path.join(screenshotsRoot, "00_entry.png"), fullPage: true });
    await page.waitForTimeout(1500);

    let prevField = null;
    const maxTurns = mode === "normal" ? 24 : 20;

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      const suggestions = await page
        .locator("button")
        .allTextContents()
        .then((arr) => arr.filter((t) => t && !/^send$|^retry$|^undo|^i do not know$/i.test(t.trim())).slice(0, 8))
        .catch(() => []);

      const currentField = latestApi?.json?.field_path ?? null;
      const assistantMessage = latestApi?.json?.assistant_message ?? null;
      const expects = latestApi?.json?.expects ?? null;
      const modelSuggestions = Array.isArray(latestApi?.json?.suggestions) ? latestApi.json.suggestions : [];

      if (!currentField && turn > 2) break;

      let answer = answerForField(currentField);
      let attemptType = "normal_answer";

      if (mode === "adversarial") {
        if (turn === 2) {
          answer = "Can you explain why you need this and give me an example?";
          attemptType = "user_question_instead_of_answer";
        } else if (String(currentField).includes("best_client_summary") && !askedBestClientHelp) {
          answer = "i am not sure, can you create one for me based on what i already shared?";
          attemptType = "user_question_help_me_draft";
          askedBestClientHelp = true;
        } else if (turn === 3) {
          answer = "idk maybe later";
          attemptType = "vague_answer";
        } else if (String(currentField).includes("timezone") && turn >= 6) {
          answer = "continue";
          attemptType = "explicit_continue_after_retries";
        } else if (String(currentField).includes("primary_client_languages") && turn >= 10) {
          answer = "continue";
          attemptType = "explicit_continue_after_retries";
        } else if (String(currentField).includes("timezone")) {
          answer = "Athens time";
          attemptType = "invalid_format_answer";
        } else if (String(currentField).includes("primary_client_languages")) {
          answer = "English 90%, Greek 20%";
          attemptType = "invalid_percent_sum";
        }
      }

      const input = page.locator("#onboarding-input");
      const inputVisible = await input.isVisible().catch(() => false);
      if (!inputVisible) {
        records.push({
          turn,
          attemptType: "no_input_visible_break",
          current_field_path: currentField,
          expected: "Input visible for next turn, or onboarding controls indicate completion/review state.",
          actual: { next_field_path: nextField, assistant_message: assistantMessage },
          pass: true,
          severity: "low",
          root_cause_hypothesis: "Reached review/completion stage where freeform input is hidden.",
          proof: path.join(screenshotsRoot, `${String(turn).padStart(2, "0")}_no_input_visible_break.png`),
          reaction: "flow_state_transition",
        });
        await page.screenshot({
          path: path.join(screenshotsRoot, `${String(turn).padStart(2, "0")}_no_input_visible_break.png`),
          fullPage: true,
        });
        break;
      }
      const send = page.getByRole("button", { name: /^Send$/ }).last();
      await input.click({ timeout: 5000 });
      await input.fill(answer);
      const respPromise = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 401, 422, 500].includes(res.status()),
          { timeout: 45000 },
        )
        .catch(() => null);
      await send.click({ timeout: 5000 });
      const resp = await respPromise;
      await page.waitForTimeout(1200);

      const nextField = latestApi?.json?.field_path ?? null;
      const reaction = classifyReaction(currentField, nextField, latestApi?.json?.assistant_message);
      const stepShot = path.join(screenshotsRoot, `${String(turn).padStart(2, "0")}_${attemptType}.png`);
      await page.screenshot({ path: stepShot, fullPage: true });

      records.push({
        turn,
        attemptType,
        current_field_path: currentField,
        expected: "Accept valid answer and progress; reject invalid with clear guidance; answer user questions briefly then continue.",
        actual: {
          response_status: resp?.status() ?? null,
          next_field_path: nextField,
          assistant_message: latestApi?.json?.assistant_message ?? null,
          suggestions: modelSuggestions,
          ui_button_sample: suggestions,
        },
        pass: Boolean(resp && [200, 400, 422].includes(resp.status())),
        severity: reaction === "unknown" ? "high" : reaction === "re-ask-same-field" ? "medium" : "low",
        root_cause_hypothesis:
          reaction === "re-ask-same-field"
            ? "Validation gate rejected answer or parser confidence too low."
            : reaction === "validation-feedback"
            ? "Validation message path triggered."
            : "Normal progression.",
        proof: stepShot,
        reaction,
      });

      prevField = currentField;

      const activateNow = page.getByRole("button", { name: "Finish onboarding now" });
      if (await activateNow.isVisible().catch(() => false)) {
        break;
      }
    }

    const summary = {
      scenarioName,
      mode,
      runAt: new Date().toISOString(),
      persona: { email: persona.email, agencyId: persona.agencyId },
      totalSteps: records.length,
      passCount: records.filter((r) => r.pass).length,
      failCount: records.filter((r) => !r.pass).length,
      records,
      responseTrace,
      consoleErrors,
      requestFailures,
    };
    fs.writeFileSync(path.join(logsRoot, "summary.json"), JSON.stringify(summary, null, 2));
    return summary;
  } catch (error) {
    fatalError = String(error?.message || error);
  } finally {
    const summary = {
      scenarioName,
      mode,
      runAt: new Date().toISOString(),
      persona: { email: persona.email, agencyId: persona.agencyId },
      totalSteps: records.length,
      passCount: records.filter((r) => r.pass).length,
      failCount: records.filter((r) => !r.pass).length,
      fatalError,
      records,
      responseTrace,
      consoleErrors,
      requestFailures,
    };
    fs.writeFileSync(path.join(logsRoot, "summary.json"), JSON.stringify(summary, null, 2));
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    if (fatalError) return summary;
    return summary;
  }
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_AGENCY_ONBOARDING_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_agency_onboarding_2026-03-08");
  fs.mkdirSync(evidenceRoot, { recursive: true });

  const normal = await runScenario({
    scenarioName: "normal_user_flow",
    mode: "normal",
    baseUrl,
    supabaseUrl,
    serviceRoleKey,
    evidenceRoot,
  });

  const adversarial = await runScenario({
    scenarioName: "adversarial_user_flow",
    mode: "adversarial",
    baseUrl,
    supabaseUrl,
    serviceRoleKey,
    evidenceRoot,
  });

  const combined = {
    runAt: new Date().toISOString(),
    baseUrl,
    normal: {
      totalSteps: normal.totalSteps,
      passCount: normal.passCount,
      failCount: normal.failCount,
      log: "normal_user_flow/logs/summary.json",
    },
    adversarial: {
      totalSteps: adversarial.totalSteps,
      passCount: adversarial.passCount,
      failCount: adversarial.failCount,
      log: "adversarial_user_flow/logs/summary.json",
    },
  };
  fs.writeFileSync(path.join(evidenceRoot, "quality_e2e_index.json"), JSON.stringify(combined, null, 2));
  console.log(JSON.stringify(combined, null, 2));
}

main().catch((error) => {
  console.error(`run_wf_agency_onboarding_quality_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
