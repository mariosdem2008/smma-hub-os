import { useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AgencyAiSetupActivationMode,
  AgencyAiSetupAgentClass,
  AgencyAiSetupStageKey,
  AgencyAiSetupUnlockState,
} from "@/lib/agency-ai-setup-v2/config";
import {
  AGENCY_AI_REQUIRED_CERTIFICATION_SCENARIOS,
  getMissingCertificationScenarios,
} from "@/lib/agency-ai-setup-v2/config";
import { deriveAgencyAiSetupReadiness, type AgencyAiSetupMetaV2 } from "@/lib/agency-ai-setup-v2/readiness";
import type { DerivedAgencyReadiness } from "@/lib/agency-ai-setup-v2/readiness";
import {
  applyTemplateDraftToMeta,
  type AgencyAiSetupCheckpointSnapshot,
  type AgencyAiSetupCheckpointStageKey,
} from "@/lib/agency-ai-setup-v2/adoption";
import { runAgencyAiSetupSimulation } from "@/lib/agency-ai-setup-v2/simulations";
import { useAuth } from "@/lib/auth";

export interface AgencyAiSetupStatusV2Record {
  agency_id: string;
  current_stage: string;
  current_step: string;
  setup_state: string;
  started_at: string;
  last_active_at: string;
  completed_foundations_at: string | null;
  completed_readiness_review_at: string | null;
  activated_at: string | null;
  control_center_enabled_at: string | null;
  meta_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgencyAiReadinessScoresV2Record {
  agency_id: string;
  score_version: number;
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
  computed_at: string;
  created_at: string;
  updated_at: string;
}

export interface AgencyAgentUnlockV2Record {
  agency_id: string;
  agent_class: AgencyAiSetupAgentClass;
  unlock_state: AgencyAiSetupUnlockState;
  blocked_reasons: string[];
  required_modules: string[];
  minimum_scores_json: Record<string, unknown>;
  activation_mode: AgencyAiSetupActivationMode | null;
  activation_policy_json: Record<string, unknown>;
  last_evaluated_at: string;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyAiSetupSimulationV2Record {
  id: string;
  agency_id: string;
  agent_class: AgencyAiSetupAgentClass;
  input_snapshot_json: Record<string, unknown>;
  output_snapshot_json: Record<string, unknown>;
  evaluation_json: Record<string, unknown>;
  result: "pass" | "warn" | "fail";
  created_by: string | null;
  created_at: string;
}

export interface AgencyAiCertificationV2Record {
  id: string;
  agency_id: string;
  agent_class: AgencyAiSetupAgentClass;
  scenario_key: string;
  scenario_title: string;
  certification_state: "needs_review" | "certified" | "revoked";
  latest_simulation_id: string | null;
  latest_result: "pass" | "warn" | "fail";
  latest_dimension_scores: Record<string, number>;
  latest_findings: string[];
  recommended_next_action: string | null;
  certified_at: string | null;
  certified_by: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyAiCertificationEventV2Record {
  id: string;
  certification_id: string;
  agency_id: string;
  agent_class: AgencyAiSetupAgentClass;
  scenario_key: string;
  event_type: "simulation_linked" | "certified" | "revoked";
  actor_user_id: string | null;
  simulation_id: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
}

export interface AgencyAiSetupSaveResultV2 {
  meta: AgencyAiSetupMetaV2;
  derived: DerivedAgencyReadiness;
}

const DEFAULT_READINESS: AgencyAiReadinessScoresV2Record = {
  agency_id: "",
  score_version: 1,
  knowledge_coverage: 0,
  process_definition: 0,
  quality_definition: 0,
  compliance_safety: 0,
  approval_governance: 0,
  evidence_strength: 0,
  overall_label: "Not Ready",
  critical_blockers: [
    "Import agency context",
    "Approve core operating modules",
    "Define quality bar and approval matrix",
  ],
  warnings: [],
  computed_from_json: {},
  computed_at: "",
  created_at: "",
  updated_at: "",
};

const DEFAULT_UNLOCKS: AgencyAgentUnlockV2Record[] = [
  {
    agency_id: "",
    agent_class: "strategy",
    unlock_state: "blocked",
    blocked_reasons: ["Core modules not approved"],
    required_modules: ["agency_identity", "service_catalog", "offer_strategy", "approval_matrix"],
    minimum_scores_json: { knowledge_coverage: 75, approval_governance: 75 },
    activation_mode: null,
    activation_policy_json: {},
    last_evaluated_at: "",
    activated_at: null,
    activated_by: null,
    created_at: "",
    updated_at: "",
  },
  {
    agency_id: "",
    agent_class: "creator",
    unlock_state: "blocked",
    blocked_reasons: ["Guardrails and creative rules incomplete"],
    required_modules: ["content_frameworks", "creative_rules", "claims_compliance", "quality_bar"],
    minimum_scores_json: { quality_definition: 80, compliance_safety: 80 },
    activation_mode: null,
    activation_policy_json: {},
    last_evaluated_at: "",
    activated_at: null,
    activated_by: null,
    created_at: "",
    updated_at: "",
  },
  {
    agency_id: "",
    agent_class: "operator",
    unlock_state: "blocked",
    blocked_reasons: ["Workflow lifecycle and approval rules incomplete"],
    required_modules: ["delivery_sops", "approval_matrix", "escalation_rules"],
    minimum_scores_json: { process_definition: 85, approval_governance: 85 },
    activation_mode: null,
    activation_policy_json: {},
    last_evaluated_at: "",
    activated_at: null,
    activated_by: null,
    created_at: "",
    updated_at: "",
  },
  {
    agency_id: "",
    agent_class: "analyst",
    unlock_state: "blocked",
    blocked_reasons: ["Reporting standards incomplete"],
    required_modules: ["reporting_kpis", "quality_bar"],
    minimum_scores_json: { evidence_strength: 70, quality_definition: 75 },
    activation_mode: null,
    activation_policy_json: {},
    last_evaluated_at: "",
    activated_at: null,
    activated_by: null,
    created_at: "",
    updated_at: "",
  },
  {
    agency_id: "",
    agent_class: "client_facing",
    unlock_state: "blocked",
    blocked_reasons: ["Client-facing governance incomplete"],
    required_modules: ["approval_matrix", "claims_compliance", "escalation_rules"],
    minimum_scores_json: { approval_governance: 90, compliance_safety: 85 },
    activation_mode: null,
    activation_policy_json: {},
    last_evaluated_at: "",
    activated_at: null,
    activated_by: null,
    created_at: "",
    updated_at: "",
  },
];

const TOUCH_STATUS_DEDUPE_WINDOW_MS = 5000;

export function useAgencyAiSetupOverview(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ["agency-ai-setup-v2-overview", agencyId],
    enabled: !!agencyId,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!agencyId) return null;
      const db = supabase as any;

