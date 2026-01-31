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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const severityRank = { low: 1, med: 2, high: 3 };

function pushBlocker(blockers, code, message, severity, field_path) {
  blockers.push({ code, message, severity, ...(field_path ? { field_path } : {}) });
}

function clampCompletion(value) {
  const rounded = Math.round(value);
  return Math.max(0, Math.min(100, rounded));
}

function highestSeverity(blockers) {
  if (!blockers.length) return null;
  return blockers.reduce((highest, b) => (severityRank[b.severity] > severityRank[highest] ? b.severity : highest), blockers[0].severity);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function evaluateModule(module, content, context) {
  const blockers = [];
  let completion = 0;
  let hasContent = false;

  switch (module) {
    case "positioning": {
      const finalSentence = isNonEmptyString(content?.finalSentence);
      const proofPoints = asArray(content?.proofPoints);
      const differentiators = asArray(content?.differentiators);
      const forbiddenPromises = asArray(content?.boundaries?.forbiddenPromises);
      const proofPointsWithEvidence = proofPoints.filter((p) => isNonEmptyString(p?.evidence));

      hasContent = finalSentence || proofPoints.length > 0 || differentiators.length > 0 || forbiddenPromises.length > 0;

      const criteria = [
        finalSentence,
        proofPoints.length >= 3,
        proofPoints.length > 0 && proofPointsWithEvidence.length === proofPoints.length,
        differentiators.length >= 2,
        forbiddenPromises.length > 0,
      ];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!finalSentence) pushBlocker(blockers, "positioning.final_sentence_missing", "Add the final positioning sentence.", "high", "finalSentence");
      if (proofPoints.length < 3) pushBlocker(blockers, "positioning.proof_points_min", "Add at least 3 proof points.", "med", "proofPoints");
      if (proofPoints.length > 0 && proofPointsWithEvidence.length !== proofPoints.length) {
        pushBlocker(blockers, "positioning.proof_points_evidence", "All proof points need evidence links.", "high", "proofPoints");
      }
      if (differentiators.length < 2) pushBlocker(blockers, "positioning.differentiators_min", "Add at least 2 differentiators.", "med", "differentiators");
      if (forbiddenPromises.length === 0) pushBlocker(blockers, "positioning.forbidden_promises", "Define at least one forbidden promise.", "med", "boundaries.forbiddenPromises");
      break;
    }
    case "pillars": {
      const pillars = asArray(content?.pillars);
      const examplesComplete = pillars.every((p) => asArray(p?.examples).length >= 3);
      const coverageSum = pillars.reduce((sum, p) => sum + (typeof p?.coveragePercent === "number" ? p.coveragePercent : 0), 0);
      const coverageComplete = pillars.length > 0 ? coverageSum === 100 : false;

      hasContent = pillars.length > 0;

      const criteria = [pillars.length >= 3 && pillars.length <= 6, examplesComplete && pillars.length > 0, coverageComplete];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (pillars.length < 3 || pillars.length > 6) pushBlocker(blockers, "pillars.count_range", "Keep between 3 and 6 pillars.", "high", "pillars");
      if (pillars.some((p) => asArray(p?.examples).length < 3)) pushBlocker(blockers, "pillars.examples_min", "Add at least 3 examples per pillar.", "med", "pillars.examples");
      if (pillars.length > 0 && coverageSum !== 100) pushBlocker(blockers, "pillars.coverage_sum", "CoveragePercent must sum to 100.", "high", "pillars.coveragePercent");
      break;
    }
    case "campaign_plan": {
      const campaigns = asArray(content?.campaigns);
      const selectedMonth = typeof content?.selectedMonth === "string" ? content.selectedMonth : "";
      const selectedMonthValid = /^\d{4}-\d{2}$/.test(selectedMonth);
      const monthCampaigns = selectedMonthValid ? campaigns.filter((c) => typeof c?.startDate === "string" && c.startDate.startsWith(selectedMonth)) : [];

      const hasCampaignForMonth = monthCampaigns.length > 0;
      const assetsComplete = monthCampaigns.every((c) => asArray(c?.assets).length > 0);
      const offersComplete = monthCampaigns.every((c) => isNonEmptyString(c?.offer) && isNonEmptyString(c?.cta) && isNonEmptyString(c?.startDate) && isNonEmptyString(c?.endDate));

      hasContent = campaigns.length > 0 || isNonEmptyString(selectedMonth);

      const criteria = [selectedMonthValid && hasCampaignForMonth, assetsComplete && monthCampaigns.length > 0, offersComplete && monthCampaigns.length > 0];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!selectedMonthValid) pushBlocker(blockers, "campaigns.selected_month_invalid", "selectedMonth must be in YYYY-MM format.", "high", "selectedMonth");
      if (campaigns.length === 0) {
        pushBlocker(blockers, "campaigns.none", "Add at least one campaign.", "high", "campaigns");
      } else if (selectedMonthValid && !hasCampaignForMonth) {
        pushBlocker(
          blockers,
          "campaigns.month_mismatch",
          "At least one campaign must have startDate within selectedMonth. Update selectedMonth or campaign dates.",
          "high",
          "campaigns.startDate",
        );
      }
      if (monthCampaigns.some((c) => asArray(c?.assets).length === 0)) pushBlocker(blockers, "campaigns.assets_missing", "Add assets checklist entries for each campaign.", "high", "campaigns.assets");
      if (!offersComplete && monthCampaigns.length > 0) pushBlocker(blockers, "campaigns.offer_cta_dates", "Each campaign needs an offer, CTA, and dates.", "high", "campaigns");
      break;
    }
    case "weekly_plan": {
      const objective = typeof content?.weeklyFocus?.objective === "string" ? content.weeklyFocus.objective : "";
      const productionChecklist = asArray(content?.productionChecklist);
      const cadenceMatrix = content?.cadenceMatrix && typeof content.cadenceMatrix === "object" ? content.cadenceMatrix : {};

      hasContent = isNonEmptyString(objective) || productionChecklist.length > 0;

      const enabledChannels = asArray(context?.channel_adaptations?.channels).map((ch) => ({ key: ch?.platform, enabled: Boolean(ch?.enabled) }));
      const activeKeys = enabledChannels.length ? enabledChannels.filter((c) => c.enabled).map((c) => c.key) : Object.keys(cadenceMatrix);
      const cadenceComplete = activeKeys.length > 0 ? activeKeys.every((k) => typeof cadenceMatrix?.[k] === "number" && cadenceMatrix[k] > 0) : false;

      const criteria = [isNonEmptyString(objective), cadenceComplete, productionChecklist.length > 0];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!isNonEmptyString(objective)) pushBlocker(blockers, "weekly.objective_missing", "Add a weekly objective.", "high", "weeklyFocus.objective");
      if (!cadenceComplete) pushBlocker(blockers, "weekly.cadence_missing", "Cadence is missing for at least one active channel.", "med", "cadenceMatrix");
      if (productionChecklist.length === 0) pushBlocker(blockers, "weekly.production_missing", "Add items to the production checklist.", "high", "productionChecklist");
      break;
    }
    case "channel_adaptations": {
      const channels = asArray(content?.channels);
      const enabledChannels = channels.filter((ch) => Boolean(ch?.enabled));
      const translationTable = asArray(content?.translationTable);
      const enabledKeys = enabledChannels.map((ch) => ch?.platform).filter(Boolean);

      const ctaRulesComplete = enabledChannels.every((ch) => asArray(ch?.ctaRules).length > 0);
      const translationComplete =
        translationTable.length > 0 &&
        translationTable.every((row) => {
          const hasCore = isNonEmptyString(row?.coreMessage);
          const variants = row?.variants && typeof row.variants === "object" ? row.variants : {};
          const hasVariants = enabledKeys.every((k) => isNonEmptyString(variants?.[k]));
          return hasCore && hasVariants;
        });

      hasContent = enabledChannels.length > 0 || translationTable.length > 0;

      const criteria = [enabledChannels.length >= 1, ctaRulesComplete, translationComplete];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (enabledChannels.length < 1) pushBlocker(blockers, "channels.count_min", "Enable at least 1 channel.", "high", "channels");
      if (!ctaRulesComplete && enabledChannels.length > 0) pushBlocker(blockers, "channels.cta_rules", "Add CTA rules for each enabled channel.", "med", "channels.ctaRules");
      if (!translationComplete) pushBlocker(blockers, "channels.translation_table", "Translation table needs a core message and variants.", "high", "translationTable");
      break;
    }
    case "rules_constraints": {
      const claimsPolicy = asArray(content?.claimsPolicy);
      const bannedWords = asArray(content?.bannedWords);
      const approvalTriggers = asArray(content?.approvalTriggers);

      const proofRequiredMissing = claimsPolicy.filter((c) => c?.status === "proof_required" && !isNonEmptyString(c?.proofLink));

      hasContent = claimsPolicy.length > 0 || bannedWords.length > 0;

      const criteria = [proofRequiredMissing.length === 0 && claimsPolicy.length > 0, bannedWords.length > 0, approvalTriggers.length > 0];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (proofRequiredMissing.length > 0) pushBlocker(blockers, "rules.proof_links", "Proof-required claims need proof links.", "high", "claimsPolicy");
      if (bannedWords.length === 0) pushBlocker(blockers, "rules.banned_terms", "Add banned terms.", "med", "bannedWords");
      if (approvalTriggers.length === 0) pushBlocker(blockers, "rules.approval_triggers", "Add approval triggers.", "med", "approvalTriggers");
      break;
    }
    default: {
      hasContent = content && typeof content === "object" ? Object.keys(content).length > 0 : false;
      completion = hasContent ? 50 : 0;
      break;
    }
  }

  const isLocked = Boolean(context?.locked);
  const currentStatus = context?.currentStatus ?? "draft";
  const hasBlockers = blockers.length > 0;
  const highest = highestSeverity(blockers);

  let status = "draft";
  if (!hasContent) status = "empty";
  else if (isLocked) status = "locked";
  else if (hasBlockers) {
    if (completion >= 80 && highest === "low") status = "review";
    else status = "draft";
  } else if (currentStatus === "approved") status = "approved";
  else if (completion >= 80) status = "review";
  else status = "draft";

  return { completion_percent: clampCompletion(completion), blockers, status };
}

