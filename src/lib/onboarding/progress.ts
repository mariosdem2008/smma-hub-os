import type { CadenceMap, OnboardingProfile } from "@/types/onboarding";

export type V5SectionId =
  | "basics"
  | "goal"
  | "offers"
  | "audience"
  | "brand"
  | "proof"
  | "channels"
  | "review";

export type OnboardingCollectionStage =
  | "essential_intake"
  | "operations_setup"
  | "progressive_enrichment";

export type OnboardingJourneyState =
  | "draft_started"
  | "setup_usable"
  | "execution_ready"
  | "strategy_enriched";

export interface SectionProgress {
  sectionId: V5SectionId;
  completed: number;
  total: number;
  percent: number;
}

export interface StageProgress {
  stage: OnboardingCollectionStage;
  completed: number;
  total: number;
  percent: number;
  missing: string[];
}

export interface OnboardingFieldClassification {
  field: string;
  stage: OnboardingCollectionStage;
  rationale: string;
}

export interface OnboardingJourneySummary {
  state: OnboardingJourneyState;
  essentialIntake: StageProgress;
  operationsSetup: StageProgress;
  progressiveEnrichment: StageProgress;
}

export interface V5ProgressSummary {
  perSection: Record<V5SectionId, SectionProgress>;
  requiredPerSection: Record<V5SectionId, { completed: number; total: number; missing: string[] }>;
  totalPercent: number;
  missingFields: string[];
  journey: OnboardingJourneySummary;
}

const SECTION_REQUIRED_FIELDS: Record<V5SectionId, string[]> = {
  basics: ["q1_business_name", "industry_niche", "q3_market_scope", "q3_geo", "q2_website_or_socials", "q4_languages"],
  goal: ["primary_goal", "conversion_path", "conversion_link_required", "dm_keyword_required"],
  offers: ["offers"],
  audience: ["audience_type", "primary_customer", "main_objection", "q9_pain_points"],
  brand: ["brand_voice", "content_style", "on_camera_availability", "available_assets"],
  proof: [],
  channels: ["platforms", "formats", "cadence_requirement"],
  review: [],
};

const READINESS_FIELDS = [
  "q1_business_name",
  "industry_niche",
  "primary_goal",
  "conversion_path",
  "conversion_link_required",
  "dm_keyword_required",
  "offers",
  "primary_customer",
  "q9_pain_points",
  "platforms",
  "cadence_requirement",
  "brand_voice",
  "content_style",
] as const;

const ESSENTIAL_INTAKE_FIELDS = [
  "q1_business_name",
  "industry_niche",
  "q2_website_or_socials",
  "q3_market_scope",
  "q3_geo",
  "primary_goal",
  "conversion_path",
  "conversion_link_required",
  "dm_keyword_required",
  "offers",
  "primary_customer",
  "platforms",
  "available_assets",
] as const;

const OPERATIONS_SETUP_FIELDS = [
  "ops_primary_contact",
  "ops_main_approver",
  "ops_preferred_comms",
  "ops_launch_window",
  "ops_access_status",
  "ops_missing_assets",
  "q4_languages",
  "formats",
  "cadence_requirement",
  "on_camera_availability",
  "response_handling",
] as const;

const PROGRESSIVE_ENRICHMENT_FIELDS = [
  "audience_type",
  "main_objection",
  "q9_pain_points",
  "brand_voice",
  "content_style",
  "proof_types",
  "competitor_link",
  "q13_differentiators",
] as const;

