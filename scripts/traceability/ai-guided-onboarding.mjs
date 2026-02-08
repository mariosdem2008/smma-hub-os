import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BLUEPRINT_DIR = path.join(ROOT, "docs", "blueprints", "ai-guided-onboarding");
const REQUIREMENTS_PATH = path.join(BLUEPRINT_DIR, "01_requirements_catalog.md");
const TASKS_PATH = path.join(BLUEPRINT_DIR, "04_task_backlog.md");
const MATRIX_PATH = path.join(BLUEPRINT_DIR, "02_traceability_matrix.md");
const TEST_PLAN_PATH = path.join(BLUEPRINT_DIR, "09_test_plan.md");
const REQUIRED_DOCS = [
  "00_overview.md",
  "01_requirements_catalog.md",
  "02_traceability_matrix.md",
  "03_phase_plan.md",
  "04_task_backlog.md",
  "05_security_and_tenant_isolation.md",
  "06_observability_plan.md",
  "07_ui_spec_chat_onboarding.md",
  "08_data_model_and_persistence.md",
  "09_test_plan.md",
];

function fail(message) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(1);
}

function readFileOrFail(p) {
  if (!fs.existsSync(p)) fail(`Missing file: ${p}`);
  return fs.readFileSync(p, "utf8");
}

function parseIdList(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function assertRequiredDocsExist() {
  for (const file of REQUIRED_DOCS) {
    const full = path.join(BLUEPRINT_DIR, file);
    if (!fs.existsSync(full)) fail(`Missing required blueprint doc: ${path.relative(ROOT, full)}`);
  }
}

function assertAsciiOnlyBlueprintDocs() {
  for (const file of REQUIRED_DOCS) {
    const full = path.join(BLUEPRINT_DIR, file);
    const text = readFileOrFail(full);
    const hits = findNonAscii(text);
    if (hits.length > 0) {
      fail(`Non-ASCII characters detected in ${path.relative(ROOT, full)} at index ${hits[0].index}`);
    }
  }
}

function assertContiguous(ids, prefix) {
  const nums = ids.map((id) => {
    const m = id.match(new RegExp(`^${prefix}-(\\d{3})$`));
    if (!m) fail(`Invalid ID format: ${id}`);
    return Number(m[1]);
  });
  const sorted = [...nums].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const expected = i + 1;
    if (sorted[i] !== expected) {
      fail(`${prefix} IDs must be contiguous starting at 001. Missing or out-of-order near ${prefix}-${String(expected).padStart(3, "0")}`);
    }
  }
}

function findNonAscii(text) {
  const hits = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 127) hits.push({ index: i, code });
  }
  return hits;
}

function parseRequirements(md) {
  const reqs = [];
  const re = /^##\s+(REQ-\d{3}):\s+(.+)\s*$/gm;
  let m;
  while ((m = re.exec(md))) {
    reqs.push({ id: m[1], title: m[2].trim() });
  }
  if (reqs.length === 0) fail("No requirements found in 01_requirements_catalog.md");
  const ids = reqs.map((r) => r.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) fail("Duplicate requirement IDs found in 01_requirements_catalog.md");
  assertContiguous([...unique], "REQ");
  return reqs;
}

