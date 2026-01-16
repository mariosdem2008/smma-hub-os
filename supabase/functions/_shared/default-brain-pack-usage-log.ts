export type DefaultBrainPackUsageStage =
  | "seed_rpc_called"
  | "repair_rpc_called"
  | "approved"
  | "ingested"
  | "completed"
  | "failed";

export function buildDefaultBrainPackUsageLog(args: {
  agencyId: string;
  userId: string;
  stage: DefaultBrainPackUsageStage;
  insertedCount?: number;
  documentIds?: string[];
  ingestedCount?: number;
  failedIds?: string[];
  errorCode?: string;
  statusCode?: number;
  latencyMs?: number;
}): Record<string, unknown> {
  const {
    agencyId,
    userId,
    stage,
    insertedCount,
    documentIds,
    ingestedCount,
    failedIds,
    errorCode,
    statusCode,
    latencyMs,
  } = args;

  return {
    agency_id: agencyId,
    client_id: null,
    user_id: userId,
    endpoint: "ai-seed-default-brain-pack",
    model: "default_brain_pack_v1",
    tokens_estimate: 0,
    tokens_in: 0,
    tokens_out: 0,
    latency_ms: latencyMs ?? null,
    unknown: false,
    status_code: statusCode ?? 200,
    error_code: errorCode ?? null,
    metadata: {
      stage,
      inserted_count: insertedCount ?? 0,
      document_ids: documentIds ?? [],
      ingested_count: ingestedCount ?? 0,
      failed_ids: failedIds ?? [],
    },
  };
}