      const [statusRes, readinessRes, unlocksRes] = await Promise.all([
        db.from("agency_ai_setup_status_v2").select("*").eq("agency_id", agencyId).maybeSingle(),
        db.from("agency_ai_readiness_scores_v2").select("*").eq("agency_id", agencyId).maybeSingle(),
        db.from("agency_agent_unlocks_v2").select("*").eq("agency_id", agencyId).order("agent_class", { ascending: true }),
      ]);

      if (statusRes.error) throw statusRes.error;
      if (readinessRes.error) throw readinessRes.error;
      if (unlocksRes.error) throw unlocksRes.error;

      return {
        status: (statusRes.data ?? null) as AgencyAiSetupStatusV2Record | null,
        readiness: (readinessRes.data
          ? {
              ...readinessRes.data,
              critical_blockers: Array.isArray(readinessRes.data.critical_blockers) ? readinessRes.data.critical_blockers : [],
              warnings: Array.isArray(readinessRes.data.warnings) ? readinessRes.data.warnings : [],
            }
          : null) as AgencyAiReadinessScoresV2Record | null,
        unlocks: ((unlocksRes.data ?? []) as AgencyAgentUnlockV2Record[]).map((row) => ({
          ...row,
          blocked_reasons: Array.isArray(row.blocked_reasons) ? row.blocked_reasons : [],
          required_modules: Array.isArray(row.required_modules) ? row.required_modules : [],
          activation_policy_json:
            row.activation_policy_json && typeof row.activation_policy_json === "object" ? row.activation_policy_json : {},
        })),
      };
    },
  });
}

