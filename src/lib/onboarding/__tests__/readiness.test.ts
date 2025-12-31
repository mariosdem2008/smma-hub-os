// ============================================================================
// Readiness Scoring Unit Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  calculateReadiness,
  getBlockers,
  areBlockersCleared,
  getReadinessLevel,
  calculateClientFlowReadiness,
  validateProofPoints,
  validateCadence,
} from '../readiness';
import type { OnboardingProfile } from '@/types/onboarding';

// Helper to create a minimal profile
function createProfile(overrides: Partial<OnboardingProfile> = {}): Partial<OnboardingProfile> {
  return {
    id: 'test-id',
    client_id: 'client-id',
    agency_id: 'agency-id',
    flow_type: 'agency_led',
    current_step: 1,
    completed_at: null,
    ...overrides,
  };
}

// Helper to create a complete profile (all fields filled)
function createCompleteProfile(): Partial<OnboardingProfile> {
  return createProfile({
    q1_business_name: 'Test Business',
    q1_provenance: 'user_typed',
    q2_website: 'https://example.com',
    q2_social_links: ['https://instagram.com/test'],
    q2_provenance: 'user_typed',
    q3_market_scope: 'national',
    q3_provenance: 'user_selected',
    q4_languages: ['en'],
    q4_provenance: 'user_selected',
    q5_offer_type: 'service',
    q5_provenance: 'user_selected',
    q6_offer_name: 'Premium Service',
    q6_price_min: 100,
    q6_price_max: 500,
    q6_main_cta: 'book_call',
    q6_provenance: 'user_typed',
    q7_business_model: 'b2b',
    q7_provenance: 'user_selected',
    q8_ideal_customer: 'Small business owners',
    q8_provenance: 'user_selected',
    q9_pain_points: ['Pain 1', 'Pain 2', 'Pain 3'],
    q9_provenance: 'user_selected',
    q10_desired_outcome: 'Increased revenue',
    q10_provenance: 'user_selected',
    q11_sales_cycle: '1_7_days',
    q11_provenance: 'user_selected',
    q12_competitors: [{ name: 'Competitor A', handle: '@compA' }],
    q12_provenance: 'user_typed',
    q13_differentiators: ['Diff 1', 'Diff 2'],
    q13_provenance: 'user_selected',
    q14_proof_level: 'some',
    q14_provenance: 'user_selected',
    q15_proof_points: [{ claim: 'Claim 1', evidence: 'Evidence 1', confidence: 4 as const }],
    q15_provenance: 'user_typed',
    q16_enabled_channels: ['instagram', 'linkedin'],
    q16_provenance: 'user_selected',
    q17_primary_goal: 'leads',
    q17_provenance: 'user_selected',
    q18_cadence: { instagram: 5, linkedin: 3 },
    q18_provenance: 'user_selected',
  });
}

describe('calculateReadiness', () => {
  it('returns low percentage for empty profile', () => {
    const profile = createProfile();
    const result = calculateReadiness(profile);

    // Empty profile gets small score from proof_points (q14=none means q15 passes)
    // and q18_cadence (empty channels passes .every() check)
    expect(result.percentage).toBeLessThan(15);
    expect(result.score).toBeLessThan(15);
    expect(result.hardBlockersCleared).toBe(false);
  });

  it('returns 100% for complete profile', () => {
    const profile = createCompleteProfile();
    const result = calculateReadiness(profile);

    expect(result.percentage).toBe(100);
    expect(result.hardBlockersCleared).toBe(true);
  });

  it('calculates section scores correctly', () => {
    const profile = createCompleteProfile();
    const result = calculateReadiness(profile);

    // Section A: 25 points total
    expect(result.sectionScores.A.max).toBe(25);
    expect(result.sectionScores.A.score).toBe(25);

    // Section B: 35 points total
    expect(result.sectionScores.B.max).toBe(35);
    expect(result.sectionScores.B.score).toBe(35);

    // Section C: 20 points total
    expect(result.sectionScores.C.max).toBe(20);
    expect(result.sectionScores.C.score).toBe(20);

    // Section D: 20 points total
    expect(result.sectionScores.D.max).toBe(20);
    expect(result.sectionScores.D.score).toBe(20);
  });

  it('applies assumption penalty correctly', () => {
    const profile = createCompleteProfile();
    // Set some provenances to ai_assumed
    profile.q8_provenance = 'ai_assumed';
    profile.q9_provenance = 'ai_assumed';

    const result = calculateReadiness(profile);

    expect(result.assumptionCount).toBe(2);
    expect(result.assumptionPenalty).toBe(4); // 2 assumptions * 2 penalty each
    expect(result.percentage).toBe(96); // 100 - 4
  });

  it('counts partial fields correctly', () => {
    const profile = createProfile({
      q1_business_name: 'Test',
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q8_ideal_customer: 'Customers',
      q10_desired_outcome: 'Outcome',
      q16_enabled_channels: ['instagram'],
      q18_cadence: { instagram: 3 },
    });

    const result = calculateReadiness(profile);

    // Should have some score
    expect(result.score).toBeGreaterThan(0);
    expect(result.hardBlockersCleared).toBe(true);
  });

  it('validates pain points require exactly 3', () => {
    const profile = createProfile({
      q9_pain_points: ['Pain 1', 'Pain 2'], // Only 2
    });

    const result = calculateReadiness(profile);

    // q9_pain_points should not contribute to score with only 2 items
    const profileWith3 = createProfile({
      q9_pain_points: ['Pain 1', 'Pain 2', 'Pain 3'],
    });
    const resultWith3 = calculateReadiness(profileWith3);

    expect(resultWith3.score).toBeGreaterThan(result.score);
  });

  it('validates differentiators require at least 2', () => {
    const profile = createProfile({
      q13_differentiators: ['Diff 1'], // Only 1
    });

    const result = calculateReadiness(profile);

    const profileWith2 = createProfile({
      q13_differentiators: ['Diff 1', 'Diff 2'],
    });
    const resultWith2 = calculateReadiness(profileWith2);

    expect(resultWith2.score).toBeGreaterThan(result.score);
  });
});

