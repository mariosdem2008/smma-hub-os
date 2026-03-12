import { describe, expect, it } from "vitest";
import { getFieldLabel } from "../labels";

describe("onboarding labels", () => {
  it("returns known labels from map", () => {
    expect(getFieldLabel("q1_business_name")).toBe("Business name");
    expect(getFieldLabel("cadence_requirement")).toBe("Cadence");
  });

  it("falls back to underscore replacement for unknown fields", () => {
    expect(getFieldLabel("custom_unknown_field")).toBe("custom unknown field");
  });
});
