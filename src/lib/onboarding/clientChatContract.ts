import type { CadenceMap, OnboardingOffer, OnboardingProfile, SocialChannel } from "@/types/onboarding";
import type { OnboardingCollectionStage } from "./progress";

export type ClientOnboardingCardId =
  | "business_essentials_card"
  | "market_scope_card"
  | "goal_conversion_card"
  | "offers_card"
  | "operations_setup_card"
  | "audience_card"
  | "brand_card"
  | "proof_card"
  | "channels_card"
  | "review_card";

export interface ClientOnboardingCardSpec {
  id: ClientOnboardingCardId;
  title: string;
  description: string;
  stage: OnboardingCollectionStage;
  stageLabel: string;
  completionMode: "blocking_now" | "required_before_execution" | "collect_later";
  submitLabel: string;
  fields: string[];
}

export interface ClientOnboardingSavedSummary {
  savedFields: string[];
  summary: string;
}

const CARD_SEQUENCE: ClientOnboardingCardSpec[] = [
  {
    id: "business_essentials_card",
    title: "Business snapshot",
    description: "Start with the basics: what the business is, where it lives online, and how we should frame it.",
    stage: "essential_intake",
    stageLabel: "Essential intake",
    completionMode: "blocking_now",
    submitLabel: "Save and continue",
    fields: ["q1_business_name", "industry_niche", "q2_website", "q2_social_links"],
  },
  {
    id: "market_scope_card",
    title: "Market focus",
    description: "Confirm where the business is selling and the market context we should plan around.",
    stage: "essential_intake",
    stageLabel: "Essential intake",
    completionMode: "blocking_now",
    submitLabel: "Save and continue",
    fields: ["q3_market_scope", "q3_country", "q3_city", "q4_languages"],
  },
  {
    id: "goal_conversion_card",
    title: "Business goal",
    description: "Set the main result the client wants and the exact action marketing should drive.",
    stage: "essential_intake",
    stageLabel: "Essential intake",
    completionMode: "blocking_now",
    submitLabel: "Save and continue",
    fields: ["primary_goal", "conversion_path", "conversion_link", "dm_keyword"],
  },
  {
    id: "offers_card",
    title: "Priority offer",
    description: "Lock the offer we should prioritize first so the workspace starts with a clear commercial focus.",
    stage: "essential_intake",
    stageLabel: "Essential intake",
    completionMode: "blocking_now",
    submitLabel: "Save and continue",
    fields: ["offers", "q6_offer_name", "q6_price_min", "q6_price_max"],
  },
  {
    id: "operations_setup_card",
    title: "Operating setup",
    description: "Capture the day-to-day contact, approver, timing, and setup blockers so delivery can run without chaos.",
    stage: "operations_setup",
    stageLabel: "Operations setup",
    completionMode: "required_before_execution",
    submitLabel: "Save and continue",
    fields: [
      "primary_contact_name",
      "primary_contact_role",
      "primary_contact_email",
      "main_approver_name",
      "main_approver_role",
      "approval_sla",
      "preferred_comms_channel",
      "launch_window",
      "required_access_status",
      "missing_assets",
      "escalation_contact",
    ],
  },
  {
    id: "audience_card",
    title: "Audience context",
    description: "Add the main buyer and the friction points that matter most. This improves strategy quality but can be refined later.",
    stage: "progressive_enrichment",
    stageLabel: "Progressive enrichment",
    completionMode: "collect_later",
    submitLabel: "Save and continue",
    fields: ["audience_type", "primary_customer", "main_objection", "q9_pain_points"],
  },
  {
    id: "brand_card",
    title: "Brand direction",
    description: "Capture creative direction and production constraints. Keep this practical rather than overly abstract.",
    stage: "operations_setup",
    stageLabel: "Operations setup",
    completionMode: "required_before_execution",
    submitLabel: "Save and continue",
    fields: ["brand_voice", "content_style", "on_camera_availability", "available_assets"],
  },
  {
    id: "proof_card",
    title: "Proof and references",
    description: "Add proof, competitor context, and differentiators to strengthen recommendations over time.",
    stage: "progressive_enrichment",
    stageLabel: "Progressive enrichment",
    completionMode: "collect_later",
    submitLabel: "Save and continue",
    fields: ["proof_types", "competitor_link", "q13_differentiators"],
  },
  {
    id: "channels_card",
    title: "Channels and delivery",
    description: "Set the active channels, content mix, and operating rhythm required for execution readiness.",
    stage: "operations_setup",
    stageLabel: "Operations setup",
    completionMode: "required_before_execution",
    submitLabel: "Save and continue",
    fields: ["platforms", "formats", "cadence_preset", "cadence_per_platform", "response_handling"],
  },
  {
    id: "review_card",
    title: "Workspace review",
    description: "Review the essentials, confirm the workspace is usable, and continue into strategy generation.",
    stage: "essential_intake",
    stageLabel: "Essential intake",
    completionMode: "blocking_now",
    submitLabel: "Generate strategy",
    fields: [],
  },
];

