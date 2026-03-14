import type {
  ClientOperatingBriefV2,
  StrategyArtifactEnvelopeV2,
  StrategyReadinessAuditBody,
  V2ReadinessState,
} from "./contracts";

type LooseRecord = Record<string, unknown>;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function offerNames(profile: LooseRecord) {
  const offers = Array.isArray(profile.offers) ? profile.offers : [];
  const names = offers
    .map((offer) => (offer && typeof offer === "object" ? (offer as Record<string, unknown>).name : ""))
    .map((name) => (typeof name === "string" ? name.trim() : ""))
    .filter(Boolean);
  const primary = firstString(profile.q6_offer_name, names[0]);
  return {
    primary,
    secondary: names.filter((name) => name !== primary),
  };
}

export function buildClientOperatingBriefV2(args: {
  clientId: string;
  agencyId: string;
  onboardingProfile?: LooseRecord | null;
  operationsSetup?: LooseRecord | null;
  clientBrain?: LooseRecord | null;
}): {
  brief: ClientOperatingBriefV2;
  readinessState: V2ReadinessState;
  missingItems: string[];
  assumptions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number;
} {
  const profile = (args.onboardingProfile ?? {}) as LooseRecord;
  const ops = ((args.operationsSetup as LooseRecord | null)?.operations_setup ?? args.operationsSetup ?? {}) as LooseRecord;
  const brain = (args.clientBrain ?? {}) as LooseRecord;
  const offer = offerNames(profile);
  const activeChannels = toStringArray(profile.platforms ?? profile.q16_enabled_channels);
  const painPoints = toStringArray(profile.q9_pain_points).concat(
    toStringArray((brain.audience as LooseRecord | undefined)?.problems),
  );
  const differentiators = toStringArray(profile.q13_differentiators).concat(
    toStringArray((brain.brand_basics as LooseRecord | undefined)?.differentiators),
  );
  const proofAssets = toStringArray(profile.proof_types);
  const goals = [firstString(profile.primary_goal, profile.q17_primary_goal)].filter(Boolean);
  const blockers = toStringArray(ops.missing_assets).concat(toStringArray(ops.access_readiness_notes));
  const openQuestions: string[] = [];
  const assumptions: string[] = [];

  if (!toNumber(profile.media_budget_monthly) && !toNumber(profile.q6_price_min)) {
    assumptions.push("Budget range is not yet confirmed.");
    openQuestions.push("What budget or spending range should strategy assume?");
  }

  if (!firstString(profile.conversion_path, profile.conversion_link, profile.dm_keyword)) {
    openQuestions.push("What is the primary conversion path for this client?");
  }

  if (!firstString((ops as LooseRecord).primary_contact_name, (ops as LooseRecord).primary_contact, profile.primary_contact_name)) {
    openQuestions.push("Who is the primary day-to-day client contact?");
  }

  const brief: ClientOperatingBriefV2 = {
    client_id: args.clientId,
    agency_id: args.agencyId,
    business_model: {
      category: firstString(profile.industry_niche, profile.q4_business_type, "unknown"),
      subtype: firstString(profile.q7_business_model),
      summary: firstString(profile.business_summary, profile.notes, `${firstString(profile.q1_business_name, "Client")} in ${firstString(profile.industry_niche, "unspecified niche")}`),
    },
    offer_priority: {
      primary_offer: offer.primary,
      secondary_offers: offer.secondary,
      offer_constraints: toStringArray(profile.offer_constraints),
    },
    audience_segments: [
      {
        id: "aud_1",
        name: firstString(profile.primary_customer, profile.q8_ideal_customer, "Primary audience"),
        jobs_to_be_done: toStringArray(profile.audience_jobs),
        pain_points: [...new Set(painPoints)],
      },
    ],
    conversion_path: {
      primary_path: firstString(profile.conversion_path, profile.conversion_link, profile.dm_keyword),
      secondary_paths: toStringArray(profile.secondary_conversion_paths),
      handoff_notes: toStringArray(profile.response_handling),
    },
    sales_process: {
      summary: firstString(profile.q11_sales_cycle, profile.sales_process, "Sales process not yet documented."),
      response_time_expectation_hours: toNumber((ops as LooseRecord).approval_turnaround_hours ?? (ops as LooseRecord).approval_sla_hours),
      known_drop_off_points: toStringArray(profile.main_objection),
    },
    pricing_and_budget: {
      price_positioning: firstString(profile.price_positioning, profile.q6_price_anchor, "unspecified"),
      media_budget_monthly: toNumber(profile.media_budget_monthly),
      commercial_constraints: toStringArray(profile.biggest_current_constraint),
    },
    proof_and_differentiators: {
      proof_assets: proofAssets,
      differentiators: [...new Set(differentiators)],
      claims_limits: toStringArray(profile.banned_claims).concat(toStringArray(profile.taboo_topics)),
    },
    goals_baselines_success_thresholds: {
      primary_goal: goals[0] ?? "",
      baselines: toStringArray(profile.performance_baselines),
      success_thresholds: toStringArray(profile.q10_desired_outcome),
    },
    channel_state_and_history: {
      active_channels: activeChannels,
      historical_notes: toStringArray(profile.channel_history).concat(toStringArray(profile.what_failed_before)),
      performance_context: toStringArray(profile.performance_context),
    },
    stakeholder_and_approval_map: {
      primary_contact: firstString((ops as LooseRecord).primary_contact_name, (ops as LooseRecord).primary_contact, profile.primary_contact_name),
      final_approver: firstString((ops as LooseRecord).main_approver_name, (ops as LooseRecord).approver_name, profile.main_approver_name),
      approval_turnaround_hours: toNumber((ops as LooseRecord).approval_turnaround_hours ?? (ops as LooseRecord).approval_sla_hours),
    },
    launch_windows_and_deadlines: {
      next_launch_window: firstString((ops as LooseRecord).launch_window, profile.launch_window) || null,
      hard_deadlines: toStringArray((ops as LooseRecord).hard_deadlines),
    },
    access_and_asset_readiness: {
      platform_access_ready: !toStringArray((ops as LooseRecord).missing_access).length,
      missing_assets: toStringArray((ops as LooseRecord).missing_assets).concat(toStringArray(profile.available_assets).length ? [] : ["Asset inventory not yet confirmed"]),
    },
    constraints_and_compliance: {
      regulated_industry: Boolean(toStringArray(profile.banned_claims).length || toStringArray(profile.taboo_topics).length),
      restricted_claims: toStringArray(profile.banned_claims).concat(toStringArray(profile.taboo_topics)),
      required_disclaimers: toStringArray((ops as LooseRecord).required_disclaimers),
    },
    internal_capacity_and_dependencies: {
      client_capacity_notes: toStringArray((ops as LooseRecord).client_capacity_notes),
      dependencies: toStringArray((ops as LooseRecord).dependencies).concat(toStringArray((ops as LooseRecord).missing_access)),
    },
    known_blockers: [...new Set(blockers)],
    open_questions: [...new Set(openQuestions)],
  };

  const missingItems: string[] = [];
  if (!brief.offer_priority.primary_offer) missingItems.push("primary_offer");
  if (!brief.goals_baselines_success_thresholds.primary_goal) missingItems.push("primary_goal");
  if (!brief.audience_segments[0]?.name) missingItems.push("primary_audience");
  if (!brief.conversion_path.primary_path) missingItems.push("conversion_path");
  if (!brief.stakeholder_and_approval_map.primary_contact) missingItems.push("primary_contact");
  if (!brief.stakeholder_and_approval_map.final_approver) missingItems.push("final_approver");
  if (!brief.channel_state_and_history.active_channels.length) missingItems.push("active_channels");

  const hasOpsReadiness =
    brief.stakeholder_and_approval_map.primary_contact.length > 0 &&
    brief.stakeholder_and_approval_map.final_approver.length > 0 &&
    brief.launch_windows_and_deadlines.next_launch_window !== null;
  const hasStrategyInputs =
    brief.offer_priority.primary_offer.length > 0 &&
    brief.goals_baselines_success_thresholds.primary_goal.length > 0 &&
    brief.audience_segments[0]?.pain_points.length > 0 &&
    brief.conversion_path.primary_path.length > 0;

  let readinessState: V2ReadinessState = "insufficient";
  if (missingItems.length === 0 && hasOpsReadiness && hasStrategyInputs) {
    readinessState = brief.open_questions.length > 0 ? "strategy_ready_with_caveats" : "strategy_ready";
  } else if (hasStrategyInputs) {
    readinessState = "diagnosis_ready";
  }
  if (readinessState === "strategy_ready" && brief.access_and_asset_readiness.platform_access_ready) {
    readinessState = "execution_ready";
  }

  const confidence = Math.max(40, 100 - (missingItems.length * 10 + brief.open_questions.length * 5));
  const citations = [
    ...(args.onboardingProfile ? [{ source: "client_onboarding_profiles" }] : []),
    ...(args.operationsSetup ? [{ source: "client_operations_setup" }] : []),
    ...(args.clientBrain ? [{ source: "client_brains" }] : []),
  ];

  return { brief, readinessState, missingItems, assumptions, citations, confidence };
}

