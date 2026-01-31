import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);

const getArgValues = (name) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
};

const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};

const hasFlag = (name) => args.includes(name);

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some(isFilled);
  return false;
}

function getPathValue(source, pathStr) {
  return pathStr.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), source);
}

const REQUIRED_CLIENT_BRAIN_FIELDS = [
  "brand_basics.name",
  "offer_details.products_services",
  "audience.problems",
  "pillars",
  "goals",
];
const REQUIRED_CLIENT_BRAIN_GROUPS = [{ key: "constraints.banned_claims_or_taboo_topics", paths: ["constraints.banned_claims", "constraints.taboo_topics"] }];

function evaluateClientBrainGate(brainJson) {
  const missing = REQUIRED_CLIENT_BRAIN_FIELDS.filter((p) => !isFilled(getPathValue(brainJson, p)));
  for (const group of REQUIRED_CLIENT_BRAIN_GROUPS) {
    const groupFilled = group.paths.some((p) => isFilled(getPathValue(brainJson, p)));
    if (!groupFilled) missing.push(group.key);
  }
  return { usable: missing.length === 0, missing_fields: missing };
}

function redactUuid(id) {
  if (typeof id !== "string") return id;
  if (!id.includes("-")) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString();
  } catch {
    return String(value);
  }
}