async function main() {
  const repoRoot = process.cwd();
  loadDotEnv(path.join(repoRoot, ".env"));
  loadDotEnv(path.join(repoRoot, ".env.local"));
  loadDotEnv(path.join(repoRoot, "supabase", ".env"));

  const agencyId = getArgValue("--agency-id") ?? process.env.TEST_AGENCY_ID ?? null;
  const clientIds = getArgValues("--client-id");
  assert(agencyId, "Missing --agency-id (or TEST_AGENCY_ID env).");
  assert(clientIds.length > 0, "Missing one or more --client-id args.");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  assert(supabaseUrl, "Missing SUPABASE_URL/VITE_SUPABASE_URL.");
  assert(supabaseKey, "Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY.");

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  for (const clientId of clientIds) {
    const { data: strategyRow, error: strategyErr } = await supabase
      .from("strategies")
      .select("id,version_int,status")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("version_int", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (strategyErr) throw strategyErr;
    if (!strategyRow?.id) {
      console.log(`[skip] client=${clientId} (no strategies row)`);
      continue;
    }

    const strategyId = strategyRow.id;
    const { data: moduleRows, error: moduleErr } = await supabase
      .from("strategy_modules")
      .select("id,module,content_json,locked,status")
      .eq("strategy_id", strategyId)
      .order("module");
    if (moduleErr) throw moduleErr;

    const modulesByName = Object.fromEntries((moduleRows ?? []).map((r) => [r.module, r]));
    const channelAdaptations = modulesByName.channel_adaptations?.content_json ?? null;

    let updated = 0;
    for (const row of moduleRows ?? []) {
      const moduleName = row.module;
      const result = evaluateModule(moduleName, row.content_json, {
        channel_adaptations: channelAdaptations,
        locked: row.locked,
        currentStatus: row.status,
      });

      const { error: updateErr } = await supabase
        .from("strategy_modules")
        .update({
          status: result.status,
          completion_percent: result.completion_percent,
          blocker_count: result.blockers.length,
          blockers: result.blockers,
        })
        .eq("id", row.id);
      if (updateErr) throw updateErr;
      updated += 1;
    }

    console.log(`[ok] client=${clientId} strategy=${strategyId} modules_updated=${updated}`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});

