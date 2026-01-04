import { describe, expect, it } from 'vitest';
import { mapProfileToPreview } from '../previewMapper';
import type { OnboardingProfile } from '@/types/onboarding';

describe('mapProfileToPreview', () => {
  it('returns nulls for broken strings', () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: 'Acme',
      primary_customer: 'pp',
      offers: [{ type: 'best_seller', name: 'le' }],
      q9_pain_points: ['pp', 'ok', 'bad'],
    };

    const preview = mapProfileToPreview(profile, {}, null);

    expect(preview.positioning_sentence).toBeNull();
    expect(preview.cta).toBeNull();
    expect(preview.pillars.every((pillar) => pillar.line === null)).toBe(true);
  });

  it('builds positioning when values are valid', () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: 'Lighthouse Studio',
      primary_customer: 'Local homeowners',
      primary_goal: 'more_bookings',
      offers: [{ type: 'best_seller', name: 'Premium Package' }],
      q13_differentiators: ['Local authority'],
    };

    const preview = mapProfileToPreview(profile, {}, null);

    expect(preview.positioning_sentence).toBe(
      'We help Local homeowners book more appointments with Premium Package.'
    );
  });
});