const FIELD_CLASSIFICATIONS: OnboardingFieldClassification[] = [
  { field: "q1_business_name", stage: "essential_intake", rationale: "Core client identity needed immediately." },
  { field: "industry_niche", stage: "essential_intake", rationale: "Needed to ground initial planning and positioning." },
  { field: "q2_website_or_socials", stage: "essential_intake", rationale: "Needed to identify the live business presence." },
  { field: "q3_market_scope", stage: "essential_intake", rationale: "Defines the target market frame from the start." },
  { field: "q3_geo", stage: "essential_intake", rationale: "Local businesses need explicit geographic context." },
  { field: "primary_goal", stage: "essential_intake", rationale: "Needed to choose the correct initial growth direction." },
  { field: "conversion_path", stage: "essential_intake", rationale: "Needed to know the main action the funnel should drive." },
  { field: "conversion_link_required", stage: "essential_intake", rationale: "Needed when conversion happens on a booking or checkout destination." },
  { field: "dm_keyword_required", stage: "essential_intake", rationale: "Needed when the conversion path relies on a DM trigger." },
  { field: "offers", stage: "essential_intake", rationale: "A usable workspace needs a priority offer to focus on." },
  { field: "primary_customer", stage: "essential_intake", rationale: "Defines the initial target buyer in plain business terms." },
  { field: "platforms", stage: "essential_intake", rationale: "Needed to anchor channel planning in current reality." },
  { field: "available_assets", stage: "essential_intake", rationale: "Determines what can be executed immediately." },
  { field: "ops_primary_contact", stage: "operations_setup", rationale: "A delivery workflow needs a named day-to-day contact." },
  { field: "ops_main_approver", stage: "operations_setup", rationale: "Execution requires a named approver." },
  { field: "ops_preferred_comms", stage: "operations_setup", rationale: "The team should know the preferred communication channel." },
  { field: "ops_launch_window", stage: "operations_setup", rationale: "Execution planning depends on timing and urgency." },
  { field: "ops_access_status", stage: "operations_setup", rationale: "The team needs visibility into access readiness." },
  { field: "ops_missing_assets", stage: "operations_setup", rationale: "Missing asset visibility is part of real setup readiness." },
  { field: "q4_languages", stage: "operations_setup", rationale: "Useful for execution planning, but not core first-session discovery." },
  { field: "formats", stage: "operations_setup", rationale: "A delivery preference that can be refined after intake." },
  { field: "cadence_requirement", stage: "operations_setup", rationale: "Execution planning detail, not first-session essentials." },
  { field: "on_camera_availability", stage: "operations_setup", rationale: "Operational production constraint needed before shipping content." },
  { field: "response_handling", stage: "operations_setup", rationale: "Ownership detail needed before live campaign execution." },
  { field: "audience_type", stage: "progressive_enrichment", rationale: "Helpful for strategy depth, but many clients need assistance to answer it well." },
  { field: "main_objection", stage: "progressive_enrichment", rationale: "Often needs strategist interpretation and can be clarified later." },
  { field: "q9_pain_points", stage: "progressive_enrichment", rationale: "Useful strategic depth, but not ideal as first-session friction." },
  { field: "brand_voice", stage: "progressive_enrichment", rationale: "Often better captured through examples and later refinement." },
  { field: "content_style", stage: "progressive_enrichment", rationale: "Creative taxonomy should not block first usability." },
  { field: "proof_types", stage: "progressive_enrichment", rationale: "Improves trust positioning, but not required to begin setup." },
  { field: "competitor_link", stage: "progressive_enrichment", rationale: "Helpful enrichment rather than operational minimum." },
  { field: "q13_differentiators", stage: "progressive_enrichment", rationale: "High-value strategy context that often needs guided clarification." },
];

export const READINESS_FIELD_TOTAL = READINESS_FIELDS.length;

function hasWebsiteOrSocials(profile: Partial<OnboardingProfile>): boolean {
  const website = profile.q2_website?.trim();
  const socials = (profile.q2_social_links ?? []).filter((link) => link.trim().length > 0);
  return Boolean(website || socials.length > 0);
}

function hasCadence(profile: Partial<OnboardingProfile>): boolean {
  const preset = profile.cadence_preset;
  if (preset && preset !== "custom") return true;

  const cadence = (profile.cadence_per_platform ?? profile.q18_cadence ?? {}) as CadenceMap;
  const platforms = profile.platforms ?? profile.q16_enabled_channels ?? [];
  if (platforms.length === 0) return false;
  return platforms.some((platform) => (cadence[platform] ?? 0) > 0);
}