const SOCIAL_CHANNELS = new Set<SocialChannel>([
  "instagram",
  "tiktok",
  "youtube",
  "youtube_shorts",
  "linkedin",
  "facebook",
  "google_business_profile",
  "pinterest",
  "x",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getClientOnboardingCards() {
  return CARD_SEQUENCE;
}

export function getEssentialIntakeCards() {
  return CARD_SEQUENCE.filter((card) => card.stage === "essential_intake");
}

export function getOperationsSetupCards() {
  return CARD_SEQUENCE.filter((card) => card.stage === "operations_setup");
}

export function getCollectLaterCards() {
  return CARD_SEQUENCE.filter((card) => card.stage === "progressive_enrichment");
}

export function getCardsForStage(stage: OnboardingCollectionStage) {
  if (stage === "essential_intake") return getEssentialIntakeCards();
  if (stage === "operations_setup") return getOperationsSetupCards();
  return getCollectLaterCards();
}

export function getFirstCardForStage(stage: OnboardingCollectionStage) {
  return getCardsForStage(stage)[0] ?? CARD_SEQUENCE[0];
}

export function getNextCardForStage(cardId: ClientOnboardingCardId, stage: OnboardingCollectionStage) {
  const stageCards = getCardsForStage(stage);
  const idx = stageCards.findIndex((card) => card.id === cardId);
  if (idx < 0 || idx >= stageCards.length - 1) return null;
  return stageCards[idx + 1];
}

export function getClientOnboardingCardTotal() {
  return CARD_SEQUENCE.length;
}

export function getClientOnboardingCardByStep(step: number) {
  if (step <= 1) return CARD_SEQUENCE[0];
  if (step >= CARD_SEQUENCE.length) return CARD_SEQUENCE[CARD_SEQUENCE.length - 1];
  return CARD_SEQUENCE[step - 1];
}

export function getClientOnboardingCardStep(cardId: ClientOnboardingCardId) {
  const idx = CARD_SEQUENCE.findIndex((card) => card.id === cardId);
  return idx >= 0 ? idx + 1 : 1;
}

export function getNextClientOnboardingCard(cardId: ClientOnboardingCardId) {
  const step = getClientOnboardingCardStep(cardId);
  return getClientOnboardingCardByStep(step + 1);
}

export type CardValidationResult = {
  ok: boolean;
  errors: string[];
  updates: Partial<OnboardingProfile>;
};

function validateBusinessEssentials(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const q1_business_name = asString(payload.q1_business_name);
  const industry_niche = asString(payload.industry_niche);
  const q2_website = asString(payload.q2_website);
  const q2_social_links = asStringArray(payload.q2_social_links);

  if (!q1_business_name) errors.push("Business name is required.");
  if (!industry_niche) errors.push("Industry / niche is required.");
  if (!q2_website && q2_social_links.length === 0) errors.push("Website or main social profile is required.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      q1_business_name,
      industry_niche: industry_niche as OnboardingProfile["industry_niche"],
      q2_website,
      q2_social_links: q2_social_links.length > 0 ? q2_social_links : null,
    },
  };
}

function validateMarketScope(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const q3_market_scope = asString(payload.q3_market_scope);
  const q3_country = asString(payload.q3_country);
  const q3_city = asString(payload.q3_city);
  const q4_languages = asStringArray(payload.q4_languages);

  if (!q3_market_scope) errors.push("Market scope is required.");
  if (q3_market_scope === "local" && (!q3_country || !q3_city)) {
    errors.push("Country and city are required for local market scope.");
  }
  if (q4_languages.length === 0) errors.push("At least one language is required.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      q3_market_scope: q3_market_scope as OnboardingProfile["q3_market_scope"],
      q3_country,
      q3_city,
      q4_languages: q4_languages.length > 0 ? q4_languages : null,
    },
  };
}

