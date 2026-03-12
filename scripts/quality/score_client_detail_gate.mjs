import fs from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`client_detail_gate: FAIL - ${message}`);
  process.exit(1);
}

function main() {
  const root = process.cwd();
  const summaryPath =
    process.argv[2] ??
    path.join(root, "docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/logs/wf_client_detail_deep_summary.json");

  if (!fs.existsSync(summaryPath)) {
    fail(`summary file not found: ${summaryPath}`);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const passCount = Number(summary.passCount ?? 0);
  const totalSteps = Number(summary.totalSteps ?? 0);
  const consoleErrorCount = Number(summary.consoleErrorCount ?? 0);
  const requestFailureCount = Number(summary.requestFailureCount ?? 0);
  const aiRequestCount = Number(summary.aiRequestCount ?? 0);

  if (totalSteps <= 0) fail(`invalid totalSteps=${totalSteps}`);
  if (passCount !== totalSteps) fail(`step failures present (${passCount}/${totalSteps})`);
  if (consoleErrorCount !== 0) fail(`console errors detected (${consoleErrorCount})`);
  if (requestFailureCount !== 0) fail(`request failures detected (${requestFailureCount})`);
  if (aiRequestCount < 8) fail(`unexpectedly low AI request coverage (${aiRequestCount})`);

  const requiredSteps = [
    "client_detail:ai_status_badge_ready_visible",
    "ai_surface:pipeline_quick_action_output_visible",
    "ai_surface:tasks_quick_action_output_visible",
    "ai_surface:analytics_quick_action_output_visible",
    "ai_surface:right_panel_proposal_applied",
    "ai_surface:right_panel_proposal_undo",
  ];
  const steps = Array.isArray(summary.steps) ? summary.steps : [];
  for (const stepId of requiredSteps) {
    const row = steps.find((s) => s?.step === stepId);
    if (!row || row.ok !== true) {
      fail(`required step missing or failed: ${stepId}`);
    }
  }

  console.log(
    `client_detail_gate: PASS - ${passCount}/${totalSteps}, console_errors=${consoleErrorCount}, request_failures=${requestFailureCount}, ai_requests=${aiRequestCount}`
  );
}

main();