export function useTouchAgencyAiSetupStatusV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const lastTouchRef = useRef<{ key: string; touchedAt: number } | null>(null);

  return useMutation({
    mutationFn: async ({
      stage,
      step,
      state,
    }: {
      stage: AgencyAiSetupStageKey;
      step?: string;
      state?: "not_started" | "in_progress" | "ready_for_review" | "active";
    }) => {
      if (!agencyId) return null;
      const nextStep = step ?? stage;
      const nextState = state ?? (stage === "overview" ? "not_started" : "in_progress");
      const dedupeKey = `${agencyId}:${stage}:${nextStep}:${nextState}`;
      const now = Date.now();
      if (
        lastTouchRef.current?.key === dedupeKey &&
        now - lastTouchRef.current.touchedAt < TOUCH_STATUS_DEDUPE_WINDOW_MS
      ) {
        return null;
      }
      lastTouchRef.current = { key: dedupeKey, touchedAt: now };
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_ai_setup_status_v2")
        .upsert(
          {
            agency_id: agencyId,
            current_stage: stage,
            current_step: nextStep,
            setup_state: nextState,
            last_active_at: new Date().toISOString(),
          },
          { onConflict: "agency_id" },
        )
        .select("*")
        .single();

      if (error) {
        lastTouchRef.current = null;
        throw error;
      }
      return data as AgencyAiSetupStatusV2Record;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useAgencyAiSetupResolvedState(agencyId: string | null | undefined) {
  const query = useAgencyAiSetupOverview(agencyId);
  const certificationsQuery = useAgencyAiCertificationsV2(agencyId);

  return useMemo(() => {
    const status = query.data?.status ?? null;
    const readiness = query.data?.readiness
      ? query.data.readiness
      : agencyId
        ? { ...DEFAULT_READINESS, agency_id: agencyId }
        : DEFAULT_READINESS;
    const unlocks = query.data?.unlocks?.length
      ? query.data.unlocks
      : agencyId
        ? DEFAULT_UNLOCKS.map((row) => ({ ...row, agency_id: agencyId }))
        : DEFAULT_UNLOCKS;
    const certifications = certificationsQuery.data ?? [];
    const certificationsByAgentClass = Object.fromEntries(
      (["strategy", "creator", "operator", "analyst", "client_facing"] as AgencyAiSetupAgentClass[]).map((agentClass) => {
        const certifiedScenarioKeys = certifications
          .filter((row) => row.agent_class === agentClass && row.certification_state === "certified")
          .map((row) => row.scenario_key);
        return [
          agentClass,
          {
            certifiedScenarioKeys,
            requiredScenarioKeys: AGENCY_AI_REQUIRED_CERTIFICATION_SCENARIOS[agentClass] ?? [],
            missingScenarioKeys: getMissingCertificationScenarios(agentClass, certifiedScenarioKeys),
          },
        ];
      }),
    ) as Record<
      AgencyAiSetupAgentClass,
      {
        certifiedScenarioKeys: string[];
        requiredScenarioKeys: string[];
        missingScenarioKeys: string[];
      }
    >;

    return {
      ...query,
      status,
      readiness,
      unlocks,
      certifications,
      certificationsByAgentClass,
    };
  }, [agencyId, certificationsQuery.data, query]);
}

export function useAgencyAiSetupSimulationsV2(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ["agency-ai-setup-v2-simulations", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      if (!agencyId) return [] as AgencyAiSetupSimulationV2Record[];
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_ai_setup_simulations_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AgencyAiSetupSimulationV2Record[];
    },
  });
}

export function useAgencyAiCertificationsV2(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ["agency-ai-setup-v2-certifications", agencyId],
    enabled: !!agencyId,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!agencyId) return [] as AgencyAiCertificationV2Record[];
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_ai_certifications_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .order("agent_class", { ascending: true })
        .order("scenario_key", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as AgencyAiCertificationV2Record[]).map((row) => ({
        ...row,
        latest_dimension_scores:
          row.latest_dimension_scores && typeof row.latest_dimension_scores === "object" ? row.latest_dimension_scores : {},
        latest_findings: Array.isArray(row.latest_findings) ? row.latest_findings : [],
      }));
    },
  });
}

export function useAgencyAiCertificationEventsV2(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ["agency-ai-setup-v2-certification-events", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      if (!agencyId) return [] as AgencyAiCertificationEventV2Record[];
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_ai_certification_events_v2")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return ((data ?? []) as AgencyAiCertificationEventV2Record[]).map((row) => ({
        ...row,
        payload_json: row.payload_json && typeof row.payload_json === "object" ? row.payload_json : {},
      }));
    },
  });
}

