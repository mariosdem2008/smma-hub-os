type LockdownCheck = {
  lockdownEnabled: boolean;
  hasAuthHeader: boolean;
  isUserValid: boolean;
  hasMembership: boolean;
};

type LockdownResult = {
  status: number;
  body: { error: string; code: string };
};

type LogArgs = {
  supabase: { from: (table: string) => { insert: (payload: any) => Promise<unknown> } };
  endpoint: string;
  agencyId?: string;
  clientId?: string | null;
};

export function getLockdownFailure(check: LockdownCheck): LockdownResult | null {
  if (!check.lockdownEnabled) return null;
  if (!check.hasAuthHeader || !check.isUserValid || !check.hasMembership) {
    return { status: 403, body: { error: "Endpoint locked down", code: "ENDPOINT_LOCKED_DOWN" } };
  }
  return null;
}

export async function logLockdownAttempt({ supabase, endpoint, agencyId, clientId }: LogArgs) {
  if (!agencyId) return;
  try {
    await supabase.from("ai_usage_logs").insert({
      agency_id: agencyId,
      client_id: clientId ?? null,
      endpoint,
      status_code: 403,
      error_code: "ENDPOINT_LOCKED_DOWN",
    });
  } catch {
    // Best-effort logging only.
  }
}