function parseTasks(md) {
  const lines = md.split(/\r?\n/);
  const tasks = [];
  let current = null;
  function pushCurrent() {
    if (current) tasks.push(current);
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^##\s+(TASK-\d{3}):\s+(.+)\s*$/);
    if (h) {
      pushCurrent();
      current = {
        id: h[1],
        title: h[2].trim(),
        mappedReqs: [],
        files: [],
        tests: [],
        evidence: [],
      };
      continue;
    }
    if (!current) continue;

    const reqLine = line.match(/^- Mapped Requirements:\s+(.+)\s*$/);
    if (reqLine) {
      current.mappedReqs = parseIdList(reqLine[1]);
      continue;
    }
    if (line.trim() === "- Files to touch:") {
      const items = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.startsWith("## ")) break;
        const item = l.match(/^\s+-\s+`([^`]+)`(?:\s+.*)?$/);
        if (item) items.push(item[1]);
        if (l.startsWith("- ")) break; // next top-level field
      }
      current.files = items;
      continue;
    }
    if (line.trim() === "- Tests to add/run:") {
      const items = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.startsWith("## ")) break;
        const item = l.match(/^\s+-\s+(.+)\s*$/);
        if (item && !item[1].startsWith("Evidence")) items.push(item[1]);
        if (l.startsWith("- ")) break; // next top-level field
      }
      current.tests = items;
      continue;
    }
    if (line.trim() === "- Evidence to attach:") {
      const items = [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j];
        if (l.startsWith("## ")) break;
        const item = l.match(/^\s+-\s+(.+)\s*$/);
        if (item) items.push(item[1]);
        if (l.startsWith("- ")) break; // next top-level field
      }
      current.evidence = items;
      continue;
    }
  }
  pushCurrent();

  if (tasks.length === 0) fail("No tasks found in 04_task_backlog.md");
  const ids = tasks.map((t) => t.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) fail("Duplicate task IDs found in 04_task_backlog.md");
  assertContiguous([...unique], "TASK");

  for (const t of tasks) {
    if (!t.mappedReqs.length) fail(`${t.id} missing Mapped Requirements`);
    if (!t.files.length) fail(`${t.id} missing Files to touch`);
    if (!t.tests.length) fail(`${t.id} missing Tests to add/run`);
    if (!t.evidence.length) fail(`${t.id} missing Evidence to attach`);
  }

  return tasks;
}

function parseReqCoverageFromTestPlan(md) {
  const coveredReqs = new Set();
  const re = /^\|\s*(REQ-\d{3})\s*\|/gm;
  let m;
  while ((m = re.exec(md))) {
    coveredReqs.add(m[1]);
  }
  if (coveredReqs.size === 0) {
    fail("No REQ rows found in 09_test_plan.md coverage table");
  }
  return coveredReqs;
}

function buildMatrix(reqs, tasks) {
  const tasksByReq = new Map();
  for (const r of reqs) tasksByReq.set(r.id, []);
  for (const t of tasks) {
    for (const r of t.mappedReqs) {
      if (!tasksByReq.has(r)) {
        fail(`${t.id} maps to unknown requirement ID: ${r}`);
      }
      tasksByReq.get(r).push(t);
    }
  }

  for (const r of reqs) {
    const mapped = tasksByReq.get(r.id) || [];
    if (mapped.length === 0) fail(`${r.id} has no mapped tasks`);
  }

  const header = [
    "# Traceability Matrix (REQ -> TASK -> files -> tests -> evidence)",
    "",
    "This file is generated from `01_requirements_catalog.md` and `04_task_backlog.md` by `scripts/traceability/ai-guided-onboarding.mjs`.",
    "Do not edit by hand; edit requirements/backlog and re-run the generator.",
    "",
  ].join("\n");

  const rows = [];
  rows.push("| REQ | Tasks | Files / Modules | Tests | Evidence Artifacts |");
  rows.push("| --- | ----- | -------------- | ----- | ------------------ |");

  for (const r of reqs) {
    const mappedTasks = tasksByReq.get(r.id) || [];
    const taskIds = mappedTasks.map((t) => t.id).sort();
    const files = [...new Set(mappedTasks.flatMap((t) => t.files))].sort();
    const tests = [...new Set(mappedTasks.flatMap((t) => t.tests))].sort();
    const evidence = [...new Set(mappedTasks.flatMap((t) => t.evidence))].sort();

    const cell = (items, max = 8) => {
      const clipped = items.length > max ? [...items.slice(0, max), `(+${items.length - max} more)`] : items;
      return clipped.join("<br>");
    };

    rows.push(
      `| ${r.id} | ${cell(taskIds, 10)} | ${cell(files, 8)} | ${cell(tests, 6)} | ${cell(evidence, 6)} |`
    );
  }

  return `${header}${rows.join("\n")}\n`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  assertRequiredDocsExist();
  const reqMd = readFileOrFail(REQUIREMENTS_PATH);
  const tasksMd = readFileOrFail(TASKS_PATH);
  const testPlanMd = readFileOrFail(TEST_PLAN_PATH);

  assertAsciiOnlyBlueprintDocs();

  const reqs = parseRequirements(reqMd);
  const tasks = parseTasks(tasksMd);
  const testCoveredReqs = parseReqCoverageFromTestPlan(testPlanMd);

  for (const req of reqs) {
    if (!testCoveredReqs.has(req.id)) {
      fail(`${req.id} missing from 09_test_plan.md REQ-to-test coverage table`);
    }
  }
  for (const reqId of testCoveredReqs) {
    if (!reqs.find((r) => r.id === reqId)) {
      fail(`${reqId} appears in 09_test_plan.md but is not present in 01_requirements_catalog.md`);
    }
  }

  const matrix = buildMatrix(reqs, tasks);

  if (!checkOnly) {
    fs.mkdirSync(BLUEPRINT_DIR, { recursive: true });
    fs.writeFileSync(MATRIX_PATH, matrix, "utf8");
    process.stdout.write(`Wrote ${path.relative(ROOT, MATRIX_PATH)} (${reqs.length} REQs, ${tasks.length} TASKs)\n`);
  } else {
    const existing = fs.existsSync(MATRIX_PATH) ? fs.readFileSync(MATRIX_PATH, "utf8") : "";
    if (existing !== matrix) fail("Traceability matrix is out of date. Re-run generator without --check.");
    process.stdout.write("OK: traceability matrix is up to date\n");
  }
}

main();
