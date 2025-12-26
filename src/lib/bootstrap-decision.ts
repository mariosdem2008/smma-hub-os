import type { UserAgencyBootstrap } from "@/lib/bootstrap";

export type BootstrapDecision =
  | { action: "go_welcome" }
  | { action: "go_select_agency" }
  | { action: "go_dashboard"; agencyId: string };

function uniqByAgencyId(items: { agency_id: string }[]) {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const item of items) {
    if (seen.has(item.agency_id)) continue;
    seen.add(item.agency_id);
    out.push(item);
  }
  return out;
}

export function decideBootstrap(
  bootstrap: UserAgencyBootstrap,
  activeAgencyId: string | null,
): BootstrapDecision {
  const memberships = uniqByAgencyId(bootstrap.memberships ?? []);
  if (memberships.length === 0) return { action: "go_welcome" };

  if (memberships.length === 1) return { action: "go_dashboard", agencyId: memberships[0].agency_id };

  if (activeAgencyId && memberships.some((m) => m.agency_id === activeAgencyId)) {
    return { action: "go_dashboard", agencyId: activeAgencyId };
  }

  return { action: "go_select_agency" };
}
