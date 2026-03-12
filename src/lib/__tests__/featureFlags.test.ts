import { describe, expect, it } from "vitest";
import { isFeatureEnabled, FEATURE_FLAGS } from "../featureFlags";

describe("featureFlags", () => {
  it("CLIENTDETAIL_TAB_BADGES is disabled by default", () => {
    expect(FEATURE_FLAGS.CLIENTDETAIL_TAB_BADGES).toBe(false);
    expect(isFeatureEnabled("CLIENTDETAIL_TAB_BADGES")).toBe(false);
  });

  it("CLIENTDETAIL_RIGHT_PANEL is disabled by default", () => {
    expect(FEATURE_FLAGS.CLIENTDETAIL_RIGHT_PANEL).toBe(true);
    expect(isFeatureEnabled("CLIENTDETAIL_RIGHT_PANEL")).toBe(true);
  });

  it("isFeatureEnabled returns expected defaults", () => {
    expect(isFeatureEnabled("CLIENTDETAIL_TAB_BADGES")).toBe(false);
    expect(isFeatureEnabled("CLIENTDETAIL_RIGHT_PANEL")).toBe(true);
  });
});
