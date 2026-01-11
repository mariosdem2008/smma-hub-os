import { describe, expect, it, vi } from "vitest";
import { resolveAgencyAdminUserId } from "../agency-members.ts";

function makeSupabaseMock(rows: { adminUserId?: string | null; anyUserId?: string | null }) {
  const from = vi.fn((table: string) => {
    if (table !== "agency_members") throw new Error(`Unexpected table: ${table}`);
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: rows.adminUserId ? { user_id: rows.adminUserId } : null })),
              })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: rows.anyUserId ? { user_id: rows.anyUserId } : null })),
            })),
          })),
        })),
      })),
    };
  });

  return { from } as any;
}

describe("resolveAgencyAdminUserId", () => {
  it("returns an owner/admin user_id when present", async () => {
    const supabase = makeSupabaseMock({ adminUserId: "admin-1", anyUserId: "user-1" });
    await expect(resolveAgencyAdminUserId(supabase, "agency-1")).resolves.toBe("admin-1");
  });

  it("falls back to any member user_id when no admin exists", async () => {
    const supabase = makeSupabaseMock({ adminUserId: null, anyUserId: "user-1" });
    await expect(resolveAgencyAdminUserId(supabase, "agency-1")).resolves.toBe("user-1");
  });

  it("returns null when agency has no members", async () => {
    const supabase = makeSupabaseMock({ adminUserId: null, anyUserId: null });
    await expect(resolveAgencyAdminUserId(supabase, "agency-1")).resolves.toBeNull();
  });
});

