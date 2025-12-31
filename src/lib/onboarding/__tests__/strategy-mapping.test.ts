// ============================================================================
// Strategy Mapping Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapOnboardingToStrategy,
  mapToPositioning,
  mapToPillars,
  mapToCampaignPlan,
  mapToWeeklyPlan,
  mapToChannelAdaptations,
  mapToRulesConstraints,
  generatePositioningStatement,
  inferContentPillars,
} from '../strategy-mapping';
import type { OnboardingProfile } from '@/types/onboarding';

// Helper to create a complete profile
function createCompleteProfile(): OnboardingProfile {
  return {
    id: 'test-id',
    client_id: 'client-id',
    agency_id: 'agency-id',
    flow_type: 'agency_led',
    current_step: 20,
    completed_at: new Date().toISOString(),

    q1_business_name: 'Test Business',
    q1_provenance: 'user_typed',
    q2_website: 'https://example.com',
    q2_social_links: ['https://instagram.com/test'],
    q2_provenance: 'user_typed',
    q3_market_scope: 'national',
    q3_country: 'USA',
    q3_city: null,
    q3_provenance: 'user_selected',
    q4_languages: ['en', 'es'],
    q4_provenance: 'user_selected',
    q5_offer_type: 'service',
    q5_provenance: 'user_selected',
    q6_offer_name: 'Premium Consulting',
    q6_price_min: 500,
    q6_price_max: 5000,
    q6_main_cta: 'Book a call',
    q6_provenance: 'user_typed',
    q7_business_model: 'b2b',
    q7_provenance: 'user_selected',
    q8_ideal_customer: 'Small business owners looking to scale',
    q8_provenance: 'user_selected',
    q9_pain_points: ['Lack of time', 'Inconsistent revenue', 'No clear strategy'],
    q9_provenance: 'user_selected',
    q10_desired_outcome: 'Predictable monthly revenue',
    q10_provenance: 'user_selected',
    q11_sales_cycle: '1_4_weeks',
    q11_provenance: 'user_selected',
    q12_competitors: [
      { name: 'Competitor A', handle: '@compA', url: 'https://compa.com' },
      { name: 'Competitor B', handle: '@compB' },
    ],
    q12_provenance: 'user_typed',
    q13_differentiators: ['Proven track record', 'Hands-on approach', 'Guaranteed results'],
    q13_provenance: 'user_selected',
    q14_proof_level: 'strong',
    q14_provenance: 'user_selected',
    q15_proof_points: [
      { claim: '10x ROI for clients', evidence: 'https://example.com/case-study', confidence: 5 as const },
      { claim: 'Featured in Forbes', evidence: 'https://forbes.com/article', confidence: 5 as const },
      { claim: 'Average 30% growth', evidence: 'Internal data', confidence: 3 as const },
    ],
    q15_provenance: 'user_typed',
    q16_enabled_channels: ['instagram', 'linkedin', 'tiktok'],
    q16_provenance: 'user_selected',
    q17_primary_goal: 'leads',
    q17_provenance: 'user_selected',
    q18_cadence: { instagram: 5, linkedin: 3, tiktok: 7 },
    q18_provenance: 'user_selected',

    ai_scan_result: null,
    ai_scan_at: null,
    ai_scan_accepted: false,
    readiness_score: 100,
    blockers: [],
    created_by: 'user-id',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('mapOnboardingToStrategy', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('returns all 6 module types', () => {
    const result = mapOnboardingToStrategy(profile);

    expect(result).toHaveProperty('positioning');
    expect(result).toHaveProperty('pillars');
    expect(result).toHaveProperty('campaign_plan');
    expect(result).toHaveProperty('weekly_plan');
    expect(result).toHaveProperty('channel_adaptations');
    expect(result).toHaveProperty('rules_constraints');
  });

  it('includes meta.source as IMPORT', () => {
    const result = mapOnboardingToStrategy(profile);

    expect(result.positioning.meta.source).toBe('IMPORT');
    expect(result.pillars.meta.source).toBe('IMPORT');
    expect(result.campaign_plan.meta.source).toBe('IMPORT');
    expect(result.weekly_plan.meta.source).toBe('IMPORT');
    expect(result.channel_adaptations.meta.source).toBe('IMPORT');
    expect(result.rules_constraints.meta.source).toBe('IMPORT');
  });

  it('includes meta.generated_at as ISO string', () => {
    const result = mapOnboardingToStrategy(profile);

    // Should be a valid ISO date string
    expect(() => new Date(result.positioning.meta.generated_at)).not.toThrow();
    expect(result.positioning.meta.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('mapToPositioning', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('builds sentence from profile fields', () => {
    const result = mapToPositioning(profile);

    expect(result.sentence.target).toBe(profile.q8_ideal_customer);
    expect(result.sentence.category).toBe(profile.q5_offer_type);
    expect(result.sentence.differentiator).toBe(profile.q13_differentiators![0]);
    expect(result.sentence.benefit).toBe(profile.q10_desired_outcome);
  });

  it('generates finalSentence string', () => {
    const result = mapToPositioning(profile);

    expect(result.finalSentence).toContain('For');
    expect(result.finalSentence).toContain(profile.q8_ideal_customer!);
    expect(result.finalSentence).toContain('.');
  });

  it('maps proof points with correct structure', () => {
    const result = mapToPositioning(profile);

    expect(result.proofPoints).toHaveLength(3);
    expect(result.proofPoints[0]).toMatchObject({
      id: expect.stringMatching(/^proof-/),
      claim: '10x ROI for clients',
      evidence: 'https://example.com/case-study',
      confidence: 5,
    });
  });

  it('maps differentiators with correct structure', () => {
    const result = mapToPositioning(profile);

    expect(result.differentiators).toHaveLength(3);
    expect(result.differentiators[0]).toMatchObject({
      id: expect.stringMatching(/^diff-/),
      rank: 1,
      approvedPhrasing: 'Proven track record',
      bannedPhrasing: [],
    });
  });

  it('categorizes proof points into boundaries', () => {
    const result = mapToPositioning(profile);

    // High confidence (>= 4) goes to allowedPromises
    expect(result.boundaries.allowedPromises).toContain('10x ROI for clients');
    expect(result.boundaries.allowedPromises).toContain('Featured in Forbes');

    // Medium confidence (2-3) goes to riskyPromises
    expect(result.boundaries.riskyPromises).toContain('Average 30% growth');

    // We don't have any low confidence in test data
    expect(result.boundaries.forbiddenPromises).toHaveLength(0);
  });

  it('sets decisions to unlocked by default', () => {
    const result = mapToPositioning(profile);

    expect(result.decisions.sentenceLocked).toBe(false);
    expect(result.decisions.differentiatorsLocked).toBe(false);
  });

  it('handles empty differentiators gracefully', () => {
    profile.q13_differentiators = [];
    const result = mapToPositioning(profile);

    expect(result.differentiators).toHaveLength(0);
    expect(result.sentence.differentiator).toBe('');
  });

  it('handles empty proof points gracefully', () => {
    profile.q15_proof_points = [];
    const result = mapToPositioning(profile);

    expect(result.proofPoints).toHaveLength(0);
    expect(result.boundaries.allowedPromises).toHaveLength(0);
  });
});

describe('mapToPillars', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('generates pillars from pain points', () => {
    const result = mapToPillars(profile);

    // Should include pain point pillars
    const painPillar = result.pillars.find((p) => p.name.includes('Lack of time'));
    expect(painPillar).toBeDefined();
    expect(painPillar!.purpose).toBe('authority');
    expect(painPillar!.contentTypes).toContain('educational');
  });

  it('generates pillars from differentiators', () => {
    const result = mapToPillars(profile);

    // Should include differentiator pillars
    const diffPillar = result.pillars.find((p) => p.name === 'Proven track record');
    expect(diffPillar).toBeDefined();
    expect(diffPillar!.purpose).toBe('proof');
    expect(diffPillar!.contentTypes).toContain('case-study');
  });

  it('ensures coverage sums to 100%', () => {
    const result = mapToPillars(profile);

    const totalCoverage = result.pillars.reduce((sum, p) => sum + p.coveragePercent, 0);
    expect(totalCoverage).toBe(100);
  });

  it('limits to 5 pillars maximum', () => {
    // Create profile with many pain points and differentiators
    profile.q9_pain_points = ['P1', 'P2', 'P3', 'P4', 'P5'];
    profile.q13_differentiators = ['D1', 'D2', 'D3', 'D4', 'D5'];

    const result = mapToPillars(profile);
    expect(result.pillars.length).toBeLessThanOrEqual(5);
  });

  it('adds offer pillar if needed', () => {
    // Minimal profile with just offer
    profile.q9_pain_points = [];
    profile.q13_differentiators = [];
    profile.q6_offer_name = 'Premium Service';

    const result = mapToPillars(profile);

    const offerPillar = result.pillars.find((p) => p.name.includes('Premium Service'));
    expect(offerPillar).toBeDefined();
    expect(offerPillar!.purpose).toBe('leads');
  });

  it('sets decisions to unlocked by default', () => {
    const result = mapToPillars(profile);

    expect(result.decisions.pillarNamesLocked).toBe(false);
    expect(result.decisions.coverageLocked).toBe(false);
    expect(result.decisions.bannedAnglesLocked).toBe(false);
  });
});

describe('mapToCampaignPlan', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('creates campaign from offer name', () => {
    const result = mapToCampaignPlan(profile);

    expect(result.campaigns).toHaveLength(1);
    expect(result.campaigns[0].name).toContain('Premium Consulting');
  });

  it('sets campaign properties from profile', () => {
    const result = mapToCampaignPlan(profile);
    const campaign = result.campaigns[0];

    expect(campaign.goal).toBe(profile.q17_primary_goal);
    expect(campaign.offer).toBe(profile.q6_offer_name);
    expect(campaign.cta).toBe(profile.q6_main_cta);
    expect(campaign.icp).toBe(profile.q8_ideal_customer);
  });

  it('sets campaign dates', () => {
    const result = mapToCampaignPlan(profile);
    const campaign = result.campaigns[0];

    expect(campaign.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(campaign.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(campaign.status).toBe('planned');
  });

  it('initializes with default assets checklist', () => {
    const result = mapToCampaignPlan(profile);
    const campaign = result.campaigns[0];

    expect(campaign.assets.length).toBeGreaterThan(0);
    expect(campaign.assets[0]).toHaveProperty('name');
    expect(campaign.assets[0]).toHaveProperty('completed');
  });

  it('sets selectedMonth to current month', () => {
    const result = mapToCampaignPlan(profile);

    expect(result.selectedMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns empty campaigns when no offer name', () => {
    profile.q6_offer_name = null;
    const result = mapToCampaignPlan(profile);

    expect(result.campaigns).toHaveLength(0);
  });
});

describe('mapToWeeklyPlan', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('sets cadence matrix from profile', () => {
    const result = mapToWeeklyPlan(profile);

    expect(result.cadenceMatrix).toEqual({
      instagram: 5,
      linkedin: 3,
      tiktok: 7,
    });
  });

  it('sets weekly focus from profile', () => {
    const result = mapToWeeklyPlan(profile);

    expect(result.weeklyFocus.objective).toBe(profile.q10_desired_outcome);
    expect(result.weeklyFocus.kpiFocus).toContain(profile.q17_primary_goal);
  });

  it('sets selectedWeek in ISO format', () => {
    const result = mapToWeeklyPlan(profile);

    expect(result.selectedWeek).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('initializes empty review and checklist', () => {
    const result = mapToWeeklyPlan(profile);

    expect(result.productionChecklist).toEqual([]);
    expect(result.weeklyReview.wins).toEqual([]);
    expect(result.weeklyReview.losses).toEqual([]);
    expect(result.weeklyReview.changesNextWeek).toEqual([]);
  });
});

describe('mapToChannelAdaptations', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('creates channel config for each enabled channel', () => {
    const result = mapToChannelAdaptations(profile);

    expect(result.channels).toHaveLength(3);
    expect(result.channels.map((c) => c.platform)).toContain('instagram');
    expect(result.channels.map((c) => c.platform)).toContain('linkedin');
    expect(result.channels.map((c) => c.platform)).toContain('tiktok');
  });

  it('sets platform-specific defaults for Instagram', () => {
    const result = mapToChannelAdaptations(profile);
    const instagram = result.channels.find((c) => c.platform === 'instagram');

    expect(instagram).toBeDefined();
    expect(instagram!.formats).toContain('reels');
    expect(instagram!.formats).toContain('stories');
    expect(instagram!.hookRules.length).toBeGreaterThan(0);
    expect(instagram!.dos.length).toBeGreaterThan(0);
    expect(instagram!.donts.length).toBeGreaterThan(0);
  });

  it('sets platform-specific defaults for LinkedIn', () => {
    const result = mapToChannelAdaptations(profile);
    const linkedin = result.channels.find((c) => c.platform === 'linkedin');

    expect(linkedin).toBeDefined();
    expect(linkedin!.role).toContain('Professional');
    expect(linkedin!.formats).toContain('text posts');
    expect(linkedin!.formats).toContain('articles');
  });

  it('sets platform-specific defaults for TikTok', () => {
    const result = mapToChannelAdaptations(profile);
    const tiktok = result.channels.find((c) => c.platform === 'tiktok');

    expect(tiktok).toBeDefined();
    expect(tiktok!.role).toContain('Viral');
    expect(tiktok!.hookRules.some((r) => r.includes('1 second'))).toBe(true);
  });

  it('includes cadence per channel', () => {
    const result = mapToChannelAdaptations(profile);
    const instagram = result.channels.find((c) => c.platform === 'instagram');

    expect(instagram!.cadence).toBe('5 posts/week');
  });

  it('handles unknown platforms gracefully', () => {
    profile.q16_enabled_channels = ['instagram', 'unknown_platform' as any];
    const result = mapToChannelAdaptations(profile);

    // Should still create configs without crashing
    expect(result.channels).toHaveLength(2);
  });
});

describe('mapToRulesConstraints', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('creates claims policy from proof points', () => {
    const result = mapToRulesConstraints(profile);

    expect(result.claimsPolicy).toHaveLength(3);
    expect(result.claimsPolicy[0]).toMatchObject({
      id: expect.stringMatching(/^claim-/),
      claim: '10x ROI for clients',
      status: 'allowed', // confidence 5 >= 4
      proofLink: 'https://example.com/case-study',
    });
  });

  it('sets claim status based on confidence', () => {
    const result = mapToRulesConstraints(profile);

    // High confidence claims should be "allowed"
    const highConfidence = result.claimsPolicy.find((c) => c.claim === '10x ROI for clients');
    expect(highConfidence!.status).toBe('allowed');

    // Medium confidence claims should be "proof_required"
    const medConfidence = result.claimsPolicy.find((c) => c.claim === 'Average 30% growth');
    expect(medConfidence!.status).toBe('proof_required');
  });

  it('adds required disclaimers for proof level "none"', () => {
    profile.q14_proof_level = 'none';
    const result = mapToRulesConstraints(profile);

    expect(result.requiredDisclaimers).toContain('Results may vary');
  });

  it('no disclaimers for proof level "some" or "strong"', () => {
    profile.q14_proof_level = 'strong';
    const result = mapToRulesConstraints(profile);

    expect(result.requiredDisclaimers).toHaveLength(0);
  });

  it('sets default approval triggers', () => {
    const result = mapToRulesConstraints(profile);

    expect(result.approvalTriggers.length).toBeGreaterThan(0);
    expect(result.approvalTriggers.some((t) => t.condition.includes('price'))).toBe(true);
    expect(result.approvalTriggers.some((t) => t.condition.includes('claims'))).toBe(true);
  });

  it('initializes empty banned words', () => {
    const result = mapToRulesConstraints(profile);
    expect(result.bannedWords).toEqual([]);
  });
});

describe('generatePositioningStatement', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('builds statement from all parts', () => {
    const result = generatePositioningStatement(profile);

    expect(result).toContain('We help');
    expect(result).toContain(profile.q8_ideal_customer!);
    expect(result).toContain('achieve');
    expect(result).toContain(profile.q10_desired_outcome!);
    expect(result).toContain('through');
    expect(result).toContain(profile.q6_offer_name!);
    expect(result).toContain('with');
    expect(result).toContain(profile.q13_differentiators![0]);
    expect(result.endsWith('.')).toBe(true);
  });

  it('handles missing fields gracefully', () => {
    profile.q8_ideal_customer = null;
    profile.q10_desired_outcome = null;
    profile.q6_offer_name = null;
    profile.q13_differentiators = [];

    const result = generatePositioningStatement(profile);

    expect(result).toBe('');
  });

  it('builds partial statement with some fields', () => {
    profile.q10_desired_outcome = null;
    profile.q13_differentiators = [];

    const result = generatePositioningStatement(profile);

    expect(result).toContain('We help');
    expect(result).toContain('through');
    expect(result).not.toContain('achieve');
    expect(result).not.toContain('with');
  });
});

describe('inferContentPillars', () => {
  let profile: OnboardingProfile;

  beforeEach(() => {
    profile = createCompleteProfile();
  });

  it('includes pain points as pillars', () => {
    const result = inferContentPillars(profile);

    expect(result.some((p) => p.includes('Lack of time'))).toBe(true);
  });

  it('includes differentiators as pillars', () => {
    const result = inferContentPillars(profile);

    expect(result).toContain('Proven track record');
  });

  it('limits to 5 pillars maximum', () => {
    profile.q9_pain_points = ['P1', 'P2', 'P3', 'P4', 'P5'];
    profile.q13_differentiators = ['D1', 'D2', 'D3', 'D4', 'D5'];

    const result = inferContentPillars(profile);

    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('adds offer focus if less than 3 pillars', () => {
    profile.q9_pain_points = [];
    profile.q13_differentiators = [];

    const result = inferContentPillars(profile);

    expect(result.some((p) => p.includes('Premium Consulting'))).toBe(true);
  });
});
