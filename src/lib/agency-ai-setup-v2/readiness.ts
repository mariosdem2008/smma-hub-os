import type { AgencyAiSetupAgentClass, AgencyAiSetupUnlockState } from "./config";

export type AgencyAiSetupMetaV2 = {
  imports?: {
    imported_at?: string;
    accepted_sources?: string[];
    accepted_document_count?: number;
  };
  foundations?: {
    updated_at?: string;
    agency_summary?: string;
    niche_focus?: string;
    service_model?: string;
    market_position?: string;
    primary_services?: string[];
    primary_offer?: string;
    secondary_offers?: string[];
    icp_segments?: string[];
  };
  guardrails?: {
    updated_at?: string;
    quality_review_standard?: string;
    creative_rules?: string[];
    banned_claims?: string[];
    required_disclaimers?: string[];
    client_facing_restrictions?: string[];
    escalation_triggers?: string[];
  };
  workflow?: {
    updated_at?: string;
    lifecycle_stages?: string[];
    approval_classes?: string[];
    delivery_sops?: string[];
    reporting_expectations?: string[];
    escalation_rules?: string[];
    workflow_notes?: string;
  };
};

export type AgencyAiSetupReadinessInput = {
  agencyId: string;
  meta: AgencyAiSetupMetaV2;
  approvedModuleKeys: string[];
  approvedModuleCount: number;
  legacyApprovedDocumentModules: string[];
  legacyApprovedDocumentCount: number;
};

export type DerivedAgencyReadiness = {
  knowledge_coverage: number;
  process_definition: number;
  quality_definition: number;
  compliance_safety: number;
  approval_governance: number;
  evidence_strength: number;
  overall_label: string;
  critical_blockers: string[];
  warnings: string[];
  computed_from_json: Record<string, unknown>;
  unlocks: Array<{
    agent_class: AgencyAiSetupAgentClass;
    unlock_state: AgencyAiSetupUnlockState;
    blocked_reasons: string[];
    required_modules: string[];
    minimum_scores_json: Record<string, number>;
    activation_policy_json: Record<string, unknown>;
  }>;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value: unknown) {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0);
}

function computeFoundationsCoverage(meta: AgencyAiSetupMetaV2["foundations"]) {
  if (!meta) return 0;
  const checks = [
    hasNonEmptyString(meta.agency_summary),
    hasNonEmptyString(meta.niche_focus),
    hasNonEmptyString(meta.service_model),
    hasNonEmptyString(meta.market_position),
    nonEmptyArray(meta.primary_services),
    hasNonEmptyString(meta.primary_offer),
    nonEmptyArray(meta.secondary_offers),
    nonEmptyArray(meta.icp_segments),
  ];
  return clamp((checks.filter(Boolean).length / checks.length) * 100);
}

function computeGuardrailsCoverage(meta: AgencyAiSetupMetaV2["guardrails"]) {
  if (!meta) return 0;
  const checks = [
    hasNonEmptyString(meta.quality_review_standard),
    nonEmptyArray(meta.creative_rules),
    nonEmptyArray(meta.banned_claims),
    nonEmptyArray(meta.required_disclaimers),
    nonEmptyArray(meta.client_facing_restrictions),
    nonEmptyArray(meta.escalation_triggers),
  ];
  return clamp((checks.filter(Boolean).length / checks.length) * 100);
}

function computeWorkflowCoverage(meta: AgencyAiSetupMetaV2["workflow"]) {
  if (!meta) return 0;
  const checks = [
    nonEmptyArray(meta.lifecycle_stages),
    nonEmptyArray(meta.approval_classes),
    nonEmptyArray(meta.delivery_sops),
    nonEmptyArray(meta.reporting_expectations),
    nonEmptyArray(meta.escalation_rules),
  ];
  return clamp((checks.filter(Boolean).length / checks.length) * 100);
}

function labelFromAverage(avg: number, blockers: string[]) {
  if (blockers.length >= 3 || avg < 25) return "Not Ready";
  if (avg < 50) return "Needs Definition";
  if (avg < 70) return "Draft Usable";
  if (avg < 85) return "Operational With Review";
  return "Expert-Quality Ready";
}

