import type {
  AgencyOperatingModuleV2,
  StrategyArtifactEnvelopeV2,
  V2ArtifactStatus,
  V2ArtifactType,
  V2ReadinessState,
} from "../../../src/lib/strategy/v2/contracts.ts";
import { normalizeAgencyOperatingModuleFromBrainDocument } from "../../../src/lib/strategy/v2/agents.ts";

type MinimalSupabase = {
  from: (table: string) => any;
};

export async function syncAgencyOperatingModulesV2(args: {
  supabase: MinimalSupabase;
  agencyId: string;
  actingUserId: string | null;
}) {
  const { supabase, agencyId, actingUserId } = args;
  const { data: docs, error } = await supabase
    .from("brain_documents")
    .select("id, agency_id, module, title, content_json, status, version, approved_at, approved_by, updated_at")
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (error) throw error;

  const normalized = ((docs ?? []) as Array<Record<string, unknown>>).map((doc) => {
    const module = normalizeAgencyOperatingModuleFromBrainDocument(doc);
    return {
      agency_id: agencyId,
      source_document_id: String(doc.id),
      module_key: module.module_key,
      version: Number(doc.version ?? 1),
      status: "approved",
      approval_owner_user_id: null,
      approved_by_user_id: (doc.approved_by as string | null) ?? actingUserId,
      approved_at: (doc.approved_at as string | null) ?? null,
      content_json: module,
      derived_snapshot_json: {
        title: module.title,
        definition: module.definition,
        key_rules: module.rules.slice(0, 5),
      },
      confidence: module.confidence,
      evidence_sources: module.evidence_sources,
      last_reviewed_at: module.last_reviewed_at ?? null,
      created_by: actingUserId,
    };
  });

  for (const row of normalized) {
    const { error: upsertError } = await supabase
      .from("agency_operating_modules_v2")
      .upsert(row, { onConflict: "agency_id,module_key,version" });
    if (upsertError) throw upsertError;
  }

  return normalized as Array<{
    agency_id: string;
    module_key: string;
    version: number;
    content_json: AgencyOperatingModuleV2;
  }>;
}

export async function createClientBriefV2(args: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string;
  actingUserId: string | null;
  onboardingProfileId?: string | null;
  clientBrainId?: string | null;
  operationsSetupId?: string | null;
  contentJson: Record<string, unknown>;
  readinessState: V2ReadinessState;
  missingItems: string[];
  assumptions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number;
}) {
  const { supabase, clientId } = args;
  const { data: latest } = await supabase
    .from("client_operating_briefs_v2")
    .select("version")
    .eq("client_id", clientId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = Number(latest?.version ?? 0) + 1;
  const insertPayload = {
    agency_id: args.agencyId,
    client_id: clientId,
    version,
    readiness_state: args.readinessState,
    status: args.readinessState === "insufficient" ? "draft" : "review",
    source_onboarding_profile_id: args.onboardingProfileId ?? null,
    source_client_brain_id: args.clientBrainId ?? null,
    source_operations_setup_id: args.operationsSetupId ?? null,
    content_json: args.contentJson,
    missing_items: args.missingItems,
    assumptions: args.assumptions,
    citations: args.citations,
    confidence: args.confidence,
    created_by: args.actingUserId,
  };
  const { data, error } = await supabase.from("client_operating_briefs_v2").insert(insertPayload).select("*").single();
  if (error) throw error;
  return data;
}

export async function createAgentRunV2(args: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string;
  agentKey: string;
  lifecycleState?: string;
  inputRefs?: Record<string, unknown>;
  startedByUserId?: string | null;
  model?: string | null;
}) {
  const { data, error } = await args.supabase
    .from("agent_runs_v2")
    .insert({
      agency_id: args.agencyId,
      client_id: args.clientId,
      agent_key: args.agentKey,
      lifecycle_state: args.lifecycleState ?? null,
      input_refs: args.inputRefs ?? {},
      started_by_user_id: args.startedByUserId ?? null,
      model: args.model ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function finalizeAgentRunV2(args: {
  supabase: MinimalSupabase;
  runId: string;
  status: "completed" | "failed" | "blocked" | "cancelled";
  outputArtifactId?: string | null;
  failureReason?: string | null;
  durationMs?: number;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsd?: number | null;
  traceJson?: Record<string, unknown>;
}) {
  const { error } = await args.supabase
    .from("agent_runs_v2")
    .update({
      run_status: args.status,
      output_artifact_id: args.outputArtifactId ?? null,
      failure_reason: args.failureReason ?? null,
      duration_ms: args.durationMs ?? null,
      tokens_in: args.tokensIn ?? null,
      tokens_out: args.tokensOut ?? null,
      cost_usd: args.costUsd ?? null,
      ...(args.traceJson ? { trace_json: args.traceJson } : {}),
      completed_at: new Date().toISOString(),
    })
    .eq("id", args.runId);
  if (error) throw error;
}

export async function createStrategyArtifactV2(args: {
  supabase: MinimalSupabase;
  agencyId: string;
  clientId: string;
  artifactType: V2ArtifactType;
  status?: V2ArtifactStatus;
  sourceBriefId?: string | null;
  agencyModuleVersionMap?: Record<string, number>;
  contentJson: Record<string, unknown>;
  markdown?: string | null;
  citations?: Array<Record<string, unknown>>;
  assumptions?: string[];
  openQuestions?: string[];
  confidence?: number | null;
  generatedByRunId?: string | null;
  createdBy?: string | null;
  publishedToStrategyId?: string | null;
  publishedToDocumentId?: string | null;
}) {
  const { data: latest } = await args.supabase
    .from("strategy_artifacts_v2")
    .select("version")
    .eq("client_id", args.clientId)
    .eq("artifact_type", args.artifactType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(latest?.version ?? 0) + 1;
  const { data, error } = await args.supabase
    .from("strategy_artifacts_v2")
    .insert({
      agency_id: args.agencyId,
      client_id: args.clientId,
      artifact_type: args.artifactType,
      version,
      status: args.status ?? "draft",
      source_brief_id: args.sourceBriefId ?? null,
      source_agency_module_version_map: args.agencyModuleVersionMap ?? {},
      content_json: args.contentJson,
      markdown: args.markdown ?? null,
      citations: args.citations ?? [],
      assumptions: args.assumptions ?? [],
      open_questions: args.openQuestions ?? [],
      confidence: args.confidence ?? null,
      generated_by_run_id: args.generatedByRunId ?? null,
      created_by: args.createdBy ?? null,
      published_to_strategy_id: args.publishedToStrategyId ?? null,
      published_to_document_id: args.publishedToDocumentId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function createArtifactEvaluationV2(args: {
  supabase: MinimalSupabase;
  artifactId: string;
  agencyId: string;
  clientId: string;
  evaluatorKey: string;
  result: "pass" | "warn" | "fail";
  score: number;
  findings: unknown[];
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await args.supabase
    .from("artifact_evaluations_v2")
    .insert({
      artifact_id: args.artifactId,
      agency_id: args.agencyId,
      client_id: args.clientId,
      evaluator_key: args.evaluatorKey,
      result: args.result,
      score: args.score,
      findings: args.findings,
      metadata: args.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
