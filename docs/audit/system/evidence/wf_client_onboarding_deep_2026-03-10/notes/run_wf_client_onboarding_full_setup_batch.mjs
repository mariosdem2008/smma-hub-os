import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const runs = Math.max(1, Number(process.env.WF_CLIENT_ONBOARDING_FULL_BATCH_RUNS || 3));
const root = process.cwd();
const notesRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/notes");
const logsRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/logs");
const summaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_summary.json");
const batchDir = path.join(logsRoot, "batch_runs");
const batchSummaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_batch_summary.json");
const batchSummaryMdPath = path.join(notesRoot, "wf_client_onboarding_full_setup_batch_summary.md");

fs.mkdirSync(batchDir, { recursive: true });

const results = [];
for (let i = 1; i <= runs; i += 1) {
  const startedAt = new Date().toISOString();
  const proc = spawnSync(process.execPath, [path.join(notesRoot, "run_wf_client_onboarding_full_setup.mjs")], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
    timeout: 8 * 60 * 1000,
  });

  let summary = null;
  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    } catch {
      summary = null;
    }
  }

  const ok = proc.status === 0 && summary && summary.passCount === summary.totalSteps;
  const item = {
    run: i,
    startedAt,
    status: proc.status,
    ok,
    stdout: (proc.stdout || "").trim(),
    stderr: (proc.stderr || "").trim(),
    metrics: summary
      ? {
          passCount: summary.passCount,
          totalSteps: summary.totalSteps,
          requestFailureCount: summary.requestFailureCount,
          requiredCoveragePct: summary.storage?.requiredFieldCoveragePct ?? null,
          requiredText: summary.ui?.requiredText ?? null,
          readinessLine: summary.ui?.readinessLine ?? null,
          premiumPhraseLintPass: (summary.premium?.bannedPhrasesFound?.length ?? 0) === 0,
          handoffVisible: Boolean(summary.premium?.completionHandoffVisible),
        }
      : null,
  };
  results.push(item);

  if (summary) {
    fs.writeFileSync(path.join(batchDir, `run_${String(i).padStart(2, "0")}.json`), JSON.stringify(summary, null, 2));
  }
}

const passRuns = results.filter((r) => r.ok).length;
const coverageValues = results
  .map((r) => r.metrics?.requiredCoveragePct)
  .filter((v) => typeof v === "number");
const minCoverage = coverageValues.length > 0 ? Math.min(...coverageValues) : null;

const batch = {
  runAt: new Date().toISOString(),
  requestedRuns: runs,
  passRuns,
  failRuns: runs - passRuns,
  passRatePct: Math.round((passRuns / runs) * 100),
  minRequiredCoveragePct: minCoverage,
  results,
};

fs.writeFileSync(batchSummaryPath, JSON.stringify(batch, null, 2));

const lines = [
  "# WF Client Onboarding Full Setup Batch Summary",
  "",
  `Run at: ${batch.runAt}`,
  `Runs: ${runs}`,
  `Pass runs: ${passRuns}`,
  `Fail runs: ${runs - passRuns}`,
  `Pass rate: ${batch.passRatePct}%`,
  `Minimum required coverage: ${minCoverage ?? "n/a"}%`,
  "",
  "| Run | OK | Pass | Request failures | Required coverage | UI Required | UI Readiness | Phrase lint | Handoff CTA |",
  "|---|---|---|---|---|---|---|---|---|",
];

for (const r of results) {
  lines.push(
    `| ${r.run} | ${r.ok ? "yes" : "no"} | ${r.metrics ? `${r.metrics.passCount}/${r.metrics.totalSteps}` : "n/a"} | ${r.metrics?.requestFailureCount ?? "n/a"} | ${r.metrics?.requiredCoveragePct ?? "n/a"}% | ${r.metrics?.requiredText ?? "n/a"} | ${r.metrics?.readinessLine ?? "n/a"} | ${r.metrics?.premiumPhraseLintPass ? "pass" : "fail"} | ${r.metrics?.handoffVisible ? "yes" : "no"} |`,
  );
}

fs.writeFileSync(batchSummaryMdPath, `${lines.join("\n")}\n`);

console.log(`wf_client_onboarding_full_setup_batch: ${passRuns}/${runs} runs passed, min_required_coverage=${minCoverage ?? "n/a"}%`);
if (passRuns !== runs) process.exit(1);
