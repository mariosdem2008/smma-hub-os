import fs from "fs";
import path from "path";

function readJsonl(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const root = process.cwd();
const datasets = [
  path.join(root, "tests", "evals", "agentic_golden.template.jsonl"),
  path.join(root, "tests", "evals", "workflows", "multistep_100.jsonl"),
  path.join(root, "tests", "evals", "intent_classification_50.template.jsonl"),
];

if (process.env.AI_EVALS_ENABLED !== "true") {
  console.log("Evals are disabled by default. Set AI_EVALS_ENABLED=true to run.");
  process.exit(0);
}

const totals: Record<string, number> = {};
const minimums: Record<string, number> = {
  [datasets[0]]: 100,
  [datasets[1]]: 100,
  [datasets[2]]: 50,
};

for (const file of datasets) {
  if (!fs.existsSync(file)) {
    console.error(`Missing dataset: ${file}`);
    process.exitCode = 1;
    continue;
  }
  const rows = readJsonl(file);
  totals[file] = rows.length;
  const modes = rows.reduce((acc: Record<string, number>, row: any) => {
    const mode = row.mode_expected ?? "UNKNOWN";
    acc[mode] = (acc[mode] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Dataset: ${file}`);
  console.log(`Total: ${rows.length}`);
  console.log(`Modes: ${JSON.stringify(modes)}`);
  const min = minimums[file];
  if (min !== undefined && rows.length < min) {
    console.error(`Dataset below minimum rows (${rows.length} < ${min}): ${file}`);
    process.exitCode = 1;
  }
}

console.log("Eval harness stub complete.");