function getOperationsSetupMeta(profile: Partial<OnboardingProfile>) {
  const v5Meta = (profile.v5_meta ?? {}) as Record<string, unknown>;
  return ((v5Meta.operations_setup ?? {}) as Record<string, unknown>);
}

function isFieldFilled(profile: Partial<OnboardingProfile>, field: string): boolean {
  const hasAnyText = (value: string | null | undefined) => Boolean(value?.trim());
  const ops = getOperationsSetupMeta(profile);

  switch (field) {
    case "q2_website_or_socials":
      return hasWebsiteOrSocials(profile);
    case "q1_business_name":
      return hasAnyText(profile.q1_business_name);
    case "industry_niche":
      return Boolean(profile.industry_niche);
    case "q3_market_scope":
      return Boolean(profile.q3_market_scope);
    case "q3_geo":
      if (profile.q3_market_scope !== "local") return true;
      return hasAnyText(profile.q3_country) && hasAnyText(profile.q3_city);
    case "q4_languages":
      return (profile.q4_languages ?? []).length > 0;
    case "primary_goal":
      return Boolean(profile.primary_goal ?? profile.q17_primary_goal);
    case "conversion_path":
      return Boolean(profile.conversion_path);
    case "conversion_link_required": {
      const path = profile.conversion_path;
      if (!path) return false;
      const requiresLink = ["book_call", "book_appointment", "website_checkout"].includes(path);
      if (!requiresLink) return true;
      return Boolean(profile.conversion_link?.trim());
    }
    case "dm_keyword_required": {
      const path = profile.conversion_path;
      if (!path) return false;
      if (path !== "dm_keyword") return true;
      return hasAnyText(profile.dm_keyword);
    }
    case "offers": {
      const offers = profile.offers ?? [];
      return offers.some((offer) => hasAnyText(offer?.name ?? null));
    }
    case "audience_type":
      return Boolean(profile.audience_type);
    case "primary_customer":
      return hasAnyText(profile.primary_customer) || hasAnyText(profile.q8_ideal_customer);
    case "main_objection":
      return Boolean(profile.main_objection);
    case "q9_pain_points":
      return (profile.q9_pain_points ?? []).filter((point) => hasAnyText(point)).length >= 3;
    case "brand_voice":
      return (profile.brand_voice ?? []).length >= 2;
    case "content_style":
      return (profile.content_style ?? []).length >= 1;
    case "on_camera_availability":
      return Boolean(profile.on_camera_availability);
    case "available_assets":
      return (profile.available_assets ?? []).length > 0;
    case "ops_primary_contact":
      return hasAnyText(typeof ops.primary_contact_name === "string" ? ops.primary_contact_name : null);
    case "ops_main_approver":
      return hasAnyText(typeof ops.main_approver_name === "string" ? ops.main_approver_name : null);
    case "ops_preferred_comms":
      return hasAnyText(typeof ops.preferred_comms_channel === "string" ? ops.preferred_comms_channel : null);
    case "ops_launch_window":
      return hasAnyText(typeof ops.launch_window === "string" ? ops.launch_window : null);
    case "ops_access_status":
      return Array.isArray(ops.required_access_status) && ops.required_access_status.length > 0;
    case "ops_missing_assets":
      return Array.isArray(ops.missing_assets);
    case "proof_types":
      return (profile.proof_types ?? []).length > 0;
    case "competitor_link":
      return hasAnyText(profile.competitor_link);
    case "response_handling":
      return Boolean(profile.response_handling);
    case "platforms":
      return (profile.platforms ?? profile.q16_enabled_channels ?? []).length > 0;
    case "formats":
      return (profile.formats ?? []).length > 0;
    case "cadence_requirement":
      return hasCadence(profile);
    case "q13_differentiators":
      return (profile.q13_differentiators ?? []).filter((value) => hasAnyText(value)).length > 0;
    default:
      return false;
  }
}

