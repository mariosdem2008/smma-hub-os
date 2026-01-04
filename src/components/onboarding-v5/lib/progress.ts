import type { CadenceMap, OnboardingProfile } from '@/types/onboarding';
import { sanitizeText } from './sanitize';

export type V5SectionId =
  | 'basics'
  | 'goal'
  | 'offers'
  | 'audience'
  | 'brand'
  | 'proof'
  | 'channels'
  | 'review';

export interface SectionProgress {
  sectionId: V5SectionId;
  completed: number;
  total: number;
  percent: number;
}

export interface V5ProgressSummary {
  perSection: Record<V5SectionId, SectionProgress>;
  requiredPerSection: Record<V5SectionId, { completed: number; total: number; missing: string[] }>;
  totalPercent: number;
  missingFields: string[];
}

const SECTION_REQUIRED_FIELDS: Record<V5SectionId, string[]> = {
  basics: [
    'q1_business_name',
    'industry_niche',
    'q3_market_scope',
    'q3_geo',
    'q2_website_or_socials',
    'q4_languages',
  ],
  goal: ['primary_goal', 'conversion_path', 'conversion_link_required'],
  offers: ['offers'],
  audience: ['audience_type', 'primary_customer', 'main_objection', 'q9_pain_points'],
  brand: ['brand_voice', 'content_style', 'on_camera_availability', 'available_assets'],
  proof: [],
  channels: ['platforms', 'formats', 'cadence_requirement'],
  review: [],
};

const READINESS_FIELDS = [
  'q1_business_name',
  'industry_niche',
  'primary_goal',
  'conversion_path',
  'conversion_link_required',
  'offers',
  'primary_customer',
  'q9_pain_points',
  'platforms',
  'cadence_requirement',
  'brand_voice',
  'content_style',
];

function hasWebsiteOrSocials(profile: Partial<OnboardingProfile>): boolean {
  const website = profile.q2_website?.trim();
  const socials = (profile.q2_social_links ?? []).filter((link) => link.trim().length > 0);
  return Boolean(website || socials.length > 0);
}

function hasCadence(profile: Partial<OnboardingProfile>): boolean {
  const preset = profile.cadence_preset;
  if (preset && preset !== 'custom') return true;

  const cadence = (profile.cadence_per_platform ?? profile.q18_cadence ?? {}) as CadenceMap;
  const platforms = profile.platforms ?? profile.q16_enabled_channels ?? [];
  if (platforms.length === 0) return false;
  return platforms.some((platform) => (cadence[platform] ?? 0) > 0);
}

function isFieldFilled(profile: Partial<OnboardingProfile>, field: string): boolean {
  switch (field) {
    case 'q2_website_or_socials':
      return hasWebsiteOrSocials(profile);
    case 'q1_business_name':
      return Boolean(sanitizeText(profile.q1_business_name ?? undefined));
    case 'industry_niche':
      return Boolean(profile.industry_niche);
    case 'q3_market_scope':
      return Boolean(profile.q3_market_scope);
    case 'q3_geo':
      if (profile.q3_market_scope !== 'local') return true;
      return Boolean(sanitizeText(profile.q3_country ?? undefined)) && Boolean(sanitizeText(profile.q3_city ?? undefined));
    case 'q4_languages':
      return (profile.q4_languages ?? []).length > 0;
    case 'primary_goal':
      return Boolean(profile.primary_goal ?? profile.q17_primary_goal);
    case 'conversion_path':
      return Boolean(profile.conversion_path);
    case 'conversion_link_required': {
      const path = profile.conversion_path;
      if (!path) return false;
      const requiresLink = ['book_call', 'book_appointment', 'website_checkout'].includes(path);
      if (!requiresLink) return true;
      return Boolean(profile.conversion_link?.trim());
    }
    case 'offers': {
      const offers = profile.offers ?? [];
      return offers.some((offer) => Boolean(sanitizeText(offer?.name ?? undefined)));
    }
    case 'audience_type':
      return Boolean(profile.audience_type);
    case 'primary_customer':
      return Boolean(sanitizeText(profile.primary_customer ?? profile.q8_ideal_customer ?? undefined));
    case 'main_objection':
      return Boolean(profile.main_objection);
    case 'q9_pain_points':
      return (profile.q9_pain_points ?? []).filter((point) => sanitizeText(point)).length >= 3;
    case 'brand_voice':
      return (profile.brand_voice ?? []).length >= 2;
    case 'content_style':
      return (profile.content_style ?? []).length >= 1;
    case 'on_camera_availability':
      return Boolean(profile.on_camera_availability);
    case 'available_assets':
      return (profile.available_assets ?? []).length > 0;
    case 'proof_types':
      return (profile.proof_types ?? []).length > 0;
    case 'competitor_link':
      return Boolean(sanitizeText(profile.competitor_link ?? undefined));
    case 'platforms':
      return (profile.platforms ?? profile.q16_enabled_channels ?? []).length > 0;
    case 'formats':
      return (profile.formats ?? []).length > 0;
    case 'cadence_requirement':
      return hasCadence(profile);
    default:
      return false;
  }
}

export function getSectionRequirementSummary(
  profile: Partial<OnboardingProfile>,
  sectionId: V5SectionId
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
    {} as Record<V5SectionId, { completed: number; total: number; missing: string[] }>
  );

  const completionRatio =
    READINESS_FIELDS.length === 0 ? 1 : (READINESS_FIELDS.length - readinessMissing.length) / READINESS_FIELDS.length;
  const totalPercent = Math.round(100 * completionRatio);

  return {
    perSection,
    requiredPerSection,
    totalPercent,
    missingFields: readinessMissing,
  };
}
