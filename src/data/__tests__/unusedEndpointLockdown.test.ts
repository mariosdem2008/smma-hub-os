import { describe, expect, it } from "vitest";
import { getLockdownFailure } from "../../../supabase/functions/_shared/lockdown";

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
