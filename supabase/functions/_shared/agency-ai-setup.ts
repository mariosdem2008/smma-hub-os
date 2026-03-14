import { createClient } from "npm:@supabase/supabase-js@2";

const modeOrder = ["preview_only", "internal_assist_only", "operational"] as const;
const requiredCertificationScenarios: Record<string, string[]> = {
  strategy: ["strategy_readiness_certification"],
  creator: ["creator_brief_certification"],
  operator: ["workflow_execution_certification"],
  analyst: ["reporting_certification"],
  client_facing: ["client_response_certification"],
};

function modeRank(mode: (typeof modeOrder)[number] | null | undefined) {
  if (!mode) return -1;
  return modeOrder.indexOf(mode);
}

function toMillis(value: string | null | undefined) {
  if (!value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function buildSectionEvidence(agentClass: string, meta: Record<string, any> | null | undefined) {
  const evidence: Array<{ label: string; timestamp: string }> = [];
  if (!meta) return evidence;

  const add = (label: string, timestamp: string | null | undefined) => {
    if (!timestamp) return;
    evidence.push({ label, timestamp });
  };

  if (agentClass === "strategy") {
    add("Imports were updated", meta.imports?.imported_at);
    add("Foundations were updated", meta.foundations?.updated_at);
  }

  if (agentClass === "creator") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Guardrails were updated", meta.guardrails?.updated_at);
  }

  if (agentClass === "operator") {
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  if (agentClass === "analyst") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  if (agentClass === "client_facing") {
    add("Foundations were updated", meta.foundations?.updated_at);
    add("Guardrails were updated", meta.guardrails?.updated_at);
    add("Workflow was updated", meta.workflow?.updated_at);
  }

  return evidence;
}

export async function enforceAgencyAgentActivation(args: {
  supabaseClient: ReturnType<typeof createClient>;
  agencyId: string;
  agentClass: "strategy" | "creator" | "operator" | "analyst" | "client_facing";
  requiredMode?: "preview_only" | "internal_assist_only" | "operational";
  corsHeaders: Record<string, string>;
}) {
  const { supabaseClient, agencyId, agentClass, requiredMode = "operational", corsHeaders } = args;
  const { data, error } = await supabaseClient
    .from("agency_agent_unlocks_v2")
    .select("agent_class, unlock_state, activated_at, activation_mode, required_modules")
    .eq("agency_id", agencyId)
    .eq("agent_class", agentClass)
    .maybeSingle();

  if (error) throw error;

  const unlockState = data?.unlock_state ?? "blocked";
  const activatedAt = data?.activated_at ?? null;
  const activationMode = data?.activation_mode ?? null;
  const requiredModules = Array.isArray(data?.required_modules) ? data.required_modules : [];
  const unlockAllowsRequired = modeRank(unlockState as (typeof modeOrder)[number]) >= modeRank(requiredMode);
  const activationAllowsRequired = modeRank(activationMode as (typeof modeOrder)[number]) >= modeRank(requiredMode);
  let missingCertificationScenarios: string[] = [];
  let staleCertificationScenarios: string[] = [];

  if (requiredMode === "operational") {
    const { data: statusRow, error: statusError } = await supabaseClient
      .from("agency_ai_setup_status_v2")
      .select("meta_json")
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (statusError) throw statusError;
    const { data: certifications, error: certificationError } = await supabaseClient
      .from("agency_ai_certifications_v2")
      .select("scenario_key, certified_at")
      .eq("agency_id", agencyId)
      .eq("agent_class", agentClass)
      .eq("certification_state", "certified");
    if (certificationError) throw certificationError;
    const { data: moduleRows, error: moduleError } = await supabaseClient
      .from("agency_operating_modules_v2")
      .select("module_key, updated_at")
      .eq("agency_id", agencyId)
      .in("module_key", requiredModules.length ? requiredModules : ["__none__"])
      .order("updated_at", { ascending: false });
    if (moduleError) throw moduleError;

    const evidence = buildSectionEvidence(agentClass, (statusRow?.meta_json ?? {}) as Record<string, any>);
    const latestModulesByKey = new Map<string, string>();
    for (const row of (moduleRows ?? []) as Array<{ module_key: string; updated_at: string }>) {
      if (!latestModulesByKey.has(row.module_key)) {
        latestModulesByKey.set(row.module_key, row.updated_at);
      }
    }
    for (const [moduleKey, updatedAt] of latestModulesByKey.entries()) {
      evidence.push({
        label: `${moduleKey.replace(/_/g, " ")} module was updated`,
        timestamp: updatedAt,
      });
    }

    const certifiedRows = (certifications ?? []) as Array<{ scenario_key: string; certified_at: string | null }>;
    const certifiedScenarioKeys = new Set(certifiedRows.map((row) => row.scenario_key));
    missingCertificationScenarios = (requiredCertificationScenarios[agentClass] ?? []).filter((item) => !certifiedScenarioKeys.has(item));
    staleCertificationScenarios = certifiedRows
      .filter((row) => {
        const certifiedAt = toMillis(row.certified_at);
        return evidence.some((entry) => toMillis(entry.timestamp) > certifiedAt);
      })
      .map((row) => row.scenario_key)
      .filter((item) => (requiredCertificationScenarios[agentClass] ?? []).includes(item));
  }

  if (
    unlockState !== "blocked" &&
    activatedAt &&
    unlockAllowsRequired &&
    activationAllowsRequired &&
    missingCertificationScenarios.length === 0 &&
    staleCertificationScenarios.length === 0
  ) {
    return null;
  }

  const deepLink =
    !unlockAllowsRequired || unlockState === "blocked"
      ? `/agency/ai-setup/readiness/preview/${agentClass}`
      : missingCertificationScenarios.length > 0 || staleCertificationScenarios.length > 0
        ? `/agency/ai-setup/readiness/preview/${agentClass}`
        : "/agency/ai-setup/activation";

  const message =
    !unlockAllowsRequired || unlockState === "blocked"
      ? `${agentClass.replace(/_/g, " ")} agent is not ready for ${requiredMode.replace(/_/g, " ")} usage yet. Resolve readiness blockers before activation.`
      : staleCertificationScenarios.length > 0
        ? `${agentClass.replace(/_/g, " ")} agent needs certification revalidation before operational usage.`
      : missingCertificationScenarios.length > 0
        ? `${agentClass.replace(/_/g, " ")} agent requires certification before operational usage.`
        : `${agentClass.replace(/_/g, " ")} agent must be activated at ${requiredMode.replace(/_/g, " ")} or higher before using this workflow.`;

  return new Response(
    JSON.stringify({
      success: false,
      code: "AGENT_ACTIVATION_REQUIRED",
      error: message,
      deep_link: deepLink,
      agent_class: agentClass,
      unlock_state: unlockState,
      activation_mode: activationMode,
      required_mode: requiredMode,
      missing_certification_scenarios: missingCertificationScenarios,
      stale_certification_scenarios: staleCertificationScenarios,
      activated_at: activatedAt,
    }),
    {
      status: 412,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
