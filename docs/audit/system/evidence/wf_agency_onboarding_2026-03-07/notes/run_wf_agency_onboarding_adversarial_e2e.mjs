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
  const email = `wf.agency.onboarding.adv.${Date.now()}@example.com`;
  const password = `Smmahub!${Date.now()}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Agency Onboarding Adversarial User" },
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
      name: `WF Onboarding Adversarial Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-onboarding-adv.example.com",
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

async function main() {
  const env = loadEnv();
  const supabaseUrl = (env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const baseUrl = env.WF_AGENCY_ONBOARDING_BASE_URL || "http://localhost:8080";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_agency_onboarding_2026-03-07");
  const screenshotsRoot = path.join(evidenceRoot, "screenshots");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(logsRoot, { recursive: true });
  fs.mkdirSync(notesRoot, { recursive: true });

  const runAt = new Date().toISOString();
  const persona = await provisionPersona(supabaseUrl, serviceRoleKey);
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  async function fetchStatusSnapshot() {
    const statusRes = await httpJson(
      `${supabaseUrl}/rest/v1/ai_onboarding_status?agency_id=eq.${persona.agencyId}&scope=eq.agency&client_id=is.null&select=id,status,metadata,updated_at&order=updated_at.desc&limit=1`,
      { headers: adminHeaders },
    );
    if (!statusRes.res.ok || !Array.isArray(statusRes.json) || !statusRes.json[0]) return null;
    const row = statusRes.json[0];
    const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    return {
      id: row.id,
      status: row.status,
      current_question_id: meta.current_question_id ?? null,
      last_answered_field: meta.last_answered_field ?? null,
      unresolved_p0: Array.isArray(meta.unresolved_p0) ? meta.unresolved_p0 : [],
      pending_p0_confirm: meta.pending_p0_confirm ?? null,
      raw: row,
    };
  }

  async function fetchTurnLogs(statusId) {
    const logsRes = await httpJson(
      `${supabaseUrl}/rest/v1/ai_onboarding_turn_logs?onboarding_status_id=eq.${statusId}&select=turn_index,user_message,assistant_message,response_json,created_at&order=turn_index.asc`,
      { headers: adminHeaders },
    );
    if (!logsRes.res.ok || !Array.isArray(logsRes.json)) return [];
    return logsRes.json;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const steps = [];
  const consoleErrors = [];
  const requestFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (req) => {
    requestFailures.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText || "unknown" });
  });

  let statusId = null;
  let turnLogs = [];
  let latestFieldPath = null;
  let latestInputType = null;

  function buildValidAnswer(fieldPath, inputType) {
    const f = String(fieldPath || "").toLowerCase();
    const t = String(inputType || "").toLowerCase();

    if (f.includes("timezone") || f.includes("locale")) return "Europe/Athens";
    if (f.includes("team_size") || f.includes("active_paying_clients")) return "7";
    if (f.includes("primary_client_languages")) return "English 70%, Greek 30%";
    if (f.includes("top_industries")) return "Gyms\nDentists\nSaaS B2B";
    if (f.includes("best_client_summary")) {
      return "Owner-led dental clinic with 3 doctors aiming for steady monthly booking growth from local paid and organic channels.";
    }
    if (f.includes("key_differentiators")) {
      return "Fast turnaround\nNiche expertise\nClear weekly reporting";
    }
    if (f.includes("service_catalog")) {
      return "Social Mgmt | Monthly strategy and posting";
    }
    if (f.includes("pricing_model")) {
      return "Fixed retainer | Stable monthly planning and delivery";
    }
    if (f.includes("website_and_links") || f.includes("competitor_urls")) {
      return "https://example.com";
    }

    if (t === "numeric") return "7";
    if (t === "percent") return "English 70%, Greek 30%";
    if (t === "tz_lang") return "Europe/Athens";
    if (t === "list") return "Valid item one\nValid item two";
    return "Meaningful valid onboarding answer";
  }
  try {
    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 45000 });
    await page.locator("#email").fill(persona.email);
    await page.locator("#password").fill(persona.password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForTimeout(2200);
    await page.evaluate((agencyId) => localStorage.setItem("activeAgencyId", agencyId), persona.agencyId);
    await page.goto(`${baseUrl}/ai/onboarding/agency`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500);
    await page.getByText("AI-guided onboarding").first().waitFor({ timeout: 30000 });
    await page.screenshot({ path: path.join(screenshotsRoot, "adv_01_entry.png"), fullPage: true });

    const input = page.locator("#onboarding-input");
    const send = page.getByRole("button", { name: /^Send$/ });
    const useAndSend = page.getByRole("button", { name: /Use & send/i }).first();
    const percentLabel = page.locator('input[placeholder="Label (e.g. English)"]').first();
    const percentValue = page.locator('input[placeholder="%"]').first();

    const detectInputMode = async () => {
      if (await input.isVisible().catch(() => false)) return "text";
      if ((await percentLabel.isVisible().catch(() => false)) && (await percentValue.isVisible().catch(() => false))) {
        return "percent";
      }
      if (await useAndSend.isVisible().catch(() => false)) return "chip";
      return "unknown";
    };

    const ensureSendableInput = async () => {
      for (let i = 0; i < 10; i += 1) {
        const mode = await detectInputMode();
        if (mode === "text" || mode === "percent") return mode;
        const retryButton = page.getByRole("button", { name: "Retry" });
        if (await retryButton.isVisible().catch(() => false)) {
          await retryButton.click();
          await page.waitForTimeout(1200);
          continue;
        }
        const continueOps = page.getByRole("button", { name: "Continue Operations" });
        if (await continueOps.isVisible().catch(() => false)) {
          await continueOps.click();
          await page.waitForTimeout(900);
          continue;
        }
        const continueAdvanced = page.getByRole("button", { name: "Continue Optional: Advanced" });
        if (await continueAdvanced.isVisible().catch(() => false)) {
          await continueAdvanced.click();
          await page.waitForTimeout(900);
          continue;
        }
        const backToChat = page.getByRole("button", { name: "Back to chat" });
        if (await backToChat.isVisible().catch(() => false)) {
          await backToChat.click();
          await page.waitForTimeout(900);
          continue;
        }
        if (mode === "chip" && (await useAndSend.isVisible().catch(() => false))) {
          await Promise.all([
            page
              .waitForResponse(
                (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 422, 500, 502].includes(res.status()),
                { timeout: 30000 },
              )
              .catch(() => null),
            useAndSend.click(),
          ]);
          await page.waitForTimeout(1400);
          continue;
        }
        await page.waitForTimeout(800);
      }
      return await detectInputMode();
    };

    const submitAdversarialInput = async (text) => {
      const mode = await ensureSendableInput();
      if (mode === "text") {
        await input.fill(text);
      } else if (mode === "percent") {
        await percentLabel.fill("");
        await percentValue.fill("");
        await percentLabel.fill(text);
      } else {
        return { mode, response: null };
      }
      let sendReady = false;
      for (let i = 0; i < 5; i += 1) {
        if (await send.isEnabled().catch(() => false)) {
          sendReady = true;
          break;
        }
        await page.waitForTimeout(200);
      }
      if (!sendReady) return { mode: `${mode}_send_disabled`, response: null };
      const responsePromise = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 422, 500, 502].includes(res.status()),
          { timeout: 30000 },
        )
        .catch(() => null);
      try {
        await send.click({ timeout: 3000 });
      } catch {
        return { mode: `${mode}_send_disabled`, response: null };
      }
      const response = await responsePromise;
      return { mode, response };
    };
    const scenarios = [
      {
        key: "user_question_should_not_advance",
        text: "Why do you need this exactly before we continue?",
        expectedAdvance: false,
        screenshot: "adv_02_user_question.png",
      },
      {
        key: "garbage_should_not_advance",
        text: "???",
        expectedAdvance: false,
        screenshot: "adv_03_garbage.png",
      },
      {
        key: "idk_should_not_advance_required",
        text: "I don't know",
        expectedAdvance: false,
        screenshot: "adv_04_idk.png",
      },
    ];

    for (const scenario of scenarios) {
      const before = await fetchStatusSnapshot();
      if (before?.id) statusId = before.id;

      const attempt = await submitAdversarialInput(scenario.text);
      if (attempt.mode !== "text" && attempt.mode !== "percent") {
        const blockedNoAdvance = attempt.mode.endsWith("_send_disabled");
        steps.push({
          step: `adv:${scenario.key}`,
          expectedAdvance: scenario.expectedAdvance,
          actualAdvance: false,
          ok: scenario.expectedAdvance === false ? blockedNoAdvance : false,
          error: `onboarding input not sendable (${attempt.mode})`,
          before: before
            ? {
                current_question_id: before.current_question_id,
                last_answered_field: before.last_answered_field,
                pending_p0_confirm: before.pending_p0_confirm,
              }
            : null,
        });
        continue;
      }
      const response = attempt.response;
      await page.waitForTimeout(2200);
      await page.screenshot({ path: path.join(screenshotsRoot, scenario.screenshot), fullPage: true });

      let responseJson = null;
      if (response) {
        try {
          responseJson = await response.json();
        } catch {
          responseJson = null;
        }
      }
      latestFieldPath = responseJson?.field_path ?? latestFieldPath;
      latestInputType = responseJson?.input_type ?? latestInputType;

      const after = await fetchStatusSnapshot();
      if (after?.id) statusId = after.id;
      const advanced = Boolean(before?.current_question_id && after?.current_question_id && before.current_question_id !== after.current_question_id);

      steps.push({
        step: `adv:${scenario.key}`,
        expectedAdvance: scenario.expectedAdvance,
        actualAdvance: advanced,
        ok: advanced === scenario.expectedAdvance,
        before: before
          ? {
              current_question_id: before.current_question_id,
              last_answered_field: before.last_answered_field,
              pending_p0_confirm: before.pending_p0_confirm,
            }
          : null,
        after: after
          ? {
              current_question_id: after.current_question_id,
              last_answered_field: after.last_answered_field,
              pending_p0_confirm: after.pending_p0_confirm,
            }
          : null,
        response_field_path: responseJson?.field_path ?? null,
        response_input_type: responseJson?.input_type ?? null,
      });
    }

    // Final step: submit a field-aware valid answer and expect advancement.
    const validAnswer = buildValidAnswer(latestFieldPath, latestInputType);
    const beforeValid = await fetchStatusSnapshot();
    if (beforeValid?.id) statusId = beforeValid.id;
    const validInputMode = await ensureSendableInput();
    let validResponse = null;
    if (validInputMode === "text") {
      await input.fill(validAnswer);
      if (!(await send.isEnabled().catch(() => false))) throw new Error("send disabled for valid-answer text scenario");
      const responsePromise = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 422, 500, 502].includes(res.status()),
          { timeout: 30000 },
        )
        .catch(() => null);
      await send.click({ timeout: 3000 });
      validResponse = await responsePromise;
    } else if (validInputMode === "percent") {
      await percentLabel.fill("English");
      await percentValue.fill("100");
      if (!(await send.isEnabled().catch(() => false))) throw new Error("send disabled for valid-answer percent scenario");
      const responsePromise = page
        .waitForResponse(
          (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 422, 500, 502].includes(res.status()),
          { timeout: 30000 },
        )
        .catch(() => null);
      await send.click({ timeout: 3000 });
      validResponse = await responsePromise;
    } else if (await useAndSend.isVisible().catch(() => false)) {
      validResponse = await Promise.all([
        page
          .waitForResponse(
            (res) => res.url().includes("/functions/v1/ai-onboarding") && [200, 400, 422, 500, 502].includes(res.status()),
            { timeout: 30000 },
          )
          .catch(() => null),
        useAndSend.click(),
      ]).then((arr) => arr[0]);
    } else {
      throw new Error(`onboarding input controls not visible for valid-answer scenario (${validInputMode})`);
    }
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(screenshotsRoot, "adv_05_valid_answer.png"), fullPage: true });
    const afterValid = await fetchStatusSnapshot();
    if (afterValid?.id) statusId = afterValid.id;
    const validAdvanced = Boolean(
      beforeValid?.current_question_id &&
      afterValid?.current_question_id &&
      beforeValid.current_question_id !== afterValid.current_question_id
    );

    let validResponseJson = null;
    if (validResponse) {
      try {
        validResponseJson = await validResponse.json();
      } catch {
        validResponseJson = null;
      }
    }

    steps.push({
      step: "adv:valid_answer_should_advance",
      expectedAdvance: true,
      actualAdvance: validAdvanced,
      ok: validAdvanced === true,
      usedAnswer: validAnswer,
      fieldHint: latestFieldPath,
      inputTypeHint: latestInputType,
      before: beforeValid
        ? {
            current_question_id: beforeValid.current_question_id,
            last_answered_field: beforeValid.last_answered_field,
            pending_p0_confirm: beforeValid.pending_p0_confirm,
          }
        : null,
      after: afterValid
        ? {
            current_question_id: afterValid.current_question_id,
            last_answered_field: afterValid.last_answered_field,
            pending_p0_confirm: afterValid.pending_p0_confirm,
          }
        : null,
      response_field_path: validResponseJson?.field_path ?? null,
      response_input_type: validResponseJson?.input_type ?? null,
    });

    const finalStatus = await fetchStatusSnapshot();
    if (finalStatus?.id) {
      statusId = finalStatus.id;
      turnLogs = await fetchTurnLogs(finalStatus.id);
    }

    const summary = {
      runAt,
      baseUrl,
      persona,
      statusId,
      passCount: steps.filter((s) => s.ok).length,
      totalSteps: steps.length,
      steps,
      finalStatus,
      turnLogs,
      consoleErrors,
      requestFailures,
    };
    fs.writeFileSync(path.join(logsRoot, "wf_agency_onboarding_adversarial_summary.json"), JSON.stringify(summary, null, 2));

    const md = [
      "# WF Agency Onboarding Adversarial E2E Summary",
      "",
      `Run at: ${runAt}`,
      `Base URL: ${baseUrl}`,
      `Pass: ${summary.passCount}/${summary.totalSteps}`,
      "",
      "## Scenario Matrix",
      "",
      "| Scenario | Expected Advance | Actual Advance | Pass |",
      "|---|---:|---:|---|",
      ...steps.map((s) => `| ${s.step.replace("adv:", "")} | ${s.expectedAdvance ? "yes" : "no"} | ${s.actualAdvance ? "yes" : "no"} | ${s.ok ? "yes" : "no"} |`),
      "",
      "## Evidence",
      "",
      "- screenshots: `adv_01_entry.png` ... `adv_05_valid_answer.png`",
      "- JSON log: `wf_agency_onboarding_adversarial_summary.json`",
      `- turn logs captured: ${turnLogs.length}`,
    ].join("\n");
    fs.writeFileSync(path.join(notesRoot, "wf_agency_onboarding_adversarial_summary.md"), md);

    console.log(`wf_agency_onboarding_adversarial_e2e: ${summary.passCount}/${summary.totalSteps} scenarios passed`);
    if (summary.passCount !== summary.totalSteps) process.exitCode = 1;
  } catch (error) {
    const fail = { runAt, baseUrl, persona, statusId, error: String(error), steps, turnLogs, consoleErrors, requestFailures };
    fs.writeFileSync(path.join(logsRoot, "wf_agency_onboarding_adversarial_summary.json"), JSON.stringify(fail, null, 2));
    console.error(`wf_agency_onboarding_adversarial_e2e failed: ${String(error)}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`wf_agency_onboarding_adversarial_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
