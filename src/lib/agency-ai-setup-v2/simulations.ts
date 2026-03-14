import type {
  AgencyAiSetupActivationMode,
  AgencyAiSetupAgentClass,
  AgencyAiSetupUnlockState,
} from "./config";

export type AgencyAiSetupSimulationDimensionKey =
  | "process_adherence"
  | "quality_bar_fit"
  | "compliance_safety"
  | "approval_behavior"
  | "operator_usefulness";

export type AgencyAiSetupSimulationScenario = {
  key: string;
  title: string;
  description: string;
  primaryObjective: string;
  minimumResult: "warn" | "pass";
};

export type AgencyAiSetupSimulationRequest = {
  agentClass: AgencyAiSetupAgentClass;
  unlockState: AgencyAiSetupUnlockState;
  activationMode: AgencyAiSetupActivationMode | null;
  activated: boolean;
  readinessLabel: string;
  blockers: string[];
  readinessScores: {
    knowledge_coverage: number;
    process_definition: number;
    quality_definition: number;
    compliance_safety: number;
    approval_governance: number;
    evidence_strength: number;
  };
};

export type AgencyAiSetupSimulationResult = {
  scenario: AgencyAiSetupSimulationScenario;
  result: "pass" | "warn" | "fail";
  summary: string;
  recommendedNextAction: string;
  findings: string[];
  dimensionScores: Record<AgencyAiSetupSimulationDimensionKey, number>;
};

