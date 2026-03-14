import { describe, expect, it } from "vitest";
import { getOnboardingFieldClassifications, getOnboardingJourneySummary, getSectionRequirementSummary, getV5ProgressSummary } from "../progress";
import type { OnboardingProfile } from "@/types/onboarding";

describe("onboarding progress", () => {
  it("returns expected missing basics fields", () => {
    const summary = getSectionRequirementSummary(
      {
        q1_business_name: "Acme",
        q2_website: "",
        q2_social_links: [],
      },
      "basics"
    );

    expect(summary.total).toBe(6);
    expect(summary.missing).toContain("industry_niche");
    expect(summary.missing).toContain("q2_website_or_socials");
  });

  it("computes readiness percent and missing fields", () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: "Acme",
      industry_niche: "other",
      primary_goal: "more_leads",
      conversion_path: "book_call",
      conversion_link: "https://example.com/book",
      offers: [{ type: "best_seller", name: "Core Offer", promise: "results_focused" }],
      primary_customer: "Local business owners",
      q9_pain_points: ["No leads", "Low reach", "Weak conversion"],
      platforms: ["instagram"],
      formats: ["short_video"],
      cadence_preset: "standard",
      brand_voice: ["professional", "friendly"],
      content_style: ["educational_tips"],
    };
    const summary = getV5ProgressSummary(profile);

    expect(summary.totalPercent).toBe(100);
    expect(summary.missingFields).toEqual([]);
  });

  it("computes staged journey readiness separately from legacy completion", () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: "Acme",
      industry_niche: "other",
      q2_website: "https://example.com",
      q3_market_scope: "national",
      q4_languages: ["english"],
      primary_goal: "more_leads",
      conversion_path: "book_call",
      conversion_link: "https://example.com/book",
      offers: [{ type: "best_seller", name: "Core Offer", promise: "results_focused" }],
      primary_customer: "Local business owners",
      platforms: ["instagram"],
      available_assets: ["existing_photos"],
    };

    const journey = getOnboardingJourneySummary(profile);

    expect(journey.state).toBe("setup_usable");
    expect(journey.essentialIntake.percent).toBe(100);
    expect(journey.operationsSetup.missing).toContain("formats");
  });

  it("exposes field classifications for staged onboarding", () => {
    const classifications = getOnboardingFieldClassifications();
    expect(classifications.find((item) => item.field === "q1_business_name")?.stage).toBe("essential_intake");
    expect(classifications.find((item) => item.field === "response_handling")?.stage).toBe("operations_setup");
    expect(classifications.find((item) => item.field === "brand_voice")?.stage).toBe("progressive_enrichment");
  });
});
