import fs from "node:fs";
import path from "node:path";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function includesAny(text, terms) {
  const normalized = String(text || "").toLowerCase();
  return terms.some((term) => normalized.includes(String(term).toLowerCase()));
}

function countSentences(text) {
  if (!text) return 0;
  return String(text)
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function scoreCase(expected, actual) {
  let checks = 0;
  let passed = 0;
  const failures = [];

  const assistant = String(actual?.assistant_message || "");
  const intent = String(actual?.intent || "");
  const confidence = typeof actual?.confidence === "number" ? actual.confidence : null;
  const suggestions = Array.isArray(actual?.suggestions) ? actual.suggestions : [];
  const updates = actual?.updates && typeof actual.updates === "object" ? actual.updates : {};
  const updateKeys = Object.keys(updates);

  if (Array.isArray(expected.must_include_any)) {
    checks += 1;
    const ok = includesAny(assistant, expected.must_include_any);
    if (ok) passed += 1; else failures.push(`must_include_any failed`);
  }

  if (Array.isArray(expected.must_not_include_any)) {
    checks += 1;
    const ok = !includesAny(assistant, expected.must_not_include_any);
    if (ok) passed += 1; else failures.push(`must_not_include_any failed`);
  }

  if (typeof expected.max_sentences === "number") {
    checks += 1;
    const n = countSentences(assistant);
    const ok = n <= expected.max_sentences;
    if (ok) passed += 1; else failures.push(`max_sentences failed (${n})`);
  }

  if (typeof expected.intent === "string") {
    checks += 1;
    const ok = intent === expected.intent;
    if (ok) passed += 1; else failures.push(`intent mismatch expected=${expected.intent} actual=${intent}`);
  }

  if (typeof expected.confidence_min === "number") {
    checks += 1;
    const ok = confidence !== null && confidence >= expected.confidence_min;
    if (ok) passed += 1; else failures.push(`confidence_min failed (${confidence})`);
  }

  if (typeof expected.confidence_max === "number") {
    checks += 1;
    const ok = confidence !== null && confidence <= expected.confidence_max;
    if (ok) passed += 1; else failures.push(`confidence_max failed (${confidence})`);
  }

  if (Array.isArray(expected.must_map_fields_any)) {
    checks += 1;
    const ok = expected.must_map_fields_any.some((field) => updateKeys.includes(field));
    if (ok) passed += 1; else failures.push(`must_map_fields_any failed`);
  }

  if (typeof expected.min_mapped_fields === "number") {
    checks += 1;
    const ok = updateKeys.length >= expected.min_mapped_fields;
    if (ok) passed += 1; else failures.push(`min_mapped_fields failed (${updateKeys.length})`);
  }

  if (typeof expected.min_suggestions === "number") {
    checks += 1;
    const ok = suggestions.length >= expected.min_suggestions;
    if (ok) passed += 1; else failures.push(`min_suggestions failed (${suggestions.length})`);
  }

  if (expected.must_offer_contextual_suggestions === true) {
    checks += 1;
    const labels = suggestions.map((item) => (typeof item === "string" ? item : item?.label || "")).join(" ").toLowerCase();
    const ok = labels.length > 0 && !labels.includes("lorem");
    if (ok) passed += 1; else failures.push(`must_offer_contextual_suggestions failed`);
  }

  if (expected.should_generate_updates === true) {
    checks += 1;
    const ok = updateKeys.length > 0;
    if (ok) passed += 1; else failures.push(`should_generate_updates failed`);
  }

  if (expected.should_offer_next_step === true) {
    checks += 1;
    const ok = includesAny(assistant, ["next", "continue", "share", "provide"]);
    if (ok) passed += 1; else failures.push(`should_offer_next_step failed`);
  }

  const score = checks === 0 ? 0 : passed / checks;
  return { checks, passed, score, failures };
}

function main() {
  const root = process.cwd();
  const datasetPath = path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/dataset/golden_cases.json");
  const actualsPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/dataset/golden_actuals.template.json");

  const dataset = readJson(datasetPath);
  const actuals = readJson(actualsPath);

  const actualMap = new Map((actuals.results || []).map((row) => [row.id, row]));

  const rows = [];
  for (const testCase of dataset.cases || []) {
    const actual = actualMap.get(testCase.id);
    if (!actual) {
      rows.push({ id: testCase.id, checks: 1, passed: 0, score: 0, failures: ["missing actual result"] });
      continue;
    }
    const res = scoreCase(testCase.expected || {}, actual);
    rows.push({ id: testCase.id, ...res });
  }

  const totalChecks = rows.reduce((sum, row) => sum + row.checks, 0);
  const totalPassed = rows.reduce((sum, row) => sum + row.passed, 0);
  const overallScore = totalChecks === 0 ? 0 : totalPassed / totalChecks;

  const summary = {
    generated_at: new Date().toISOString(),
    dataset: datasetPath,
    actuals: actualsPath,
    total_cases: rows.length,
    total_checks: totalChecks,
    total_passed: totalPassed,
    overall_score: Number(overallScore.toFixed(4)),
    pass_threshold: 0.85,
    status: overallScore >= 0.85 ? "pass" : "fail",
    cases: rows,
  };

  const outPath = path.join(root, "docs/audit/system/evidence/golden_set_onboarding_2026-03-09/logs/golden_set_score.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(`golden_set_score: ${summary.total_passed}/${summary.total_checks} checks, score=${summary.overall_score}, status=${summary.status}`);
  if (summary.status !== "pass") process.exitCode = 1;
}

main();
