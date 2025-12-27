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

export function getLockdownFailure(check: LockdownCheck): LockdownResult | null {
  if (!check.lockdownEnabled) return null;
  if (!check.hasAuthHeader || !check.isUserValid || !check.hasMembership) {
    return { status: 403, body: { error: "Endpoint locked down", code: "ENDPOINT_LOCKED_DOWN" } };
  }
  return null;
}