async function getCurrentMeta(agencyId: string) {
  const db = supabase as any;
  const { data, error } = await db
    .from("agency_ai_setup_status_v2")
    .select("meta_json")
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) throw error;
  return ((data?.meta_json ?? {}) as AgencyAiSetupMetaV2) || {};
}

async function getApprovedBrainDocumentSummary(agencyId: string) {
  const db = supabase as any;
  const { data, error } = await db
    .from("brain_documents")
    .select("id,title,module")
    .eq("agency_id", agencyId)
    .eq("status", "approved");
  if (error) throw error;
  const docs = (data ?? []) as Array<{ id: string; title: string; module: string }>;
  const modules = Array.from(new Set(docs.map((row) => row.module)));
  return {
    docs,
    modules,
    count: modules.length ? (data?.length ?? modules.length) : 0,
  };
}

async function getAgencyProfileSummary(agencyId: string) {
  const db = supabase as any;
  const { data, error } = await db
    .from("agencies")
    .select("name,niche,website")
    .eq("id", agencyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    name: data.name as string | null,
    niche: data.niche as string | null,
    description:
      typeof data.name === "string"
        ? `${data.name} is using Agency AI Setup V2 to turn existing positioning and delivery knowledge into a governed Strategy AI baseline.`
        : null,
    services: null,
  };
}

async function getApprovedAgencyOperatingModuleSummary(agencyId: string) {
  const db = supabase as any;
  const { data, error } = await db
    .from("agency_operating_modules_v2")
    .select("module_key")
    .eq("agency_id", agencyId)
    .eq("status", "approved");
  if (error) throw error;
  const moduleKeys = Array.from(new Set(((data ?? []) as Array<{ module_key: string }>).map((row) => row.module_key)));
  return {
    moduleKeys,
    count: moduleKeys.length ? (data?.length ?? moduleKeys.length) : 0,
  };
}

async function persistReadinessSnapshot(agencyId: string, meta: AgencyAiSetupMetaV2) {
  const db = supabase as any;
  const approvedModules = await getApprovedAgencyOperatingModuleSummary(agencyId);
  const approvedDocs = await getApprovedBrainDocumentSummary(agencyId);
  const derived = deriveAgencyAiSetupReadiness({
    agencyId,
    meta,
    approvedModuleKeys: approvedModules.moduleKeys,
    approvedModuleCount: approvedModules.count,
    legacyApprovedDocumentModules: approvedDocs.modules,
    legacyApprovedDocumentCount: approvedDocs.count,
  });

  await db.from("agency_ai_readiness_scores_v2").upsert(
    {
      agency_id: agencyId,
      score_version: 1,
      knowledge_coverage: derived.knowledge_coverage,
      process_definition: derived.process_definition,
      quality_definition: derived.quality_definition,
      compliance_safety: derived.compliance_safety,
      approval_governance: derived.approval_governance,
      evidence_strength: derived.evidence_strength,
      overall_label: derived.overall_label,
      critical_blockers: derived.critical_blockers,
      warnings: derived.warnings,
      computed_from_json: derived.computed_from_json,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "agency_id" },
  );

  for (const unlock of derived.unlocks) {
    await db.from("agency_agent_unlocks_v2").upsert(
      {
        agency_id: agencyId,
        agent_class: unlock.agent_class,
        unlock_state: unlock.unlock_state,
        blocked_reasons: unlock.blocked_reasons,
        required_modules: unlock.required_modules,
        minimum_scores_json: unlock.minimum_scores_json,
        activation_policy_json: unlock.activation_policy_json,
        last_evaluated_at: new Date().toISOString(),
      },
      { onConflict: "agency_id,agent_class" },
    );
  }

  return derived;
}

export async function recomputeAgencyAiSetupReadinessV2(agencyId: string) {
  const currentMeta = await getCurrentMeta(agencyId);
  return persistReadinessSnapshot(agencyId, currentMeta);
}

