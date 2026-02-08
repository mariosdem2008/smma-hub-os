type CheckpointStatus = "pending" | "running" | "completed" | "failed";

type CheckpointInput = {
  planId: string;
  stepId: string;
  status: CheckpointStatus;
  agencyId: string;
  clientId?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown> | null;
};

export async function writeCheckpoint(supabase: any, input: CheckpointInput) {
  if (!supabase) return { ok: false, error: "supabase_missing" };
  const { error } = await supabase.from("ai_executor_checkpoints").insert({
    plan_id: input.planId,
    step_id: input.stepId,
    status: input.status,
    agency_id: input.agencyId,
    client_id: input.clientId ?? null,
    user_id: input.userId ?? null,
    payload: input.payload ?? null,
  });
  if (error) return { ok: false, error: error.message ?? "checkpoint_insert_failed" };
  return { ok: true };
}

export async function getLatestCheckpoint(supabase: any, planId: string) {
  if (!supabase) return { ok: false, error: "supabase_missing", data: null };
  const { data, error } = await supabase
    .from("ai_executor_checkpoints")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message ?? "checkpoint_fetch_failed", data: null };
  return { ok: true, data };
}
