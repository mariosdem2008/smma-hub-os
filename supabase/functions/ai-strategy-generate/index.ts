import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { evaluateClientBrainForStrategy } from "../_shared/brain-quality.ts";
import { embedQueryForRag, getMatchRpcName } from "../_shared/rag-index.ts";
import { mapV3AnswersToClientBrain } from "../_shared/client-brain-mapping.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { applyRagPolicy, getRagConfig, shouldUseRagPolicy } from "../../../src/ai/ragPolicy.ts";
import { validateCitations } from "../../../src/ai/citations.ts";
import { calculateCost } from "../_shared/budgets.ts";
import { capMatchesByTokenBudget, clampMatchCount, getInitialMatchCount, applyScoreRerank } from "../_shared/retrieval.ts";
import { buildBrainDocumentReferences, formatBrainDocumentReferencesMarkdown } from "../_shared/strategy-references.ts";
import { buildStrategyOutputSchema, type StrategyOutput } from "../_shared/strategy-output.ts";
import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
import { enforceAgencyAgentActivation } from "../_shared/agency-ai-setup.ts";
import { fetchApprovedBrainDocuments, ingestBrainDocumentForRag } from "../_shared/brain-documents.ts";
import { evaluateStrategyModule } from "../../../src/lib/strategy/rulesEngine.ts";
import { getTemplateDraftContent } from "../../../src/lib/strategy/defaults.ts";
import { generateSpanId, generateTraceId, logOtelSpan } from "../../../src/ai/otel.ts";
import { isDurableExecutorEnabled } from "../../../src/ai/flags.ts";
import { writeCheckpoint } from "../_shared/executor-checkpoints.ts";
import { buildClientOperatingBriefV2, buildReadinessArtifact, evaluateReadinessArtifact } from "../../../src/lib/strategy/v2/briefBuilder.ts";
import { buildDefaultDiagnosisInputSummary, buildStrategyPlanArtifact, evaluateDiagnosisArtifact, evaluateRecommendationArtifact } from "../../../src/lib/strategy/v2/agents.ts";
import { allowsRecommendationFromReadiness, buildFallbackTrace, getReadinessDeepLinkStage } from "../../../src/lib/strategy/v2/workflow.ts";
import {
  createAgentRunV2,
  createArtifactEvaluationV2,
  createClientBriefV2,
  createStrategyArtifactV2,
  finalizeAgentRunV2,
  syncAgencyOperatingModulesV2,
} from "../_shared/strategy-v2.ts";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function emptySources() {
  return {
    agency_brain_fields: [],
    client_brain_fields: [],
    memory_citations: [],
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStrategyHtml(markdown: string) {
  return `<pre>${escapeHtml(markdown)}</pre>`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values: Array<unknown>, limit = 50): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  ).slice(0, limit);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function composeStrategyMarkdown(args: {
  brief: any;
  diagnosisArtifact: any;
  recommendationArtifact: any;
  modules: Record<string, any>;
}) {
  const body = args.recommendationArtifact?.body ?? {};
  const diagnosis = args.diagnosisArtifact?.body ?? {};
  const primaryOffer = body?.chosen_offer_priority?.primary_offer || args.brief?.offer_priority?.primary_offer || "Primary offer";
  const funnelPath = body?.chosen_funnel?.path || args.brief?.conversion_path?.primary_path || "Primary conversion path";
  const strategicDirection = args.recommendationArtifact?.summary || body?.strategic_direction || "Strategic direction pending final review.";
  const channelPriorities = Array.isArray(body?.channel_priorities) ? body.channel_priorities : [];
  const pillarRecommendations = Array.isArray(body?.pillar_recommendations) ? body.pillar_recommendations : [];
  const openQuestions = uniqueStrings([
    ...(args.diagnosisArtifact?.open_questions ?? []),
    ...(args.recommendationArtifact?.open_questions ?? []),
    ...(args.brief?.open_questions ?? []),
  ], 10);

  return [
    "# Strategy Plan",
    "",
    "## Executive Summary",
    strategicDirection,
    "",
    "## Commercial Focus",
    `- Primary offer: ${primaryOffer}`,
    `- Funnel path: ${funnelPath}`,
    `- Primary goal: ${args.brief?.goals_baselines_success_thresholds?.primary_goal || "Qualified pipeline growth"}`,
    "",
    "## Audience",
    ...(Array.isArray(args.brief?.audience_segments) && args.brief.audience_segments.length
      ? args.brief.audience_segments.map((segment: any) => `- ${segment.name}: ${(segment.jobs_to_be_done ?? []).join(", ") || "Needs clearer articulation"}`)
      : ["- Audience segments require further refinement."]),
    "",
    "## Diagnosis Highlights",
    ...(Array.isArray(diagnosis?.top_opportunities) && diagnosis.top_opportunities.length
      ? diagnosis.top_opportunities.map((item: string) => `- ${item}`)
      : ["- Clarify offer-market fit and priority channel mix."]),
    "",
    "## Channel Priorities",
    ...(channelPriorities.length
      ? channelPriorities.map((row: any) => `- ${row.channel}: ${row.role}`)
      : ["- Channel priorities require follow-up review."]),
    "",
    "## Content Pillars",
    ...(pillarRecommendations.length
      ? pillarRecommendations.map((row: any) => `- ${row.name}: ${row.purpose}`)
      : ["- Use authority, proof, connection, and conversion until custom pillars are approved."]),
    "",
    "## Operating Notes",
    `- Primary contact: ${args.brief?.stakeholder_and_approval_map?.primary_contact || "Pending confirmation"}`,
    `- Final approver: ${args.brief?.stakeholder_and_approval_map?.final_approver || "Pending confirmation"}`,
    `- Access readiness: ${args.brief?.access_and_asset_readiness?.platform_access_ready ? "Ready" : "Not fully ready"}`,
    "",
    openQuestions.length
      ? ["## Open Questions", ...openQuestions.map((item) => `- ${item}`), ""].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDeterministicStrategyOutputFromV2(args: {
  brief: any;
  diagnosisArtifact: any;
  recommendationArtifact: any;
}): StrategyOutput {
  const brief = args.brief ?? {};
  const diagnosis = args.diagnosisArtifact?.body ?? {};
  const recommendation = args.recommendationArtifact?.body ?? {};
  const generatedAt = new Date().toISOString();
  const baseEvidence = {
    facts_used: uniqueStrings([
      brief?.business_model?.summary,
      brief?.conversion_path?.primary_path,
      ...(brief?.proof_and_differentiators?.differentiators ?? []),
      ...(diagnosis?.top_opportunities ?? []),
    ], 8),
    assumptions: uniqueStrings([
      ...(args.diagnosisArtifact?.assumptions ?? []),
      ...(args.recommendationArtifact?.assumptions ?? []),
      ...(brief?.known_blockers ?? []),
    ], 6),
    open_questions: uniqueStrings([
      ...(args.diagnosisArtifact?.open_questions ?? []),
      ...(args.recommendationArtifact?.open_questions ?? []),
      ...(brief?.open_questions ?? []),
    ], 5),
    confidence_0_100: 75,
  };

  const positioning = deepClone(getTemplateDraftContent("positioning") as any);
  const audienceNames = Array.isArray(brief?.audience_segments) && brief.audience_segments.length
    ? brief.audience_segments.map((segment: any) => segment.name)
    : ["target clients"];
  positioning.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  positioning.sentence.target = audienceNames.join(" + ");
  positioning.sentence.category = brief?.business_model?.category || "social media growth";
  positioning.sentence.differentiator =
    brief?.proof_and_differentiators?.differentiators?.[0] ||
    recommendation?.strategic_direction ||
    positioning.sentence.differentiator;
  positioning.sentence.benefit =
    brief?.goals_baselines_success_thresholds?.primary_goal ||
    recommendation?.chosen_funnel?.why ||
    positioning.sentence.benefit;
  positioning.finalSentence =
    recommendation?.messaging_direction?.core_message ||
    `For ${positioning.sentence.target} who need ${positioning.sentence.category}, this strategy focuses on ${positioning.sentence.differentiator} to achieve ${positioning.sentence.benefit}.`;
  positioning.proofPoints = uniqueStrings([
    ...(brief?.proof_and_differentiators?.proof_assets ?? []),
    ...(brief?.proof_and_differentiators?.differentiators ?? []),
    ...(diagnosis?.top_opportunities ?? []),
  ], 3).map((item, index) => ({
    id: `proof-${index + 1}`,
    claim: item,
    evidence: `Internal evidence reference: ${item}`,
    confidence: index === 0 ? 4 : 3,
  }));
  while (positioning.proofPoints.length < 3) {
    const index = positioning.proofPoints.length + 1;
    positioning.proofPoints.push({
      id: `proof-${index}`,
      claim: `Evidence set ${index}`,
      evidence: `Internal evidence reference ${index}`,
      confidence: 3,
    });
  }
  positioning.differentiators = uniqueStrings([
    ...(brief?.proof_and_differentiators?.differentiators ?? []),
    recommendation?.strategic_direction,
    recommendation?.messaging_direction?.core_message,
  ], 3).slice(0, 3).map((item, index) => ({
    id: `diff-${index + 1}`,
    rank: index + 1,
    approvedPhrasing: item,
    bannedPhrasing: uniqueStrings([...(recommendation?.messaging_direction?.donts ?? []), "Guaranteed", "Miracle"], 5),
  }));
  while (positioning.differentiators.length < 2) {
    positioning.differentiators.push({
      id: `diff-${positioning.differentiators.length + 1}`,
      rank: positioning.differentiators.length + 1,
      approvedPhrasing: `Differentiator ${positioning.differentiators.length + 1}`,
      bannedPhrasing: ["Guaranteed", "Miracle"],
    });
  }
  positioning.boundaries.forbiddenPromises = uniqueStrings([
    ...(brief?.proof_and_differentiators?.claims_limits ?? []),
    ...(recommendation?.messaging_direction?.donts ?? []),
    ...positioning.boundaries.forbiddenPromises,
  ], 8);
  Object.assign(positioning, baseEvidence);

  const pillars = deepClone(getTemplateDraftContent("pillars") as any);
  pillars.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  const recommendedPillars = Array.isArray(recommendation?.pillar_recommendations) && recommendation.pillar_recommendations.length
    ? recommendation.pillar_recommendations
    : pillars.pillars;
  const coverageTemplate = [30, 25, 25, 20];
  pillars.pillars = recommendedPillars.slice(0, 4).map((item: any, index: number) => ({
    id: `pillar-${index + 1}`,
    name: item?.name || `Pillar ${index + 1}`,
    coveragePercent: coverageTemplate[index] ?? 20,
    purpose: index === 0 ? "authority" : index === 1 ? "proof" : index === 2 ? "reach" : "leads",
    coreMessage: item?.purpose || item?.name || "Core message",
    contentTypes: ["Short-form video", "Carousel", "Story"],
    bannedAngles: uniqueStrings(recommendation?.messaging_direction?.donts ?? [], 3),
    kpis: ["Reach", "Saves", "Leads"],
    examples: [
      `${item?.name || "Pillar"} example 1`,
      `${item?.name || "Pillar"} example 2`,
      `${item?.name || "Pillar"} example 3`,
    ],
  }));
  while (pillars.pillars.length < 3) {
    const index = pillars.pillars.length + 1;
    pillars.pillars.push({
      id: `pillar-${index}`,
      name: `Pillar ${index}`,
      coveragePercent: index === 3 ? 20 : 25,
      purpose: index === 3 ? "leads" : "authority",
      coreMessage: `Pillar ${index} message`,
      contentTypes: ["Short-form video", "Carousel", "Story"],
      bannedAngles: [],
      kpis: ["Reach", "Leads"],
      examples: [`Example ${index}.1`, `Example ${index}.2`, `Example ${index}.3`],
    });
  }
  const coverageSum = pillars.pillars.reduce((sum: number, pillar: any) => sum + (pillar.coveragePercent ?? 0), 0);
  if (coverageSum !== 100 && pillars.pillars.length > 0) {
    pillars.pillars[pillars.pillars.length - 1].coveragePercent += 100 - coverageSum;
  }
  pillars.proofInventory = positioning.proofPoints.map((point: any, index: number) => ({
    id: `proof-inventory-${index + 1}`,
    title: point.claim,
    pillarIds: pillars.pillars.slice(0, 2).map((pillar: any) => pillar.id),
    url: point.evidence,
  }));
  Object.assign(pillars, baseEvidence);

  const campaignPlan = deepClone(getTemplateDraftContent("campaign_plan") as any);
  campaignPlan.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  const primaryOffer = recommendation?.chosen_offer_priority?.primary_offer || brief?.offer_priority?.primary_offer || campaignPlan.campaigns[0].offer;
  const firstCampaign = campaignPlan.campaigns[0];
  firstCampaign.name = recommendation?.strategic_direction || firstCampaign.name;
  firstCampaign.goal = brief?.goals_baselines_success_thresholds?.primary_goal || firstCampaign.goal;
  firstCampaign.offer = primaryOffer;
  firstCampaign.cta = recommendation?.chosen_funnel?.path || "Book a strategy call";
  firstCampaign.icp = audienceNames.join(" / ");
  firstCampaign.pillarIds = pillars.pillars.slice(0, 3).map((pillar: any) => pillar.id);
  firstCampaign.angle = diagnosis?.current_state_summary || firstCampaign.angle;
  firstCampaign.kpiTargets = { leads: 10, qualified_calls: 4 };
  Object.assign(campaignPlan, baseEvidence);

  const weeklyPlan = deepClone(getTemplateDraftContent("weekly_plan") as any);
  weeklyPlan.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  weeklyPlan.weeklyFocus.objective = brief?.goals_baselines_success_thresholds?.primary_goal || weeklyPlan.weeklyFocus.objective;
  weeklyPlan.weeklyFocus.primaryCampaignId = firstCampaign.id;
  weeklyPlan.weeklyFocus.priorityPillarIds = pillars.pillars.slice(0, 2).map((pillar: any) => pillar.id);
  weeklyPlan.weeklyFocus.kpiFocus = ["Leads", "Qualified calls"];
  weeklyPlan.productionChecklist = [
    { id: "prod-1", type: "script", title: "Draft weekly scripts", owner: "agency", dueDate: toIsoDate(new Date()), completed: false },
    { id: "prod-2", type: "shoot", title: "Record proof-backed assets", owner: "client", dueDate: toIsoDate(new Date(Date.now() + 86400000)), completed: false },
    { id: "prod-3", type: "approval", title: "Approve campaign messaging", owner: "client", dueDate: toIsoDate(new Date(Date.now() + 2 * 86400000)), completed: false },
  ];
  Object.assign(weeklyPlan, baseEvidence);

  const channelAdaptations = deepClone(getTemplateDraftContent("channel_adaptations") as any);
  channelAdaptations.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  const channelPriorityMap = new Map(
    (Array.isArray(recommendation?.channel_priorities) ? recommendation.channel_priorities : []).map((row: any) => [row.channel, row]),
  );
  channelAdaptations.channels = channelAdaptations.channels.map((channel: any) => {
    const recommended = channelPriorityMap.get(channel.platform);
    if (!recommended) return { ...channel, enabled: false };
    return {
      ...channel,
      enabled: true,
      role: recommended.role || channel.role,
      ctaRules: uniqueStrings([primaryOffer, ...(channel.ctaRules ?? [])], 4),
      dos: uniqueStrings([...(recommendation?.messaging_direction?.dos ?? []), ...(channel.dos ?? [])], 5),
      donts: uniqueStrings([...(recommendation?.messaging_direction?.donts ?? []), ...(channel.donts ?? [])], 5),
    };
  });
  channelAdaptations.translationTable = [
    {
      coreMessage: recommendation?.messaging_direction?.core_message || positioning.finalSentence,
      variants: Object.fromEntries(
        channelAdaptations.channels
          .filter((channel: any) => channel.enabled)
          .map((channel: any) => [channel.platform, `${channel.platform}: ${recommendation?.messaging_direction?.core_message || positioning.finalSentence}`]),
      ),
    },
  ];
  Object.assign(channelAdaptations, baseEvidence);

  const rulesConstraints = deepClone(getTemplateDraftContent("rules_constraints") as any);
  rulesConstraints.meta = { source: "V2_PUBLISHED", generated_at: generatedAt };
  rulesConstraints.claimsPolicy = uniqueStrings([
    ...(brief?.proof_and_differentiators?.claims_limits ?? []),
    ...(brief?.constraints_and_compliance?.restricted_claims ?? []),
    ...(brief?.proof_and_differentiators?.differentiators ?? []),
  ], 10).map((claim: string, index: number) => ({
    id: `claim-${index + 1}`,
    claim,
    status: index < 3 ? "proof_required" : index < 6 ? "forbidden" : "allowed",
    proofLink: index < 3 ? `Internal evidence reference: ${claim}` : undefined,
  }));
  while (rulesConstraints.claimsPolicy.length < 4) {
    rulesConstraints.claimsPolicy.push({
      id: `claim-${rulesConstraints.claimsPolicy.length + 1}`,
      claim: `Standard claim ${rulesConstraints.claimsPolicy.length + 1}`,
      status: rulesConstraints.claimsPolicy.length === 0 ? "proof_required" : "allowed",
      proofLink: rulesConstraints.claimsPolicy.length === 0 ? "Internal evidence reference" : undefined,
    });
  }
  rulesConstraints.bannedWords = uniqueStrings([
    ...(recommendation?.messaging_direction?.donts ?? []),
    ...(rulesConstraints.bannedWords ?? []),
  ], 10);
  rulesConstraints.requiredDisclaimers = uniqueStrings([
    ...(brief?.constraints_and_compliance?.required_disclaimers ?? []),
    ...(rulesConstraints.requiredDisclaimers ?? []),
  ], 6);
  rulesConstraints.approvalTriggers = [
    { id: "trigger-1", condition: "Claims without proof", action: "Request proof or revise wording" },
    { id: "trigger-2", condition: "Final copy approval", action: `Send to ${brief?.stakeholder_and_approval_map?.final_approver || "client approver"}` },
  ];
  Object.assign(rulesConstraints, baseEvidence);

  const modules = {
    positioning,
    pillars,
    campaign_plan: campaignPlan,
    weekly_plan: weeklyPlan,
    channel_adaptations: channelAdaptations,
    rules_constraints: rulesConstraints,
  };

  return {
    modules,
    document: {
      markdown: composeStrategyMarkdown({
        brief,
        diagnosisArtifact: args.diagnosisArtifact,
        recommendationArtifact: args.recommendationArtifact,
        modules,
      }),
    },
    decisions: [
      { module: "positioning", decision_key: "primary_offer", value: { offer: primaryOffer }, locked: false },
      {
        module: "campaign_plan",
        decision_key: "primary_funnel",
        value: { path: recommendation?.chosen_funnel?.path || brief?.conversion_path?.primary_path || "Primary funnel" },
        locked: false,
      },
    ],
    tasks: [
      { module: "campaign_plan", title: "Validate campaign offer and CTA", description: "Confirm the main offer, CTA, and funnel handoff.", priority: "high", dedupe_key: "v2:campaign:validate-offer" },
      { module: "rules_constraints", title: "Confirm claims and approvals", description: "Review proof-required claims and approval triggers before production.", priority: "high", dedupe_key: "v2:rules:confirm-claims" },
    ],
  } as StrategyOutput;
}

function buildDeterministicDiagnosisArtifact(args: {
  brief: any;
  briefVersion: number;
  agencyModuleVersions: Record<string, number>;
}) {
  const brief = args.brief ?? {};
  const audience = Array.isArray(brief?.audience_segments) ? brief.audience_segments[0] ?? {} : {};
  const primaryGoal = brief?.goals_baselines_success_thresholds?.primary_goal || "growth";
  const primaryOffer = brief?.offer_priority?.primary_offer || "Primary offer";
  const activeChannels = Array.isArray(brief?.channel_state_and_history?.active_channels)
    ? brief.channel_state_and_history.active_channels
    : [];
  const currentPath = brief?.conversion_path?.primary_path || "Primary conversion path";
  const blockers = Array.isArray(brief?.known_blockers) ? brief.known_blockers : [];
  const openQuestions = uniqueStrings([
    ...(brief?.open_questions ?? []),
    !brief?.stakeholder_and_approval_map?.primary_contact ? "Who is the primary day-to-day contact?" : "",
    !brief?.pricing_and_budget?.media_budget_monthly ? "What budget range should the strategy assume?" : "",
  ], 6);

  return {
    artifact_meta: {
      artifact_type: "strategy_diagnosis",
      version: 1,
      brief_version: args.briefVersion,
      agency_module_versions: args.agencyModuleVersions,
    },
    summary: `${primaryOffer} has a viable direction, but execution quality depends on clearer proof, stakeholder ownership, and a tighter funnel path.`,
    body: {
      current_state_summary: `${primaryOffer} is positioned to support ${primaryGoal}, but the current setup still has execution and clarity gaps.`,
      business_objective_tree: [
        {
          objective: `Improve ${primaryGoal}`,
          drivers: uniqueStrings([
            `Clarify the ${primaryOffer} offer`,
            currentPath ? `Strengthen the ${currentPath} conversion path` : "",
            ...(activeChannels.map((channel: string) => `Use ${channel} as an intentional growth channel`)),
          ], 5),
        },
      ],
      offer_diagnosis: {
        primary_offer_fit: audience?.name ? "Moderate" : "Low",
        issues: uniqueStrings([
          !brief?.proof_and_differentiators?.differentiators?.length ? "Differentiation is still weak or undocumented." : "",
          !brief?.proof_and_differentiators?.proof_assets?.length ? "Proof assets are missing or thin." : "",
          !audience?.jobs_to_be_done?.length ? "Audience jobs-to-be-done are not yet explicit." : "",
        ], 4),
        notes: uniqueStrings([
          `Primary audience: ${audience?.name || "Not fully defined"}`,
          `Primary offer: ${primaryOffer}`,
        ], 3),
      },
      funnel_diagnosis: {
        current_path: currentPath,
        strengths: uniqueStrings([
          currentPath ? `A primary conversion path exists: ${currentPath}` : "",
          activeChannels.length ? `The client already has active channels: ${activeChannels.join(", ")}` : "",
          brief?.access_and_asset_readiness?.platform_access_ready ? "Platform access is available." : "",
        ], 4),
        weaknesses: uniqueStrings([
          ...blockers,
          !brief?.sales_process?.summary || brief.sales_process.summary === "Sales process not yet documented."
            ? "Sales process is not yet documented clearly."
            : "",
          !brief?.stakeholder_and_approval_map?.final_approver ? "Final approver is still missing." : "",
        ], 5),
      },
      audience_clarity: {
        score_0_100: audience?.pain_points?.length ? 65 : 50,
        strengths: uniqueStrings([
          audience?.name ? `Audience segment identified: ${audience.name}` : "",
          ...(audience?.pain_points ?? []).slice(0, 3),
        ], 4),
        gaps: uniqueStrings([
          !audience?.jobs_to_be_done?.length ? "Jobs-to-be-done are incomplete." : "",
          !brief?.pricing_and_budget?.media_budget_monthly ? "Budget expectations are not yet confirmed." : "",
        ], 4),
      },
      channel_fit: (activeChannels.length ? activeChannels : ["instagram"]).slice(0, 3).map((channel: string, index: number) => ({
        channel,
        fit: index === 0 ? "High" : "Moderate",
        why: `${channel} can support awareness, proof distribution, and conversion follow-through for ${primaryOffer}.`,
      })),
      risk_summary: uniqueStrings([
        !brief?.pricing_and_budget?.media_budget_monthly ? "Budget is unconfirmed, so paid planning remains approximate." : "",
        !brief?.stakeholder_and_approval_map?.primary_contact ? "Missing primary contact will slow approvals and execution." : "",
        !brief?.proof_and_differentiators?.proof_assets?.length ? "Limited proof assets may reduce conversion confidence." : "",
      ], 5),
      top_opportunities: uniqueStrings([
        `Clarify the value proposition of ${primaryOffer}.`,
        `Tighten the ${currentPath} handoff and response flow.`,
        activeChannels[0] ? `Systemize ${activeChannels[0]} around proof and conversion.` : "Systemize the primary channel around proof and conversion.",
      ], 4),
    },
    assumptions: uniqueStrings([
      ...(brief?.known_blockers ?? []),
      !brief?.pricing_and_budget?.media_budget_monthly ? "Budget is not confirmed yet." : "",
    ], 5),
    open_questions: openQuestions,
    citations: [{ source: "client_brief" }],
    confidence: 72,
  };
}

function buildDeterministicRecommendationArtifact(args: {
  brief: any;
  diagnosisArtifact: any;
  briefVersion: number;
  agencyModuleVersions: Record<string, number>;
}) {
  const brief = args.brief ?? {};
  const diagnosisBody = args.diagnosisArtifact?.body ?? {};
  const audience = Array.isArray(brief?.audience_segments) ? brief.audience_segments[0] ?? {} : {};
  const primaryOffer = brief?.offer_priority?.primary_offer || "Primary offer";
  const primaryGoal = brief?.goals_baselines_success_thresholds?.primary_goal || "growth";
  const activeChannels = Array.isArray(brief?.channel_state_and_history?.active_channels) && brief.channel_state_and_history.active_channels.length
    ? brief.channel_state_and_history.active_channels
    : ["instagram"];
  const primaryPath = brief?.conversion_path?.primary_path || "book_call";
  const topOpportunities = Array.isArray(diagnosisBody?.top_opportunities) ? diagnosisBody.top_opportunities : [];
  const openQuestions = uniqueStrings([
    ...(args.diagnosisArtifact?.open_questions ?? []),
    ...(brief?.open_questions ?? []),
  ], 6);

  return {
    artifact_meta: {
      artifact_type: "strategy_recommendation",
      version: 1,
      brief_version: args.briefVersion,
      agency_module_versions: args.agencyModuleVersions,
    },
    summary: `Recommended direction: turn ${primaryOffer} into a clearer, proof-backed growth system focused on ${primaryGoal}.`,
    body: {
      strategic_direction: `Lead with authority and proof, then convert through a tighter ${primaryPath} path for ${audience?.name || "the primary audience"}.`,
      chosen_offer_priority: {
        primary_offer: primaryOffer,
        why: `This is the most direct offer to support ${primaryGoal} once positioning and proof are tightened.`,
      },
      chosen_funnel: {
        path: activeChannels[0] ? `${activeChannels[0]} -> ${primaryPath}` : primaryPath,
        why: `This path matches the client’s active channels and keeps the conversion model operationally simple.`,
      },
      channel_priorities: activeChannels.slice(0, 3).map((channel: string, index: number) => ({
        channel,
        priority: index + 1,
        role: index === 0 ? "Primary demand and proof channel." : "Supporting nurture and distribution channel.",
      })),
      pillar_recommendations: uniqueStrings([
        "Authority and education",
        "Proof and outcomes",
        "Offer clarity and conversion",
      ], 4).map((name, index) => ({
        name,
        purpose: index === 0
          ? "Build trust and category authority."
          : index === 1
            ? "Demonstrate evidence and reduce buyer hesitation."
            : "Move prospects toward the next step with clear messaging.",
      })),
      messaging_direction: {
        core_message: `A clearer path to ${primaryGoal} through ${primaryOffer}.`,
        dos: uniqueStrings([
          "Use direct commercial language.",
          "Anchor claims in real proof or process clarity.",
          ...(brief?.proof_and_differentiators?.differentiators ?? []),
        ], 5),
        donts: uniqueStrings([
          ...(brief?.proof_and_differentiators?.claims_limits ?? []),
          "Avoid guarantees without proof.",
          "Avoid generic agency language.",
        ], 5),
      },
      risks_and_tradeoffs: uniqueStrings([
        ...((diagnosisBody?.risk_summary as string[] | undefined) ?? []),
        !brief?.stakeholder_and_approval_map?.primary_contact ? "Execution risk remains until ownership is explicit." : "",
      ], 5),
      decision_rationale: [
        {
          decision: `Keep ${primaryOffer} as the lead offer.`,
          why: `It is already closest to the current client context and shortest path to ${primaryGoal}.`,
        },
        {
          decision: `Prioritize ${activeChannels[0]} first.`,
          why: `It is already active and gives the fastest route to consistent proof-led execution.`,
        },
        {
          decision: "Use a proof-first content system.",
          why: topOpportunities[0] || "The diagnosis shows that clarity and trust need to improve before scaling.",
        },
      ],
    },
    assumptions: uniqueStrings([
      ...(args.diagnosisArtifact?.assumptions ?? []),
      !brief?.pricing_and_budget?.media_budget_monthly ? "Budget remains assumed until confirmed." : "",
    ], 5),
    open_questions: openQuestions,
    citations: [{ source: "strategy_diagnosis" }, { source: "client_brief" }],
    confidence: 74,
  };
}

type GatedCode = "BRAIN_INCOMPLETE" | "AGENCY_BRAIN_INCOMPLETE" | "CLIENT_BRAIN_MISSING" | "READINESS_SCOPE_INCOMPLETE" | "AGENT_ACTIVATION_REQUIRED";

function activationModeRank(mode: "preview_only" | "internal_assist_only" | "operational" | null | undefined) {
  switch (mode) {
    case "preview_only":
      return 0;
    case "internal_assist_only":
      return 1;
    case "operational":
      return 2;
    default:
      return -1;
  }
}

function buildUnknownResponse(
  gate: { missing_fields: string[]; questions: string[] },
  options?: { code?: GatedCode; deep_link?: string },
) {
  return {
    unknown: true,
    missing_fields: gate.missing_fields,
    questions: gate.questions,
    escalation: false,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.deep_link ? { deep_link: options.deep_link } : {}),
  };
}

function buildAiRunCitations(selectedMatches: any[]) {
  return {
    memory_citations: selectedMatches
      .map((row: any) => ({
        doc_id: row.document_id ?? row.doc_id,
        chunk_id: row.chunk_id,
        doc_type: row.doc_type,
        similarity: row.score ?? row.similarity ?? 0,
      }))
      .filter((row: any) => typeof row.doc_id === "string"),
    client_brain_fields: ["client_brain.summary"],
    agency_brain_fields: [],
  };
}

async function finalizePublishedStrategySideEffects(args: {
  supabase: any;
  agencyId: string;
  clientId: string;
  createdStrategyId: string | null;
  moduleEvaluations: Array<{
    module: string;
    status: string;
    completion_percent: number;
    blockers: unknown[];
  }>;
}) {
  if (!args.createdStrategyId) {
    console.error("strategy_snapshot_missing_strategy_id", { agencyId: args.agencyId, clientId: args.clientId });
    return;
  }

  const updateOps = args.moduleEvaluations.map((result) =>
    args.supabase
      .from("strategy_modules")
      .update({
        status: result.status,
        completion_percent: result.completion_percent,
        blocker_count: result.blockers.length,
        blockers: result.blockers,
      })
      .eq("strategy_id", args.createdStrategyId)
      .eq("module", result.module),
  );

  const updateResults = await Promise.allSettled(updateOps);
  const failed = updateResults
    .map((result) => {
      if (result.status === "rejected") return { ok: false, message: result.reason?.message ?? String(result.reason) };
      const err = (result.value as any)?.error;
      if (err) return { ok: false, message: err.message ?? String(err) };
      return { ok: true, message: "" };
    })
    .filter((item) => !item.ok);

  if (failed.length) {
    console.error("strategy_module_evaluation_persist_failed", {
      agencyId: args.agencyId,
      clientId: args.clientId,
      strategyId: args.createdStrategyId,
      failures: failed.map((item) => item.message ?? "unknown_error"),
    });
  }

  try {
    await args.supabase.rpc("refresh_client_enrichment_queue", {
      p_client_id: args.clientId,
      p_reason: "strategy_generation",
    });
    await args.supabase.rpc("refresh_client_execution_tasks", {
      p_client_id: args.clientId,
      p_reason: "strategy_generation",
    });
  } catch (error) {
    console.error("client_post_generation_refresh_failed", {
      agencyId: args.agencyId,
      clientId: args.clientId,
      strategyId: args.createdStrategyId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function estimateTokensForCost(text: string) {
  return Math.ceil(text.length / 3);
}

function extractUsageFromRaw(raw: unknown) {
  const usage = (raw as any)?.usage;
  const inputTokens = usage?.prompt_tokens ?? usage?.input_tokens;
  const outputTokens = usage?.completion_tokens ?? usage?.output_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    const serialized = entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",");
    return `{${serialized}}`;
  }
  return JSON.stringify(value);
}

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isLikelyPlaceholderWebsite(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const site = value.trim().toLowerCase();
  if (!site) return false;
  return site === "example.com" || site === "http://example.com" || site === "https://example.com";
}

function normalizeCountry(value: unknown): { value: string | null; warning?: string } {
  if (typeof value !== "string") return { value: null };
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  // Common onboarding typos we have observed (keep conservative; do not guess broadly).
  const lower = trimmed.toLowerCase();
  if (lower === "greecee") return { value: "Greece", warning: `Normalized country from "${trimmed}" to "Greece".` };
  return { value: trimmed };
}

function normalizeCity(value: unknown): { value: string | null } {
  if (typeof value !== "string") return { value: null };
  const trimmed = value.trim();
  return { value: trimmed.length ? trimmed : null };
}

function deepMergePreferExisting(existing: any, fallback: any): any {
  if (existing === null || existing === undefined) return fallback;
  if (fallback === null || fallback === undefined) return existing;

  if (Array.isArray(existing) || Array.isArray(fallback)) {
    const existingArr = Array.isArray(existing) ? existing : [];
    const fallbackArr = Array.isArray(fallback) ? fallback : [];
    return existingArr.length > 0 ? existingArr : fallbackArr;
  }

  if (typeof existing === "object" && typeof fallback === "object") {
    const out: Record<string, unknown> = { ...(fallback as Record<string, unknown>) };
    for (const [key, value] of Object.entries(existing as Record<string, unknown>)) {
      out[key] = deepMergePreferExisting(value, (fallback as Record<string, unknown>)[key]);
    }
    return out;
  }

  if (typeof existing === "string") {
    return existing.trim().length > 0 ? existing : fallback;
  }

  return existing;
}

function buildRawResponsesFromOnboarding(profile: Record<string, unknown>) {
  const businessName = (profile.q1_business_name as string) ?? "";
  const website = (profile.q2_website as string) ?? "";
  const platforms = toList(profile.platforms ?? profile.q16_enabled_channels);

  const offerNames = [
    ...(Array.isArray(profile.offers)
      ? (profile.offers as Array<any>).map((offer) => (offer?.name ? String(offer.name) : "")).filter(Boolean)
      : []),
    ...(typeof profile.q6_offer_name === "string" ? [profile.q6_offer_name] : []),
  ].filter(Boolean);

  const audience = [
    ...(Array.isArray(profile.q9_pain_points) ? (profile.q9_pain_points as string[]) : []),
    ...(typeof profile.primary_customer === "string" ? [profile.primary_customer] : []),
    ...(typeof profile.q8_ideal_customer === "string" ? [profile.q8_ideal_customer] : []),
  ]
    .map((item) => String(item).trim())
    .filter(Boolean);

  const goal = (profile.primary_goal as string) ?? (profile.q17_primary_goal as string) ?? "";
  const conversionPath = (profile.conversion_path as string) ?? "";
  const dmKeyword = (profile.dm_keyword as string) ?? "";
  const conversionLink = (profile.conversion_link as string) ?? "";

  const goals: string[] = [];
  if (goal) goals.push(goal);
  if (conversionPath === "dm_keyword") {
    goals.push(dmKeyword ? `DM keyword: ${dmKeyword}` : "DM keyword");
  } else if (conversionPath) {
    goals.push(conversionLink ? `${conversionPath}: ${conversionLink}` : conversionPath);
  }

  const ctaStyles: string[] = [];
  if (conversionPath === "dm_keyword") {
    ctaStyles.push(dmKeyword ? `DM ${dmKeyword}` : "DM keyword");
  } else if (conversionPath) {
    ctaStyles.push(conversionPath);
  }

  return {
    brand: businessName,
    website,
    goals,
    offers: offerNames,
    audience,
    platforms,
    cta_styles: ctaStyles,
    competitors: toList(profile.q12_competitors ?? profile.competitors),
    differentiators: toList(profile.q13_differentiators ?? profile.differentiators),
    banned_claims: toList(profile.banned_claims),
    taboo_topics: toList(profile.taboo_topics),
    pricing: (profile.q6_price_min || profile.q6_price_max) ? `${profile.q6_price_min ?? ""}-${profile.q6_price_max ?? ""}` : "",
  } as Record<string, unknown>;
}

async function sha256Hex(input: string) {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const MODULE_LABELS: Record<string, string> = {
  positioning: "Positioning",
  pillars: "Pillars",
  campaign_plan: "Campaign plan",
  weekly_plan: "Weekly plan",
  channel_adaptations: "Channel adaptations",
  rules_constraints: "Rules + constraints",
};

function buildBlockerTasks(args: {
  moduleEvaluations: Array<{ module: string; blockers: Array<{ code: string; message: string; severity?: string; field_path?: string }> }>;
}) {
  const tasks: Array<Record<string, unknown>> = [];
  for (const evaluation of args.moduleEvaluations ?? []) {
    const module = evaluation.module;
    for (const blocker of evaluation.blockers ?? []) {
      const title = `Fix ${MODULE_LABELS[module] ?? module}: ${blocker.message}`;
      const descriptionParts = [
        blocker.field_path ? `Field: ${blocker.field_path}` : null,
        blocker.code ? `Code: ${blocker.code}` : null,
        blocker.severity ? `Severity: ${blocker.severity}` : null,
      ].filter(Boolean);
      tasks.push({
        module,
        title,
        description: descriptionParts.join(" • "),
        priority: blocker.severity === "high" ? "urgent" : blocker.severity === "med" ? "high" : "medium",
        dedupe_key: `blocker:${module}:${blocker.code ?? blocker.message}`,
      });
    }
  }
  return tasks;
}

async function safeInsertAiRun(
  supabase: ReturnType<typeof createClient>,
  payload: {
    agencyId: string;
    clientId: string;
    userId: string | null;
    model: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    startTime: number;
    success: boolean;
    unknown: boolean;
    citations: unknown;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("ai_runs").insert({
      agency_id: payload.agencyId,
      client_id: payload.clientId,
      user_id: payload.userId,
      prompt_id: null,
      prompt_version: null,
      model: payload.model,
      tokens_in: payload.tokensIn,
      tokens_out: payload.tokensOut,
      cost_usd: payload.costUsd,
      latency_ms: Date.now() - payload.startTime,
      success: payload.success,
      citations: payload.citations,
      unknown: payload.unknown,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: payload.metadata ?? {},
    });
  } catch (error) {
    console.error("Failed to write ai_runs", error);
  }
}

function pad2(num: number) {
  return String(num).padStart(2, "0");
}

function isoWeekString(date: Date): string {
  // ISO week date weeks start on Monday.
  // Algorithm: shift to Thursday, then week = 1 + floor((thursday - jan4)/7days)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${year}-W${pad2(week)}`;
}

serve(async (req: Request) => {
  const traceId = generateTraceId();
  const spanId = generateSpanId();
  const spanStart = Date.now();
  let response: Response | undefined;
  let supabase: ReturnType<typeof createClient> | null = null;
  let agencyId: string | undefined;
  let clientId: string | undefined;
  let userId: string | undefined;
  let planId: string | undefined;
  let durableEnabled = false;

  response = await (async () => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(req) });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
    }

    const guardResponse = getEndpointGuardResponse("ai-strategy-generate", corsHeaders(req));
    if (guardResponse) return guardResponse;

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const startTime = Date.now();
    const strictSchema = Deno.env.get("AI_SCHEMA_STRICT") === "true";
    const body = await req.json().catch(() => ({}));
    clientId = body.client_id as string | undefined;
    const instruction = body.instruction as string | undefined;
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const isCron = cronSecret.length > 0 && cronHeader === cronSecret;

    if (!clientId) {
      return jsonResponse({ error: "client_id is required", code: "MISSING_CLIENT_ID" }, 400, corsHeaders(req));
    }

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("agency_id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError || !clientRow?.agency_id) {
      return jsonResponse({ error: "Client not found", code: "CLIENT_NOT_FOUND" }, 404, corsHeaders(req));
    }

    agencyId = clientRow.agency_id as string;

    let actingUserId: string | null = null;
    if (isCron) {
      const { data: adminUser } = await supabase
        .from("agency_members")
        .select("user_id")
        .eq("agency_id", agencyId)
        .in("role", ["owner", "admin"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      actingUserId = adminUser?.user_id ?? null;
      if (!actingUserId) {
        return jsonResponse({ error: "No admin user available for job execution" }, 403, corsHeaders(req));
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      const user = userData?.user;
      if (userError || !user) {
        return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
      }

      const { data: membership } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .eq("agency_id", agencyId)
        .maybeSingle();

      if (!membership) {
        return jsonResponse({ error: "Forbidden", code: "FORBIDDEN" }, 403, corsHeaders(req));
      }
      actingUserId = user.id;
    }

    userId = actingUserId ?? undefined;

    durableEnabled = isDurableExecutorEnabled();
    if (durableEnabled && agencyId && clientId) {
      planId = `strategy:${clientId}:${Date.now()}`;
      await writeCheckpoint(supabase, {
        planId,
        stepId: "strategy_generate",
        status: "running",
        agencyId,
        clientId,
        userId: userId ?? null,
        payload: { task_type: "ai-strategy-generate" },
      });
    }

  const { data: brainRow, error: brainError } = await supabase
    .from("client_brains")
    .select("id, brain_json, usable, status, updated_at")
    .eq("agency_id", agencyId)
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Defense-in-depth: bootstrap a baseline brain row if missing.
  // The database trigger/backfill should make this rare, but this keeps the endpoint resilient.
  let ensuredBrainRow = brainRow ?? null;
  if (!brainError && !ensuredBrainRow) {
    await supabase.from("client_brains").insert({
      agency_id: agencyId,
      client_id: clientId,
      version: 1,
      status: "draft",
      locked: false,
      usable: false,
      brain_json: {},
      json_diff: null,
      confidence: 0,
    });

    const { data: reloaded } = await supabase
      .from("client_brains")
      .select("id, brain_json, usable, status, updated_at")
      .eq("agency_id", agencyId)
      .eq("client_id", clientId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    ensuredBrainRow = reloaded ?? null;
  }

  if (brainError || !ensuredBrainRow) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "CLIENT_BRAIN_MISSING" },
    });
    return jsonResponse(
      buildUnknownResponse(
        {
          missing_fields: ["client_brain"],
          questions: ["Complete client onboarding before generating a strategy."],
        },
        { code: "CLIENT_BRAIN_MISSING", deep_link: `/onboarding/client/${clientId}` },
      ),
      200,
      corsHeaders(req),
    );
  }

  const { data: onboardingProfile } = await supabase
    .from("client_onboarding_profiles")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: operationsSetupRecord } = await supabase
    .from("client_operations_setup")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  const gate = evaluateClientBrainForStrategy((ensuredBrainRow.brain_json as any) ?? {});

  const onboardingCompleted =
    Boolean(onboardingProfile?.completed_at) ||
    (typeof (onboardingProfile as any)?.readiness_score === "number" && (onboardingProfile as any).readiness_score >= 100);

  let effectiveBrain = (ensuredBrainRow.brain_json as any) ?? {};
  let effectiveBrainUsable = Boolean(ensuredBrainRow.usable) && gate.usable;

  if (!effectiveBrainUsable && onboardingProfile && onboardingCompleted) {
    try {
      const rawResponses = buildRawResponsesFromOnboarding(onboardingProfile as any);
      const fallbackBrain = mapV3AnswersToClientBrain(rawResponses, {}, new Date().toISOString());
      const mergedBrain = deepMergePreferExisting(effectiveBrain, fallbackBrain);
      const mergedGate = evaluateClientBrainForStrategy(mergedBrain ?? {});

      if (mergedGate.usable) {
        effectiveBrain = mergedBrain;
        effectiveBrainUsable = true;

        await supabase
          .from("client_brains")
          .update({
            brain_json: mergedBrain,
            usable: true,
            status: "usable",
            updated_at: new Date().toISOString(),
          })
          .eq("id", ensuredBrainRow.id);
      }
    } catch (error) {
      console.error("Failed to hydrate client brain from onboarding fallback", error);
    }
  }

  if (!effectiveBrainUsable) {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId,
      endpoint: "ai-strategy-generate",
      model: "gate-only",
      tokens_estimate: 0,
      tokens_in: 0,
      tokens_out: 0,
      latency_ms: Date.now() - startTime,
      unknown: true,
    });
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: {
        code: "BRAIN_INCOMPLETE",
        missing_fields: gate.missing_fields,
      },
    });
    return jsonResponse(
      buildUnknownResponse(gate, { code: "BRAIN_INCOMPLETE", deep_link: `/onboarding/client/${clientId}` }),
      200,
      corsHeaders(req),
    );
  }

  const { count: approvedBrainDocCount, error: approvedBrainDocError } = await supabase
    .from("ai_documents")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("doc_type", "brain_document")
    .eq("metadata->>status", "approved");

  if (approvedBrainDocError) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "retrieval-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "RAG_FAILURE", error: approvedBrainDocError.message },
    });
    return jsonResponse({ error: "Failed to check agency brain readiness", code: "RAG_FAILURE" }, 500, corsHeaders(req));
  }

  let effectiveApprovedBrainDocCount = approvedBrainDocCount ?? 0;

  if (effectiveApprovedBrainDocCount === 0) {
    try {
      const approvedBrainDocs = await fetchApprovedBrainDocuments(supabase as any, agencyId);
      if (approvedBrainDocs.length > 0) {
        let ingestedCount = 0;
        for (const doc of approvedBrainDocs) {
          try {
            await ingestBrainDocumentForRag(supabase as any, doc as any);
            ingestedCount += 1;
          } catch (error) {
            console.error("Failed to ingest approved brain document for strategy self-heal", {
              agencyId,
              clientId,
              documentId: (doc as any)?.id ?? null,
              module: (doc as any)?.module ?? null,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (ingestedCount > 0) {
          const { count: refreshedApprovedBrainDocCount, error: refreshedApprovedBrainDocError } = await supabase
            .from("ai_documents")
            .select("id", { count: "exact", head: true })
            .eq("agency_id", agencyId)
            .eq("doc_type", "brain_document")
            .eq("metadata->>status", "approved");

          if (refreshedApprovedBrainDocError) {
            await safeInsertAiRun(supabase, {
              agencyId,
              clientId,
              userId: actingUserId,
              model: "retrieval-only",
              tokensIn: 0,
              tokensOut: 0,
              costUsd: 0,
              startTime,
              success: false,
              unknown: false,
              citations: emptySources(),
              metadata: { code: "RAG_FAILURE", error: refreshedApprovedBrainDocError.message },
            });
            return jsonResponse({ error: "Failed to refresh agency brain readiness", code: "RAG_FAILURE" }, 500, corsHeaders(req));
          }

          effectiveApprovedBrainDocCount = refreshedApprovedBrainDocCount ?? 0;
        }
      }
    } catch (error) {
      console.error("Failed to self-heal agency brain retrieval documents", {
        agencyId,
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (effectiveApprovedBrainDocCount === 0) {
    const gateResponse = buildUnknownResponse(
      {
        missing_fields: ["agency_brain_documents"],
        questions: ["Agency AI setup is incomplete. Approve and ingest at least one brain module to continue."],
      },
      { code: "AGENCY_BRAIN_INCOMPLETE", deep_link: "/agency/ai-setup" },
    );
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "AGENCY_BRAIN_INCOMPLETE" },
    });
    return jsonResponse(gateResponse, 200, corsHeaders(req));
  }

  const activationGateResponse = await enforceAgencyAgentActivation({
    supabaseClient: supabase as any,
    agencyId,
    agentClass: "strategy",
    requiredMode: "internal_assist_only",
    corsHeaders: corsHeaders(req),
  });
  if (activationGateResponse) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: { code: "AGENT_ACTIVATION_REQUIRED", agent_class: "strategy" },
    });
    return activationGateResponse;
  }

  const { data: activationRow } = await supabase
    .from("agency_agent_unlocks_v2")
    .select("unlock_state, activated_at, activation_mode")
    .eq("agency_id", agencyId)
    .eq("agent_class", "strategy")
    .maybeSingle();

  if (
    activationModeRank((activationRow?.unlock_state as "preview_only" | "internal_assist_only" | "operational" | null | undefined) ?? null) <
      activationModeRank("internal_assist_only") ||
    activationModeRank((activationRow?.activation_mode as "preview_only" | "internal_assist_only" | "operational" | null | undefined) ?? null) <
      activationModeRank("internal_assist_only") ||
    !activationRow?.activated_at
  ) {
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "gate-only",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: {
        code: "AGENT_ACTIVATION_REQUIRED",
        agent_class: "strategy",
        required_mode: "internal_assist_only",
        activation_mode: activationRow?.activation_mode ?? null,
      },
    });
    return jsonResponse(
      {
        success: false,
        code: "AGENT_ACTIVATION_REQUIRED",
        error: "strategy agent must be activated at internal assist only or higher before using this workflow.",
        deep_link: "/agency/ai-setup/activation",
        agent_class: "strategy",
        unlock_state: activationRow?.unlock_state ?? "blocked",
        activation_mode: activationRow?.activation_mode ?? null,
        required_mode: "internal_assist_only",
        activated_at: activationRow?.activated_at ?? null,
      },
      412,
      corsHeaders(req),
    );
  }

  const agencyOperatingModules = await syncAgencyOperatingModulesV2({
    supabase,
    agencyId,
    actingUserId,
  });
  const agencyModuleVersionMap = Object.fromEntries(
    agencyOperatingModules.map((row) => [row.module_key, row.version]),
  );

  // Agency governance from the AI Setup wizard (foundations, guardrails,
  // workflow). Without this, banned claims, quality standards, and approval
  // rules configured by the agency never reach the strategy agents.
  const { data: setupStatusRow } = await supabase
    .from("agency_ai_setup_status_v2")
    .select("meta_json")
    .eq("agency_id", agencyId)
    .maybeSingle();
  const setupMeta = ((setupStatusRow as any)?.meta_json ?? {}) as Record<string, unknown>;
  const agencyGovernanceContext = [
    "AgencyGovernance (configured by the agency; binding on all outputs):",
    JSON.stringify({
      foundations: setupMeta.foundations ?? null,
      guardrails: setupMeta.guardrails ?? null,
      workflow: setupMeta.workflow ?? null,
    }),
    "GovernanceRules:\n- Never violate guardrails (banned claims, restricted topics, required disclaimers).\n- Match the agency's quality standards and service model.\n- Respect approval and escalation rules from workflow.",
  ].join("\n");

  const briefBuild = buildClientOperatingBriefV2({
    clientId,
    agencyId,
    onboardingProfile: onboardingProfile as Record<string, unknown> | null,
    operationsSetup: operationsSetupRecord as Record<string, unknown> | null,
    clientBrain: effectiveBrain as Record<string, unknown>,
  });

  const briefRow = await createClientBriefV2({
    supabase,
    agencyId,
    clientId,
    actingUserId,
    onboardingProfileId: (onboardingProfile as any)?.id ?? null,
    clientBrainId: ensuredBrainRow.id,
    operationsSetupId: (operationsSetupRecord as any)?.id ?? null,
    contentJson: briefBuild.brief as unknown as Record<string, unknown>,
    readinessState: briefBuild.readinessState,
    missingItems: briefBuild.missingItems,
    assumptions: briefBuild.assumptions,
    citations: briefBuild.citations,
    confidence: briefBuild.confidence,
  });

  const readinessRun = await createAgentRunV2({
    supabase,
    agencyId,
    clientId,
    agentKey: "strategy_readiness_agent",
    lifecycleState: "strategy_readiness_review",
    inputRefs: {
      brief_id: briefRow.id,
      onboarding_profile_id: (onboardingProfile as any)?.id ?? null,
      operations_setup_id: (operationsSetupRecord as any)?.id ?? null,
      client_brain_id: ensuredBrainRow.id,
    },
    startedByUserId: actingUserId,
    model: "deterministic",
  });

  const readinessArtifact = buildReadinessArtifact({
    brief: briefBuild.brief,
    briefVersion: briefRow.version,
    agencyModuleVersions: agencyModuleVersionMap,
    readinessState: briefBuild.readinessState,
    missingItems: briefBuild.missingItems,
    assumptions: briefBuild.assumptions,
    citations: briefBuild.citations,
    confidence: briefBuild.confidence,
  });

  const readinessArtifactRow = await createStrategyArtifactV2({
    supabase,
    agencyId,
    clientId,
    artifactType: "strategy_readiness_audit",
    status: briefBuild.readinessState === "insufficient" ? "review" : "approved",
    sourceBriefId: briefRow.id,
    agencyModuleVersionMap,
    contentJson: readinessArtifact as unknown as Record<string, unknown>,
    citations: readinessArtifact.citations,
    assumptions: readinessArtifact.assumptions,
    openQuestions: readinessArtifact.open_questions,
    confidence: readinessArtifact.confidence,
    generatedByRunId: readinessRun.id,
    createdBy: actingUserId,
  });

  const readinessEvaluation = evaluateReadinessArtifact(readinessArtifact);
  await createArtifactEvaluationV2({
    supabase,
    artifactId: readinessArtifactRow.id,
    agencyId,
    clientId,
    evaluatorKey: "strategy_readiness_gate_v2",
    result: readinessEvaluation.result,
    score: readinessEvaluation.score,
    findings: readinessEvaluation.findings,
    metadata: {
      readiness_state: briefBuild.readinessState,
    },
  });
  await finalizeAgentRunV2({
    supabase,
    runId: readinessRun.id,
    status: briefBuild.readinessState === "insufficient" ? "blocked" : "completed",
    outputArtifactId: readinessArtifactRow.id,
    durationMs: Date.now() - startTime,
  });

  if (briefBuild.readinessState === "insufficient") {
    const questions = [
      ...briefBuild.brief.open_questions,
      ...briefBuild.missingItems.map((item) => `Please provide ${item.replace(/_/g, " ")}.`),
    ].slice(0, 6);
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "strategy_v2_readiness",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: {
        code: "BRAIN_INCOMPLETE",
        missing_fields: briefBuild.missingItems,
        readiness_state: briefBuild.readinessState,
      },
    });
    return jsonResponse(
      buildUnknownResponse(
        {
          missing_fields: briefBuild.missingItems,
          questions,
        },
        { code: "BRAIN_INCOMPLETE", deep_link: `/onboarding/client/${clientId}?stage=essential_intake` },
      ),
      200,
      corsHeaders(req),
    );
  }

  const diagnosisRun = await createAgentRunV2({
    supabase,
    agencyId,
    clientId,
    agentKey: "diagnosis_agent",
    lifecycleState: "strategy_diagnosis",
    inputRefs: {
      brief_id: briefRow.id,
      readiness_artifact_id: readinessArtifactRow.id,
    },
    startedByUserId: actingUserId,
  });

  const diagnosisContext = [
    "Strategy Diagnosis Context",
    JSON.stringify(
      buildDefaultDiagnosisInputSummary(
        briefBuild.brief,
        agencyOperatingModules.map((row) => row.content_json),
      ),
    ),
    `ReadinessArtifact:\n${JSON.stringify(readinessArtifact)}`,
    agencyGovernanceContext,
  ].join("\n\n");

  let diagnosisResult: any = null;
  let diagnosisArtifact: Record<string, unknown> | null = null;
  let diagnosisFallbackReason: string | null = null;
  try {
    diagnosisResult = await ai.run({
      taskType: TaskType.STRATEGY_DIAGNOSIS,
      input: "",
      context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase, skipUsageLog: true },
      metadata: { context: diagnosisContext },
    });
    if (diagnosisResult.unknown || !diagnosisResult.output) {
      diagnosisFallbackReason = "diagnosis_unknown";
      diagnosisArtifact = buildDeterministicDiagnosisArtifact({
        brief: briefBuild.brief,
        briefVersion: briefRow.version,
        agencyModuleVersions: agencyModuleVersionMap,
      }) as unknown as Record<string, unknown>;
    } else {
      diagnosisArtifact = diagnosisResult.output as Record<string, unknown>;
    }
  } catch (error: any) {
    diagnosisFallbackReason = error?.message ?? "diagnosis_error";
    diagnosisArtifact = buildDeterministicDiagnosisArtifact({
      brief: briefBuild.brief,
      briefVersion: briefRow.version,
      agencyModuleVersions: agencyModuleVersionMap,
    }) as unknown as Record<string, unknown>;
  }

  const diagnosisArtifactRow = await createStrategyArtifactV2({
    supabase,
    agencyId,
    clientId,
    artifactType: "strategy_diagnosis",
    status: "review",
    sourceBriefId: briefRow.id,
    agencyModuleVersionMap,
    contentJson: diagnosisArtifact,
    citations: (diagnosisArtifact as any).citations ?? [],
    assumptions: (diagnosisArtifact as any).assumptions ?? [],
    openQuestions: (diagnosisArtifact as any).open_questions ?? [],
    confidence: (diagnosisArtifact as any).confidence ?? null,
    generatedByRunId: diagnosisRun.id,
    createdBy: actingUserId,
  });
  const diagnosisEvaluation = evaluateDiagnosisArtifact(diagnosisArtifact as any);
  await createArtifactEvaluationV2({
    supabase,
    artifactId: diagnosisArtifactRow.id,
    agencyId,
    clientId,
    evaluatorKey: "diagnosis_quality_gate_v2",
    result: diagnosisEvaluation.result,
    score: diagnosisEvaluation.score,
    findings: diagnosisEvaluation.findings,
    metadata: buildFallbackTrace("diagnosis_agent", diagnosisFallbackReason),
  });
  await finalizeAgentRunV2({
    supabase,
    runId: diagnosisRun.id,
    status: diagnosisEvaluation.result === "fail" ? "failed" : "completed",
    outputArtifactId: diagnosisArtifactRow.id,
    failureReason: diagnosisEvaluation.result === "fail" ? (diagnosisFallbackReason ?? null) : null,
    durationMs: Date.now() - startTime,
    traceJson: buildFallbackTrace("diagnosis_agent", diagnosisFallbackReason),
  });

  if (diagnosisEvaluation.result === "fail") {
    return jsonResponse({ error: "Strategy diagnosis failed quality checks", code: "GENERATION_ERROR" }, 500, corsHeaders(req));
  }

  if (!allowsRecommendationFromReadiness(briefBuild.readinessState)) {
    const questions = uniqueStrings([
      ...(briefBuild.brief.open_questions ?? []),
      ...briefBuild.missingItems.map((item) => `Please confirm ${item.replace(/_/g, " ")} before recommendations are finalized.`),
      "Complete the remaining client context so the system can move from diagnosis into a recommended plan.",
    ], 6);
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: "strategy_v2_readiness",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: true,
      citations: emptySources(),
      metadata: {
        code: "READINESS_SCOPE_INCOMPLETE",
        readiness_state: briefBuild.readinessState,
        missing_fields: briefBuild.missingItems,
        allowed_scope: (readinessArtifact as any)?.body?.allowed_scope ?? ["diagnosis"],
      },
    });
    return jsonResponse(
      buildUnknownResponse(
        {
          missing_fields: briefBuild.missingItems,
          questions,
        },
        {
          code: "READINESS_SCOPE_INCOMPLETE",
          deep_link: `/onboarding/client/${clientId}?stage=${getReadinessDeepLinkStage(briefBuild.readinessState)}`,
        },
      ),
      200,
      corsHeaders(req),
    );
  }

  const recommendationRun = await createAgentRunV2({
    supabase,
    agencyId,
    clientId,
    agentKey: "strategy_architect_agent",
    lifecycleState: "strategy_in_review",
    inputRefs: {
      brief_id: briefRow.id,
      diagnosis_artifact_id: diagnosisArtifactRow.id,
    },
    startedByUserId: actingUserId,
  });

  const recommendationContext = [
    "Strategy Recommendation Context",
    `Brief:\n${JSON.stringify(briefBuild.brief)}`,
    `DiagnosisArtifact:\n${JSON.stringify(diagnosisArtifact)}`,
    `AgencyModules:\n${JSON.stringify(agencyOperatingModules.map((row) => row.content_json))}`,
    agencyGovernanceContext,
  ].join("\n\n");

  let recommendationResult: any = null;
  let recommendationArtifact: Record<string, unknown> | null = null;
  let recommendationFallbackReason: string | null = null;
  try {
    recommendationResult = await ai.run({
      taskType: TaskType.STRATEGY_RECOMMENDATION,
      input: "",
      context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase, skipUsageLog: true },
      metadata: { context: recommendationContext },
    });
    if (recommendationResult.unknown || !recommendationResult.output) {
      recommendationFallbackReason = "recommendation_unknown";
      recommendationArtifact = buildDeterministicRecommendationArtifact({
        brief: briefBuild.brief,
        diagnosisArtifact,
        briefVersion: briefRow.version,
        agencyModuleVersions: agencyModuleVersionMap,
      }) as unknown as Record<string, unknown>;
    } else {
      recommendationArtifact = recommendationResult.output as Record<string, unknown>;
    }
  } catch (error: any) {
    recommendationFallbackReason = error?.message ?? "recommendation_error";
    recommendationArtifact = buildDeterministicRecommendationArtifact({
      brief: briefBuild.brief,
      diagnosisArtifact,
      briefVersion: briefRow.version,
      agencyModuleVersions: agencyModuleVersionMap,
    }) as unknown as Record<string, unknown>;
  }

  const recommendationArtifactRow = await createStrategyArtifactV2({
    supabase,
    agencyId,
    clientId,
    artifactType: "strategy_recommendation",
    status: "review",
    sourceBriefId: briefRow.id,
    agencyModuleVersionMap,
    contentJson: recommendationArtifact,
    citations: (recommendationArtifact as any).citations ?? [],
    assumptions: (recommendationArtifact as any).assumptions ?? [],
    openQuestions: (recommendationArtifact as any).open_questions ?? [],
    confidence: (recommendationArtifact as any).confidence ?? null,
    generatedByRunId: recommendationRun.id,
    createdBy: actingUserId,
  });
  const recommendationEvaluation = evaluateRecommendationArtifact(recommendationArtifact as any);
  await createArtifactEvaluationV2({
    supabase,
    artifactId: recommendationArtifactRow.id,
    agencyId,
    clientId,
    evaluatorKey: "strategy_recommendation_gate_v2",
    result: recommendationEvaluation.result,
    score: recommendationEvaluation.score,
    findings: recommendationEvaluation.findings,
    metadata: buildFallbackTrace("strategy_architect_agent", recommendationFallbackReason),
  });
  await finalizeAgentRunV2({
    supabase,
    runId: recommendationRun.id,
    status: recommendationEvaluation.result === "fail" ? "failed" : "completed",
    outputArtifactId: recommendationArtifactRow.id,
    failureReason: recommendationEvaluation.result === "fail" ? (recommendationFallbackReason ?? null) : null,
    durationMs: Date.now() - startTime,
    traceJson: buildFallbackTrace("strategy_architect_agent", recommendationFallbackReason),
  });

  if (recommendationEvaluation.result === "fail") {
    return jsonResponse({ error: "Strategy recommendation failed quality checks", code: "GENERATION_ERROR" }, 500, corsHeaders(req));
  }

  const { data: latestStrategy } = await supabase
    .from("strategies")
    .select("id, updated_at")
    .eq("client_id", clientId)
    .order("version_int", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: moduleRows } = latestStrategy?.id
    ? await supabase
        .from("strategy_modules")
        .select("module, content_json, updated_at")
        .eq("strategy_id", latestStrategy.id)
    : { data: [] };
  // Publisher mode for the final strategy plan. "llm" (default) runs the
  // STRATEGY_PLAN model with full RAG context and falls back to the
  // deterministic V2 publisher on any failure. Set STRATEGY_PLAN_PUBLISHER
  // to "deterministic" to skip the model entirely.
  const useCompactPublicationContext =
    (Deno.env.get("STRATEGY_PLAN_PUBLISHER") ?? "llm").toLowerCase() === "deterministic";
  let context = "";
  let selectedMatches: any[] = [];
  let brainAiDocumentRows: any[] = [];
  let brainDocReferences: any[] = [];
  let referencesSection = "## References\n- Client Operating Brief V2\n- Strategy Diagnosis V2\n- Strategy Recommendation V2";
  let contextTruncated = false;
  let retrievalCount = 0;
  let docTypesUsed: string[] = [];
  let ragPolicyVersion = useCompactPublicationContext ? "v2_compact" : "legacy";
  let agencyBrainMatchCount = 0;
  let brainDocChunkRetrievedCount = 0;
  let brainDocChunkUsedCount = 0;
  let failedBrainDocChunksCount = 0;

  if (!useCompactPublicationContext) {
    try {
    const useRagPolicy = shouldUseRagPolicy({ agencyId, clientId });
    const ragConfig = getRagConfig(TaskType.STRATEGY_PLAN);
    const minSimilarity = 0.0;
    let queryEmbedding: number[];
    try {
      const embedded = await embedQueryForRag({ query: "strategy_draft" });
      queryEmbedding = embedded.embedding as any;
    } catch (error: any) {
      const message = error?.message ?? String(error);
      const missingApiKey = message.includes("API_KEY is not configured");
      if (missingApiKey) {
        await safeInsertAiRun(supabase, {
          agencyId,
          clientId,
          userId: actingUserId,
          model: "missing-ai-api-key",
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          startTime,
          success: false,
          unknown: false,
          citations: emptySources(),
          metadata: { code: "MISSING_API_KEY", error: message },
        });
        throw error;
      }
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: "rag-query-embedding",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: false,
        citations: emptySources(),
        metadata: { code: "RAG_FAILURE", error: message },
      });
      throw error;
    }

    const legacyClientDocTypes = ["client_guidelines", "client_notes", "approved_posts", "ai_artifact", "strategy_draft"];
    const legacyAgencyDocTypes = ["agency_sop", "brain_document"];
    const legacyExemplarDocTypes = ["agency_exemplar_strategy"];

    const rpcName = getMatchRpcName({ scoped: false });
    let { data: clientMatches, error: clientMatchesError } = await supabase.rpc(rpcName, {
      p_agency_id: agencyId,
      p_client_id: clientId,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(getInitialMatchCount(useRagPolicy ? ragConfig.client_memory_top_k : 6, 50)),
      p_doc_types: useRagPolicy ? ragConfig.client_doc_types : legacyClientDocTypes,
      p_modules: null,
      p_min_similarity: minSimilarity,
    });

    let { data: agencyMatches, error: agencyMatchesError } = await supabase.rpc(rpcName, {
      p_agency_id: agencyId,
      p_client_id: null,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(getInitialMatchCount(useRagPolicy ? ragConfig.agency_memory_top_k : 4, 50)),
      p_doc_types: useRagPolicy ? ragConfig.agency_doc_types : legacyAgencyDocTypes,
      p_modules: null,
      p_min_similarity: minSimilarity,
    });

    let { data: exemplarMatches, error: exemplarMatchesError } = await supabase.rpc(rpcName, {
      p_agency_id: agencyId,
      p_client_id: null,
      p_query_embedding: queryEmbedding,
      p_match_count: clampMatchCount(getInitialMatchCount(useRagPolicy ? ragConfig.exemplar_top_k : 2, 50)),
      p_doc_types: useRagPolicy ? ragConfig.exemplar_doc_types : legacyExemplarDocTypes,
      p_modules: null,
      p_min_similarity: minSimilarity,
    });

    if (clientMatchesError || agencyMatchesError || exemplarMatchesError) {
      const message = clientMatchesError?.message ?? agencyMatchesError?.message ?? exemplarMatchesError?.message ?? "unknown";
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: "retrieval-only",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: false,
        citations: emptySources(),
        metadata: { code: "RAG_FAILURE", error: message },
      });
      throw new Error(message);
    }

    let matches = [...(clientMatches || []), ...(agencyMatches || []), ...(exemplarMatches || [])];
    if (matches.length === 0) {
      const { data: approvedDocs } = await supabase
        .from("ai_documents")
        .select("id, extracted_text")
        .eq("agency_id", agencyId)
        .eq("doc_type", "brain_document")
        .eq("metadata->>status", "approved")
        .order("created_at", { ascending: false })
        .limit(2);

      if ((approvedDocs ?? []).length > 0) {
        agencyMatches = (approvedDocs ?? []).map((doc: any) => ({
          doc_type: "brain_document",
          document_id: doc.id,
          chunk_id: null,
          chunk_text: doc.extracted_text ?? "",
          score: 1,
        }));
        matches = [...(clientMatches || []), ...(agencyMatches || []), ...(exemplarMatches || [])];
      }
    }

    matches = applyScoreRerank(matches, 12);
    agencyBrainMatchCount = (agencyMatches ?? []).filter((row: any) => row.doc_type === "brain_document").length;
    const legacyMatches = matches.length === 0 ? [] : useRagPolicy ? matches : capMatchesByTokenBudget(matches, 1200).matches;
    const fullContext = legacyMatches.map((row: any) => `(${row.doc_type}) ${row.chunk_text}`).join("\n\n");
    const legacyContext = truncate(fullContext, 6000);
    const legacyContextTruncated = fullContext.length > 6000 || legacyMatches.length < matches.length;
    const ragResult = useRagPolicy ? applyRagPolicy(matches, ragConfig) : null;
    context = ragResult?.context ?? legacyContext;
    selectedMatches = ragResult?.selectedMatches ?? legacyMatches;
    contextTruncated = ragResult?.contextTruncated ?? legacyContextTruncated;
    retrievalCount = ragResult?.retrievalCount ?? legacyMatches.length;
    docTypesUsed = ragResult?.docTypesUsed ?? Array.from(new Set(legacyMatches.map((row: any) => row.doc_type)));
    ragPolicyVersion = useRagPolicy ? "v1" : "legacy";
    brainDocChunkRetrievedCount = (agencyMatches ?? []).filter((row: any) => row.doc_type === "brain_document").length;
    brainDocChunkUsedCount = selectedMatches.filter((row: any) => row.doc_type === "brain_document").length;

    const brainDocAiDocumentIds = Array.from(
      new Set(
        selectedMatches
          .filter((row: any) => row.doc_type === "brain_document" && row.document_id)
          .map((row: any) => row.document_id),
      ),
    );
    const { data: brainAiDocumentRowsData } = brainDocAiDocumentIds.length
      ? await supabase
          .from("ai_documents")
          .select("id, title, metadata")
          .eq("agency_id", agencyId)
          .eq("doc_type", "brain_document")
          .in("id", brainDocAiDocumentIds)
      : { data: [] };
    brainAiDocumentRows = (brainAiDocumentRowsData ?? []) as any[];
    brainDocReferences = buildBrainDocumentReferences({
      matches: selectedMatches,
      aiDocuments: brainAiDocumentRows,
      maxReferences: 20,
    });
    referencesSection = formatBrainDocumentReferencesMarkdown({
      references: brainDocReferences,
      maxReferences: 20,
    });
    const failedChunksResult = brainDocAiDocumentIds.length
      ? await supabase
          .from("ai_document_chunks")
          .select("id", { count: "exact", head: true })
          .in("document_id", brainDocAiDocumentIds)
          .eq("embedding_status", "failed")
      : { count: 0 };
    failedBrainDocChunksCount = failedChunksResult.count ?? 0;
    } catch (ragError) {
      // Retrieval is an enhancement, not a hard dependency: degrade to the
      // structured V2 artifacts (brief + diagnosis + recommendation) rather
      // than failing the whole generation.
      console.error("strategy_plan_rag_degraded", {
        agencyId,
        clientId,
        traceId,
        error: ragError instanceof Error ? ragError.message : String(ragError),
      });
      context = "";
      selectedMatches = [];
      brainAiDocumentRows = [];
      ragPolicyVersion = "rag_failed";
    }
  }

  const promptContext = [
    `GeneratedAtUtc: ${new Date().toISOString()}`,
    `CurrentMonth: ${new Date().getUTCFullYear()}-${pad2(new Date().getUTCMonth() + 1)}`,
    `CurrentIsoWeek: ${isoWeekString(new Date())}`,
    (() => {
      const profile = (onboardingProfile ?? {}) as Record<string, unknown>;
      const warnings: string[] = [];

      const country = normalizeCountry(profile.q3_country ?? (profile as any).country);
      if (country.warning) warnings.push(country.warning);
      const city = normalizeCity(profile.q3_city ?? (profile as any).city);

      const website = (profile.q2_website ?? (profile as any).website) as unknown;
      if (isLikelyPlaceholderWebsite(website)) {
        warnings.push(`Website looks like a placeholder (${String(website)}). Treat as unverified.`);
      }

      const sanitized = {
        ...profile,
        ...(country.value ? { q3_country: country.value } : {}),
        ...(city.value ? { q3_city: city.value } : {}),
      };

      return [
        `Onboarding Profile (sanitized):\n${JSON.stringify(sanitized)}`,
        warnings.length ? `DataQualityWarnings:\n- ${warnings.join("\n- ")}` : "DataQualityWarnings:\n(none)",
      ].join("\n\n");
    })(),
    `Client Operating Brief V2:\n${JSON.stringify(briefBuild.brief)}`,
    `Strategy Diagnosis V2:\n${JSON.stringify(diagnosisArtifact)}`,
    `Strategy Recommendation V2:\n${JSON.stringify(recommendationArtifact)}`,
    `Structured Strategy:\n${JSON.stringify(moduleRows ?? [])}`,
    agencyGovernanceContext,
    `RAG Context:\n${context}`,
    referencesSection,
  ].join("\n\n");

  const outputSchema = buildStrategyOutputSchema();
  let aiResult: any = null;
  let output: StrategyOutput | null = null;
  let planFallbackReason: string | null = useCompactPublicationContext ? "publisher_deterministic_mode" : null;
  if (!useCompactPublicationContext) {
    try {
      aiResult = await ai.run({
        taskType: TaskType.STRATEGY_PLAN,
        input: "",
        context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase, skipUsageLog: true },
        metadata: { context: promptContext, instruction, client_brain: effectiveBrain },
        outputSchema,
      });
      output = (aiResult.output ?? null) as StrategyOutput | null;

      if (aiResult?.unknown || (aiResult?.output as any)?.unknown === true) {
        planFallbackReason = "plan_unknown";
        output = null;
      } else if (!aiResult?.schemaOk || !output) {
        planFallbackReason = "plan_schema_invalid";
        output = null;
      }
    } catch (error: any) {
      const isTimeout = error instanceof DOMException && error.name === "AbortError";
      const message = error?.message ?? String(error);
      const missingApiKey = typeof message === "string" && message.includes("API_KEY is not configured");
      planFallbackReason = missingApiKey
        ? "missing_api_key"
        : isTimeout
          ? "plan_timeout"
          : `plan_error: ${truncate(message, 300)}`;
      output = null;
    }

    if (planFallbackReason) {
      // The model path failed; record it and publish via the deterministic
      // V2 builder below so the agency still gets a reviewable strategy.
      console.error("strategy_plan_llm_fallback", { agencyId, clientId, traceId, reason: planFallbackReason });
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "strategy-plan"),
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: planFallbackReason === "plan_unknown",
        citations: emptySources(),
        metadata: { code: "STRATEGY_PLAN_FALLBACK", reason: planFallbackReason, trace_id: traceId },
      });
    }
  }

  if (!output) {
    try {
      output = buildDeterministicStrategyOutputFromV2({
        brief: briefBuild.brief,
        diagnosisArtifact,
        recommendationArtifact,
      });
      aiResult = {
        output,
        schemaOk: true,
        unknown: false,
        meta: { provider: "deterministic", model: "v2-deterministic-publisher" },
      };
    } catch (error: any) {
      const builderError = error?.message ?? String(error);
      console.error("strategy_v2_deterministic_build_failed", { agencyId, clientId, error: builderError, traceId });
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: "v2-deterministic-publisher",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: false,
        citations: emptySources(),
        metadata: { code: "DETERMINISTIC_BUILD_ERROR", error: builderError, trace_id: traceId },
      });
      return jsonResponse({ error: "Failed to build deterministic strategy output", code: "DETERMINISTIC_BUILD_ERROR", trace_id: traceId }, 500, corsHeaders(req));
    }
  }

  try {
    const referencesMarkdown = referencesSection.replace(/^References:/, "## References");

    // Post-generation quality repair loop: if the rules engine finds blockers, attempt limited repair passes.
    // This improves completeness while staying compatible with the existing StrategyPlan schema.
    const MAX_REPAIR_PASSES = planFallbackReason ? 0 : 2;
    let repairedOutput = output;
    let repairedAiResult = aiResult;

    for (let pass = 0; pass < MAX_REPAIR_PASSES; pass += 1) {
      const evaluations = Object.entries(repairedOutput.modules).map(([module, content]) => {
        const evaluation = evaluateStrategyModule(module as any, content as any, {
          modules: repairedOutput.modules as any,
          currentStatus: "draft",
          isLocked: false,
        });
        return { module, ...evaluation };
      });

      const blockersByModule = evaluations
        .filter((e: any) => (e.blockers ?? []).length > 0)
        .map((e: any) => ({ module: e.module, blockers: e.blockers }));

      if (blockersByModule.length === 0) break;

      const repairContext = [
        promptContext,
        `RepairPass: ${pass + 1}/${MAX_REPAIR_PASSES}`,
        `ExistingModulesJson:\n${JSON.stringify(repairedOutput.modules)}`,
        `BlockersToFix:\n${JSON.stringify(blockersByModule)}`,
        "RepairInstructions:\n- Fix ONLY the listed blockers.\n- Preserve correct fields (especially selectedMonth, selectedWeek, dates, cadenceMatrix).\n- Do NOT introduce new unsourced numeric KPI targets; if targets exist without baseline, label them as assumptions and ask for baseline.\n- Avoid the word \"store\" for service businesses; use \"studio\" / \"location\" wording.\n- Avoid \"guaranteed\" language in fitness/health contexts.\n- Return full StrategyPlan JSON matching schema.",
      ].join("\n\n");

      let passResult: any = null;
      try {
        passResult = await ai.run({
          taskType: TaskType.STRATEGY_PLAN,
          input: "",
          context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase, skipUsageLog: true },
          metadata: { context: repairContext, instruction, client_brain: effectiveBrain },
          outputSchema,
        });
      } catch (error: any) {
        console.error("strategy_repair_pass_failed", { pass: pass + 1, error: error?.message ?? String(error) });
        break;
      }

      const candidate = (passResult?.output ?? null) as StrategyOutput | null;
      if (!passResult?.schemaOk || !candidate) break;

      const nextModules: any = { ...(repairedOutput.modules as any) };
      for (const row of blockersByModule as any[]) {
        const module = row.module;
        if (candidate.modules && (candidate.modules as any)[module]) {
          nextModules[module] = (candidate.modules as any)[module];
        }
      }

      repairedOutput = { ...repairedOutput, modules: nextModules, document: candidate.document ?? repairedOutput.document };
      repairedAiResult = passResult;
    }

    const baseMarkdown = repairedOutput.document.markdown?.trim() ?? "";
    const markdown = /\n##\s+References\b/i.test(baseMarkdown)
      ? baseMarkdown
      : `${baseMarkdown}\n\n${referencesMarkdown}`;
    const html = renderStrategyHtml(markdown);

    const citations = selectedMatches.map((row: any) => ({
      doc_type: row.doc_type,
      document_id: row.document_id,
      chunk_id: row.chunk_id,
      score: row.score,
    }));

    const brainDocRows = (brainAiDocumentRows ?? []) as any[];

    const brainDocVersions = (brainDocRows ?? [])
      .map((row: any) => ({
        id: row.id,
        module: row.metadata?.module ?? null,
        version: row.metadata?.version ?? null,
        status: row.metadata?.status ?? null,
        approved_at: row.metadata?.approved_at ?? null,
      }))
      .sort((a: any, b: any) => String(a.module ?? "").localeCompare(String(b.module ?? "")));

    const derivedFromHash = await sha256Hex(
      stableStringify({
        onboardingProfile,
        scan: {
          ai_scan_result: onboardingProfile?.ai_scan_result ?? null,
          ai_scan_at: onboardingProfile?.ai_scan_at ?? null,
          ai_scan_accepted: onboardingProfile?.ai_scan_accepted ?? null,
        },
        brain_documents: brainDocVersions,
      }),
    );

    const modulePayload = Object.entries(repairedOutput.modules).map(([module, content]) => ({
      module,
      content_json: content,
      ai_confidence: (content as any).confidence_0_100 ?? null,
    }));

    const moduleEvaluations = Object.entries(repairedOutput.modules).map(([module, content]) => {
      const evaluation = evaluateStrategyModule(module as any, content as any, {
        modules: repairedOutput.modules as any,
        currentStatus: "draft",
        isLocked: false,
      });
      return { module, ...evaluation };
    });

    const autoValidationTasks = Object.entries(repairedOutput.modules)
      .filter(([, content]) => (content as any).confidence_0_100 < 70)
      .map(([module, content]) => {
        const questions = (content as any).open_questions ?? [];
        const description = questions.length
          ? `Open questions: ${questions.slice(0, 5).join("; ")}`
          : "Review module for accuracy and completeness.";
        return {
          module,
          title: `Validate ${MODULE_LABELS[module] ?? module} module`,
          description,
          priority: "high",
          dedupe_key: `validation:${module}`,
        };
      });

    const blockerTasks = buildBlockerTasks({ moduleEvaluations: moduleEvaluations as any });
    const taskRows = [...(repairedOutput.tasks ?? []), ...autoValidationTasks, ...blockerTasks];
    const dedupedTasks = taskRows.reduce((map: Map<string, any>, task: any) => {
      const key = task.dedupe_key ?? `${task.module ?? "general"}:${task.title}`;
      if (!map.has(key)) {
        map.set(key, task);
      }
      return map;
    }, new Map<string, any>());
    const tasksPayload = Array.from(dedupedTasks.values());

    const rpcResult = await supabase.rpc("create_strategy_snapshot", {
      p_client_id: clientId,
      p_agency_id: agencyId,
      p_strategy_id: latestStrategy?.id ?? null,
      p_user_id: actingUserId,
      p_modules: modulePayload,
      p_document_markdown: markdown,
      p_document_html: html,
      p_model: repairedAiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
      p_instruction: instruction ?? null,
      p_derived_hash: derivedFromHash,
      p_decisions: repairedOutput.decisions ?? null,
      p_tasks: tasksPayload.length ? tasksPayload : null,
    });

    if (rpcResult?.error) {
      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini"),
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        startTime,
        success: false,
        unknown: false,
        citations: emptySources(),
        metadata: { code: "PERSISTENCE_ERROR", error: rpcResult.error.message },
      });
      return jsonResponse({ error: "Failed to save strategy snapshot", code: "PERSISTENCE_ERROR" }, 500, corsHeaders(req));
    }

    if (useCompactPublicationContext) {
      const createdStrategyId = (rpcResult as any)?.data?.strategy_id;
      const createdDocumentId = (rpcResult as any)?.data?.document_id;
      const strategyPlanArtifact = buildStrategyPlanArtifact({
        briefVersion: briefRow.version,
        agencyModuleVersions: agencyModuleVersionMap,
        summary:
          typeof (recommendationArtifact as any)?.summary === "string" && (recommendationArtifact as any).summary.trim()
            ? String((recommendationArtifact as any).summary)
            : "Approved strategy plan generated from V2 recommendation and published to strategy surfaces.",
        markdown,
        assumptions: [
          ...(((diagnosisArtifact as any)?.assumptions as string[] | undefined) ?? []),
          ...(((recommendationArtifact as any)?.assumptions as string[] | undefined) ?? []),
        ],
        openQuestions: [
          ...(((diagnosisArtifact as any)?.open_questions as string[] | undefined) ?? []),
          ...(((recommendationArtifact as any)?.open_questions as string[] | undefined) ?? []),
        ],
        citations: selectedMatches.map((row: any) => ({
          document_id: row.document_id,
          doc_type: row.doc_type,
          score: row.score,
        })),
        confidence: Math.round(
          Number(((recommendationArtifact as any)?.confidence ?? 70) + ((repairedOutput.modules.positioning as any)?.confidence_0_100 ?? 70)) / 2,
        ),
        modules: repairedOutput.modules as unknown as Record<string, unknown>,
      });

      const strategyPlanArtifactRow = await createStrategyArtifactV2({
        supabase,
        agencyId,
        clientId,
        artifactType: "strategy_plan_v2",
        status: "review",
        sourceBriefId: briefRow.id,
        agencyModuleVersionMap,
        contentJson: strategyPlanArtifact as unknown as Record<string, unknown>,
        markdown,
        citations: strategyPlanArtifact.citations,
        assumptions: strategyPlanArtifact.assumptions,
        openQuestions: strategyPlanArtifact.open_questions,
        confidence: strategyPlanArtifact.confidence,
        createdBy: actingUserId,
        publishedToStrategyId: createdStrategyId ?? null,
        publishedToDocumentId: createdDocumentId ?? null,
      });

      await finalizePublishedStrategySideEffects({
        supabase,
        agencyId,
        clientId,
        createdStrategyId: createdStrategyId ?? null,
        moduleEvaluations,
      });

      const runtimeModel = aiResult?.meta?.model ?? "v2-deterministic-publisher";
      const tokensIn = estimateTokensForCost(context);
      const tokensOut = estimateTokensForCost(markdown);
      const costUsd = 0;
      const citationsForRun = buildAiRunCitations(selectedMatches);
      const citationValidation = validateCitations(
        { sources: citationsForRun, unknown: false, escalate_to_human: false },
        selectedMatches,
      );

      if (!citationValidation.valid && strictSchema) {
        await safeInsertAiRun(supabase, {
          agencyId,
          clientId,
          userId: actingUserId,
          model: runtimeModel,
          tokensIn,
          tokensOut,
          costUsd,
          startTime,
          success: false,
          unknown: false,
          citations: citationsForRun,
          metadata: {
            cost_estimation_method: "estimate_chars_div3",
            retrieval_count: retrievalCount,
            context_truncated: contextTruncated,
            doc_types_used: docTypesUsed,
            rag_policy_version: ragPolicyVersion,
            publication_mode: "v2_compact_deterministic",
            citation_errors: citationValidation.errors,
          },
        });
        return jsonResponse({ error: "Citation validation failed", code: "CITATION_VALIDATION_FAILED" }, 500, corsHeaders(req));
      }

      await safeInsertAiRun(supabase, {
        agencyId,
        clientId,
        userId: actingUserId,
        model: runtimeModel,
        tokensIn,
        tokensOut,
        costUsd,
        startTime,
        success: true,
        unknown: false,
        citations: citationsForRun,
        metadata: {
          cost_estimation_method: "estimate_chars_div3",
          retrieval_count: retrievalCount,
          context_truncated: contextTruncated,
          doc_types_used: docTypesUsed,
          rag_policy_version: ragPolicyVersion,
          publication_mode: planFallbackReason ? "deterministic" : "llm",
          plan_mode: planFallbackReason ? "deterministic_fallback" : "model_output",
          plan_fallback_reason: planFallbackReason,
          recommendation_mode: recommendationFallbackReason ? "deterministic_fallback" : "model_output",
          diagnosis_mode: diagnosisFallbackReason ? "deterministic_fallback" : "model_output",
          ...(citationValidation.valid ? {} : { citation_errors: citationValidation.errors }),
        },
      });

      await supabase.from("ai_usage_logs").insert({
        agency_id: agencyId,
        client_id: clientId,
        endpoint: "ai-strategy-generate",
        model: runtimeModel,
        tokens_estimate: Math.ceil(markdown.length / 4),
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        latency_ms: Date.now() - startTime,
        unknown: false,
      });

      return jsonResponse(
        {
          unknown: false,
          modules: repairedOutput.modules,
          tasks_created: tasksPayload.length,
          citations,
          confidence: Math.round(
            Object.values(repairedOutput.modules)
              .map((mod: any) => Number(mod.confidence_0_100 ?? 0))
              .reduce((acc, val) => acc + val, 0) / Object.keys(repairedOutput.modules).length,
          ),
          v2: {
            brief_id: briefRow.id,
            brief_version: briefRow.version,
            readiness_state: briefBuild.readinessState,
            readiness_artifact_id: readinessArtifactRow.id,
            diagnosis_artifact_id: diagnosisArtifactRow.id,
            recommendation_artifact_id: recommendationArtifactRow.id,
            strategy_plan_artifact_id: strategyPlanArtifactRow.id,
          },
          document: (rpcResult as any)?.data ?? null,
        },
        200,
        corsHeaders(req),
      );
    }

    const createdStrategyId = (rpcResult as any)?.data?.strategy_id;
    const createdDocumentId = (rpcResult as any)?.data?.document_id;
    const strategyPlanArtifact = buildStrategyPlanArtifact({
    briefVersion: briefRow.version,
    agencyModuleVersions: agencyModuleVersionMap,
    summary:
      typeof (recommendationArtifact as any)?.summary === "string" && (recommendationArtifact as any).summary.trim()
        ? String((recommendationArtifact as any).summary)
        : "Approved strategy plan generated from V2 recommendation and published to strategy surfaces.",
    markdown,
    assumptions: [
      ...(((diagnosisArtifact as any)?.assumptions as string[] | undefined) ?? []),
      ...(((recommendationArtifact as any)?.assumptions as string[] | undefined) ?? []),
    ],
    openQuestions: [
      ...(((diagnosisArtifact as any)?.open_questions as string[] | undefined) ?? []),
      ...(((recommendationArtifact as any)?.open_questions as string[] | undefined) ?? []),
    ],
    citations: selectedMatches.map((row: any) => ({
      document_id: row.document_id,
      doc_type: row.doc_type,
      score: row.score,
    })),
    confidence: Math.round(
      Number(((recommendationArtifact as any)?.confidence ?? 70) + ((repairedOutput.modules.positioning as any)?.confidence_0_100 ?? 70)) / 2,
    ),
    modules: repairedOutput.modules as unknown as Record<string, unknown>,
  });
    const strategyPlanArtifactRow = await createStrategyArtifactV2({
    supabase,
    agencyId,
    clientId,
    artifactType: "strategy_plan_v2",
    status: "review",
    sourceBriefId: briefRow.id,
    agencyModuleVersionMap,
    contentJson: strategyPlanArtifact as unknown as Record<string, unknown>,
    markdown,
    citations: strategyPlanArtifact.citations,
    assumptions: strategyPlanArtifact.assumptions,
    openQuestions: strategyPlanArtifact.open_questions,
    confidence: strategyPlanArtifact.confidence,
    createdBy: actingUserId,
    publishedToStrategyId: createdStrategyId ?? null,
    publishedToDocumentId: createdDocumentId ?? null,
  });

    await finalizePublishedStrategySideEffects({
      supabase,
      agencyId,
      clientId,
      createdStrategyId: createdStrategyId ?? null,
      moduleEvaluations,
    });

    const usage = extractUsageFromRaw(aiResult?.raw);
    const runtimeModel = aiResult?.meta?.model ?? (Deno.env.get("STRATEGY_MODEL_ID") ?? "gpt-4o-mini");
    const tokensIn = usage?.inputTokens ?? estimateTokensForCost(context);
    const tokensOut = usage?.outputTokens ?? estimateTokensForCost(markdown);
    const costUsd = calculateCost(aiResult?.meta?.provider ?? "openai", runtimeModel, tokensIn, tokensOut);
    const costEstimationMethod = usage ? "token_based" : "estimate_chars_div3";

    const citationsForRun = buildAiRunCitations(selectedMatches);

    const citationValidation = validateCitations(
      { sources: citationsForRun, unknown: false, escalate_to_human: false },
      selectedMatches,
    );

    if (!citationValidation.valid && strictSchema) {
      await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: runtimeModel,
      tokensIn,
      tokensOut,
      costUsd,
      startTime,
      success: false,
      unknown: false,
      citations: citationsForRun,
      metadata: {
        cost_estimation_method: costEstimationMethod,
        retrieval_count: retrievalCount,
        context_truncated: contextTruncated,
        doc_types_used: docTypesUsed,
        rag_policy_version: ragPolicyVersion,
        citation_errors: citationValidation.errors,
      },
    });
      return jsonResponse({ error: "Citation validation failed", code: "CITATION_VALIDATION_FAILED" }, 500, corsHeaders(req));
    }

    await safeInsertAiRun(supabase, {
    agencyId,
    clientId,
    userId: actingUserId,
    model: runtimeModel,
    tokensIn,
    tokensOut,
    costUsd,
    startTime,
    success: true,
    unknown: false,
    citations: citationsForRun,
    metadata: {
      cost_estimation_method: costEstimationMethod,
      retrieval_count: retrievalCount,
      context_truncated: contextTruncated,
      doc_types_used: docTypesUsed,
      rag_policy_version: ragPolicyVersion,
      plan_mode: planFallbackReason ? "deterministic_fallback" : "model_output",
      plan_fallback_reason: planFallbackReason,
      recommendation_mode: recommendationFallbackReason ? "deterministic_fallback" : "model_output",
      diagnosis_mode: diagnosisFallbackReason ? "deterministic_fallback" : "model_output",
      ...(citationValidation.valid ? {} : { citation_errors: citationValidation.errors }),
    },
  });

    await supabase.from("ai_usage_logs").insert({
    agency_id: agencyId,
    client_id: clientId,
    endpoint: "ai-strategy-generate",
    model: runtimeModel,
    tokens_estimate: Math.ceil(markdown.length / 4),
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    latency_ms: Date.now() - startTime,
    unknown: false,
  });

    return jsonResponse(
      {
        unknown: false,
        modules: repairedOutput.modules,
      tasks_created: tasksPayload.length,
      citations,
      rag_debug: {
        brain_document_chunks_retrieved: brainDocChunkRetrievedCount,
        brain_document_chunks_used: brainDocChunkUsedCount,
        brain_document_failed_chunks: failedBrainDocChunksCount ?? 0,
        brain_document_any_failed_chunks: (failedBrainDocChunksCount ?? 0) > 0,
        brain_document_references_used: brainDocReferences,
        context_truncated: contextTruncated,
        rag_policy_version: ragPolicyVersion,
      },
      confidence: Math.round(
        Object.values(repairedOutput.modules)
          .map((mod: any) => Number(mod.confidence_0_100 ?? 0))
          .reduce((acc, val) => acc + val, 0) / Object.keys(repairedOutput.modules).length,
      ),
      v2: {
        brief_id: briefRow.id,
        brief_version: briefRow.version,
        readiness_state: briefBuild.readinessState,
        readiness_artifact_id: readinessArtifactRow.id,
        diagnosis_artifact_id: diagnosisArtifactRow.id,
        recommendation_artifact_id: recommendationArtifactRow.id,
        strategy_plan_artifact_id: strategyPlanArtifactRow.id,
      },
        document: rpcResult?.data ?? null,
      },
      200,
      corsHeaders(req),
    );
  } catch (error: any) {
    const publicationError = error?.message ?? String(error);
    console.error("strategy_publication_failed", { agencyId, clientId, error: publicationError, traceId });
    await safeInsertAiRun(supabase, {
      agencyId,
      clientId,
      userId: actingUserId,
      model: aiResult?.meta?.model ?? "v2-deterministic-publisher",
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      startTime,
      success: false,
      unknown: false,
      citations: emptySources(),
      metadata: { code: "PUBLICATION_ERROR", error: publicationError, trace_id: traceId },
    });
    return jsonResponse({ error: "Failed to publish strategy", code: "PUBLICATION_ERROR", trace_id: traceId }, 500, corsHeaders(req));
  }
  })();

  await logOtelSpan(supabase, {
    traceId,
    spanId,
    stage: "edge.ai-strategy-generate",
    taskType: TaskType.STRATEGY_PLAN,
    agencyId,
    clientId,
    userId,
    latencyMs: Date.now() - spanStart,
    attributes: { http_status: response?.status ?? 0 },
  });

  if (durableEnabled && supabase && agencyId && planId) {
    const status = response?.status && response.status < 300 ? "completed" : "failed";
    await writeCheckpoint(supabase, {
      planId,
      stepId: "strategy_generate",
      status,
      agencyId,
      clientId,
      userId: userId ?? null,
      payload: { http_status: response?.status ?? 0 },
    });
  }

  return response!;
});
