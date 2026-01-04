import { describe, expect, it } from 'vitest';
import { getV5ProgressSummary } from '../progress';
import type { OnboardingProfile } from '@/types/onboarding';

describe('getV5ProgressSummary', () => {
  it('reaches 100 when required fields are complete', () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: 'Nimbus Creative Studio',
      industry_niche: 'restaurant_cafe',
      primary_goal: 'more_bookings',
      conversion_path: 'book_appointment',
      conversion_link: 'https://calendly.com/nimbus',
      offers: [{ type: 'best_seller', name: 'Signature Service' }],
      primary_customer: 'Local families',
      q9_pain_points: ['Not enough customers/leads', 'Low trust / weak reputation', 'Low engagement'],
      brand_voice: ['friendly', 'educational'],
      content_style: ['educational_tips'],
      platforms: ['instagram'],
      cadence_preset: 'standard',
    };

    const summary = getV5ProgressSummary(profile);
    expect(summary.totalPercent).toBe(100);
  });

  it('requires conversion link for book appointment', () => {
    const profile: Partial<OnboardingProfile> = {
      q1_business_name: 'Nimbus Creative Studio',
      industry_niche: 'restaurant_cafe',
      primary_goal: 'more_bookings',
      conversion_path: 'book_appointment',
      offers: [{ type: 'best_seller', name: 'Signature Service' }],
      primary_customer: 'Local families',
      q9_pain_points: ['Not enough customers/leads', 'Low trust / weak reputation', 'Low engagement'],
      brand_voice: ['friendly', 'educational'],
      content_style: ['educational_tips'],
      platforms: ['instagram'],
      cadence_preset: 'standard',
    };

    const summary = getV5ProgressSummary(profile);
    expect(summary.missingFields).toContain('conversion_link_required');
  });
});