function validateGoalConversion(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const primary_goal = asString(payload.primary_goal);
  const conversion_path = asString(payload.conversion_path);
  const conversion_link = asString(payload.conversion_link);
  const dm_keyword = asString(payload.dm_keyword);

  if (!primary_goal) errors.push("Primary goal is required.");
  if (!conversion_path) errors.push("Conversion path is required.");

  if (conversion_path && ["book_call", "book_appointment", "website_checkout"].includes(conversion_path) && !conversion_link) {
    errors.push("Conversion link is required for this conversion path.");
  }
  if (conversion_path === "dm_keyword" && !dm_keyword) errors.push("DM keyword is required for dm_keyword path.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      primary_goal: primary_goal as OnboardingProfile["primary_goal"],
      conversion_path: conversion_path as OnboardingProfile["conversion_path"],
      conversion_link,
      dm_keyword,
    },
  };
}

function normalizeOffers(raw: unknown): OnboardingOffer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => asRecord(item))
    .map((row) => {
      const type = asString(row.type) ?? "best_seller";
      const name = asString(row.name) ?? "";
      const price_min = asNumber(row.price_min);
      const price_max = asNumber(row.price_max);
      const promise = asString(row.promise);
      return {
        type: type as OnboardingOffer["type"],
        name,
        price_min,
        price_max,
        promise,
      };
    })
    .filter((offer) => offer.name.trim().length > 0);
}

function validateOffers(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const offers = normalizeOffers(payload.offers);
  if (offers.length === 0) errors.push("At least one offer is required.");
  if (offers.length > 3) errors.push("Maximum 3 offers are allowed.");

  const first = offers[0];
  return {
    ok: errors.length === 0,
    errors,
    updates: {
      offers: offers.length > 0 ? offers : null,
      q6_offer_name: first?.name ?? null,
      q6_price_min: first?.price_min ?? null,
      q6_price_max: first?.price_max ?? null,
    },
  };
}

function validateOperationsSetup(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const primary_contact_name = asString(payload.primary_contact_name);
  const primary_contact_role = asString(payload.primary_contact_role);
  const primary_contact_email = asString(payload.primary_contact_email);
  const main_approver_name = asString(payload.main_approver_name);
  const main_approver_role = asString(payload.main_approver_role);
  const approval_sla = asString(payload.approval_sla);
  const preferred_comms_channel = asString(payload.preferred_comms_channel);
  const launch_window = asString(payload.launch_window);
  const escalation_contact = asString(payload.escalation_contact);
  const required_access_status = asStringArray(payload.required_access_status);
  const missing_assets = asStringArray(payload.missing_assets);

  if (!primary_contact_name) errors.push("Primary contact is required.");
  if (!main_approver_name) errors.push("Main approver is required.");
  if (!preferred_comms_channel) errors.push("Preferred communication channel is required.");
  if (!launch_window) errors.push("Launch window or timing note is required.");
  if (required_access_status.length === 0) errors.push("At least one access status is required.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      v5_meta: {
        operations_setup: {
          primary_contact_name,
          primary_contact_role,
          primary_contact_email,
          main_approver_name,
          main_approver_role,
          approval_sla,
          preferred_comms_channel,
          launch_window,
          required_access_status,
          missing_assets,
          escalation_contact,
          updated_at: new Date().toISOString(),
        },
      } as OnboardingProfile["v5_meta"],
    },
  };
}

