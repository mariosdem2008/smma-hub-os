import fs from "fs";
import path from "path";

type WorkflowRow = {
  workflow_id: string;
  mode_expected?: string;
  steps: string[];
  expected: string;
};

function readJsonl(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function normalizeStep(step: string) {
  const raw = step.trim();
  // Allow both ToolType strings and legacy human-readable names.
  const lowered = raw
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/\s+/g, "_")
    .toLowerCase();

  const alias: Record<string, string> = {
    search_knowledge_base: "search_knowledge_base",
    searchknowledgebase: "search_knowledge_base",
    get_client_history: "get_client_history",
    getclienthistory: "get_client_history",
    fetch_campaign_performance: "fetch_campaign_performance",
    fetchcampaignperformance: "fetch_campaign_performance",
    get_account_details: "get_account_details",
    getaccountdetails: "get_account_details",
    update_client_record: "update_client_record",
    updateclientrecord: "update_client_record",
    create_new_task: "create_new_task",
    createnewtask: "create_new_task",
    generate_strategy_report: "generate_strategy_report",
    generatestrategyreport: "generate_strategy_report",
    trigger_email_sequence: "trigger_email_sequence",
    triggeremailsequence: "trigger_email_sequence",
    propose_memory_write: "propose_memory_write",
    proposememorywrite: "propose_memory_write",
    validate_pii: "validate_pii",
    validatepii: "validate_pii",
    check_compliance_flags: "check_compliance_flags",
    checkcomplianceflags: "check_compliance_flags",
    approve_action: "approve_action",
    approveaction: "approve_action",
  };

  return alias[lowered] ?? null;
}

function simulateTool(step: string) {
  const toolType = normalizeStep(step);
  if (!toolType) return { success: false, error: "unknown_tool_step" };
  return { success: true, result: { tool: toolType } };
}

function runWorkflow(row: WorkflowRow) {
  const results: Array<{ step: string; success: boolean }> = [];
  for (const step of row.steps) {
    const outcome = simulateTool(step);
    results.push({ step, success: outcome.success });
    if (!outcome.success) return { success: false, results };
  }
  return { success: true, results };
}

const root = process.cwd();
const dataset = path.join(root, "tests", "evals", "workflows", "multistep_100.jsonl");

if (process.env.AI_EVALS_ENABLED !== "true") {
  console.log("Replay harness disabled by default. Set AI_EVALS_ENABLED=true to run.");
  process.exit(0);
}

if (!fs.existsSync(dataset)) {
  console.error(`Missing dataset: ${dataset}`);
  process.exit(1);
}

const rows = readJsonl(dataset) as WorkflowRow[];
let successCount = 0;
for (const row of rows) {
  const outcome = runWorkflow(row);
  const expected = String((row as any).expected ?? "success").toLowerCase();
  const passed = expected === "success" ? outcome.success : !outcome.success;
  if (passed) successCount += 1;
}

const successRate = rows.length > 0 ? successCount / rows.length : 0;
console.log(`Workflows: ${rows.length}`);
console.log(`Success: ${successCount}`);
console.log(`Success rate: ${(successRate * 100).toFixed(2)}%`);

if (rows.length < 100 || successRate < 0.95) {
  process.exitCode = 1;
}