export function useRunAgencyAiSetupReadinessReviewV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const derived = await recomputeAgencyAiSetupReadinessV2(agencyId);
      await db
        .from("agency_ai_setup_status_v2")
        .upsert(
          {
            agency_id: agencyId,
            current_stage: "activation",
            current_step: "readiness",
            setup_state: "ready_for_review",
            last_active_at: new Date().toISOString(),
            completed_readiness_review_at: new Date().toISOString(),
          },
          { onConflict: "agency_id" },
        );
      return derived;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useActivateAgencyAgentClassV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      agentClass,
      activate,
      mode,
    }: {
      agentClass: AgencyAiSetupAgentClass;
      activate?: boolean;
      mode?: AgencyAiSetupActivationMode | null;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const active = activate !== false;
      if (active && mode === "operational") {
        const { data: certifications, error: certificationError } = await db
          .from("agency_ai_certifications_v2")
          .select("scenario_key")
          .eq("agency_id", agencyId)
          .eq("agent_class", agentClass)
          .eq("certification_state", "certified");
        if (certificationError) throw certificationError;
        const certifiedScenarioKeys = ((certifications ?? []) as Array<{ scenario_key: string }>).map((row) => row.scenario_key);
        const missingScenarios = getMissingCertificationScenarios(agentClass, certifiedScenarioKeys);
        if (missingScenarios.length > 0) {
          throw new Error(
            `Operational activation requires certified scenarios: ${missingScenarios.map((item) => item.replace(/_/g, " ")).join(", ")}.`,
          );
        }
      }
      const activatedAt = active ? new Date().toISOString() : null;
      const activatedBy = active ? user?.id ?? null : null;
      const activationMode = active ? mode ?? "internal_assist_only" : null;
      const { error } = await db
        .from("agency_agent_unlocks_v2")
        .update({
          activated_at: activatedAt,
          activated_by: activatedBy,
          activation_mode: activationMode,
        })
        .eq("agency_id", agencyId)
        .eq("agent_class", agentClass);
      if (error) throw error;

      const { error: statusError } = await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          current_stage: "activation",
          current_step: active ? "activated" : "readiness",
          setup_state: active ? "active" : "ready_for_review",
          last_active_at: new Date().toISOString(),
          activated_at: activatedAt,
          control_center_enabled_at: activatedAt,
        },
        { onConflict: "agency_id" },
      );
      if (statusError) throw statusError;

      return {
        agency_id: agencyId,
        agent_class: agentClass,
        activated_at: activatedAt,
        activated_by: activatedBy,
        activation_mode: activationMode,
      } as AgencyAgentUnlockV2Record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function usePersistAgencyAiSetupCheckpointV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stage,
      checkpoint,
    }: {
      stage: AgencyAiSetupCheckpointStageKey;
      checkpoint: AgencyAiSetupCheckpointSnapshot;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const meta = await getCurrentMeta(agencyId);
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...meta,
        checkpoints: {
          ...(meta.checkpoints ?? {}),
          [stage]: {
            ...checkpoint,
            updated_at: new Date().toISOString(),
          },
        },
      };

      const { error } = await db
        .from("agency_ai_setup_status_v2")
        .upsert(
          {
            agency_id: agencyId,
            meta_json: nextMeta,
            last_active_at: new Date().toISOString(),
          },
          { onConflict: "agency_id" },
        );
      if (error) throw error;
      return nextMeta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useCreateAgencyAiSetupSimulationV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      agentClass,
      unlockState,
      readinessLabel,
      blockers,
      activated,
      activationMode,
      readinessScores,
      scenarioKey,
    }: {
      agentClass: AgencyAiSetupAgentClass;
      unlockState: AgencyAiSetupUnlockState;
      readinessLabel: string;
      blockers: string[];
      activated: boolean;
      activationMode: AgencyAiSetupActivationMode | null;
      readinessScores: {
        knowledge_coverage: number;
        process_definition: number;
        quality_definition: number;
        compliance_safety: number;
        approval_governance: number;
        evidence_strength: number;
      };
      scenarioKey?: string;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const simulation = runAgencyAiSetupSimulation(
        {
          agentClass,
          unlockState,
          activationMode,
          activated,
          readinessLabel,
          blockers,
          readinessScores,
        },
        scenarioKey,
      );
      const { data, error } = await db
        .from("agency_ai_setup_simulations_v2")
        .insert({
          agency_id: agencyId,
          agent_class: agentClass,
          input_snapshot_json: {
            scenario_key: simulation.scenario.key,
            scenario_title: simulation.scenario.title,
            unlock_state: unlockState,
            activation_mode: activationMode,
            readiness_label: readinessLabel,
            blocker_count: blockers.length,
            readiness_scores: readinessScores,
          },
          output_snapshot_json: {
            summary: simulation.summary,
            recommended_next_action: simulation.recommendedNextAction,
            findings: simulation.findings,
            dimension_scores: simulation.dimensionScores,
          },
          evaluation_json: {
            blockers,
            activated,
            scenario: simulation.scenario,
            dimension_scores: simulation.dimensionScores,
            findings: simulation.findings,
            recommended_next_action: simulation.recommendedNextAction,
          },
          result: simulation.result,
          created_by: user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as AgencyAiSetupSimulationV2Record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-simulations", agencyId] });
    },
  });
}

