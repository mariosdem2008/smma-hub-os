import type { OnboardingProfile, OnboardingV5Meta, V5ScanResult, SocialChannel } from '@/types/onboarding';
import { CTA_OPTIONS, CONVERSION_PATH_OPTIONS } from '@/types/onboarding';
import { sanitizeList, sanitizeText } from './sanitize';
import { getV5ProgressSummary } from './progress';

export type PreviewSource = 'answers' | 'scan' | 'ai_inferred';

export interface PreviewPillar {
  title: string | null;
  line: string | null;
}

export interface PreviewOutput {
  positioning_sentence: string | null;
  pillars: PreviewPillar[];
  cta: string | null;
  cadence_snapshot: Partial<Record<SocialChannel, number>>;
  confidence: number;
  sources: PreviewSource[];
}

function buildPositioningSentence(profile: Partial<OnboardingProfile>): string | null {
  const offer = sanitizeText(profile.offers?.[0]?.name ?? profile.q6_offer_name ?? undefined);
  const customer = sanitizeText(profile.primary_customer ?? profile.q8_ideal_customer ?? undefined);
  const goal = sanitizeText(getGoalOutcome(profile.primary_goal));
  if (!customer) return null;
  if (goal && offer) {
    return `We help ${customer} ${goal} with ${offer}.`;
  }
  if (offer) {
    return `We help ${customer} with ${offer}.`;
  }
  if (goal) {
    return `We help ${customer} ${goal}.`;
  }
  return null;
}

function getGoalOutcome(goal: OnboardingProfile['primary_goal'] | null | undefined): string {
  switch (goal) {
    case 'more_bookings':
      return 'book more appointments';
    case 'more_leads':
      return 'generate more leads';
    case 'more_dms':
      return 'get more DMs';
    case 'more_online_sales':
      return 'sell more online';
    case 'more_foot_traffic':
      return 'drive more foot traffic';
    case 'more_trust':
      return 'build trust and authority';
    default:
      return '';
  }
}

function buildPillars(profile: Partial<OnboardingProfile>): PreviewPillar[] {
  const painPoints = sanitizeList(profile.q9_pain_points ?? []);
  const differentiators = sanitizeList(profile.q13_differentiators ?? []);

  const rawPillars = [
    ...painPoints.slice(0, 2).map((pain) => ({
      title: 'Pain Relief',
      line: `Solve ${pain}`,
    })),
    ...differentiators.slice(0, 2).map((diff) => ({
      title: 'Differentiator',
      line: diff,
    })),
  ];

  const normalized = rawPillars.slice(0, 3).map((pillar) => ({
    title: sanitizeText(pillar.title),
    line: sanitizeText(pillar.line),
  }));

  while (normalized.length < 3) {
    normalized.push({ title: null, line: null });
  }

  return normalized;
}

function buildCadenceSnapshot(profile: Partial<OnboardingProfile>): Partial<Record<SocialChannel, number>> {
  const cadence = profile.cadence_per_platform ?? profile.q18_cadence ?? {};
  const channels = profile.platforms ?? profile.q16_enabled_channels ?? [];
  return channels.reduce((acc, channel) => {
    acc[channel] = cadence[channel] ?? 0;
    return acc;
  }, {} as Partial<Record<SocialChannel, number>>);
}

function getSources(
  profile: Partial<OnboardingProfile>,
  meta: OnboardingV5Meta | null | undefined,
  scan?: V5ScanResult | null
): PreviewSource[] {
  const sources: PreviewSource[] = [];
  const hasAnswers = Boolean(
    sanitizeText(profile.q1_business_name ?? undefined) ||
    sanitizeText(profile.primary_customer ?? profile.q8_ideal_customer ?? undefined) ||
    sanitizeText(profile.offers?.[0]?.name ?? profile.q6_offer_name ?? undefined)
  );

  if (hasAnswers) sources.push('answers');

  const scanApplied = (meta?.last_scan?.applied_fields_count ?? 0) > 0;
  if (scanApplied || scan) sources.push('scan');

  if (sources.length === 0) sources.push('ai_inferred');

  return sources;
}

export function mapProfileToPreview(
  profile: Partial<OnboardingProfile>,
  meta: OnboardingV5Meta | null | undefined,
  scan?: V5ScanResult | null
): PreviewOutput {
  const positioning = buildPositioningSentence(profile);
  const pillars = buildPillars(profile);
  const conversionLabel =
    CONVERSION_PATH_OPTIONS.find((option) => option.id === profile.conversion_path)?.label ?? '';
  const ctaLabel =
    CTA_OPTIONS.find((option) => option.id === profile.q6_main_cta)?.label ?? profile.q6_main_cta ?? '';
  const cta = sanitizeText(ctaLabel || conversionLabel) ?? sanitizeText(scan?.primary_cta);
  const cadence_snapshot = buildCadenceSnapshot(profile);

  const progress = getV5ProgressSummary(profile);

  return {
    positioning_sentence: positioning,
    pillars,
    cta,
    cadence_snapshot,
    confidence: progress.totalPercent,
    sources: getSources(profile, meta, scan),
  };
}