const SCENARIOS: Record<AgencyAiSetupAgentClass, AgencyAiSetupSimulationScenario[]> = {
  strategy: [
    {
      key: "strategy_readiness_certification",
      title: "Strategy readiness certification",
      description: "Tests whether the strategy agent can produce a grounded recommendation path without skipping governance.",
      primaryObjective: "Confirm readiness, diagnosis, and recommendation quality before strategy work is trusted.",
      minimumResult: "pass",
    },
    {
      key: "strategy_gap_escalation",
      title: "Gap escalation handling",
      description: "Tests whether the strategy agent surfaces missing context instead of making ungrounded assumptions.",
      primaryObjective: "Ensure incomplete context triggers the correct blockers and follow-up requests.",
      minimumResult: "warn",
    },
  ],
  creator: [
    {
      key: "creator_brief_certification",
      title: "Creator brief certification",
      description: "Tests whether creator outputs can stay on-brand, compliant, and approval-safe.",
      primaryObjective: "Verify the creator stack is governed enough for internal draft generation.",
      minimumResult: "pass",
    },
    {
      key: "claims_and_voice_guardrail",
      title: "Claims and voice guardrail",
      description: "Tests whether creator outputs respect banned claims, disclaimers, and style controls.",
      primaryObjective: "Reduce brand and compliance risk before live content work.",
      minimumResult: "warn",
    },
  ],
  operator: [
    {
      key: "workflow_execution_certification",
      title: "Workflow execution certification",
      description: "Tests whether operator agents can route work, approvals, and follow-ups inside the agency process.",
      primaryObjective: "Confirm the operator layer can behave like a governed internal coordinator.",
      minimumResult: "pass",
    },
    {
      key: "approval_handoff_resilience",
      title: "Approval handoff resilience",
      description: "Tests whether approval and escalation gaps are caught before task automation runs.",
      primaryObjective: "Ensure workflow automation never outruns governance.",
      minimumResult: "warn",
    },
  ],
  analyst: [
    {
      key: "reporting_certification",
      title: "Reporting certification",
      description: "Tests whether analyst outputs can be evidence-backed and explainable.",
      primaryObjective: "Confirm analyst outputs are useful to operators and safe for review.",
      minimumResult: "pass",
    },
    {
      key: "drift_signal_review",
      title: "Drift signal review",
      description: "Tests whether the analyst can flag quality and strategy drift with useful evidence.",
      primaryObjective: "Validate that performance commentary is grounded and actionable.",
      minimumResult: "warn",
    },
  ],
  client_facing: [
    {
      key: "client_response_certification",
      title: "Client response certification",
      description: "Tests whether client-facing assistance stays within approvals, safety, and escalation rules.",
      primaryObjective: "Confirm the assistant can interact safely without undermining the team.",
      minimumResult: "pass",
    },
    {
      key: "escalation_boundary_review",
      title: "Escalation boundary review",
      description: "Tests whether sensitive requests are escalated instead of answered loosely.",
      primaryObjective: "Ensure boundary handling is explicit before live client exposure.",
      minimumResult: "warn",
    },
  ],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getModeBonus(mode: AgencyAiSetupActivationMode | null) {
  if (mode === "operational") return 10;
  if (mode === "internal_assist_only") return 5;
  return 0;
}

function getStatePenalty(state: AgencyAiSetupUnlockState, blockers: number) {
  if (state === "blocked") return 35;
  if (state === "preview_only") return 18 + blockers * 2;
  if (state === "internal_assist_only") return 8 + blockers;
  return blockers > 2 ? blockers * 2 : 0;
}

function buildDimensionScores(request: AgencyAiSetupSimulationRequest) {
  const { readinessScores, activationMode, unlockState, blockers } = request;
  const modeBonus = getModeBonus(activationMode);
  const penalty = getStatePenalty(unlockState, blockers.length);

  return {
    process_adherence: clamp(
      readinessScores.process_definition * 0.65 +
        readinessScores.approval_governance * 0.35 +
        modeBonus -
        penalty,
    ),
    quality_bar_fit: clamp(
      readinessScores.quality_definition * 0.7 +
        readinessScores.knowledge_coverage * 0.3 +
        Math.max(0, modeBonus - 2) -
        penalty,
    ),
    compliance_safety: clamp(readinessScores.compliance_safety + modeBonus - Math.round(penalty * 0.8)),
    approval_behavior: clamp(
      readinessScores.approval_governance * 0.75 +
        readinessScores.process_definition * 0.25 +
        modeBonus -
        penalty,
    ),
    operator_usefulness: clamp(
      readinessScores.knowledge_coverage * 0.3 +
        readinessScores.process_definition * 0.25 +
        readinessScores.evidence_strength * 0.25 +
        readinessScores.quality_definition * 0.2 +
        modeBonus -
        Math.round(penalty * 0.7),
    ),
  } satisfies Record<AgencyAiSetupSimulationDimensionKey, number>;
}

function summarizeFindings(
  request: AgencyAiSetupSimulationRequest,
  scenario: AgencyAiSetupSimulationScenario,
  scores: Record<AgencyAiSetupSimulationDimensionKey, number>,
) {
  const findings: string[] = [];
  if (request.blockers.length) {
    findings.push(`${request.blockers.length} active blocker${request.blockers.length === 1 ? "" : "s"} still constrain this agent class.`);
  }
  if (scores.process_adherence < 70) findings.push("Workflow definition is still too weak for dependable process adherence.");
  if (scores.quality_bar_fit < 75) findings.push("Quality standards are not strong enough to support consistently expert outputs.");
  if (scores.compliance_safety < 80) findings.push("Compliance and safety controls still need strengthening before broader activation.");
  if (scores.approval_behavior < 80) findings.push("Approval governance is not yet strong enough to trust autonomous handoffs.");
  if (scores.operator_usefulness < 72) findings.push("The output quality is still likely to create review overhead for the agency team.");
  if (!request.activated) findings.push("This class is not activated yet, so live workflow behavior is still unproven.");
  if (request.activationMode === "preview_only") findings.push("This class is limited to preview mode and should not be treated as production-ready.");
  if (request.unlockState === "operational" && scenario.minimumResult === "pass" && findings.length === 0) {
    findings.push("This setup is currently strong enough to certify the core workflow scenario.");
  }
  return findings;
}

function determineResult(
  scenario: AgencyAiSetupSimulationScenario,
  scores: Record<AgencyAiSetupSimulationDimensionKey, number>,
  blockers: string[],
) {
  const average =
    (scores.process_adherence +
      scores.quality_bar_fit +
      scores.compliance_safety +
      scores.approval_behavior +
      scores.operator_usefulness) /
    5;

  if (blockers.length >= 3 || average < 68 || scores.compliance_safety < 70 || scores.approval_behavior < 70) {
    return "fail" as const;
  }

  if (
    scenario.minimumResult === "pass" &&
    (average < 82 || scores.quality_bar_fit < 78 || scores.operator_usefulness < 75)
  ) {
    return "warn" as const;
  }

  if (average < 75) return "warn" as const;
  return "pass" as const;
}

function buildSummary(
  request: AgencyAiSetupSimulationRequest,
  scenario: AgencyAiSetupSimulationScenario,
  result: "pass" | "warn" | "fail",
) {
  if (result === "pass") {
    return `${scenario.title} passed. ${request.agentClass.replace(/_/g, " ")} is strong enough for this governed scenario under the current setup.`;
  }
  if (result === "warn") {
    return `${scenario.title} is usable with review, but the current setup still leaves meaningful operator risk.`;
  }
  return `${scenario.title} failed. The current setup should not be treated as expert-ready for this agent class yet.`;
}

function buildRecommendedAction(
  scores: Record<AgencyAiSetupSimulationDimensionKey, number>,
  blockers: string[],
) {
  if (blockers.length) return `Resolve the active blockers first, then rerun certification to confirm the unlock still holds under pressure.`;
  if (scores.approval_behavior < 80) return "Strengthen approval rules and workflow governance before expanding activation.";
  if (scores.compliance_safety < 80) return "Tighten claims, disclaimer, and escalation guardrails before broader rollout.";
  if (scores.quality_bar_fit < 80) return "Improve the quality bar and module examples so outputs match agency standards more consistently.";
  if (scores.operator_usefulness < 80) return "Add stronger SOP detail and evidence so the agent reduces review overhead instead of adding it.";
  return "Keep this class in its current mode, run the secondary scenario, and review the result history before moving to wider rollout.";
}

export function getAgencyAiSimulationScenarios(agentClass: AgencyAiSetupAgentClass) {
  return SCENARIOS[agentClass];
}

export function runAgencyAiSetupSimulation(
  request: AgencyAiSetupSimulationRequest,
  scenarioKey?: string,
): AgencyAiSetupSimulationResult {
  const scenarios = getAgencyAiSimulationScenarios(request.agentClass);
  const scenario = scenarios.find((item) => item.key === scenarioKey) ?? scenarios[0];
  const dimensionScores = buildDimensionScores(request);
  const result = determineResult(scenario, dimensionScores, request.blockers);
  return {
    scenario,
    result,
    summary: buildSummary(request, scenario, result),
    recommendedNextAction: buildRecommendedAction(dimensionScores, request.blockers),
    findings: summarizeFindings(request, scenario, dimensionScores),
    dimensionScores,
  };
}