export function usePromoteAgencyAiSimulationToCertificationV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      simulation,
      note,
    }: {
      simulation: AgencyAiSetupSimulationV2Record;
      note?: string;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      if (simulation.result !== "pass") throw new Error("Only passing simulations can be certified");
      const db = supabase as any;
      const scenarioKey = String(simulation.input_snapshot_json?.scenario_key ?? "");
      const scenarioTitle = String(
        simulation.input_snapshot_json?.scenario_title ?? simulation.evaluation_json?.scenario?.title ?? "Certification scenario",
      );
      const dimensionScores =
        simulation.output_snapshot_json?.dimension_scores && typeof simulation.output_snapshot_json.dimension_scores === "object"
          ? simulation.output_snapshot_json.dimension_scores
          : {};
      const findings = Array.isArray(simulation.output_snapshot_json?.findings)
        ? simulation.output_snapshot_json.findings
        : [];
      const recommendedNextAction =
        typeof simulation.output_snapshot_json?.recommended_next_action === "string"
          ? simulation.output_snapshot_json.recommended_next_action
          : null;

      const { data, error } = await db
        .from("agency_ai_certifications_v2")
        .upsert(
          {
            agency_id: agencyId,
            agent_class: simulation.agent_class,
            scenario_key: scenarioKey,
            scenario_title: scenarioTitle,
            certification_state: "certified",
            latest_simulation_id: simulation.id,
            latest_result: simulation.result,
            latest_dimension_scores: dimensionScores,
            latest_findings: findings,
            recommended_next_action: recommendedNextAction,
            certified_at: new Date().toISOString(),
            certified_by: user?.id ?? null,
            revoked_at: null,
            revoked_by: null,
            note: note ?? null,
          },
          { onConflict: "agency_id,agent_class,scenario_key" },
        )
        .select("*")
        .single();
      if (error) throw error;

      await db.from("agency_ai_certification_events_v2").insert([
        {
          certification_id: data.id,
          agency_id: agencyId,
          agent_class: simulation.agent_class,
          scenario_key: scenarioKey,
          event_type: "simulation_linked",
          actor_user_id: user?.id ?? null,
          simulation_id: simulation.id,
          payload_json: {
            result: simulation.result,
            summary: simulation.output_snapshot_json?.summary ?? null,
          },
        },
        {
          certification_id: data.id,
          agency_id: agencyId,
          agent_class: simulation.agent_class,
          scenario_key: scenarioKey,
          event_type: "certified",
          actor_user_id: user?.id ?? null,
          simulation_id: simulation.id,
          payload_json: {
            note: note ?? null,
            dimension_scores: dimensionScores,
          },
        },
      ]);

      return data as AgencyAiCertificationV2Record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-certifications", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-certification-events", agencyId] });
    },
  });
}

export function useRevokeAgencyAiCertificationV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      certificationId,
      note,
    }: {
      certificationId: string;
      note?: string;
    }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const { data, error } = await db
        .from("agency_ai_certifications_v2")
        .update({
          certification_state: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user?.id ?? null,
          note: note ?? null,
        })
        .eq("agency_id", agencyId)
        .eq("id", certificationId)
        .select("*")
        .single();
      if (error) throw error;

      await db.from("agency_ai_certification_events_v2").insert({
        certification_id: certificationId,
        agency_id: agencyId,
        agent_class: data.agent_class,
        scenario_key: data.scenario_key,
        event_type: "revoked",
        actor_user_id: user?.id ?? null,
        simulation_id: data.latest_simulation_id,
        payload_json: {
          note: note ?? null,
        },
      });

      return data as AgencyAiCertificationV2Record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-certifications", agencyId] });
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-certification-events", agencyId] });
    },
  });
}

