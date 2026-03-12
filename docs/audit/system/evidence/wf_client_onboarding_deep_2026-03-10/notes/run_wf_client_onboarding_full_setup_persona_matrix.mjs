import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const profiles = (process.env.WF_CLIENT_ONBOARDING_PERSONA_MATRIX || "fitness,medspa,realtor")
  .split(",")
  .map((v) => v.trim().toLowerCase())
  .filter(Boolean);

const root = process.cwd();
const notesRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/notes");
const logsRoot = path.resolve("docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/logs");
const summaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_summary.json");
const matrixSummaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_persona_matrix_summary.json");
const matrixSummaryMdPath = path.join(notesRoot, "wf_client_onboarding_full_setup_persona_matrix_summary.md");
const matrixDir = path.join(logsRoot, "persona_matrix_runs");

fs.mkdirSync(matrixDir, { recursive: true });

const results = [];
for (const profile of profiles) {
  const startedAt = new Date().toISOString();
  const proc = spawnSync(process.execPath, [path.join(notesRoot, "run_wf_client_onboarding_full_setup.mjs")], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    env: { ...process.env, WF_CLIENT_ONBOARDING_ANSWER_PROFILE: profile },
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
    profile,
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
          answerProfile: summary.answerProfile || null,
        }
      : null,
  };
  results.push(item);

  if (summary) {
    fs.writeFileSync(path.join(matrixDir, `${profile}.json`), JSON.stringify(summary, null, 2));
  }
}

const passRuns = results.filter((r) => r.ok).length;
const coverageValues = results
  .map((r) => r.metrics?.requiredCoveragePct)
  .filter((v) => typeof v === "number");
const minCoverage = coverageValues.length > 0 ? Math.min(...coverageValues) : null;

const matrix = {
  runAt: new Date().toISOString(),
  profiles,
  totalRuns: results.length,
  passRuns,
  failRuns: results.length - passRuns,
  passRatePct: results.length ? Math.round((passRuns / results.length) * 100) : 0,
  minRequiredCoveragePct: minCoverage,
  results,
};

fs.writeFileSync(matrixSummaryPath, JSON.stringify(matrix, null, 2));

const lines = [
  "# WF Client Onboarding Full Setup Persona Matrix Summary",
  "",
  `Run at: ${matrix.runAt}`,
  `Profiles: ${profiles.join(", ")}`,
  `Runs: ${matrix.totalRuns}`,
  `Pass runs: ${matrix.passRuns}`,
  `Fail runs: ${matrix.failRuns}`,
  `Pass rate: ${matrix.passRatePct}%`,
  `Minimum required coverage: ${minCoverage ?? "n/a"}%`,
  "",
  "| Profile | OK | Pass | Request failures | Required coverage | UI Required | UI Readiness | Phrase lint | Handoff CTA |",
  "|---|---|---|---|---|---|---|---|---|",
];

for (const r of results) {
  lines.push(
    `| ${r.profile} | ${r.ok ? "yes" : "no"} | ${r.metrics ? `${r.metrics.passCount}/${r.metrics.totalSteps}` : "n/a"} | ${r.metrics?.requestFailureCount ?? "n/a"} | ${r.metrics?.requiredCoveragePct ?? "n/a"}% | ${r.metrics?.requiredText ?? "n/a"} | ${r.metrics?.readinessLine ?? "n/a"} | ${r.metrics?.premiumPhraseLintPass ? "pass" : "fail"} | ${r.metrics?.handoffVisible ? "yes" : "no"} |`,
  );
}

fs.writeFileSync(matrixSummaryMdPath, `${lines.join("\n")}\n`);

console.log(`wf_client_onboarding_full_setup_persona_matrix: ${passRuns}/${matrix.totalRuns} runs passed, min_required_coverage=${minCoverage ?? "n/a"}%`);
if (passRuns !== matrix.totalRuns) process.exit(1);
