import type {
  ClientOperatingBriefV2,
  CreatorBriefBody,
  StrategyArtifactEnvelopeV2,
  StrategyRecommendationBody,
} from "./contracts";

type CreatorBriefMode = "ideas" | "hook" | "caption" | "script" | "rewrite";

type BuildCreatorBriefArgs = {
  briefVersion: number;
  agencyModuleVersions: Record<string, number>;
  brief: ClientOperatingBriefV2;
  recommendationArtifact: StrategyArtifactEnvelopeV2<StrategyRecommendationBody>;
  strategyPlanArtifact: { open_questions?: string[]; assumptions?: string[] };
  mode: CreatorBriefMode;
  platform?: string | null;
};

function uniqueStrings(values: Array<unknown>, limit = 12) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim()),
    ),
  ).slice(0, limit);
}

function modeLabel(mode: CreatorBriefMode) {
  switch (mode) {
    case "ideas":
      return "content idea generation";
    case "hook":
      return "hook generation";
    case "caption":
      return "caption generation";
    case "script":
      return "script generation";
    case "rewrite":
      return "content rewrite";
  }
}

export function buildCreatorBriefArtifact(args: BuildCreatorBriefArgs): StrategyArtifactEnvelopeV2<CreatorBriefBody> {
  const recommendation = args.recommendationArtifact.body;
  const primaryChannel = recommendation.channel_priorities[0]?.channel || args.platform || "social media";
  const platform = args.platform?.trim() || primaryChannel;
  const selectedAudience = args.brief.audience_segments[0];
  const contentPillars = recommendation.pillar_recommendations.slice(0, 4);

  const body: CreatorBriefBody = {
    requested_output: {
      mode: args.mode,
      platform,
    },
    strategic_goal:
      args.brief.goals_baselines_success_thresholds.primary_goal ||
      recommendation.strategic_direction ||
      "Support client growth with platform-appropriate content.",
    primary_offer: recommendation.chosen_offer_priority.primary_offer || args.brief.offer_priority.primary_offer,
    target_audience: {
      segments: args.brief.audience_segments.map((segment) => segment.name),
      jobs_to_be_done: uniqueStrings(selectedAudience?.jobs_to_be_done ?? []),
      pain_points: uniqueStrings(selectedAudience?.pain_points ?? []),
    },
    messaging_core: {
      core_message:
        recommendation.messaging_direction.core_message ||
        recommendation.strategic_direction ||
        args.brief.business_model.summary,
      supporting_angles: uniqueStrings([
        ...recommendation.decision_rationale.map((row) => row.decision),
        ...contentPillars.map((pillar) => pillar.name),
      ], 6),
      approved_phrases: uniqueStrings([
        recommendation.messaging_direction.core_message,
        ...recommendation.messaging_direction.dos,
      ], 8),
      banned_phrases: uniqueStrings([
        ...recommendation.messaging_direction.donts,
        ...args.brief.proof_and_differentiators.claims_limits,
      ], 10),
    },
    channel_execution: {
      primary_channel: primaryChannel,
      role: recommendation.channel_priorities[0]?.role || "Primary growth channel",
      format_guidance: uniqueStrings([
        `${platform} output should align with ${modeLabel(args.mode)}.`,
        `Prioritize ${recommendation.chosen_funnel.path} as the conversion path.`,
        args.mode === "script" ? "Open strong in the first three seconds and land on one CTA." : "",
        args.mode === "caption" ? "Keep the caption aligned to the hook and CTA." : "",
        args.mode === "ideas" ? "Favor executable concepts over abstract themes." : "",
        args.mode === "rewrite" ? "Preserve the original meaning while improving clarity and fit." : "",
      ], 6),
      CTA: recommendation.chosen_funnel.path || "Book a strategy call",
    },
    content_pillars: contentPillars,
    proof_points: uniqueStrings([
      ...args.brief.proof_and_differentiators.proof_assets,
      ...args.brief.proof_and_differentiators.differentiators,
    ], 6),
    guardrails: {
      claims_limits: uniqueStrings(args.brief.proof_and_differentiators.claims_limits, 8),
      required_disclaimers: uniqueStrings(args.brief.constraints_and_compliance.required_disclaimers, 8),
      compliance_notes: uniqueStrings([
        ...(args.brief.constraints_and_compliance.regulated_industry ? ["Regulated industry: keep claims conservative and evidence-backed."] : []),
        ...args.brief.constraints_and_compliance.restricted_claims,
      ], 8),
    },
    production_notes: uniqueStrings([
      `Primary contact: ${args.brief.stakeholder_and_approval_map.primary_contact || "pending confirmation"}`,
      `Final approver: ${args.brief.stakeholder_and_approval_map.final_approver || "pending confirmation"}`,
      args.brief.access_and_asset_readiness.platform_access_ready ? "Platform access is ready." : "Platform access is not fully ready.",
      ...args.brief.known_blockers,
    ], 8),
  };

  return {
    artifact_meta: {
      artifact_type: "creator_brief",
      version: 1,
      brief_version: args.briefVersion,
      agency_module_versions: args.agencyModuleVersions,
    },
    summary: `Creator brief for ${modeLabel(args.mode)} on ${platform}.`,
    body,
    assumptions: uniqueStrings([
      ...args.recommendationArtifact.assumptions,
      ...(args.strategyPlanArtifact.assumptions ?? []),
    ], 10),
    open_questions: uniqueStrings([
      ...args.recommendationArtifact.open_questions,
      ...(args.strategyPlanArtifact.open_questions ?? []),
      ...args.brief.open_questions,
    ], 8),
    citations: args.recommendationArtifact.citations,
    confidence: Math.max(70, Math.min(95, Math.round(args.recommendationArtifact.confidence || 80))),
  };
}

