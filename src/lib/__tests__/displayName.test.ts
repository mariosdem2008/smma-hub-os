import { describe, expect, it } from "vitest";
import { getDisplayName } from "../displayName";

describe("getDisplayName", () => {
  it("returns full name when available", () => {
    expect(getDisplayName({ full_name: "Alex Rivera", email: "alex@example.com" })).toBe("Alex Rivera");
  });

  it("returns email when name is missing", () => {
    expect(getDisplayName({ full_name: null, email: "alex@example.com" })).toBe("alex@example.com");
  });

  it("handles missing profile data for assigned vs unassigned", () => {
    expect(getDisplayName(null)).toBe("Team member");
    expect(getDisplayName(null, { unassigned: true })).toBe("Unassigned");
  });
});