function buildUnlock(
  agentClass: AgencyAiSetupAgentClass,
  requiredModules: string[],
  minimumScores: Record<string, number>,
  blockers: string[],
  actualScores: Record<string, number>,
) {
  const failingScoreKeys = Object.entries(minimumScores)
    .filter(([key, value]) => (actualScores[key] ?? 0) < value)
    .map(([key, value]) => `${key.replace(/_/g, " ")} below ${value}`);
  const combined = [...blockers, ...failingScoreKeys];

  let unlock_state: AgencyAiSetupUnlockState = "blocked";
  if (combined.length === 0) unlock_state = "operational";
  else if (combined.length <= 1) unlock_state = "preview_only";
  else if (combined.length <= 2) unlock_state = "internal_assist_only";

  return {
    agent_class: agentClass,
    unlock_state,
    blocked_reasons: combined,
    required_modules: requiredModules,
    minimum_scores_json: minimumScores,
    activation_policy_json: {
      max_mode: unlock_state,
      capabilities:
        unlock_state === "blocked"
          ? []
          : unlock_state === "preview_only"
            ? ["run_simulations", "render_previews"]
            : unlock_state === "internal_assist_only"
              ? ["run_simulations", "render_previews", "generate_internal_drafts", "write_internal_artifacts"]
              : [
                  "run_simulations",
                  "render_previews",
                  "generate_internal_drafts",
                  "write_internal_artifacts",
                  "generate_production_outputs",
                  "participate_in_live_workflow",
                ],
    },
  };
}