async function main() {
  // Load .env for local runs (without printing secrets)
  const repoRoot = process.cwd();
  loadDotEnv(path.join(repoRoot, ".env"));
  loadDotEnv(path.join(repoRoot, ".env.local"));
  loadDotEnv(path.join(repoRoot, "supabase", ".env"));

  const agencyId = getArgValue("--agency-id") ?? process.env.TEST_AGENCY_ID ?? process.env.AGENCY_ID ?? null;
  const clientIds = getArgValues("--client-id").length ? getArgValues("--client-id") : [];
  const brainDocIds = getArgValues("--brain-doc-id");
  const dumpDir = getArgValue("--dump-dir");
  const details = hasFlag("--details");
  const brainDocDetails = hasFlag("--brain-doc-details");

  assert(agencyId, "Missing agency id. Provide --agency-id or env TEST_AGENCY_ID/AGENCY_ID.");
  assert(clientIds.length > 0, "Missing client id(s). Provide one or more --client-id arguments.");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  assert(supabaseUrl, "Missing SUPABASE_URL or VITE_SUPABASE_URL.");
  assert(supabaseKey, "Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY.");

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: agencyBrainDocs, error: agencyBrainError } = await supabase
    .from("brain_documents")
    .select("id,module,title,status,version,updated_at")
    .eq("agency_id", agencyId)
    .in("module", ["quality_bar", "sop_strategy"])
    .order("module");
  if (agencyBrainError) throw agencyBrainError;

  console.log("Agency brain docs (quality_bar, sop_strategy)");
  for (const doc of agencyBrainDocs ?? []) {
    console.log(`- ${doc.module} v${doc.version} (${doc.status}): ${doc.title} [${redactUuid(doc.id)}] updated=${formatDate(doc.updated_at)}`);
  }
  if (!(agencyBrainDocs ?? []).length) console.log("- (none found)");

  if (brainDocIds.length) {
    const { data: referenced, error } = await supabase
      .from("brain_documents")
      .select(brainDocDetails ? "id,module,title,status,version,updated_at,content_json" : "id,module,title,status,version,updated_at")
      .in("id", brainDocIds);
    if (error) throw error;
    console.log("");
    console.log("Referenced brain_document_id lookups");
    for (const doc of referenced ?? []) {
      console.log(`- ${doc.module} v${doc.version} (${doc.status}): ${doc.title} [${redactUuid(doc.id)}] updated=${formatDate(doc.updated_at)}`);
      if (brainDocDetails && doc.content_json && typeof doc.content_json === "object") {
        if (doc.module === "quality_bar") {
          const criteriaCount = Array.isArray(doc.content_json.review_criteria) ? doc.content_json.review_criteria.length : 0;
          console.log(
            `  details: acceptance_threshold=${doc.content_json.acceptance_threshold ?? ""} revision_limits=${doc.content_json.revision_limits ?? ""} review_criteria=${criteriaCount}`,
          );
        }
        if (doc.module === "sop_strategy") {
          const pillarsCount = Array.isArray(doc.content_json.pillars) ? doc.content_json.pillars.length : 0;
          const platformCount = Array.isArray(doc.content_json.platform_priorities) ? doc.content_json.platform_priorities.length : 0;
          console.log(`  details: pillars=${pillarsCount} platform_priorities=${platformCount} planning_cadence=${doc.content_json.planning_cadence ?? ""}`);
        }
      }
    }
    const foundIds = new Set((referenced ?? []).map((d) => d.id));
    const missing = brainDocIds.filter((id) => !foundIds.has(id));
    for (const id of missing) console.log(`- NOT FOUND: ${redactUuid(id)}`);

    if (dumpDir) {
      const outPath = path.join(dumpDir, `brain_docs_${agencyId}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ agency_id: agencyId, brain_documents: referenced ?? [] }, null, 2));
      console.log(`- wrote dump: ${outPath}`);
    }
  }

  if (dumpDir) {
    fs.mkdirSync(dumpDir, { recursive: true });
  }

  for (const clientId of clientIds) {
    console.log("");
    console.log(`Client ${redactUuid(clientId)}`);

    const { data: brainRow, error: brainErr } = await supabase
      .from("client_brains")
      .select("id,version,status,usable,locked,confidence,updated_at,brain_json")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (brainErr) throw brainErr;

    if (!brainRow) {
      console.log("- client_brains: (none)");
    } else {
      const gate = evaluateClientBrainGate(brainRow.brain_json ?? {});
      console.log(
        `- client_brains: v${brainRow.version} status=${brainRow.status} usable=${Boolean(brainRow.usable)} gate_usable=${gate.usable} locked=${Boolean(
          brainRow.locked,
        )} confidence=${brainRow.confidence} updated=${formatDate(brainRow.updated_at)}`,
      );
      if (!gate.usable) console.log(`- client_brains missing_fields: ${gate.missing_fields.join(", ")}`);
    }

    const { data: strategyDoc, error: strategyDocErr } = await supabase
      .from("strategy_documents")
      .select("id,is_active,model,created_at,updated_at,derived_from_hash")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (strategyDocErr) throw strategyDocErr;

    console.log(
      `- strategy_documents active: ${strategyDoc ? `[${redactUuid(strategyDoc.id)}] model=${strategyDoc.model ?? "unknown"} updated=${formatDate(strategyDoc.updated_at)}` : "(none)"}`,
    );

    const { data: moduleRows, error: moduleErr } = await supabase
      .from("strategy_modules")
      .select(
        details
          ? "id,module,status,completion_percent,blocker_count,ai_generated,ai_confidence,version,updated_at,strategy_id,blockers,content_json"
          : "id,module,status,completion_percent,blocker_count,ai_generated,ai_confidence,version,updated_at,strategy_id,blockers",
      )
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (moduleErr) throw moduleErr;

    const latestByModule = new Map();
    for (const row of moduleRows ?? []) {
      if (!latestByModule.has(row.module)) latestByModule.set(row.module, row);
    }
    console.log("- strategy_modules (latest per module)");
    for (const row of Array.from(latestByModule.values()).sort((a, b) => String(a.module).localeCompare(String(b.module)))) {
      const blockerCodes = Array.isArray(row.blockers) ? row.blockers.map((b) => b?.code).filter(Boolean).slice(0, 8) : [];
      const blockersText = blockerCodes.length ? ` blockers=[${blockerCodes.join(", ")}]` : "";
      console.log(
        `  - ${row.module} v${row.version} status=${row.status} completion=${row.completion_percent} ai_conf=${row.ai_confidence} updated=${formatDate(
          row.updated_at,
        )}${blockersText}`,
      );

      if (details && row.content_json && typeof row.content_json === "object") {
        const c = row.content_json;
        if (row.module === "positioning") {
          const proofPoints = Array.isArray(c.proofPoints) ? c.proofPoints : [];
          const differentiators = Array.isArray(c.differentiators) ? c.differentiators : [];
          console.log(
            `    details: finalSentence=${Boolean((c.finalSentence ?? "").trim())} proofPoints=${proofPoints.length} differentiators=${differentiators.length}`,
          );
        } else if (row.module === "pillars") {
          const pillars = Array.isArray(c.pillars) ? c.pillars : [];
          const sum = pillars.reduce((acc, p) => acc + (typeof p?.coveragePercent === "number" ? p.coveragePercent : 0), 0);
          const examplesMin = pillars.length ? Math.min(...pillars.map((p) => (Array.isArray(p?.examples) ? p.examples.length : 0))) : 0;
          console.log(`    details: pillars=${pillars.length} coverage_sum=${sum} min_examples_per_pillar=${examplesMin}`);
        } else if (row.module === "campaign_plan") {
          const campaigns = Array.isArray(c.campaigns) ? c.campaigns : [];
          const selectedMonth = typeof c.selectedMonth === "string" ? c.selectedMonth : "";
          const monthMatches = campaigns.filter((x) => typeof x?.startDate === "string" && x.startDate.startsWith(selectedMonth));
          const placeholderDates = campaigns.some(
            (x) => typeof x?.startDate === "string" && /Current Month/i.test(x.startDate),
          );
          console.log(
            `    details: selectedMonth=${selectedMonth || "(empty)"} campaigns=${campaigns.length} campaigns_in_selectedMonth=${monthMatches.length} placeholderDates=${placeholderDates}`,
          );
        } else if (row.module === "weekly_plan") {
          const objective = c?.weeklyFocus?.objective ?? "";
          const cadence = c?.cadenceMatrix ?? {};
          const checklist = Array.isArray(c.productionChecklist) ? c.productionChecklist : [];
          console.log(
            `    details: selectedWeek=${c.selectedWeek || "(empty)"} objective=${Boolean(String(objective).trim())} cadence_keys=${
              cadence && typeof cadence === "object" ? Object.keys(cadence).length : 0
            } checklist_items=${checklist.length}`,
          );
        } else if (row.module === "channel_adaptations") {
          const channels = Array.isArray(c.channels) ? c.channels : [];
          const enabled = channels.filter((ch) => ch?.enabled);
          const examplesMin = enabled.length ? Math.min(...enabled.map((ch) => (Array.isArray(ch?.examples) ? ch.examples.length : 0))) : 0;
          const translationRows = Array.isArray(c.translationTable) ? c.translationTable : [];
          console.log(
            `    details: enabled_channels=${enabled.length} min_examples_per_enabled_channel=${examplesMin} translation_rows=${translationRows.length}`,
          );
        } else if (row.module === "rules_constraints") {
          const claims = Array.isArray(c.claimsPolicy) ? c.claimsPolicy : [];
          const proofReqMissing = claims.filter((x) => x?.status === "proof_required" && !x?.proofLink);
          console.log(
            `    details: claimsPolicy=${claims.length} proof_required_missing_links=${proofReqMissing.length} bannedWords=${
              Array.isArray(c.bannedWords) ? c.bannedWords.length : 0
            } approvalTriggers=${Array.isArray(c.approvalTriggers) ? c.approvalTriggers.length : 0}`,
          );
        }
      }
    }
    if (latestByModule.size === 0) console.log("  - (none)");

    if (dumpDir && latestByModule.size > 0) {
      const payload = {
        agency_id: agencyId,
        client_id: clientId,
        generated_at: new Date().toISOString(),
        strategy_document: strategyDoc ?? null,
        latest_client_brain: brainRow
          ? {
              id: brainRow.id,
              version: brainRow.version,
              status: brainRow.status,
              usable: brainRow.usable,
              locked: brainRow.locked,
              confidence: brainRow.confidence,
              updated_at: brainRow.updated_at,
              brain_json: brainRow.brain_json ?? {},
            }
          : null,
        latest_modules: Object.fromEntries(
          Array.from(latestByModule.entries()).map(([module, row]) => [
            module,
            {
              id: row.id,
              module: row.module,
              status: row.status,
              completion_percent: row.completion_percent,
              blocker_count: row.blocker_count,
              blockers: row.blockers,
              ai_confidence: row.ai_confidence,
              version: row.version,
              updated_at: row.updated_at,
              strategy_id: row.strategy_id,
              ...(row.content_json ? { content_json: row.content_json } : {}),
            },
          ]),
        ),
      };
      const outPath = path.join(dumpDir, `strategy_quality_${clientId}.json`);
      fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
      console.log(`- wrote dump: ${outPath}`);
    }
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
