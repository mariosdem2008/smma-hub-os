import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/data/supabase")>("@/data/supabase");
  return {
    ...actual,
    db: {
      rpc: vi.fn(),
    },
  };
});

import { getClientBrainStatus } from "@/data";
import { db } from "@/data/supabase";

describe("getClientBrainStatus", () => {
  beforeEach(() => {
    vi.mocked(db.rpc).mockReset();
  });

  it("returns unusable when RPC reports unusable", async () => {
    vi.mocked(db.rpc).mockResolvedValue({
      data: [
        {
          client_id: "client-1",
          usable: false,
          missing_fields_count: 2,
          missing_fields: ["brand_basics.name", "goals"],
          status: "draft",
          locked: false,
          version: 1,
          updated_at: "2025-12-24T00:00:00Z",
        },
      ],
      error: null,
    } as any);

    const result = await getClientBrainStatus("client-1");

    expect(result.usable).toBe(false);
    expect(result.missingFieldsCount).toBe(2);
    expect(result.missingFields).toEqual(["brand_basics.name", "goals"]);
  });

  it("returns usable when RPC reports usable", async () => {
    vi.mocked(db.rpc).mockResolvedValue({
      data: [
        {
          client_id: "client-1",
          usable: true,
          missing_fields_count: 0,
          missing_fields: [],
          status: "usable",
          locked: true,
          version: 1,
          updated_at: "2025-12-24T00:00:00Z",
        },
      ],
      error: null,
    } as any);

    const result = await getClientBrainStatus("client-1");

    expect(result.usable).toBe(true);
    expect(result.missingFieldsCount).toBe(0);
    expect(result.missingFields).toEqual([]);
  });

  it("returns onboarding-not-started when RPC returns null", async () => {
    vi.mocked(db.rpc).mockResolvedValue({ data: null, error: null } as any);

    const result = await getClientBrainStatus("client-1");

    expect(result.usable).toBe(false);
    expect(result.missingFieldsCount).toBe(1);
    expect(result.missingFields).toEqual(["onboarding_not_started"]);
  });
});