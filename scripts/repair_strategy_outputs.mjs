import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
};
const getArgValues = (name) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function currentMonthUtc(now) {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
}

function isoWeekString(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${pad2(week)}`;
}

function isoWeekStartDateUtc(isoWeek) {
  const match = String(isoWeek).match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return start;
}

function ymd(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "string") continue;
    const val = item.trim();
    if (!val || seen.has(val)) continue;
    seen.add(val);
    out.push(val);
  }
  return out;
}

function replaceKeywordPlaceholders(text) {
  if (typeof text !== "string") return text;
  return text.replace(/\[KEYWORD\]/gi, "keyword");
}

function repairCampaignPlan(campaignPlan, now) {
  const month = currentMonthUtc(now);
  const startDate = `${month}-01`;
  const endDate = `${month}-28`;

  const campaigns = asArray(campaignPlan?.campaigns)
    .map((c, i) => ({ ...c, id: typeof c?.id === "string" ? c.id : `c${i + 1}` }))
    .filter((c) => typeof c?.name === "string" && c.name.trim().length > 0)
    .filter((c) => typeof c?.offer === "string" || typeof c?.goal === "string");

  const kept = campaigns.length ? [campaigns[0]] : [];
  const fixed = kept.length
    ? kept.map((c) => ({
        ...c,
        name: replaceKeywordPlaceholders(c.name),
        goal: replaceKeywordPlaceholders(c.goal ?? "Drive measurable conversions this month."),
        offer: replaceKeywordPlaceholders(c.offer ?? "Primary offer"),
        cta: replaceKeywordPlaceholders(c.cta ?? "visit_store"),
        icp: replaceKeywordPlaceholders(c.icp ?? ""),
        angle: replaceKeywordPlaceholders(c.angle ?? ""),
        assets: asArray(c.assets).length
          ? asArray(c.assets)
          : [
              { name: "Offer explainer video", completed: false },
              { name: "3 proof posts (reviews/results)", completed: false },
              { name: "FAQ carousel", completed: false },
            ],
        kpiTargets: c.kpiTargets && typeof c.kpiTargets === "object" ? c.kpiTargets : {},
        startDate,
        endDate,
        status: ["planned", "active", "completed", "cancelled"].includes(c.status) ? c.status : "planned",
      }))
    : [
        {
          id: "c1",
          name: "Month 1 Campaign",
          goal: "Drive measurable conversions this month.",
          offer: "Primary offer",
          cta: "visit_store",
          icp: "",
          pillarIds: [],
          angle: "Clear offer + simple next step.",
          assets: [
            { name: "Offer explainer video", completed: false },
            { name: "3 proof posts (reviews/results)", completed: false },
            { name: "FAQ carousel", completed: false },
          ],
          kpiTargets: {},
          startDate,
          endDate,
          status: "planned",
        },
      ];

  return {
    ...(campaignPlan ?? {}),
    meta: { ...(campaignPlan?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    selectedMonth: month,
    campaigns: fixed,
    stopDoing: uniqStrings(asArray(campaignPlan?.stopDoing)),
    decisions: campaignPlan?.decisions ?? { monthlyOffersLocked: true, activeCampaignsLocked: true },
  };
}

function repairWeeklyPlan(weeklyPlan, channelAdaptations, now) {
  const week = isoWeekString(now);
  const weekStart = isoWeekStartDateUtc(week) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due1 = new Date(weekStart);
  due1.setUTCDate(weekStart.getUTCDate() + 1);
  const due2 = new Date(weekStart);
  due2.setUTCDate(weekStart.getUTCDate() + 3);
  const due3 = new Date(weekStart);
  due3.setUTCDate(weekStart.getUTCDate() + 5);

  const enabled = asArray(channelAdaptations?.channels).filter((c) => c?.enabled).map((c) => c.platform);
  const cadenceMatrix = weeklyPlan?.cadenceMatrix && typeof weeklyPlan.cadenceMatrix === "object" ? { ...weeklyPlan.cadenceMatrix } : {};
  for (const platform of enabled) {
    if (typeof cadenceMatrix[platform] !== "number" || cadenceMatrix[platform] <= 0) cadenceMatrix[platform] = platform === "tiktok" ? 5 : 3;
  }

  return {
    ...(weeklyPlan ?? {}),
    meta: { ...(weeklyPlan?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    selectedWeek: week,
    weeklyFocus: {
      ...(weeklyPlan?.weeklyFocus ?? { objective: "", primaryCampaignId: "c1", priorityPillarIds: [], kpiFocus: [] }),
      objective: (weeklyPlan?.weeklyFocus?.objective ?? "").trim() || "Execute a consistent week of content aligned to pillars and conversion CTA.",
    },
    cadenceMatrix,
    productionChecklist: asArray(weeklyPlan?.productionChecklist).length
      ? asArray(weeklyPlan.productionChecklist).map((t) => ({ ...t, dueDate: typeof t?.dueDate === "string" && t.dueDate ? t.dueDate : ymd(due3) }))
      : [
          { id: "w1_t1", type: "script", title: "Script: 2 pillar posts + 1 offer post", owner: "Content Creator", dueDate: ymd(due1), completed: false },
          { id: "w1_t2", type: "shoot", title: "Shoot: 3 short-form videos", owner: "Client Team", dueDate: ymd(due2), completed: false },
          { id: "w1_t3", type: "approval", title: "Approve: weekly batch", owner: "Client Contact", dueDate: ymd(due3), completed: false },
        ],
    weeklyReview: weeklyPlan?.weeklyReview ?? { wins: [], losses: [], changesNextWeek: [] },
    decisions: weeklyPlan?.decisions ?? { objectiveLocked: true, cadenceLocked: true },
  };
}

function repairPillars(pillars) {
  const repaired = asArray(pillars?.pillars).map((p, idx) => {
    const examples = uniqStrings(asArray(p?.examples).map(replaceKeywordPlaceholders));
    const filled = examples.length >= 3
      ? examples
      : uniqStrings([
          ...examples,
          `Example idea 1 for ${p?.name ?? `pillar ${idx + 1}`}`,
          `Example idea 2 for ${p?.name ?? `pillar ${idx + 1}`}`,
          `Example idea 3 for ${p?.name ?? `pillar ${idx + 1}`}`,
        ]).slice(0, 6);
    return { ...p, id: typeof p?.id === "string" ? p.id : `p${idx + 1}`, examples: filled };
  });

  return {
    ...(pillars ?? {}),
    meta: { ...(pillars?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    pillars: repaired,
    proofInventory: asArray(pillars?.proofInventory),
    decisions: pillars?.decisions ?? { pillarNamesLocked: true, coverageLocked: true, bannedAnglesLocked: true },
  };
}

function repairPositioning(positioning) {
  const proofPoints = asArray(positioning?.proofPoints).map((p, i) => ({ ...p, id: typeof p?.id === "string" ? p.id : `pp${i + 1}` }));
  while (proofPoints.length < 3) {
    const id = `pp${proofPoints.length + 1}`;
    proofPoints.push({
      id,
      claim: "Members see meaningful progress through consistent accountability and support.",
      evidence: "Client-provided proof (reviews/testimonials/before-after). Link TBD.",
      confidence: 3,
    });
  }

  return {
    ...(positioning ?? {}),
    meta: { ...(positioning?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    finalSentence: replaceKeywordPlaceholders(positioning?.finalSentence ?? ""),
    proofPoints,
    differentiators: asArray(positioning?.differentiators).length ? positioning.differentiators : [
      { id: "d1", rank: 1, approvedPhrasing: "Personalized accountability", bannedPhrasing: ["Guaranteed results"] },
      { id: "d2", rank: 2, approvedPhrasing: "Supportive local community", bannedPhrasing: ["The best", "Number 1"] },
    ],
    boundaries: {
      ...(positioning?.boundaries ?? { allowedPromises: [], riskyPromises: [], forbiddenPromises: [] }),
      forbiddenPromises: uniqStrings([...(positioning?.boundaries?.forbiddenPromises ?? []), "Guaranteed results", "Instant transformation"]),
    },
  };
}

function repairChannelAdaptations(channels) {
  const repairedChannels = asArray(channels?.channels).map((ch, idx) => {
    const examples = uniqStrings(asArray(ch?.examples).map(replaceKeywordPlaceholders));
    const filled = examples.length >= 2
      ? examples
      : uniqStrings([...examples, `Example idea 1 for ${ch?.platform ?? "channel"}`, `Example idea 2 for ${ch?.platform ?? "channel"}`]);
    return { ...ch, id: typeof ch?.id === "string" ? ch.id : `ch${idx + 1}`, role: replaceKeywordPlaceholders(ch?.role ?? ""), ctaRules: uniqStrings(asArray(ch?.ctaRules).map(replaceKeywordPlaceholders)), examples: filled };
  });

  const enabled = repairedChannels.filter((c) => c?.enabled).map((c) => c.platform).filter(Boolean);
  const tt = asArray(channels?.translationTable);
  const core = replaceKeywordPlaceholders(tt[0]?.coreMessage ?? "Take the next step today.");
  const variants = (tt[0]?.variants && typeof tt[0].variants === "object") ? { ...tt[0].variants } : {};
  for (const platform of enabled) {
    if (typeof variants[platform] !== "string" || !variants[platform].trim()) variants[platform] = core;
    variants[platform] = replaceKeywordPlaceholders(variants[platform]);
  }

  return {
    ...(channels ?? {}),
    meta: { ...(channels?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    channels: repairedChannels,
    translationTable: [{ coreMessage: core, variants }],
    decisions: channels?.decisions ?? { ctasLocked: true, rulesLocked: true },
  };
}

function repairRulesConstraints(rules) {
  const claimsPolicy = asArray(rules?.claimsPolicy).map((c, i) => ({
    ...c,
    id: typeof c?.id === "string" ? c.id : `cl${i + 1}`,
    proofLink: c?.status === "proof_required" && (!c?.proofLink || !String(c.proofLink).trim())
      ? "TBD - add verified proof link (case study / data / approved testimonial)."
      : c?.proofLink,
  }));

  const bannedWords = uniqStrings(asArray(rules?.bannedWords));
  const ensuredBanned = bannedWords.length >= 3 ? bannedWords : uniqStrings([...bannedWords, "Guaranteed", "Miracle", "Cure", "Always", "Never"]).slice(0, 8);
  const approvalTriggers = asArray(rules?.approvalTriggers).length
    ? asArray(rules.approvalTriggers)
    : [
        { id: "at1", condition: "Any post making a quantifiable claim", action: "Requires internal review + proof verification." },
        { id: "at2", condition: "Any testimonial or before/after content", action: "Requires client approval." },
      ];

  return {
    ...(rules ?? {}),
    meta: { ...(rules?.meta ?? {}), source: "REPAIR_SCRIPT_V1", generated_at: new Date().toISOString() },
    claimsPolicy,
    bannedWords: ensuredBanned,
    requiredDisclaimers: uniqStrings(asArray(rules?.requiredDisclaimers)),
    approvalTriggers,
    decisions: rules?.decisions ?? { forbiddenClaimsLocked: true, bannedTermsLocked: true },
  };
}

function buildDocumentMarkdown(modules, title) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push(`\n## Positioning\n${modules.positioning?.finalSentence ?? ""}`.trim());
  lines.push(`\n## Pillars`);
  for (const p of asArray(modules.pillars?.pillars)) {
    lines.push(`- ${p.name} (${p.coveragePercent}%): ${asArray(p.examples).slice(0, 3).join("; ")}`);
  }
  lines.push(`\n## Campaign (${modules.campaign_plan?.selectedMonth ?? ""})`);
  const c = asArray(modules.campaign_plan?.campaigns)[0];
  if (c) {
    lines.push(`- ${c.name}: ${c.startDate} → ${c.endDate}`);
    lines.push(`- Offer: ${c.offer}`);
    lines.push(`- CTA: \`${c.cta}\``);
  }
  lines.push(`\n## Weekly Plan (${modules.weekly_plan?.selectedWeek ?? ""})`);
  lines.push(`- Objective: ${modules.weekly_plan?.weeklyFocus?.objective ?? ""}`);
  lines.push(`- Checklist:`);
  for (const t of asArray(modules.weekly_plan?.productionChecklist)) {
    lines.push(`  - [ ] ${t.title} (due ${t.dueDate})`);
  }
  lines.push(`\n## Channels`);
  for (const ch of asArray(modules.channel_adaptations?.channels)) {
    if (!ch.enabled) continue;
    lines.push(`- ${ch.platform}: ${asArray(ch.examples).slice(0, 2).join("; ")}`);
  }
  lines.push(`\n## Rules`);
  lines.push(`- Banned terms: ${asArray(modules.rules_constraints?.bannedWords).join(", ")}`);
  return lines.join("\n");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function main() {
  const repoRoot = process.cwd();
  loadDotEnv(path.join(repoRoot, ".env"));
  loadDotEnv(path.join(repoRoot, ".env.local"));
  loadDotEnv(path.join(repoRoot, "supabase", ".env"));

  const agencyId = getArgValue("--agency-id") ?? process.env.TEST_AGENCY_ID ?? null;
  const clientIds = getArgValues("--client-id");
  const dryRun = hasFlag("--dry-run");
  assert(agencyId, "Missing --agency-id (or TEST_AGENCY_ID env).");
  assert(clientIds.length > 0, "Provide one or more --client-id args.");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  assert(supabaseUrl, "Missing SUPABASE_URL/VITE_SUPABASE_URL.");
  assert(serviceRoleKey, "Missing SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY.");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: adminRow, error: adminErr } = await supabase
    .from("agency_members")
    .select("user_id, role, created_at")
    .eq("agency_id", agencyId)
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (adminErr) throw adminErr;
  assert(adminRow?.user_id, "No admin/owner found for agency (needed for create_strategy_snapshot.p_user_id).");
  const actingUserId = adminRow.user_id;

  for (const clientId of clientIds) {
    const { data: strategyRow, error: strategyErr } = await supabase
      .from("strategies")
      .select("id,version_int")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("version_int", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (strategyErr) throw strategyErr;
    assert(strategyRow?.id, `No strategy row found for client ${clientId}`);

    const strategyId = strategyRow.id;
    const { data: moduleRows, error: moduleErr } = await supabase
      .from("strategy_modules")
      .select("module,content_json")
      .eq("strategy_id", strategyId);
    if (moduleErr) throw moduleErr;
    const modules = Object.fromEntries((moduleRows ?? []).map((r) => [r.module, r.content_json ?? {}]));

    const now = new Date();
    const repaired = {
      positioning: repairPositioning(modules.positioning ?? {}),
      pillars: repairPillars(modules.pillars ?? {}),
      campaign_plan: repairCampaignPlan(modules.campaign_plan ?? {}, now),
      channel_adaptations: repairChannelAdaptations(modules.channel_adaptations ?? {}),
      weekly_plan: null,
      rules_constraints: null,
    };
    repaired.weekly_plan = repairWeeklyPlan(modules.weekly_plan ?? {}, repaired.channel_adaptations, now);
    repaired.rules_constraints = repairRulesConstraints(modules.rules_constraints ?? {});

    const pillarIds = asArray(repaired.pillars.pillars).map((p) => p.id).filter(Boolean);
    repaired.campaign_plan.campaigns = asArray(repaired.campaign_plan.campaigns).map((c) => ({
      ...c,
      pillarIds: asArray(c.pillarIds).length ? c.pillarIds : pillarIds.slice(0, 3),
    }));

    const title = `Strategy Repair: ${clientId}`;
    const markdown = buildDocumentMarkdown(repaired, title);
    const html = `<pre>${escapeHtml(markdown)}</pre>`;
    const derived = crypto.createHash("sha256").update(JSON.stringify({ repaired, agencyId, clientId })).digest("hex");

    const modulePayload = Object.entries(repaired).map(([module, content]) => ({
      module,
      content_json: content,
      ai_confidence: typeof content?.confidence_0_100 === "number" ? content.confidence_0_100 : 85,
    }));

    if (dryRun) {
      console.log(`[dry-run] client=${clientId} strategy=${strategyId} modules=${modulePayload.length}`);
      continue;
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc("create_strategy_snapshot", {
      p_client_id: clientId,
      p_agency_id: agencyId,
      p_strategy_id: strategyId,
      p_user_id: actingUserId,
      p_modules: modulePayload,
      p_document_markdown: markdown,
      p_document_html: html,
      p_model: "repair-script-v1",
      p_instruction: "Repair pass: fix month/week anchoring, remove placeholders, fill examples/proof points, ensure rules completeness.",
      p_derived_hash: derived,
      p_decisions: null,
      p_tasks: null,
    });
    if (rpcErr) throw rpcErr;

    console.log(`[ok] client=${clientId} strategy=${rpcData?.strategy_id ?? strategyId} repaired`);
  }
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
