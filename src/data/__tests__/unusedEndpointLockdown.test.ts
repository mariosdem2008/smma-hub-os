import { describe, expect, it } from "vitest";
import { getLockdownFailure, logLockdownAttempt } from "../../../supabase/functions/_shared/lockdown";

describe("unused endpoint lockdown guard", () => {
  it("ai-retrieve-context returns 403 when lockdown enabled and unauthenticated", () => {
    const result = getLockdownFailure({
      lockdownEnabled: true,
      hasAuthHeader: false,
      isUserValid: false,
      hasMembership: false,
    });

    expect(result?.status).toBe(403);
    expect(result?.body.code).toBe("ENDPOINT_LOCKED_DOWN");
  });

  it("logs lockdown attempts for unauthenticated requests when flag is on", async () => {
    const inserts: any[] = [];
    const supabase = {
      from: () => ({
        insert: async (payload: any) => {
          inserts.push(payload);
          return { data: null, error: null };
        },
      }),
    };

    const result = getLockdownFailure({
      lockdownEnabled: true,
      hasAuthHeader: false,
      isUserValid: false,
      hasMembership: false,
    });

    expect(result?.status).toBe(403);

    await logLockdownAttempt({
      supabase,
      endpoint: "ai-retrieve-context",
      agencyId: "agency-1",
      clientId: null,
    });

    expect(inserts[0]).toMatchObject({
      endpoint: "ai-retrieve-context",
      status_code: 403,
      error_code: "ENDPOINT_LOCKED_DOWN",
    });
  });

  it("ai-documents-ingest proceeds when lockdown disabled", () => {
    const result = getLockdownFailure({
      lockdownEnabled: false,
      hasAuthHeader: false,
      isUserValid: false,
      hasMembership: false,
    });

    expect(result).toBeNull();
  });
});
