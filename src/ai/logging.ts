import { TaskType } from "./taskTypes.ts"

type MinimalSupabase = {
  from: (table: string) => any;
};

export type UsageLogInput = {
  taskType: TaskType;
  endpoint: string;
  provider: string;
  model: string;
  agencyId?: string | null;
  clientId?: string | null;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  unknown?: boolean;
  success: boolean;
  errorCode?: string | null;
};

export async function logUsage(supabase: MinimalSupabase | null, input: UsageLogInput) {
  if (!supabase) return;
  await supabase.from("ai_usage_logs").insert({
    agency_id: input.agencyId ?? null,
    client_id: input.clientId ?? null,
    endpoint: input.endpoint,
    model: input.model,
    tokens_estimate: input.tokensIn ?? 0,
    tokens_in: input.tokensIn ?? 0,
    tokens_out: input.tokensOut ?? 0,
    latency_ms: input.latencyMs,
    unknown: input.unknown ?? false,
  });
}
