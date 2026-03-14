export type AgencyAiSetupStageKey =
  | "overview"
  | "imports"
  | "foundations"
  | "modules"
  | "guardrails"
  | "workflow"
  | "readiness"
  | "activation"
  | "control-center"
  | "legacy";

export type AgencyAiSetupAgentClass =
  | "strategy"
  | "creator"
  | "operator"
  | "analyst"
  | "client_facing";

export type AgencyAiSetupUnlockState =
  | "blocked"
  | "preview_only"
  | "internal_assist_only"
  | "operational";

export type AgencyAiSetupActivationMode =
  | "preview_only"
  | "internal_assist_only"
  | "operational";

export const AGENCY_AI_SETUP_STAGES: Array<{
  key: AgencyAiSetupStageKey;
  title: string;
  description: string;
  path: string;
}> = [
  { key: "overview", title: "Overview", description: "Readiness snapshot and next actions.", path: "/agency/ai-setup" },
  { key: "imports", title: "Imports", description: "Import and review existing agency context.", path: "/agency/ai-setup/imports" },
  { key: "foundations", title: "Foundations", description: "Define agency identity, offers, and ICP.", path: "/agency/ai-setup/foundations" },
  { key: "modules", title: "Modules", description: "Structure operating modules and approvals.", path: "/agency/ai-setup/modules" },
  { key: "guardrails", title: "Guardrails", description: "Set quality, compliance, and creative rules.", path: "/agency/ai-setup/guardrails" },
  { key: "workflow", title: "Workflow", description: "Configure lifecycle stages, approvals, and SOPs.", path: "/agency/ai-setup/workflow" },
  { key: "readiness", title: "Readiness", description: "Review readiness scores, blockers, and previews.", path: "/agency/ai-setup/readiness" },
  { key: "activation", title: "Activation", description: "Unlock agents in controlled stages.", path: "/agency/ai-setup/activation" },
  { key: "control-center", title: "Control Center", description: "Monitor live agent status and drift.", path: "/agency/ai-setup/control-center" },
  { key: "legacy", title: "Legacy", description: "Previous module-by-module AI setup surface.", path: "/agency/ai-setup/legacy" },
];

export const AGENCY_AI_SETUP_READINESS_DIMENSIONS = [
  { key: "knowledge_coverage", title: "Knowledge Coverage" },
  { key: "process_definition", title: "Process Definition" },
  { key: "quality_definition", title: "Quality Definition" },
  { key: "compliance_safety", title: "Compliance Safety" },
  { key: "approval_governance", title: "Approval Governance" },
  { key: "evidence_strength", title: "Evidence Strength" },
] as const;

export const AGENCY_AI_AGENT_CLASSES: Array<{
  key: AgencyAiSetupAgentClass;
  title: string;
  description: string;
}> = [
  { key: "strategy", title: "Strategy", description: "Readiness, diagnosis, recommendation, and planning agents." },
  { key: "creator", title: "Creator", description: "Brief, captions, scripts, ideas, and rewrite agents." },
  { key: "operator", title: "Operator", description: "Task routing, approvals, and workflow agents." },
  { key: "analyst", title: "Analyst", description: "Reporting, commentary, and drift detection agents." },
  { key: "client_facing", title: "Client-Facing", description: "Portal Q&A and client communication agents." },
];

export const AGENCY_AI_REQUIRED_CERTIFICATION_SCENARIOS: Record<AgencyAiSetupAgentClass, string[]> = {
  strategy: ["strategy_readiness_certification"],
  creator: ["creator_brief_certification"],
  operator: ["workflow_execution_certification"],
  analyst: ["reporting_certification"],
  client_facing: ["client_response_certification"],
};

export function formatUnlockStateLabel(state: AgencyAiSetupUnlockState | string | null | undefined) {
  switch (state) {
    case "preview_only":
      return "Preview Only";
    case "internal_assist_only":
      return "Internal Assist Only";
    case "operational":
      return "Operational";
    case "blocked":
    default:
      return "Blocked";
  }
}

export const AGENCY_AI_ACTIVATION_MODE_ORDER: AgencyAiSetupActivationMode[] = [
  "preview_only",
  "internal_assist_only",
  "operational",
];

export const AGENCY_AI_ACTIVATION_MODE_LABELS: Record<AgencyAiSetupActivationMode, string> = {
  preview_only: "Preview Only",
  internal_assist_only: "Internal Assist Only",
  operational: "Operational",
};

export const AGENCY_AI_ACTIVATION_MODE_CAPABILITIES: Record<AgencyAiSetupActivationMode, string[]> = {
  preview_only: [
    "Run simulations",
    "Inspect previews",
  ],
  internal_assist_only: [
    "Run simulations",
    "Inspect previews",
    "Generate internal drafts",
    "Write internal artifacts for team review",
  ],
  operational: [
    "Run simulations",
    "Inspect previews",
    "Generate internal drafts",
    "Write internal artifacts for team review",
    "Generate governed production outputs",
    "Participate in live workflow under approvals",
  ],
};

export function getActivationModeRank(mode: AgencyAiSetupActivationMode | null | undefined) {
  if (!mode) return -1;
  return AGENCY_AI_ACTIVATION_MODE_ORDER.indexOf(mode);
}

export function getMissingCertificationScenarios(
  agentClass: AgencyAiSetupAgentClass,
  certifiedScenarioKeys: string[],
) {
  const required = AGENCY_AI_REQUIRED_CERTIFICATION_SCENARIOS[agentClass] ?? [];
  const certified = new Set(certifiedScenarioKeys);
  return required.filter((scenarioKey) => !certified.has(scenarioKey));
}

export function getAvailableActivationModes(
  agentClass: AgencyAiSetupAgentClass,
  maxMode: AgencyAiSetupUnlockState | null | undefined,
  certifiedScenarioKeys: string[] = [],
) {
  const normalized =
    maxMode && maxMode !== "blocked" ? (maxMode as AgencyAiSetupActivationMode) : null;
  const maxRank = getActivationModeRank(normalized);
  const missingCertifications = getMissingCertificationScenarios(agentClass, certifiedScenarioKeys);
  return AGENCY_AI_ACTIVATION_MODE_ORDER.filter((mode) => {
    if (getActivationModeRank(mode) > maxRank) return false;
    if (mode === "operational" && missingCertifications.length > 0) return false;
    return true;
  });
}