export function buildReadinessArtifact(args: {
  brief: ClientOperatingBriefV2;
  briefVersion: number;
  agencyModuleVersions: Record<string, number>;
  readinessState: V2ReadinessState;
  missingItems: string[];
  assumptions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number;
}): StrategyArtifactEnvelopeV2<StrategyReadinessAuditBody> {
  const blockingGaps = args.missingItems.map((item) => ({
    key: item,
    severity: ["primary_contact", "final_approver", "primary_offer", "primary_goal", "conversion_path"].includes(item)
      ? "high" as const
      : "medium" as const,
    message: `${item.replace(/_/g, " ")} is missing.`,
  }));
  const allowedScope =
    args.readinessState === "insufficient"
      ? ["brief_assembly"]
      : args.readinessState === "diagnosis_ready"
        ? ["diagnosis"]
        : ["diagnosis", "recommendation_with_caveats"];

  return {
    artifact_meta: {
      artifact_type: "strategy_readiness_audit",
      version: 1,
      brief_version: args.briefVersion,
      agency_module_versions: args.agencyModuleVersions,
    },
    summary:
      args.readinessState === "insufficient"
        ? "Client context is not yet sufficient for strategy reasoning."
        : args.readinessState === "diagnosis_ready"
          ? "Client context is sufficient for diagnosis but still has recommendation gaps."
          : "Client context is sufficient to proceed with strategic reasoning.",
    body: {
      readiness_state: args.readinessState,
      overall_score_0_100: args.confidence,
      blocking_gaps: blockingGaps,
      critical_inputs_present: [
        args.brief.offer_priority.primary_offer ? "primary_offer" : "",
        args.brief.goals_baselines_success_thresholds.primary_goal ? "primary_goal" : "",
        args.brief.conversion_path.primary_path ? "conversion_path" : "",
        args.brief.stakeholder_and_approval_map.primary_contact ? "primary_contact" : "",
        args.brief.channel_state_and_history.active_channels.length ? "active_channels" : "",
      ].filter(Boolean),
      critical_inputs_missing: args.missingItems,
      risky_assumptions: args.assumptions,
      allowed_scope: allowedScope,
      recommended_next_actions: blockingGaps.map((gap) => ({
        action_type: gap.key.includes("contact") || gap.key.includes("approver") ? "operations_setup" : "client_input",
        title: `Resolve ${gap.key.replace(/_/g, " ")}`,
      })),
    },
    assumptions: args.assumptions,
    open_questions: args.brief.open_questions,
    citations: args.citations,
    confidence: args.confidence,
  };
}

export function evaluateReadinessArtifact(artifact: StrategyArtifactEnvelopeV2<StrategyReadinessAuditBody>) {
  const findings: Array<{ level: "warn" | "fail"; message: string }> = [];
  if (!artifact.body.critical_inputs_present.length) findings.push({ level: "fail", message: "No critical inputs were detected." });
  if (artifact.body.readiness_state === "insufficient" && artifact.body.allowed_scope.includes("recommendation_with_caveats")) {
    findings.push({ level: "fail", message: "Insufficient readiness cannot allow recommendation scope." });
  }
  if (!artifact.body.recommended_next_actions.length && artifact.body.critical_inputs_missing.length) {
    findings.push({ level: "fail", message: "Missing items exist without next actions." });
  }
  return {
    result: findings.some((item) => item.level === "fail") ? "fail" as const : findings.length ? "warn" as const : "pass" as const,
    score: Math.max(0, 100 - findings.length * 20),
    findings,
  };
}
