import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function passResult(checks, id, detail) {
  checks.push({ id, ok: true, detail });
}

function failResult(checks, id, detail) {
  checks.push({ id, ok: false, detail });
}

function hasStepOk(summary, stepId) {
  const steps = Array.isArray(summary?.steps) ? summary.steps : [];
  return steps.some((step) => step?.step === stepId && step?.ok === true);
}

function stepGroupPass(summary, suffix) {
  const steps = Array.isArray(summary?.steps) ? summary.steps : [];
  const matching = steps.filter((step) => String(step?.step || "").endsWith(suffix));
  return matching.length > 0 && matching.every((step) => step.ok === true);
}

function main() {
  const root = process.cwd();
  const evidenceRoot = path.join(root, "docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  const summaryPath = path.join(logsRoot, "wf_client_onboarding_chat_audit_summary.json");
  const outJsonPath = path.join(logsRoot, "wf_client_onboarding_chat_gate_summary.json");
  const outMdPath = path.join(notesRoot, "wf_client_onboarding_chat_gate_summary.md");

  if (!fs.existsSync(summaryPath)) {
    console.error(`client_onboarding_chat_gate: FAIL - missing file: ${summaryPath}`);
    process.exit(1);
  }

  const summary = readJson(summaryPath);
  const checks = [];

  const actionableRequestFailures = Number(summary?.actionableRequestFailures?.length ?? 0);
  if (actionableRequestFailures === 0) passResult(checks, "reliability", "no actionable request failures detected");
  else failResult(checks, "reliability", `${actionableRequestFailures} actionable request failures detected`);

  const duplicateFraming = !(Array.isArray(summary?.findings) ? summary.findings : []).some((finding) =>
    String(finding?.issue || "").toLowerCase().includes("appears"),
  );
  if (duplicateFraming) passResult(checks, "single_active_step_framing", "active onboarding step is not duplicated in the audited viewport");
  else failResult(checks, "single_active_step_framing", "duplicate onboarding framing was detected");

  if (stepGroupPass(summary, ":save_indicator")) passResult(checks, "save_indicator", "every audited step displayed the Saved confirmation indicator");
  else failResult(checks, "save_indicator", "one or more audited steps missed the Saved confirmation indicator");

  if (stepGroupPass(summary, ":saved_summary")) passResult(checks, "saved_summary", "every audited step displayed a saved-summary confirmation bubble");
  else failResult(checks, "saved_summary", "one or more audited steps missed the saved-summary confirmation bubble");

  if (hasStepOk(summary, "handoff:message_visible")) passResult(checks, "handoff_message", "strategy handoff message was visible on landing");
  else failResult(checks, "handoff_message", "strategy handoff message was not visible on landing");

  const hasProgress = Boolean(summary?.uiChecks?.hasProgress);
  if (hasProgress) passResult(checks, "progress_visible", "progress remained visible in the audited flow");
  else failResult(checks, "progress_visible", "progress visibility check failed");

  const passCount = checks.filter((check) => check.ok).length;
  const totalChecks = checks.length;
  const status = passCount === totalChecks ? "pass" : "fail";

  const out = {
    runAt: new Date().toISOString(),
    status,
    passCount,
    totalChecks,
    checks,
    artifacts: { summaryPath },
  };

  fs.writeFileSync(outJsonPath, JSON.stringify(out, null, 2));
  const lines = [
    "# WF Client Onboarding Chat Gate Summary",
    "",
    `Run at: ${out.runAt}`,
    `Status: ${out.status}`,
    `Checks: ${out.passCount}/${out.totalChecks}`,
    "",
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...checks.map((check) => `| ${check.id} | ${check.ok ? "pass" : "fail"} | ${check.detail} |`),
    "",
    "Artifacts:",
    `- ${summaryPath}`,
  ];
  fs.writeFileSync(outMdPath, `${lines.join("\n")}\n`);

  console.log(`client_onboarding_chat_gate: ${status.toUpperCase()} - ${passCount}/${totalChecks} checks`);
  if (status !== "pass") process.exit(1);
}

main();
