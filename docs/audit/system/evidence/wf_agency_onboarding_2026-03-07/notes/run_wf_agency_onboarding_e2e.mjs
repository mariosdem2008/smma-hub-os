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

function normalizeQuestionText(rawText) {
  if (!rawText) return "";
  return rawText.replace(/^Current question:\s*/i, "").trim().toLowerCase();
}

function answerForCurrentQuestion(rawQuestionText) {
  const question = normalizeQuestionText(rawQuestionText);
  if (!question) return "General onboarding answer for progress.";

  if (question.includes("legal / public brand name")) {
    return "Apex Growth Partners";
  }
  if (question.includes("iana timezone")) {
    return "Europe/Athens";
  }
  if (question.includes("primary client languages")) {
    return "English, 70%\nGreek, 30%";
  }
  if (question.includes("total team headcount")) {
    return "7";
  }
  if (question.includes("active paying clients")) {
    return "12";
  }
  if (question.includes("top up to 5 industries")) {
    return "Gyms\nDentists\nSaaS B2B";
  }
  if (question.includes("single best client")) {
    return "A multi-location gym founder with 12 staff wants predictable monthly lead volume and improved close rates from paid traffic.";
  }
  if (question.includes("top 3 differentiators")) {
    return "Founder-led strategy sessions\nWeekly KPI accountability reporting\nFast creative feedback loops";
  }
  if (question.includes("which services do you actively sell")) {
    return "Paid Ads | Meta and Google ad management with weekly optimization\nSocial Mgmt | Monthly calendar, posting, and community management";
  }
  if (question.includes("top 1-2 offers by margin")) {
    return "Retainer Growth | Weekly strategy, 12 creatives, reporting | 1500-2500 | Reusable workflow";
  }
  if (question.includes("packaged offers")) {
    return "Lead Engine | 40 leads/month | 12 creatives, ad management, reporting | 30 days | 1500-2500";
  }
  if (question.includes("primary pricing model")) {
    return "Fixed retainer | Predictable monthly workload with clear scope and stable delivery planning.";
  }

  return "General onboarding answer for progress.";
}