function validateAudience(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const audience_type = asString(payload.audience_type);
  const primary_customer = asString(payload.primary_customer);
  const main_objection = asString(payload.main_objection);
  const q9_pain_points = asStringArray(payload.q9_pain_points);

  if (!audience_type) errors.push("Audience type is required.");
  if (!primary_customer) errors.push("Primary customer is required.");
  if (!main_objection) errors.push("Main objection is required.");
  if (q9_pain_points.length < 3) errors.push("Exactly 3 pain points are required.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      audience_type: audience_type as OnboardingProfile["audience_type"],
      primary_customer,
      main_objection: main_objection as OnboardingProfile["main_objection"],
      q9_pain_points: q9_pain_points.slice(0, 3),
    },
  };
}

function validateBrand(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const brand_voice = asStringArray(payload.brand_voice);
  const content_style = asStringArray(payload.content_style);
  const on_camera_availability = asString(payload.on_camera_availability);
  const available_assets = asStringArray(payload.available_assets);

  if (brand_voice.length < 2) errors.push("At least 2 brand voice traits are required.");
  if (content_style.length < 1) errors.push("At least 1 content style is required.");
  if (!on_camera_availability) errors.push("On-camera availability is required.");
  if (available_assets.length < 1) errors.push("At least 1 available asset is required.");

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      brand_voice: brand_voice as OnboardingProfile["brand_voice"],
      content_style: content_style as OnboardingProfile["content_style"],
      on_camera_availability: on_camera_availability as OnboardingProfile["on_camera_availability"],
      available_assets: available_assets as OnboardingProfile["available_assets"],
    },
  };
}

function validateProof(payload: Record<string, unknown>): CardValidationResult {
  const proof_types = asStringArray(payload.proof_types);
  const competitor_link = asString(payload.competitor_link);
  const q13_differentiators = asStringArray(payload.q13_differentiators);
  return {
    ok: true,
    errors: [],
    updates: {
      proof_types: proof_types.length > 0 ? (proof_types as OnboardingProfile["proof_types"]) : null,
      competitor_link,
      q13_differentiators: q13_differentiators.length > 0 ? q13_differentiators : null,
    },
  };
}

function normalizePlatforms(raw: unknown): SocialChannel[] {
  return asStringArray(raw)
    .filter((item): item is SocialChannel => SOCIAL_CHANNELS.has(item as SocialChannel));
}

function normalizeCadence(raw: unknown, platforms: SocialChannel[]): CadenceMap {
  const record = asRecord(raw);
  const map: CadenceMap = {};
  for (const platform of platforms) {
    const value = asNumber(record[platform]);
    if (value && value > 0) map[platform] = value;
  }
  return map;
}

function validateChannels(payload: Record<string, unknown>): CardValidationResult {
  const errors: string[] = [];
  const platforms = normalizePlatforms(payload.platforms);
  const formats = asStringArray(payload.formats);
  const cadence_preset = asString(payload.cadence_preset);
  const response_handling = asString(payload.response_handling);
  const cadence_per_platform = normalizeCadence(payload.cadence_per_platform, platforms);

  if (platforms.length < 1) errors.push("At least one platform is required.");
  if (formats.length < 1) errors.push("At least one content format is required.");
  if (!cadence_preset) errors.push("Cadence preset is required.");
  if (cadence_preset === "custom" && Object.keys(cadence_per_platform).length === 0) {
    errors.push("Custom cadence requires at least one platform cadence value.");
  }

  const cadencePayload =
    cadence_preset === "custom"
      ? cadence_per_platform
      : platforms.reduce((acc, platform) => {
          acc[platform] = cadence_preset === "light" ? 3 : cadence_preset === "aggressive" ? 8 : 5;
          return acc;
        }, {} as CadenceMap);

  return {
    ok: errors.length === 0,
    errors,
    updates: {
      platforms: platforms.length > 0 ? platforms : null,
      q16_enabled_channels: platforms.length > 0 ? platforms : null,
      formats: formats.length > 0 ? formats : null,
      cadence_preset: cadence_preset as OnboardingProfile["cadence_preset"],
      cadence_per_platform: cadencePayload,
      q18_cadence: cadencePayload,
      response_handling: response_handling as OnboardingProfile["response_handling"],
    },
  };
}

