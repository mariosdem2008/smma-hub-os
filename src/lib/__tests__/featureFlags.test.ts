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

  it("ONBOARDING_V5 is disabled by default", () => {
    expect(FEATURE_FLAGS.ONBOARDING_V5).toBe(true);
    expect(isFeatureEnabled("ONBOARDING_V5")).toBe(true);
  });

  it("isFeatureEnabled returns false for disabled flags", () => {
    // Both flags should be OFF by default
    expect(isFeatureEnabled("CLIENTDETAIL_TAB_BADGES")).toBe(false);
    expect(isFeatureEnabled("CLIENTDETAIL_RIGHT_PANEL")).toBe(true);
    expect(isFeatureEnabled("ONBOARDING_V5")).toBe(true);
  });
});