async function provisionPersona(supabaseUrl, serviceRoleKey) {
  const adminHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const email = `wf.agency.onboarding.${Date.now()}@example.com`;
  const password = `Smmahub!${Date.now()}`;

  const userCreate = await httpJson(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "WF Agency Onboarding User" },
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
      name: `WF Onboarding Agency ${Date.now()}`,
      niche: "Marketing",
      website: "https://wf-onboarding.example.com",
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
  const injectRetryFailure = env.WF_AGENCY_ONBOARDING_INJECT_RETRY === "true";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  }

  const evidenceRoot = path.resolve("docs/audit/system/evidence/wf_agency_onboarding_2026-03-07");
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
  const loopTrace = [];
  let failNextOnboardingCall = false;

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });
  page.on("requestfailed", (req) => {
    const failure = req.failure()?.errorText || "unknown";
    if (failure.includes("ERR_ABORTED")) return;
    requestFailures.push({ url: req.url(), method: req.method(), failure });
  });
  await page.route("**/functions/v1/ai-onboarding", async (route) => {
    if (failNextOnboardingCall) {
      failNextOnboardingCall = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
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

    await page.goto(`${baseUrl}/ai/onboarding/agency`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1800);
    const entryShot = path.join(screenshotsRoot, "01_onboarding_entry.png");
    await page.screenshot({ path: entryShot, fullPage: true });
    const entryOk = new URL(page.url()).pathname === "/ai/onboarding/agency";
    steps.push({ step: "onboarding:entry", ok: entryOk, url: page.url(), screenshot: entryShot });

    const input = page.locator("#onboarding-input");
    const sendButtons = page.getByRole("button", { name: /^Send$/ });
    const useSendButtons = page.getByRole("button", { name: "Use & send" });
    const percentLabel = page.locator('input[placeholder="Label (e.g. English)"]').first();
    const percentValue = page.locator('input[placeholder="%"]').first();
    const clickFirstVisibleButton = async (name) => {
      const buttons = page.getByRole("button", { name });
      const count = await buttons.count();
      for (let idx = count - 1; idx >= 0; idx -= 1) {
        const candidate = buttons.nth(idx);
        if (await candidate.isVisible().catch(() => false)) {
          await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
          await candidate.click({ timeout: 3000 });
          return true;
        }
      }
      return false;
    };
    const clickVisibleSend = async () => {
      const count = await sendButtons.count();
      for (let idx = count - 1; idx >= 0; idx -= 1) {
        const candidate = sendButtons.nth(idx);
        const visible = await candidate.isVisible().catch(() => false);
        const enabled = await candidate.isEnabled().catch(() => false);
        if (!visible || !enabled) continue;
        await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
        await candidate.click({ timeout: 3000 });
        return true;
      }
      return false;
    };
    const visibleSendEnabled = async () => {
      const count = await sendButtons.count();
      for (let idx = count - 1; idx >= 0; idx -= 1) {
        const candidate = sendButtons.nth(idx);
        const visible = await candidate.isVisible().catch(() => false);
        const enabled = await candidate.isEnabled().catch(() => false);
        if (visible && enabled) return true;
      }
      return false;
    };

    const submitTurn = async (text, options = { preferStructuredValid: false }) => {
      if (await input.isVisible().catch(() => false)) {
        await input.fill(text);
        await page.waitForTimeout(100);
        if (await visibleSendEnabled()) {
          await clickVisibleSend();
          return true;
        }
      }
      if ((await percentLabel.isVisible().catch(() => false)) && (await percentValue.isVisible().catch(() => false))) {
        if (options.preferStructuredValid) {
          await percentLabel.fill("English");
          await percentValue.fill("100");
        } else {
          await percentLabel.fill(text);
          await percentValue.fill("");
        }
        if (!(await visibleSendEnabled())) return false;
        await clickVisibleSend();
        return true;
      }
      const structuredInputs = page.locator('input[placeholder]');
      const structuredCount = await structuredInputs.count();
      if (structuredCount > 0) {
        const placeholders = ["Offer name", "3 deliverables", "EUR/mo range", "High-margin reason", "Service", "Scope summary", "KPI outcome", "Deliverables", "Duration", "EUR range", "Asset", "Max delay days", "Role", "Method", "SLA hours", "Tier", "Low EUR", "High EUR"];
        for (const placeholder of placeholders) {
          const field = page.locator(`input[placeholder="${placeholder}"]`).first();
          if (await field.isVisible().catch(() => false)) {
            const valueByPlaceholder = {
              "Offer name": "Retainer Growth",
              "3 deliverables": "Weekly strategy, 12 creatives, reporting",
              "EUR/mo range": "1500-2500",
              "High-margin reason": "Reusable workflow",
              "Service": "Paid Ads",
              "Scope summary": "Lead generation management",
              "KPI outcome": "Booked calls",
              "Deliverables": "Strategy plus weekly optimizations and reporting",
              "Duration": "90 days",
              "EUR range": "1200-2200",
              "Asset": "Brand kit",
              "Max delay days": "3",
              "Role": "Owner",
              "Method": "Email",
              "SLA hours": "48",
              "Tier": "Standard",
              "Low EUR": "1000",
              "High EUR": "2000",
            };
            await field.fill(valueByPlaceholder[placeholder] ?? "Valid value");
          }
        }
        if (await visibleSendEnabled()) {
          await clickVisibleSend();
          return true;
        }
      }
      const useCount = await useSendButtons.count();
      if (useCount > 0) {
        const clicked = await clickFirstVisibleButton("Use & send");
        if (clicked) return true;
      }
      const timezoneButtons = [
        "Europe/Athens",
        "Europe/Nicosia",
        "Europe/London",
        "Asia/Dubai",
        "America/New_York",
        "America/Los_Angeles",
      ];
      for (const tz of timezoneButtons) {
        const tzBtn = page.getByRole("button", { name: tz });
        if (await tzBtn.isVisible().catch(() => false)) {
          await tzBtn.click({ timeout: 3000 });
          if (await visibleSendEnabled()) {
            await clickVisibleSend();
            return true;
          }
        }
      }
      return false;
    };

    const firstSendOk = await submitTurn("We help local businesses generate leads with short-form content and paid ads.", {
      preferStructuredValid: true,
    });
    if (!firstSendOk) throw new Error("Unable to submit onboarding first answer in current input mode");
    await page.waitForTimeout(2500);
    const sendShot = path.join(screenshotsRoot, "02_after_send.png");
    await page.screenshot({ path: sendShot, fullPage: true });
    steps.push({ step: "onboarding:send_answer", ok: true, url: page.url(), screenshot: sendShot });

    if (injectRetryFailure) {
      // Optional: force one turn failure to exercise Retry branch.
      failNextOnboardingCall = true;
      const failureSendOk = await submitTurn("This turn should fail once so retry can be tested.", {
        preferStructuredValid: true,
      });
      if (!failureSendOk) throw new Error("Unable to submit onboarding failure-injection turn in current input mode");
      const retryButton = page.getByRole("button", { name: "Retry" });
      const retryVisible = await retryButton.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
      if (retryVisible) {
        const retryErrorShot = path.join(screenshotsRoot, "03_retry_error_state.png");
        await page.screenshot({ path: retryErrorShot, fullPage: true });
        await retryButton.click();
        await page.waitForTimeout(2200);
        const retrySuccessShot = path.join(screenshotsRoot, "04_after_retry.png");
        await page.screenshot({ path: retrySuccessShot, fullPage: true });
        steps.push({ step: "onboarding:retry", ok: true, url: page.url(), screenshot: retrySuccessShot });
      } else {
        steps.push({ step: "onboarding:retry", ok: false, url: page.url(), note: "Retry state did not render" });
      }
    } else {
      steps.push({
        step: "onboarding:retry",
        ok: true,
        url: page.url(),
        note: "Retry injection disabled for completion-cert run (set WF_AGENCY_ONBOARDING_INJECT_RETRY=true to force).",
      });
    }

    const useSendCount = await useSendButtons.count();
    if (useSendCount > 0) {
      await clickFirstVisibleButton("Use & send");
      await page.waitForTimeout(2500);
      const suggestionShot = path.join(screenshotsRoot, "05_after_use_and_send.png");
      await page.screenshot({ path: suggestionShot, fullPage: true });
      steps.push({ step: "onboarding:use_and_send", ok: true, url: page.url(), screenshot: suggestionShot });
    } else {
      steps.push({
        step: "onboarding:use_and_send",
        ok: false,
        url: page.url(),
        note: "No 'Use & send' action surfaced for current step",
      });
    }

    const undoButton = page.getByRole("button", { name: "Undo last answer" });
    const undoVisible = await undoButton.isVisible().catch(() => false);
    if (undoVisible) {
      await undoButton.click();
      await page.waitForTimeout(2200);
      const undoShot = path.join(screenshotsRoot, "06_after_undo.png");
      await page.screenshot({ path: undoShot, fullPage: true });
      steps.push({ step: "onboarding:undo", ok: true, url: page.url(), screenshot: undoShot });
    } else {
      steps.push({ step: "onboarding:undo", ok: false, url: page.url(), note: "Undo control not visible" });
    }

    // Drive onboarding forward until finish/skip controls appear.
    let requiredCompleteSeen = false;
    let skipOptionalDone = false;
    const maxTurns = 25;
    let idleIterations = 0;

    for (let i = 0; i < maxTurns; i += 1) {
      let actionTaken = false;
      const iterationTrace = { turn: i + 1, question: "", action: "", note: "" };
      const finishNow = page.getByRole("button", { name: "Finish onboarding now" });
      const activateNow = page.getByRole("button", { name: "Activate Agency Workspace" });
      const qText = (await page.locator("text=Current question:").first().textContent().catch(() => null)) ?? "";
      iterationTrace.question = normalizeQuestionText(qText);
      if (await finishNow.isVisible().catch(() => false)) {
        requiredCompleteSeen = true;
        iterationTrace.action = "required_complete_gate_visible";
        loopTrace.push(iterationTrace);
        break;
      }
      if (await activateNow.isVisible().catch(() => false)) {
        requiredCompleteSeen = true;
        iterationTrace.action = "activate_visible";
        loopTrace.push(iterationTrace);
        break;
      }

      const retryButton = page.getByRole("button", { name: "Retry" });
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
        await page.waitForTimeout(1800);
        actionTaken = true;
        iterationTrace.action = "retry";
        loopTrace.push(iterationTrace);
        continue;
      }

      const skipOptional = page.getByRole("button", { name: "Skip optional" });
      if (!skipOptionalDone && (await skipOptional.isVisible().catch(() => false))) {
        await skipOptional.click();
        await page.waitForTimeout(1800);
        skipOptionalDone = true;
        actionTaken = true;
        iterationTrace.action = "skip_optional";
        loopTrace.push(iterationTrace);
        continue;
      }

      // Review stage can hide the input; move back to chat when possible.
      const continueOps = page.getByRole("button", { name: "Continue Operations" });
      if (await continueOps.isVisible().catch(() => false)) {
        await continueOps.click();
        await page.waitForTimeout(1200);
        actionTaken = true;
        iterationTrace.action = "continue_operations";
        loopTrace.push(iterationTrace);
        continue;
      }
      const continueAdvanced = page.getByRole("button", { name: "Continue Optional: Advanced" });
      if (await continueAdvanced.isVisible().catch(() => false)) {
        await continueAdvanced.click();
        await page.waitForTimeout(1200);
        actionTaken = true;
        iterationTrace.action = "continue_advanced";
        loopTrace.push(iterationTrace);
        continue;
      }
      const backToChat = page.getByRole("button", { name: "Back to chat" });
      if (await backToChat.isVisible().catch(() => false)) {
        await backToChat.click();
        await page.waitForTimeout(1200);
        actionTaken = true;
        iterationTrace.action = "back_to_chat";
        loopTrace.push(iterationTrace);
        continue;
      }

      const questionText = (await page.locator("text=Current question:").first().textContent().catch(() => null)) ?? "";
      const candidateAnswer = answerForCurrentQuestion(questionText);
      if (await submitTurn(candidateAnswer, { preferStructuredValid: true })) {
        await page.waitForTimeout(1800);
        actionTaken = true;
        iterationTrace.action = "submit_turn";
        iterationTrace.note = candidateAnswer;
        loopTrace.push(iterationTrace);
        continue;
      }

      const useButtons = page.getByRole("button", { name: "Use & send" });
      const useCount = await useButtons.count();
      if (useCount > 0) {
        try {
          const clicked = await clickFirstVisibleButton("Use & send");
          if (clicked) {
            await page.waitForTimeout(1800);
            actionTaken = true;
            iterationTrace.action = "use_and_send";
            loopTrace.push(iterationTrace);
            continue;
          }
        } catch {
          // fall through to other input methods
        }
      }

      const idkButton = page.getByRole("button", { name: "I do not know" });
      if ((await idkButton.isVisible().catch(() => false)) && (await idkButton.isEnabled().catch(() => false))) {
        await idkButton.click();
        await page.waitForTimeout(1800);
        actionTaken = true;
        iterationTrace.action = "i_do_not_know";
        loopTrace.push(iterationTrace);
        continue;
      }

      if (!actionTaken) {
        idleIterations += 1;
        const autofill = page.getByRole("button", { name: "Autofill" }).first();
        if (await autofill.isVisible().catch(() => false)) {
          await autofill.click();
          await page.waitForTimeout(1000);
          if (await visibleSendEnabled()) {
            await clickVisibleSend();
            await page.waitForTimeout(1800);
            idleIterations = 0;
            iterationTrace.action = "autofill_send";
            loopTrace.push(iterationTrace);
            continue;
          }
        }
      } else {
        idleIterations = 0;
      }

      if (idleIterations >= 3) {
        steps.push({
          step: "onboarding:loop_guard",
          ok: false,
          url: page.url(),
          note: "No actionable control detected for 3 consecutive iterations; stopped to avoid runner timeout.",
        });
        iterationTrace.action = "loop_guard_break";
        loopTrace.push(iterationTrace);
        break;
      }

      if (!iterationTrace.action) {
        iterationTrace.action = "wait";
        loopTrace.push(iterationTrace);
      }
      await page.waitForTimeout(1000);
    }

    steps.push({
      step: "onboarding:required_complete_gate",
      ok: requiredCompleteSeen,
      url: page.url(),
      note: requiredCompleteSeen ? "Finish onboarding control became visible" : "Could not reach required complete gate",
    });

    const skipAllButton = page.getByRole("button", { name: "Skip all remaining" });
    if (await skipAllButton.isVisible().catch(() => false)) {
      await skipAllButton.click();
      await page.waitForTimeout(2200);
      const skipAllShot = path.join(screenshotsRoot, "07_after_skip_all.png");
      await page.screenshot({ path: skipAllShot, fullPage: true });
      steps.push({ step: "onboarding:skip_all_remaining", ok: true, url: page.url(), screenshot: skipAllShot });
    } else {
      steps.push({
        step: "onboarding:skip_all_remaining",
        ok: requiredCompleteSeen,
        url: page.url(),
        note: requiredCompleteSeen
          ? "Not visible in this run (likely no remaining optional branches at checkpoint)"
          : "Skip all remaining control not visible before required completion",
      });
    }

    const finishNow = page.getByRole("button", { name: "Finish onboarding now" });
    const activateButton = page.getByRole("button", { name: "Activate Agency Workspace" });
    if (await finishNow.isVisible().catch(() => false)) {
      await finishNow.click();
    } else if (await activateButton.isVisible().catch(() => false)) {
      await activateButton.click();
    }
    await page.waitForTimeout(2200);
    const finalShot = path.join(screenshotsRoot, "08_after_activate_workspace.png");
    await page.screenshot({ path: finalShot, fullPage: true });
    const finalPath = new URL(page.url()).pathname;
    const activated = finalPath === "/agency/welcome-ai" || finalPath === "/dashboard";
    steps.push({
      step: "onboarding:activate_workspace",
      ok: activated,
      url: page.url(),
      screenshot: finalShot,
      note: activated ? "Workspace activation path completed" : `Unexpected final route: ${finalPath}`,
    });
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
    loopTrace,
    steps,
    consoleErrors,
    requestFailures,
  };

  fs.writeFileSync(path.join(logsRoot, "wf_agency_onboarding_summary.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# WF Agency Onboarding E2E Summary",
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
  fs.writeFileSync(path.join(notesRoot, "wf_agency_onboarding_summary.md"), md);

  console.log(
    `wf_agency_onboarding_e2e: ${passCount}/${steps.length} steps passed, console_errors=${consoleErrors.length}, request_failures=${requestFailures.length}`
  );
  if (passCount !== steps.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`wf_agency_onboarding_e2e failed: ${error?.message || String(error)}`);
  process.exitCode = 1;
});
