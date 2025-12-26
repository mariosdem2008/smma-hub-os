import { describe, it, expect } from "vitest";
import { decideBootstrap } from "@/lib/bootstrap-decision";
import type { UserAgencyBootstrap } from "@/lib/bootstrap";

function b(partial: Partial<UserAgencyBootstrap>): UserAgencyBootstrap {
  return {
    memberships: [],
    pending_invites: [],
    last_agency_id: null,
    ...partial,
  };
}

describe("decideBootstrap", () => {
  it("routes to welcome when no memberships and no invites", () => {
    const decision = decideBootstrap(b({ memberships: [], pending_invites: [] }), null);
    expect(decision).toEqual({ action: "go_welcome" });
  });

  it("routes to dashboard when exactly one membership", () => {
    const decision = decideBootstrap(
      b({ memberships: [{ agency_id: "a1", role: "owner", agency_name: "A", is_owner: true }] as any }),
      null,
    );
    expect(decision).toEqual({ action: "go_dashboard", agencyId: "a1" });
  });

  it("routes to select-agency when multiple memberships and no active selection", () => {
    const decision = decideBootstrap(
      b({
        memberships: [
          { agency_id: "a1", role: "member", agency_name: "A", is_owner: false },
          { agency_id: "a2", role: "member", agency_name: "B", is_owner: false },
        ] as any,
      }),
      null,
    );
    expect(decision).toEqual({ action: "go_select_agency" });
  });

  it("routes to dashboard when active agency is present and valid", () => {
    const decision = decideBootstrap(
      b({
        memberships: [
          { agency_id: "a1", role: "member", agency_name: "A", is_owner: false },
          { agency_id: "a2", role: "member", agency_name: "B", is_owner: false },
        ] as any,
      }),
      "a2",
    );
    expect(decision).toEqual({ action: "go_dashboard", agencyId: "a2" });
  });
});
