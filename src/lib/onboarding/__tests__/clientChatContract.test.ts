import { describe, expect, it } from "vitest";
import {
  getClientOnboardingCardByStep,
  getClientOnboardingCardStep,
  getNextClientOnboardingCard,
  validateCardPayload,
} from "../clientChatContract";

describe("clientChatContract", () => {
  it("returns deterministic card sequence step mapping", () => {
    const first = getClientOnboardingCardByStep(1);
    const last = getClientOnboardingCardByStep(999);
    expect(first.id).toBe("business_essentials_card");
    expect(last.id).toBe("review_card");
    expect(getClientOnboardingCardStep("channels_card")).toBe(8);
    expect(getNextClientOnboardingCard("channels_card").id).toBe("review_card");
  });

  it("validates business essentials requirements", () => {
    const invalid = validateCardPayload("business_essentials_card", {
      q1_business_name: "",
      industry_niche: "",
      q2_website: "",
      q2_social_links: [],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);

    const valid = validateCardPayload("business_essentials_card", {
      q1_business_name: "Northwave Fitness",
      industry_niche: "gym_fitness_studio",
      q2_website: "",
      q2_social_links: ["https://instagram.com/northwave"],
    });
    expect(valid.ok).toBe(true);
    expect(valid.updates.q1_business_name).toBe("Northwave Fitness");
  });

  it("enforces goal conversion conditional requirements", () => {
    const needsLink = validateCardPayload("goal_conversion_card", {
      primary_goal: "more_leads",
      conversion_path: "book_call",
      conversion_link: "",
    });
    expect(needsLink.ok).toBe(false);

    const needsDmKeyword = validateCardPayload("goal_conversion_card", {
      primary_goal: "more_dms",
      conversion_path: "dm_keyword",
      dm_keyword: "",
    });
    expect(needsDmKeyword.ok).toBe(false);

    const valid = validateCardPayload("goal_conversion_card", {
      primary_goal: "more_dms",
      conversion_path: "dm_keyword",
      dm_keyword: "BOOK",
    });
    expect(valid.ok).toBe(true);
  });

  it("maps channel mirrors for legacy fields", () => {
    const result = validateCardPayload("channels_card", {
      platforms: ["instagram", "tiktok"],
      formats: ["short_video"],
      cadence_preset: "standard",
      cadence_per_platform: {},
      response_handling: "owner",
    });
    expect(result.ok).toBe(true);
    expect(result.updates.platforms).toEqual(["instagram", "tiktok"]);
    expect(result.updates.q16_enabled_channels).toEqual(["instagram", "tiktok"]);
    expect(result.updates.q18_cadence).toEqual({ instagram: 5, tiktok: 5 });
  });
});

