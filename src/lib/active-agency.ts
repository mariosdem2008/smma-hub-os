const KEY = "activeAgencyId";

export function getActiveAgencyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveAgencyId(agencyId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, agencyId);
  } catch {
    // ignore
  }
}

export function clearActiveAgencyId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

