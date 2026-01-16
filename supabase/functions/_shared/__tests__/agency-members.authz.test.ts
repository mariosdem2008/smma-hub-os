import { describe, expect, it, vi } from "vitest";
import { isAgencyAdminOrOwner } from "../agency-members.ts";

function makeSupabaseMock(role: string | null) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "agency_members") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: role ? { agency_id: "agency-1", role } : null })),
              })),
            })),
          })),
        })),
      };
    }),
  };
}

describe("isAgencyAdminOrOwner", () => {
  it("returns false for member role", async () => {
    const supabase = makeSupabaseMock(null);
    await expect(isAgencyAdminOrOwner(supabase as any, "agency-1", "user-1")).resolves.toBe(false);
  });

  it("returns true for admin/owner", async () => {
    await expect(isAgencyAdminOrOwner(makeSupabaseMock("admin") as any, "agency-1", "user-1")).resolves.toBe(true);
    await expect(isAgencyAdminOrOwner(makeSupabaseMock("owner") as any, "agency-1", "user-1")).resolves.toBe(true);
  });
});

