import type { ChatMessage } from "../providers/types.ts";

type OfferArgs = {
  website: string;
  niche: string;
};

type AudienceArgs = {
  niche: string;
  offers: string[];
};

type DifferentiatorArgs = {
  brand: string;
  niche: string;
};

export function buildOnboardingOffersPrompt(args: OfferArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a marketing strategist. Generate 8 concise offer descriptions (max 6 words each) based on website/niche. Return ONLY valid JSON array: [{\"id\":\"offer1\",\"label\":\"...\"},...]. No markdown, no explanation.",
    },
    {
      role: "user",
      content: `Website: ${args.website}\nNiche: ${args.niche}\n\nGenerate 8 typical offers/services for this business.`,
    },
  ];
}

export function buildOnboardingAudiencePrompt(args: AudienceArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a marketing strategist. Generate 5 target audience personas (max 8 words each) based on niche/offers. Return ONLY valid JSON array: [{\"id\":\"persona1\",\"label\":\"...\"},...]. No markdown.",
    },
    {
      role: "user",
      content: `Niche: ${args.niche}\nOffers: ${args.offers.join(", ")}\n\nGenerate 5 target audience personas.`,
    },
  ];
}

export function buildOnboardingDifferentiatorsPrompt(args: DifferentiatorArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a marketing strategist. Generate 6 potential brand differentiators (max 10 words each) based on brand/niche. Return ONLY valid JSON array: [{\"id\":\"diff1\",\"label\":\"...\"},...]. No markdown.",
    },
    {
      role: "user",
      content: `Brand: ${args.brand}\nNiche: ${args.niche}\n\nGenerate 6 potential differentiators.`,
    },
  ];
}