function buildStageProgress(profile: Partial<OnboardingProfile>, stage: OnboardingCollectionStage, fields: readonly string[]): StageProgress {
  const missing = fields.filter((field) => !isFieldFilled(profile, field));
  const completed = fields.length - missing.length;
  return {
    stage,
    completed,
    total: fields.length,
    percent: fields.length === 0 ? 100 : Math.round((completed / fields.length) * 100),
    missing,
  };
}

export function getOnboardingFieldClassifications() {
  return FIELD_CLASSIFICATIONS;
}

export function getStageFields(stage: OnboardingCollectionStage) {
  if (stage === "essential_intake") return [...ESSENTIAL_INTAKE_FIELDS];
  if (stage === "operations_setup") return [...OPERATIONS_SETUP_FIELDS];
  return [...PROGRESSIVE_ENRICHMENT_FIELDS];
}

export function getOnboardingJourneySummary(profile: Partial<OnboardingProfile>): OnboardingJourneySummary {
  const essentialIntake = buildStageProgress(profile, "essential_intake", ESSENTIAL_INTAKE_FIELDS);
  const operationsSetup = buildStageProgress(profile, "operations_setup", OPERATIONS_SETUP_FIELDS);
  const progressiveEnrichment = buildStageProgress(profile, "progressive_enrichment", PROGRESSIVE_ENRICHMENT_FIELDS);

  let state: OnboardingJourneyState = "draft_started";
  if (essentialIntake.missing.length === 0) state = "setup_usable";
  if (essentialIntake.missing.length === 0 && operationsSetup.missing.length === 0) state = "execution_ready";
  if (essentialIntake.missing.length === 0 && operationsSetup.missing.length === 0 && progressiveEnrichment.missing.length === 0) {
    state = "strategy_enriched";
  }

  return {
    state,
    essentialIntake,
    operationsSetup,
    progressiveEnrichment,
  };
}

export function getSectionRequirementSummary(
  profile: Partial<OnboardingProfile>,
  sectionId: V5SectionId,
): { completed: number; total: number; missing: string[] } {
  const required = SECTION_REQUIRED_FIELDS[sectionId] ?? [];
  const missing = required.filter((field) => !isFieldFilled(profile, field));
  const completed = required.length - missing.length;
  return { completed, total: required.length, missing };
}

export function getV5ProgressSummary(profile: Partial<OnboardingProfile>): V5ProgressSummary {
  const sections = Object.keys(SECTION_REQUIRED_FIELDS) as V5SectionId[];
  const readinessMissing = READINESS_FIELDS.filter((field) => !isFieldFilled(profile, field));

  const perSection = sections.reduce((acc, sectionId) => {
    const fields = SECTION_REQUIRED_FIELDS[sectionId] ?? [];
    const total = fields.length;
    const completed = fields.filter((field) => isFieldFilled(profile, field)).length;
    const percent = total === 0 ? 100 : Math.round((completed / total) * 100);
    acc[sectionId] = { sectionId, completed, total, percent };
    return acc;
  }, {} as Record<V5SectionId, SectionProgress>);

  const requiredPerSection = sections.reduce(
    (acc, sectionId) => {
      const summary = getSectionRequirementSummary(profile, sectionId);
      acc[sectionId] = summary;
      return acc;
    },
    {} as Record<V5SectionId, { completed: number; total: number; missing: string[] }>,
  );

  const completionRatio =
    READINESS_FIELDS.length === 0 ? 1 : (READINESS_FIELDS.length - readinessMissing.length) / READINESS_FIELDS.length;
  const totalPercent = Math.round(100 * completionRatio);

  return {
    perSection,
    requiredPerSection,
    totalPercent,
    missingFields: readinessMissing,
    journey: getOnboardingJourneySummary(profile),
  };
}