export function useImportAgencyAiSetupContextV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { acceptedSources: string[]; acceptedDocumentCount: number; strategyTemplateKey?: AgencyAiSetupMetaV2["guided_strategy_template_key"] }) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const currentMeta = await getCurrentMeta(agencyId);
      const [agencyProfile, approvedDocs] = await Promise.all([
        getAgencyProfileSummary(agencyId),
        getApprovedBrainDocumentSummary(agencyId),
      ]);
      const draftedMeta = applyTemplateDraftToMeta(
        currentMeta,
        payload.strategyTemplateKey ?? currentMeta.guided_strategy_template_key ?? "general_service",
        agencyProfile,
        approvedDocs.docs,
      );
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...draftedMeta,
        imports: {
          imported_at: new Date().toISOString(),
          accepted_sources: payload.acceptedSources,
          accepted_document_count: payload.acceptedDocumentCount,
        },
      };

      await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          current_stage: "foundations",
          current_step: "foundations",
          setup_state: "in_progress",
          last_active_at: new Date().toISOString(),
          meta_json: nextMeta,
        },
        { onConflict: "agency_id" },
      );

      await persistReadinessSnapshot(agencyId, nextMeta);
      return nextMeta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useSelectAgencyAiSetupStrategyTemplateV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (strategyTemplateKey: NonNullable<AgencyAiSetupMetaV2["guided_strategy_template_key"]>) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const currentMeta = await getCurrentMeta(agencyId);
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...currentMeta,
        guided_strategy_template_key: strategyTemplateKey,
      };

      const { error } = await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          last_active_at: new Date().toISOString(),
          meta_json: nextMeta,
        },
        { onConflict: "agency_id" },
      );

      if (error) throw error;
      return nextMeta;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useSaveAgencyAiSetupFoundationsV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NonNullable<AgencyAiSetupMetaV2["foundations"]>) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const currentMeta = await getCurrentMeta(agencyId);
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...currentMeta,
        foundations: payload,
      };
      nextMeta.foundations = {
        ...nextMeta.foundations,
        updated_at: new Date().toISOString(),
      };

      await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          current_stage: "modules",
          current_step: "foundations",
          setup_state: "in_progress",
          last_active_at: new Date().toISOString(),
          completed_foundations_at: new Date().toISOString(),
          meta_json: nextMeta,
        },
        { onConflict: "agency_id" },
      );

      const derived = await persistReadinessSnapshot(agencyId, nextMeta);
      return { meta: nextMeta, derived } satisfies AgencyAiSetupSaveResultV2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useSaveAgencyAiSetupGuardrailsV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NonNullable<AgencyAiSetupMetaV2["guardrails"]>) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const currentMeta = await getCurrentMeta(agencyId);
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...currentMeta,
        guardrails: payload,
      };
      nextMeta.guardrails = {
        ...nextMeta.guardrails,
        updated_at: new Date().toISOString(),
      };

      await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          current_stage: "workflow",
          current_step: "guardrails",
          setup_state: "in_progress",
          last_active_at: new Date().toISOString(),
          meta_json: nextMeta,
        },
        { onConflict: "agency_id" },
      );

      const derived = await persistReadinessSnapshot(agencyId, nextMeta);
      return { meta: nextMeta, derived } satisfies AgencyAiSetupSaveResultV2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}

export function useSaveAgencyAiSetupWorkflowV2(agencyId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NonNullable<AgencyAiSetupMetaV2["workflow"]>) => {
      if (!agencyId) throw new Error("No agency selected");
      const db = supabase as any;
      const currentMeta = await getCurrentMeta(agencyId);
      const nextMeta: AgencyAiSetupMetaV2 = {
        ...currentMeta,
        workflow: payload,
      };
      nextMeta.workflow = {
        ...nextMeta.workflow,
        updated_at: new Date().toISOString(),
      };

      await db.from("agency_ai_setup_status_v2").upsert(
        {
          agency_id: agencyId,
          current_stage: "readiness",
          current_step: "workflow",
          setup_state: "in_progress",
          last_active_at: new Date().toISOString(),
          meta_json: nextMeta,
        },
        { onConflict: "agency_id" },
      );

      const derived = await persistReadinessSnapshot(agencyId, nextMeta);
      return { meta: nextMeta, derived } satisfies AgencyAiSetupSaveResultV2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-ai-setup-v2-overview", agencyId] });
    },
  });
}
