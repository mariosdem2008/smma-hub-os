import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function failResult(checks, id, detail) {
  checks.push({ id, ok: false, detail });
}

function passResult(checks, id, detail) {
  checks.push({ id, ok: true, detail });
}

function hasStepOk(summary, stepId) {
  const steps = Array.isArray(summary?.steps) ? summary.steps : [];
  const row = steps.find((s) => s?.step === stepId);
  return Boolean(row?.ok === true);
}

function main() {
  const root = process.cwd();
  const evidenceRoot = path.join(root, "docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10");
  const logsRoot = path.join(evidenceRoot, "logs");
  const notesRoot = path.join(evidenceRoot, "notes");
  const fullSummaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_summary.json");
  const batchSummaryPath = path.join(logsRoot, "wf_client_onboarding_full_setup_batch_summary.json");
  const personaMatrixPath = path.join(logsRoot, "wf_client_onboarding_full_setup_persona_matrix_summary.json");
  const goldenScorePath = path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/logs/golden_set_score.json");
  const outJsonPath = path.join(logsRoot, "wf_client_onboarding_premium_gate_summary.json");
  const outMdPath = path.join(notesRoot, "wf_client_onboarding_premium_gate_summary.md");

  const requiredFiles = [fullSummaryPath, batchSummaryPath, personaMatrixPath, goldenScorePath];
  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) {
      console.error(`client_onboarding_premium_gate: FAIL - missing file: ${filePath}`);
      process.exit(1);
    }
  }

  const full = readJson(fullSummaryPath);
  const batch = readJson(batchSummaryPath);
  const persona = readJson(personaMatrixPath);
  const golden = readJson(goldenScorePath);
  const checks = [];

  const readabilityOk =
    hasStepOk(full, "quality:mobile_composer_visible") &&
    fs.existsSync(path.join(evidenceRoot, "screenshots/full_setup/04_onboarding_after_full_answers.png")) &&
    fs.existsSync(path.join(evidenceRoot, "screenshots/full_setup/06_mobile_completion.png"));
  if (readabilityOk) passResult(checks, "ux_readability", "desktop + mobile completion evidence and mobile composer visibility are present");
  else failResult(checks, "ux_readability", "missing readability evidence or mobile composer visibility check");

  const phraseLintPass = (full?.premium?.bannedPhrasesFound?.length ?? 0) === 0 && hasStepOk(full, "quality:premium_phrase_lint");
  const singleNextActionProxy = Boolean(full?.premium?.completionHandoffVisible) && hasStepOk(full, "quality:completion_handoff_cta_visible");
  if (phraseLintPass && singleNextActionProxy) {
    passResult(checks, "conversation_clarity", "phrase lint pass and clear completion next action visible");
  } else {
    failResult(checks, "conversation_clarity", "phrase lint or single-next-action proxy failed");
  }

  const frictionOk =
    Number(full?.storage?.requiredFieldCoveragePct ?? 0) === 100 &&
    hasStepOk(full, "quality:completion_handoff_navigation") &&
    hasStepOk(full, "quality:completion_handoff_cta_visible");
  if (frictionOk) passResult(checks, "friction", "full completion and handoff path validated");
  else failResult(checks, "friction", "completion coverage or handoff flow not fully validated");

  const batchRuns = Number(batch?.requestedRuns ?? 0);
  const batchPass = Number(batch?.passRuns ?? 0);
  const batchNoReqFail = (Array.isArray(batch?.results) ? batch.results : []).every((r) => Number(r?.metrics?.requestFailureCount ?? 0) === 0);
  const reliabilityOk = batchRuns >= 10 && batchPass === batchRuns && batchNoReqFail;
  if (reliabilityOk) passResult(checks, "reliability", `batch pass ${batchPass}/${batchRuns} with zero request failures`);
  else failResult(checks, "reliability", `batch requirements not met (runs=${batchRuns}, pass=${batchPass}, zero_req_fail=${batchNoReqFail})`);

  const personaRuns = Number(persona?.totalRuns ?? 0);
  const personaPass = Number(persona?.passRuns ?? 0);
  const personaNoReqFail = (Array.isArray(persona?.results) ? persona.results : []).every((r) => Number(r?.metrics?.requestFailureCount ?? 0) === 0);
  const personaOk = personaRuns >= 3 && personaPass === personaRuns && personaNoReqFail;
  if (personaOk) passResult(checks, "persona_variance", `persona matrix pass ${personaPass}/${personaRuns} with zero request failures`);
  else failResult(checks, "persona_variance", `persona variance requirements not met (runs=${personaRuns}, pass=${personaPass}, zero_req_fail=${personaNoReqFail})`);

  const goldenScore = Number(golden?.overall_score ?? 0);
  const goldenPass = String(golden?.status || "") === "pass" && goldenScore >= Number(golden?.pass_threshold ?? 0.85);
  if (goldenPass) passResult(checks, "quality_gate", `golden quality score ${goldenScore} (${golden.status})`);
  else failResult(checks, "quality_gate", `golden quality check failed (score=${goldenScore}, status=${golden?.status})`);

  const passCount = checks.filter((c) => c.ok).length;
  const totalChecks = checks.length;
  const status = passCount === totalChecks ? "pass" : "fail";

  const summary = {
    runAt: new Date().toISOString(),
    status,
    passCount,
    totalChecks,
    checks,
    artifacts: {
      fullSummaryPath,
      batchSummaryPath,
      personaMatrixPath,
      goldenScorePath,
    },
  };

  fs.writeFileSync(outJsonPath, JSON.stringify(summary, null, 2));

  const lines = [
    "# WF Client Onboarding Premium Gate Summary",
    "",
    `Run at: ${summary.runAt}`,
    `Status: ${summary.status}`,
    `Checks: ${summary.passCount}/${summary.totalChecks}`,
    "",
    "| Check | Result | Detail |",
    "|---|---|---|",
    ...checks.map((c) => `| ${c.id} | ${c.ok ? "pass" : "fail"} | ${c.detail} |`),
    "",
    "Artifacts:",
    `- ${fullSummaryPath}`,
    `- ${batchSummaryPath}`,
    `- ${personaMatrixPath}`,
    `- ${goldenScorePath}`,
  ];
  fs.writeFileSync(outMdPath, `${lines.join("\n")}\n`);

  console.log(`client_onboarding_premium_gate: ${status.toUpperCase()} - ${passCount}/${totalChecks} checks`);
  if (status !== "pass") process.exit(1);
}

main();