describe('getBlockers', () => {
  it('returns blockers for empty profile (q18 passes with no channels)', () => {
    const profile = createProfile();
    const blockers = getBlockers(profile);

    // Note: q18_cadence passes when no channels are enabled (empty array .every() = true)
    expect(blockers.length).toBe(5);
    expect(blockers.map((b) => b.field)).toContain('q6_offer_name');
    expect(blockers.map((b) => b.field)).toContain('q6_main_cta');
    expect(blockers.map((b) => b.field)).toContain('q8_ideal_customer');
    expect(blockers.map((b) => b.field)).toContain('q10_desired_outcome');
    expect(blockers.map((b) => b.field)).toContain('q16_enabled_channels');
    // q18_cadence passes because channels array is empty
    expect(blockers.map((b) => b.field)).not.toContain('q18_cadence');
  });

  it('returns no blockers when all hard blockers filled', () => {
    const profile = createProfile({
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q8_ideal_customer: 'Customer',
      q10_desired_outcome: 'Outcome',
      q16_enabled_channels: ['instagram'],
      q18_cadence: { instagram: 3 },
    });

    const blockers = getBlockers(profile);
    expect(blockers.length).toBe(0);
  });

  it('requires cadence for all enabled channels', () => {
    const profile = createProfile({
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q8_ideal_customer: 'Customer',
      q10_desired_outcome: 'Outcome',
      q16_enabled_channels: ['instagram', 'tiktok'],
      q18_cadence: { instagram: 3 }, // Missing tiktok
    });

    const blockers = getBlockers(profile);
    expect(blockers.some((b) => b.field === 'q18_cadence')).toBe(true);
  });

  it('passes cadence check when all channels have cadence', () => {
    const profile = createProfile({
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q8_ideal_customer: 'Customer',
      q10_desired_outcome: 'Outcome',
      q16_enabled_channels: ['instagram', 'tiktok'],
      q18_cadence: { instagram: 3, tiktok: 5 },
    });

    const blockers = getBlockers(profile);
    expect(blockers.length).toBe(0);
  });
});

describe('areBlockersCleared', () => {
  it('returns false for empty profile', () => {
    const profile = createProfile();
    expect(areBlockersCleared(profile)).toBe(false);
  });

  it('returns true when all blockers cleared', () => {
    const profile = createProfile({
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q8_ideal_customer: 'Customer',
      q10_desired_outcome: 'Outcome',
      q16_enabled_channels: ['instagram'],
      q18_cadence: { instagram: 3 },
    });

    expect(areBlockersCleared(profile)).toBe(true);
  });
});

describe('getReadinessLevel', () => {
  it('returns "Not ready" for 0-39%', () => {
    expect(getReadinessLevel(0).label).toBe('Not ready');
    expect(getReadinessLevel(0).color).toBe('red');
    expect(getReadinessLevel(39).label).toBe('Not ready');
  });

  it('returns "Almost ready" for 40-69%', () => {
    expect(getReadinessLevel(40).label).toBe('Almost ready');
    expect(getReadinessLevel(40).color).toBe('yellow');
    expect(getReadinessLevel(69).label).toBe('Almost ready');
  });

  it('returns "Ready" for 70-89%', () => {
    expect(getReadinessLevel(70).label).toBe('Ready');
    expect(getReadinessLevel(70).color).toBe('green');
    expect(getReadinessLevel(89).label).toBe('Ready');
  });

  it('returns "Excellent" for 90-100%', () => {
    expect(getReadinessLevel(90).label).toBe('Excellent');
    expect(getReadinessLevel(90).color).toBe('green');
    expect(getReadinessLevel(100).label).toBe('Excellent');
  });
});

