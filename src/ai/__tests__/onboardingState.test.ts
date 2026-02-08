import { describe, expect, it } from "vitest";
import {
  applyCalibrationInput,
  evaluateOnboardingProgress,
  mergeDraftSnapshot,
  normalizeOnboardingSuggestions,
  resolveSnapshotValue,
} from "../onboardingState.ts";

describe("onboarding state helpers", () => {
  it("deep-merges draft snapshots", () => {
    const merged = mergeDraftSnapshot(
      {
        bootstrap: { agency_name: "Alpha Agency" },
        tone_voice: { voice_attributes: ["professional"] },
      },
      {
        bootstrap: { services: ["content", "ads"] },
        tone_voice: { voice_attributes: ["friendly"] },
      }
    );

    expect(merged.bootstrap).toEqual({
      agency_name: "Alpha Agency",
      services: ["content", "ads"],
    });
    expect(merged.tone_voice).toEqual({
      voice_attributes: ["friendly"],
    });
  });

  it("uses path aliases when resolving values", () => {
    const snapshot = {
      identity: {
        name: "Nexus Media",
        offers: ["SMM", "UGC"],
      },
    };
    expect(resolveSnapshotValue(snapshot, "bootstrap", "agency_name")).toBe("Nexus Media");
    expect(resolveSnapshotValue(snapshot, "bootstrap", "services")).toEqual(["SMM", "UGC"]);
  });

  it("returns deterministic 3-4 suggestions", () => {
    const snapshot = {
      bootstrap: {
        agency_name: "Prime Social",
        services: ["Paid social", "Creative testing"],
        target_industries: ["Ecommerce"],
      },
    };

    const suggestions = normalizeOnboardingSuggestions({
      rawSuggestions: ["Use an invented competitor detail not in context"],
      module: "bootstrap",
      snapshot,
    });

    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    expect(suggestions.some((value) => value.includes("Prime Social"))).toBe(true);
  });

  it("scopes suggestions to the missing field when provided", () => {
    const snapshot = {
      bootstrap: {
        agency_name: "Prime Social",
        services: ["Paid social", "Creative testing"],
      },
    };

    const suggestions = normalizeOnboardingSuggestions({
      module: "bootstrap",
      fieldPath: "agency_name",
      snapshot,
    });

    expect(suggestions.some((value) => value.toLowerCase().includes("agency name"))).toBe(true);
  });

  it("updates draft from calibration input and advances progress", () => {
    let snapshot: Record<string, unknown> = {};
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "agency_name", "Orbit Studio");
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "locale", "Europe/Athens, English");
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "team_size", "5");
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "active_clients", "8");
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "target_industries", "SaaS");
    snapshot = applyCalibrationInput(snapshot, "bootstrap", "services", "SMM, Content");
    snapshot = applyCalibrationInput(snapshot, "positioning", "icp_best", "B2B SaaS, $20k-$100k MRR");
    snapshot = applyCalibrationInput(snapshot, "positioning", "differentiators", "48h turnaround");
    snapshot = applyCalibrationInput(snapshot, "offer_stack", "core_offer_high_margin", "Content retainer");
    snapshot = applyCalibrationInput(snapshot, "offer_stack", "core_offers", "Retainer");
    snapshot = applyCalibrationInput(snapshot, "offer_stack", "pricing_model", "Fixed retainer");

    const progress = evaluateOnboardingProgress(snapshot);
    expect(progress.requiredComplete).toBe(true);
  });
});
