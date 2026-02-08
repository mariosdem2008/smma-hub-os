export function readEnvFlag(name: string, defaultValue = false): boolean {
  if (typeof Deno !== "undefined" && typeof (Deno as any)?.env?.get === "function") {
    const raw = (Deno as any).env.get(name) as string | undefined;
    if (raw === undefined) return defaultValue;
    return raw.toLowerCase() === "true";
  }
  if (typeof process !== "undefined") {
    const raw = process.env[name];
    if (raw === undefined) return defaultValue;
    return raw.toLowerCase() === "true";
  }
  return defaultValue;
}

function readEnv(name: string): string | undefined {
  if (typeof Deno !== "undefined" && typeof (Deno as any)?.env?.get === "function") {
    return (Deno as any).env.get(name) as string | undefined;
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

function parseCsv(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
}

export function isNewPlannerEnabled(): boolean {
  return readEnvFlag("USE_NEW_PLANNER", false);
}

export function isNewRagIndexingEnabled(): boolean {
  return readEnvFlag("ENABLE_NEW_RAG_INDEXING", true);
}

export function isOtelLoggingEnabled(): boolean {
  return readEnvFlag("AI_OTEL_LOGGING", true);
}

export function isDurableExecutorEnabled(): boolean {
  return readEnvFlag("USE_DURABLE_EXECUTOR", false);
}

export function isRagRerankingEnabled(): boolean {
  return readEnvFlag("ENABLE_RAG_RERANKING", false);
}

export function isToolGovernanceEnabled(): boolean {
  return readEnvFlag("ENFORCE_TOOL_GOVERNANCE", false);
}

// Phase 2 flags (default OFF until cutover)
export function isEpisodicMemoryEnabled(): boolean {
  return readEnvFlag("ENABLE_EPISODIC_MEMORY", false);
}

export function isLongTermMemoryEnabled(): boolean {
  return readEnvFlag("ENABLE_LONG_TERM_MEMORY", false);
}

export function isContextualIngestionEnabled(): boolean {
  return readEnvFlag("ENABLE_CONTEXTUAL_INGESTION", false);
}

// Phase 2 cohort safety:
// - default is "require_list" so that enabling Phase 2 flags does not accidentally cut over all tenants.
// - set PHASE2_COHORT_MODE=allow_all to intentionally enable for all tenants.
export function isPhase2EnabledForAgency(agencyId: string | null | undefined): boolean {
  if (!agencyId) return false;
  const mode = (readEnv("PHASE2_COHORT_MODE") ?? "require_list").trim().toLowerCase();
  if (mode === "allow_all") return true;

  const cohort = parseCsv(readEnv("PHASE2_COHORT_AGENCY_IDS"));
  if (cohort.size === 0) return false;
  return cohort.has(agencyId);
}
