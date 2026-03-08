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
    expect(resolveSnapshotValue(snapshot, "agency", "name")).toBe("Nexus Media");
    expect(resolveSnapshotValue(snapshot, "agency", "service_catalog")).toEqual(["SMM", "UGC"]);
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
    snapshot = applyCalibrationInput(snapshot, "agency", "name", "Orbit Studio");
    snapshot = applyCalibrationInput(snapshot, "agency", "timezone", "Europe/Athens");
    snapshot = applyCalibrationInput(snapshot, "agency", "primary_client_languages", "English 80%, Greek 20%");
    snapshot = applyCalibrationInput(snapshot, "agency", "team_size_total", "5");
    snapshot = applyCalibrationInput(snapshot, "agency", "active_paying_clients", "8");
    snapshot = applyCalibrationInput(snapshot, "agency", "top_industries", "SaaS");
    snapshot = applyCalibrationInput(snapshot, "agency", "best_client_summary", "B2B SaaS founder at $40k MRR focused on qualified demo bookings.");
    snapshot = applyCalibrationInput(snapshot, "agency", "key_differentiators", "Fast turnarounds, Founder-led strategy, SaaS specialization");
    snapshot = applyCalibrationInput(snapshot, "agency", "service_catalog", "Paid Ads | Meta and Google campaign management");
    snapshot = applyCalibrationInput(snapshot, "agency", "top_margin_offers", "Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow");
    snapshot = applyCalibrationInput(snapshot, "agency", "packaged_offers", "Lead Engine | 40 leads/month | 12 creatives; ad mgmt; reporting | 30 days | 1500-2500");
    snapshot = applyCalibrationInput(snapshot, "agency", "pricing_model", "Fixed retainer | Predictable monthly workload and scope");

    const progress = evaluateOnboardingProgress(snapshot);
    expect(progress.requiredComplete).toBe(true);
  });
});