export function validateCardPayload(cardId: ClientOnboardingCardId, payload: unknown): CardValidationResult {
  const record = asRecord(payload);
  switch (cardId) {
    case "business_essentials_card":
      return validateBusinessEssentials(record);
    case "market_scope_card":
      return validateMarketScope(record);
    case "goal_conversion_card":
      return validateGoalConversion(record);
    case "offers_card":
      return validateOffers(record);
    case "operations_setup_card":
      return validateOperationsSetup(record);
    case "audience_card":
      return validateAudience(record);
    case "brand_card":
      return validateBrand(record);
    case "proof_card":
      return validateProof(record);
    case "channels_card":
      return validateChannels(record);
    case "review_card":
      return { ok: true, errors: [], updates: {} };
    default:
      return { ok: false, errors: ["Unsupported card."], updates: {} };
  }
}

export function buildSavedSummary(
  cardId: ClientOnboardingCardId,
  updates: Partial<OnboardingProfile>,
): ClientOnboardingSavedSummary {
  switch (cardId) {
    case "business_essentials_card": {
      const parts: string[] = [];
      if (updates.q1_business_name) parts.push(`Saved business name as "${updates.q1_business_name}".`);
      if (updates.industry_niche) parts.push(`Locked in the niche and online presence basics.`);
      return {
        savedFields: ["q1_business_name", "industry_niche", "q2_website", "q2_social_links"],
        summary: parts.join(" ") || "Saved the business essentials.",
      };
    }
    case "market_scope_card":
      return {
        savedFields: ["q3_market_scope", "q3_country", "q3_city", "q4_languages"],
        summary: "Saved market scope, location, and language context.",
      };
    case "goal_conversion_card":
      return {
        savedFields: ["primary_goal", "conversion_path", "conversion_link", "dm_keyword"],
        summary: "Saved the primary goal and the exact conversion path we should optimize for.",
      };
    case "offers_card": {
      const offerName = typeof updates.q6_offer_name === "string" ? updates.q6_offer_name : null;
      return {
        savedFields: ["offers", "q6_offer_name", "q6_price_min", "q6_price_max"],
        summary: offerName
          ? `Saved the core offer around "${offerName}".`
          : "Saved the core offer details.",
        };
      }
    case "operations_setup_card":
      return {
        savedFields: [
          "primary_contact_name",
          "main_approver_name",
          "preferred_comms_channel",
          "launch_window",
          "required_access_status",
          "missing_assets",
        ],
        summary: "Saved the operating setup: contacts, approvals, timing, and readiness blockers.",
      };
    case "audience_card":
      return {
        savedFields: ["audience_type", "primary_customer", "main_objection", "q9_pain_points"],
        summary: "Saved who the client serves, the main objection, and the biggest pain points.",
      };
    case "brand_card":
      return {
        savedFields: ["brand_voice", "content_style", "on_camera_availability", "available_assets"],
        summary: "Saved voice, content style, on-camera constraints, and available assets.",
      };
    case "proof_card":
      return {
        savedFields: ["proof_types", "competitor_link", "q13_differentiators"],
        summary: "Saved proof points, competitor context, and differentiators.",
      };
    case "channels_card":
      return {
        savedFields: ["platforms", "formats", "cadence_preset", "cadence_per_platform", "response_handling"],
        summary: "Saved platforms, formats, cadence, and response handling preferences.",
      };
    case "review_card":
      return {
        savedFields: [],
        summary: "Final review confirmed. Preparing the client workspace now.",
      };
    default:
      return {
        savedFields: [],
        summary: "Saved the latest onboarding details.",
      };
  }
}