describe('calculateClientFlowReadiness', () => {
  it('returns 0% for empty profile', () => {
    const profile = createProfile();
    expect(calculateClientFlowReadiness(profile)).toBe(0);
  });

  it('returns 100% when all client fields filled', () => {
    const profile = createProfile({
      q1_business_name: 'Business',
      q2_website: 'https://example.com',
      q3_market_scope: 'national',
      q4_languages: ['en'],
      q5_offer_type: 'service',
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q7_business_model: 'b2b',
      q8_ideal_customer: 'Customer',
      q9_pain_points: ['P1', 'P2', 'P3'],
      q10_desired_outcome: 'Outcome',
      q11_sales_cycle: '1_7_days',
      q12_competitors: [{ name: 'Comp' }],
    });

    expect(calculateClientFlowReadiness(profile)).toBe(100);
  });

  it('excludes agency-only fields', () => {
    // Q13-Q18 are agency-only, should not affect client flow readiness
    const baseProfile = createProfile({
      q1_business_name: 'Business',
      q2_website: 'https://example.com',
      q3_market_scope: 'national',
      q4_languages: ['en'],
      q5_offer_type: 'service',
      q6_offer_name: 'Offer',
      q6_main_cta: 'book_call',
      q7_business_model: 'b2b',
      q8_ideal_customer: 'Customer',
      q9_pain_points: ['P1', 'P2', 'P3'],
      q10_desired_outcome: 'Outcome',
      q11_sales_cycle: '1_7_days',
      q12_competitors: [{ name: 'Comp' }],
    });

    const withAgencyFields = createProfile({
      ...baseProfile,
      q13_differentiators: ['D1', 'D2'],
      q16_enabled_channels: ['instagram'],
    });

    expect(calculateClientFlowReadiness(baseProfile)).toBe(calculateClientFlowReadiness(withAgencyFields));
  });
});

describe('validateProofPoints', () => {
  it('always valid for proof level "none"', () => {
    expect(validateProofPoints('none', []).valid).toBe(true);
    expect(validateProofPoints('none', null).valid).toBe(true);
  });

  it('requires at least 1 point for proof level "some"', () => {
    expect(validateProofPoints('some', []).valid).toBe(false);
    expect(validateProofPoints('some', [{ claim: 'C', evidence: 'E', confidence: 3 }]).valid).toBe(true);
  });

  it('requires at least 3 points for proof level "strong"', () => {
    expect(validateProofPoints('strong', []).valid).toBe(false);
    expect(validateProofPoints('strong', [{ claim: 'C1', evidence: 'E1', confidence: 3 }]).valid).toBe(false);
    expect(
      validateProofPoints('strong', [
        { claim: 'C1', evidence: 'E1', confidence: 3 },
        { claim: 'C2', evidence: 'E2', confidence: 3 },
      ]).valid
    ).toBe(false);
    expect(
      validateProofPoints('strong', [
        { claim: 'C1', evidence: 'E1', confidence: 3 },
        { claim: 'C2', evidence: 'E2', confidence: 3 },
        { claim: 'C3', evidence: 'E3', confidence: 3 },
      ]).valid
    ).toBe(true);
  });

  it('returns helpful error messages', () => {
    const someResult = validateProofPoints('some', []);
    expect(someResult.message).toContain('1 proof point');

    const strongResult = validateProofPoints('strong', []);
    expect(strongResult.message).toContain('3 proof points');
  });
});

describe('validateCadence', () => {
  it('returns valid for empty channels', () => {
    const result = validateCadence([], {});
    expect(result.valid).toBe(true);
    expect(result.missingChannels).toHaveLength(0);
  });

  it('returns invalid when channels missing cadence', () => {
    const result = validateCadence(['instagram', 'tiktok'], { instagram: 3 });
    expect(result.valid).toBe(false);
    expect(result.missingChannels).toContain('tiktok');
  });

  it('returns valid when all channels have cadence', () => {
    const result = validateCadence(['instagram', 'tiktok'], { instagram: 3, tiktok: 5 });
    expect(result.valid).toBe(true);
    expect(result.missingChannels).toHaveLength(0);
  });

  it('requires cadence > 0', () => {
    const result = validateCadence(['instagram'], { instagram: 0 });
    expect(result.valid).toBe(false);
    expect(result.missingChannels).toContain('instagram');
  });

  it('handles null inputs gracefully', () => {
    expect(validateCadence(null, null).valid).toBe(true);
    expect(validateCadence(undefined, undefined).valid).toBe(true);
  });
});