export function deriveAgencyAiSetupReadiness(input: AgencyAiSetupReadinessInput): DerivedAgencyReadiness {
  const foundationsCoverage = computeFoundationsCoverage(input.meta.foundations);
  const guardrailsCoverage = computeGuardrailsCoverage(input.meta.guardrails);
  const workflowCoverage = computeWorkflowCoverage(input.meta.workflow);
  const importedSources = input.meta.imports?.accepted_sources?.length ?? 0;
  const v2Modules = new Set(input.approvedModuleKeys);
  const legacyModules = new Set(input.legacyApprovedDocumentModules);
  const effectiveEvidenceCount = input.approvedModuleCount > 0 ? input.approvedModuleCount : input.legacyApprovedDocumentCount;
  const hasImports = importedSources > 0 || input.legacyApprovedDocumentCount > 0;

  const knowledge_coverage = clamp(foundationsCoverage * 0.55 + Math.min(45, effectiveEvidenceCount * 8));
  const process_definition = clamp(
    (v2Modules.has("approval_matrix") ? 30 : 0) +
      (v2Modules.has("service_catalog") ? 15 : 0) +
      (v2Modules.has("offer_strategy") ? 15 : 0) +
      (hasNonEmptyString(input.meta.foundations?.service_model) ? 15 : 0) +
      (nonEmptyArray(input.meta.foundations?.primary_services) ? 10 : 0) +
      (hasImports ? 5 : 0) +
      (workflowCoverage >= 50 ? 5 : 0) +
      (workflowCoverage >= 75 ? 5 : 0),
  );
  const quality_definition = clamp(
    (v2Modules.has("quality_bar") ? 50 : 0) +
      (v2Modules.has("agency_identity") ? 10 : 0) +
      (v2Modules.has("service_catalog") ? 10 : 0) +
      (hasNonEmptyString(input.meta.foundations?.market_position) ? 10 : 0) +
      (hasNonEmptyString(input.meta.foundations?.agency_summary) ? 5 : 0) +
      (guardrailsCoverage >= 50 ? 5 : 0) +
      (guardrailsCoverage >= 75 ? 10 : 0),
  );
  const compliance_safety = clamp(
    (v2Modules.has("approval_matrix") ? 45 : 0) +
      (v2Modules.has("quality_bar") ? 10 : 0) +
      (legacyModules.has("rep_policy") ? 15 : 0) +
      (legacyModules.has("ai_permissions") ? 20 : 0) +
      (guardrailsCoverage >= 50 ? 5 : 0) +
      (guardrailsCoverage >= 75 ? 5 : 0),
  );
  const approval_governance = clamp(
    (v2Modules.has("approval_matrix") ? 55 : 0) +
      (v2Modules.has("quality_bar") ? 15 : 0) +
      (legacyModules.has("ai_permissions") ? 20 : 0) +
      (workflowCoverage >= 50 ? 5 : 0) +
      (workflowCoverage >= 75 ? 5 : 0),
  );
  const evidence_strength = clamp(
    Math.min(60, effectiveEvidenceCount * 12) +
      Math.min(20, importedSources * 10) +
      (foundationsCoverage >= 50 ? 10 : 0) +
      (foundationsCoverage >= 75 ? 10 : 0),
  );

  const critical_blockers: string[] = [];
  if (!hasImports) critical_blockers.push("Import agency context");
  if (foundationsCoverage < 50) critical_blockers.push("Complete agency foundations");
  if (!v2Modules.has("quality_bar")) critical_blockers.push("Approve quality bar module");
  if (!v2Modules.has("approval_matrix")) critical_blockers.push("Approve approval matrix module");
  if (guardrailsCoverage < 50) critical_blockers.push("Define guardrails and claims controls");
  if (workflowCoverage < 50) critical_blockers.push("Define workflow stages and approvals");

  const warnings: string[] = [];
  if (!v2Modules.has("agency_identity")) warnings.push("Agency identity module is not approved yet.");
  if (!v2Modules.has("service_catalog")) warnings.push("Service catalog module is not approved yet.");
  if (foundationsCoverage >= 50 && !v2Modules.has("offer_strategy")) warnings.push("Offer strategy module is still missing.");
  if (guardrailsCoverage >= 50 && !v2Modules.has("quality_bar")) warnings.push("Guardrails are defined, but quality bar is not approved yet.");
  if (workflowCoverage >= 50 && !v2Modules.has("approval_matrix")) warnings.push("Workflow is defined, but approval matrix is not approved yet.");

  const actualScores = {
    knowledge_coverage,
    process_definition,
    quality_definition,
    compliance_safety,
    approval_governance,
    evidence_strength,
  };

  const average =
    (knowledge_coverage +
      process_definition +
      quality_definition +
      compliance_safety +
      approval_governance +
      evidence_strength) /
    6;

  const unlocks = [
    buildUnlock(
      "strategy",
      ["agency_identity", "service_catalog", "offer_strategy", "quality_bar", "approval_matrix"],
      { knowledge_coverage: 75, approval_governance: 75 },
      [
        ...(!v2Modules.has("agency_identity") ? ["Agency identity module not approved"] : []),
        ...(!v2Modules.has("offer_strategy") ? ["Offer strategy module not approved"] : []),
      ],
      actualScores,
    ),
    buildUnlock(
      "creator",
      ["quality_bar", "approval_matrix", "service_catalog"],
      { quality_definition: 80, compliance_safety: 80 },
      [
        ...(!v2Modules.has("quality_bar") ? ["Quality bar not approved"] : []),
        ...(!v2Modules.has("approval_matrix") ? ["Approval matrix not approved"] : []),
      ],
      actualScores,
    ),
    buildUnlock(
      "operator",
      ["approval_matrix", "service_catalog", "offer_strategy"],
      { process_definition: 85, approval_governance: 85 },
      [
        ...(!v2Modules.has("approval_matrix") ? ["Approval matrix not approved"] : []),
        ...(!v2Modules.has("service_catalog") ? ["Service catalog not approved"] : []),
      ],
      actualScores,
    ),
    buildUnlock(
      "analyst",
      ["quality_bar", "service_catalog"],
      { evidence_strength: 70, quality_definition: 75 },
      [...(!v2Modules.has("quality_bar") ? ["Quality bar not approved"] : [])],
      actualScores,
    ),
    buildUnlock(
      "client_facing",
      ["approval_matrix", "quality_bar", "agency_identity"],
      { approval_governance: 90, compliance_safety: 85 },
      [
        ...(!v2Modules.has("agency_identity") ? ["Agency identity module not approved"] : []),
        ...(!v2Modules.has("approval_matrix") ? ["Approval matrix not approved"] : []),
      ],
      actualScores,
    ),
  ];

  return {
    ...actualScores,
    overall_label: labelFromAverage(average, critical_blockers),
      critical_blockers,
      warnings,
      computed_from_json: {
      approved_module_count: input.approvedModuleCount,
      approved_module_keys: input.approvedModuleKeys,
        legacy_approved_document_count: input.legacyApprovedDocumentCount,
        legacy_approved_document_modules: input.legacyApprovedDocumentModules,
        imported_sources: input.meta.imports?.accepted_sources ?? [],
        foundations_coverage: foundationsCoverage,
        guardrails_coverage: guardrailsCoverage,
        workflow_coverage: workflowCoverage,
      },
      unlocks,
  };
}