export function evaluateCreatorBriefArtifact(artifact: StrategyArtifactEnvelopeV2<CreatorBriefBody>) {
  const findings: Array<{ level: "warn" | "fail"; message: string }> = [];
  if (!artifact.body.requested_output.platform) findings.push({ level: "fail", message: "Creator brief is missing requested platform." });
  if (!artifact.body.primary_offer) findings.push({ level: "fail", message: "Creator brief is missing primary offer." });
  if (!artifact.body.messaging_core?.core_message) findings.push({ level: "fail", message: "Creator brief is missing core message." });
  if (!artifact.body.channel_execution?.CTA) findings.push({ level: "warn", message: "Creator brief is missing CTA guidance." });
  if (!artifact.body.content_pillars?.length) findings.push({ level: "warn", message: "Creator brief is missing content pillars." });
  if (!artifact.body.guardrails?.claims_limits?.length && !artifact.body.guardrails?.required_disclaimers?.length) {
    findings.push({ level: "warn", message: "Creator brief has limited guardrail detail." });
  }

  return {
    result: findings.some((item) => item.level === "fail") ? "fail" as const : findings.length ? "warn" as const : "pass" as const,
    score: Math.max(0, 100 - findings.length * 12),
    findings,
  };
}

export function renderCreatorBriefPromptContext(
  artifact: StrategyArtifactEnvelopeV2<CreatorBriefBody>,
  extraContext?: string | null,
) {
  const body = artifact.body;
  return [
    `Creator brief`,
    `Mode: ${body.requested_output.mode}`,
    `Platform: ${body.requested_output.platform}`,
    `Strategic goal: ${body.strategic_goal}`,
    `Primary offer: ${body.primary_offer}`,
    `Audience segments: ${body.target_audience.segments.join(", ") || "Unknown"}`,
    `Jobs to be done: ${body.target_audience.jobs_to_be_done.join(" | ") || "Unknown"}`,
    `Pain points: ${body.target_audience.pain_points.join(" | ") || "Unknown"}`,
    `Core message: ${body.messaging_core.core_message}`,
    `Approved phrases: ${body.messaging_core.approved_phrases.join(" | ") || "None provided"}`,
    `Banned phrases: ${body.messaging_core.banned_phrases.join(" | ") || "None provided"}`,
    `Primary channel role: ${body.channel_execution.role}`,
    `Format guidance: ${body.channel_execution.format_guidance.join(" | ") || "Follow platform best fit."}`,
    `CTA: ${body.channel_execution.CTA}`,
    `Content pillars: ${body.content_pillars.map((pillar) => `${pillar.name}: ${pillar.purpose}`).join(" | ") || "None provided"}`,
    `Proof points: ${body.proof_points.join(" | ") || "Use approved proof only."}`,
    `Claims limits: ${body.guardrails.claims_limits.join(" | ") || "Do not overclaim."}`,
    `Required disclaimers: ${body.guardrails.required_disclaimers.join(" | ") || "None specified"}`,
    `Compliance notes: ${body.guardrails.compliance_notes.join(" | ") || "None specified"}`,
    `Production notes: ${body.production_notes.join(" | ") || "None specified"}`,
    extraContext?.trim() ? `Additional request context: ${extraContext.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
