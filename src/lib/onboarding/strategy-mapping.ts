// ============================================================================
// Onboarding Profile → Strategy Modules Mapping
// Maps completed onboarding data to strategy module content
// Matches exact schemas in src/lib/strategy/types.ts
// ============================================================================

import type { OnboardingProfile } from '@/types/onboarding';
import type {
  PositioningContent,
  PillarsContent,
  CampaignPlanContent,
  WeeklyPlanContent,
  ChannelAdaptationsContent,
  RulesConstraintsContent,
  ModuleContent,
  StrategyModule,
  ProofPoint,
  Differentiator,
  Pillar,
  Campaign,
  ChannelConfig,
  ClaimPolicy,
  Platform,
} from '@/lib/strategy/types';

// ============================================================================
// Module Mappers - Each matches the exact schema in types.ts
// ============================================================================

// Map profile to positioning module (PositioningContent schema)
export function mapToPositioning(profile: OnboardingProfile): PositioningContent {
  const differentiators = profile.q13_differentiators ?? [];
  const proofPointsData = (profile.q15_proof_points as { claim: string; evidence: string; confidence: number }[]) ?? [];

  // Build proof points matching ProofPoint interface
  const proofPoints: ProofPoint[] = proofPointsData.map((pp, i) => ({
    id: `proof-${i}`,
    claim: pp.claim,
    evidence: pp.evidence,
    confidence: (Math.min(5, Math.max(1, pp.confidence)) as 1 | 2 | 3 | 4 | 5),
  }));

  // Build differentiators matching Differentiator interface
  const mappedDifferentiators: Differentiator[] = differentiators.map((d, i) => ({
    id: `diff-${i}`,
    rank: i + 1,
    approvedPhrasing: d,
    bannedPhrasing: [],
  }));

  // Build the positioning sentence
  const sentence = {
    target: profile.q8_ideal_customer ?? '',
    category: profile.q5_offer_type ?? '',
    differentiator: differentiators[0] ?? '',
    benefit: profile.q10_desired_outcome ?? '',
  };

  // Compose final sentence
  const parts: string[] = [];
  if (sentence.target) parts.push(`For ${sentence.target}`);
  if (sentence.category) parts.push(`who need ${sentence.category}`);
  if (sentence.differentiator) parts.push(`we are the only ${sentence.differentiator}`);
  if (sentence.benefit) parts.push(`that ${sentence.benefit}`);
  const finalSentence = parts.length > 0 ? parts.join(' ') + '.' : '';

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    sentence,
    finalSentence,
    proofPoints,
    differentiators: mappedDifferentiators,
    boundaries: {
      allowedPromises: proofPointsData.filter(pp => pp.confidence >= 4).map(pp => pp.claim),
      riskyPromises: proofPointsData.filter(pp => pp.confidence >= 2 && pp.confidence < 4).map(pp => pp.claim),
      forbiddenPromises: [],
    },
    decisions: {
      sentenceLocked: false,
      differentiatorsLocked: false,
    },
  };
}

// Map profile to pillars module (PillarsContent schema)
export function mapToPillars(profile: OnboardingProfile): PillarsContent {
  const pillars: Pillar[] = [];
  const painPoints = profile.q9_pain_points ?? [];
  const differentiators = profile.q13_differentiators ?? [];

  // Generate pillars from pain points and differentiators
  let pillarIndex = 0;
  const totalPillars = Math.min(5, painPoints.length + differentiators.length + 1);
  const coveragePerPillar = Math.floor(100 / totalPillars);

  // Add pillars from pain points
  painPoints.slice(0, 2).forEach((pain, i) => {
    pillars.push({
      id: `pillar-pain-${i}`,
      name: `Solving: ${pain}`,
      coveragePercent: coveragePerPillar,
      purpose: i === 0 ? 'authority' : 'reach',
      coreMessage: `We help customers overcome ${pain}`,
      contentTypes: ['educational', 'tips', 'how-to'],
      bannedAngles: [],
      kpis: ['engagement', 'saves'],
      examples: [],
    });
    pillarIndex++;
  });

  // Add pillars from differentiators
  differentiators.slice(0, 2).forEach((diff, i) => {
    pillars.push({
      id: `pillar-diff-${i}`,
      name: diff,
      coveragePercent: coveragePerPillar,
      purpose: 'proof',
      coreMessage: `Our unique approach: ${diff}`,
      contentTypes: ['case-study', 'behind-the-scenes', 'testimonial'],
      bannedAngles: [],
      kpis: ['trust', 'conversions'],
      examples: [],
    });
    pillarIndex++;
  });

  // Add offer pillar if needed
  if (pillars.length < 3 && profile.q6_offer_name) {
    pillars.push({
      id: 'pillar-offer-0',
      name: `${profile.q6_offer_name} focus`,
      coveragePercent: coveragePerPillar,
      purpose: 'leads',
      coreMessage: `Our core offer: ${profile.q6_offer_name}`,
      contentTypes: ['product', 'demo', 'offer'],
      bannedAngles: [],
      kpis: ['leads', 'clicks'],
      examples: [],
    });
  }

  // Adjust coverage to sum to 100
  if (pillars.length > 0) {
    const remainder = 100 - (pillars.length * coveragePerPillar);
    pillars[0].coveragePercent += remainder;
  }

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    pillars,
    proofInventory: [],
    decisions: {
      pillarNamesLocked: false,
      coverageLocked: false,
      bannedAnglesLocked: false,
    },
  };
}

// Map profile to campaign plan module (CampaignPlanContent schema)
export function mapToCampaignPlan(profile: OnboardingProfile): CampaignPlanContent {
  const campaigns: Campaign[] = [];

  if (profile.q6_offer_name) {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    campaigns.push({
      id: 'campaign-0',
      name: `${profile.q6_offer_name} Launch`,
      goal: profile.q17_primary_goal ?? 'leads',
      offer: profile.q6_offer_name,
      cta: profile.q6_main_cta ?? 'Book a call',
      icp: profile.q8_ideal_customer ?? '',
      pillarIds: [],
      angle: `Solve ${profile.q9_pain_points?.[0] ?? 'their problem'}`,
      assets: [
        { name: 'Hero video', completed: false },
        { name: 'Landing page', completed: false },
        { name: 'Social graphics', completed: false },
      ],
      kpiTargets: {
        leads: 50,
        engagement: 5,
      },
      startDate,
      endDate,
      status: 'planned',
    });
  }

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    selectedMonth: new Date().toISOString().slice(0, 7),
    campaigns,
    stopDoing: [],
    decisions: {
      monthlyOffersLocked: false,
      activeCampaignsLocked: false,
    },
  };
}

// Map profile to weekly plan module (WeeklyPlanContent schema)
export function mapToWeeklyPlan(profile: OnboardingProfile): WeeklyPlanContent {
  const cadence = profile.q18_cadence as Record<string, number> | undefined ?? {};

  // Convert to proper cadence matrix
  const cadenceMatrix: Record<string, number> = {};
  for (const [platform, posts] of Object.entries(cadence)) {
    cadenceMatrix[platform] = posts;
  }

  // Get current week in ISO format
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) + startOfYear.getDay() + 1) / 7);
  const selectedWeek = `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    selectedWeek,
    weeklyFocus: {
      objective: profile.q10_desired_outcome ?? '',
      primaryCampaignId: 'campaign-0',
      priorityPillarIds: [],
      kpiFocus: [profile.q17_primary_goal ?? 'engagement'],
    },
    cadenceMatrix,
    productionChecklist: [],
    weeklyReview: {
      wins: [],
      losses: [],
      changesNextWeek: [],
    },
    decisions: {
      objectiveLocked: false,
      cadenceLocked: false,
    },
  };
}

// Map profile to channel adaptations module (ChannelAdaptationsContent schema)
export function mapToChannelAdaptations(profile: OnboardingProfile): ChannelAdaptationsContent {
  const enabledChannels = profile.q16_enabled_channels ?? [];
  const cadence = profile.q18_cadence as Record<string, number> | undefined ?? {};
  const goal = profile.q17_primary_goal ?? 'discovery';

  // Platform-specific defaults
  const platformDefaults: Record<string, Partial<ChannelConfig>> = {
    instagram: {
      role: 'Visual storytelling and community engagement',
      formats: ['reels', 'stories', 'carousels', 'posts'],
      hookRules: ['Start with movement', 'Use text overlays'],
      ctaRules: ['Link in bio', 'Swipe up (stories)'],
      visualRules: ['Bright colors', 'Face-forward content'],
      dos: ['Use trending audio', 'Post consistently', 'Engage with comments'],
      donts: ['Low-quality images', 'Excessive hashtags', 'Ignoring DMs'],
    },
    tiktok: {
      role: 'Viral discovery and entertainment',
      formats: ['short-form video', 'duets', 'stitches'],
      hookRules: ['Hook in first 1 second', 'Use trending sounds'],
      ctaRules: ['Link in bio', 'Comment engagement'],
      visualRules: ['Raw/authentic look', 'Vertical format'],
      dos: ['Follow trends', 'Post frequently', 'Use native features'],
      donts: ['Over-produced content', 'Hard selling', 'Ignoring trends'],
    },
    linkedin: {
      role: 'Professional thought leadership',
      formats: ['text posts', 'articles', 'carousels', 'video'],
      hookRules: ['Lead with insight', 'Use line breaks'],
      ctaRules: ['Direct website links', 'Lead gen forms'],
      visualRules: ['Professional imagery', 'Clean graphics'],
      dos: ['Share expertise', 'Engage with industry', 'Personal stories'],
      donts: ['Casual tone', 'Clickbait', 'Over-promotion'],
    },
    facebook: {
      role: 'Community building and sharing',
      formats: ['posts', 'reels', 'stories', 'live'],
      hookRules: ['Question hooks', 'Story-based'],
      ctaRules: ['Direct links', 'Messenger CTAs'],
      visualRules: ['Shareable content', 'Text-friendly'],
      dos: ['Build groups', 'Encourage shares', 'Go live'],
      donts: ['Engagement bait', 'Excessive posting', 'Ignoring comments'],
    },
    youtube_shorts: {
      role: 'Evergreen discovery content',
      formats: ['shorts', 'long-form', 'community'],
      hookRules: ['Hook in thumbnail', 'First 3 seconds'],
      ctaRules: ['Subscribe CTA', 'Description links'],
      visualRules: ['High quality', 'SEO-optimized'],
      dos: ['SEO titles', 'Consistent uploads', 'End screens'],
      donts: ['Clickbait thumbnails', 'Ignoring comments', 'Inconsistent schedule'],
    },
  };

  const channels: ChannelConfig[] = enabledChannels.map((platform, i) => {
    const defaults = platformDefaults[platform] ?? {};
    return {
      id: `channel-${i}`,
      platform: platform as Platform,
      enabled: true,
      role: defaults.role ?? `${platform} channel`,
      formats: defaults.formats ?? [],
      hookRules: defaults.hookRules ?? [],
      ctaRules: defaults.ctaRules ?? [],
      visualRules: defaults.visualRules ?? [],
      cadence: `${cadence[platform] ?? 0} posts/week`,
      dos: defaults.dos ?? [],
      donts: defaults.donts ?? [],
      examples: [],
    };
  });

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    channels,
    translationTable: [],
    decisions: {
      ctasLocked: false,
      rulesLocked: false,
    },
  };
}

// Map profile to rules & constraints module (RulesConstraintsContent schema)
export function mapToRulesConstraints(profile: OnboardingProfile): RulesConstraintsContent {
  const proofPointsData = (profile.q15_proof_points as { claim: string; evidence: string; confidence: number }[]) ?? [];
  const proofLevel = profile.q14_proof_level ?? 'none';

  // Map proof points to claims policy
  const claimsPolicy: ClaimPolicy[] = proofPointsData.map((pp, i) => ({
    id: `claim-${i}`,
    claim: pp.claim,
    status: pp.confidence >= 4 ? 'allowed' : 'proof_required',
    proofLink: pp.evidence || undefined,
  }));

  return {
    meta: {
      source: 'IMPORT',
      generated_at: new Date().toISOString(),
    },
    claimsPolicy,
    bannedWords: [],
    requiredDisclaimers: proofLevel === 'none' ? ['Results may vary'] : [],
    approvalTriggers: [
      { id: 'trigger-1', condition: 'Contains price/offer', action: 'Requires manager approval' },
      { id: 'trigger-2', condition: 'Makes specific claims', action: 'Check proof inventory' },
    ],
    decisions: {
      forbiddenClaimsLocked: false,
      bannedTermsLocked: false,
    },
  };
}

// ============================================================================
// Main Mapping Function
// ============================================================================

// Maps profile to all 6 strategy modules
export function mapOnboardingToStrategy(profile: OnboardingProfile): Record<StrategyModule, ModuleContent> {
  return {
    positioning: mapToPositioning(profile),
    pillars: mapToPillars(profile),
    campaign_plan: mapToCampaignPlan(profile),
    weekly_plan: mapToWeeklyPlan(profile),
    channel_adaptations: mapToChannelAdaptations(profile),
    rules_constraints: mapToRulesConstraints(profile),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

// Generate positioning statement from profile
export function generatePositioningStatement(profile: OnboardingProfile): string {
  const parts: string[] = [];

  if (profile.q8_ideal_customer) {
    parts.push(`We help ${profile.q8_ideal_customer}`);
  }

  if (profile.q10_desired_outcome) {
    parts.push(`achieve ${profile.q10_desired_outcome}`);
  }

  if (profile.q6_offer_name) {
    parts.push(`through ${profile.q6_offer_name}`);
  }

  const differentiators = profile.q13_differentiators ?? [];
  if (differentiators[0]) {
    parts.push(`with ${differentiators[0]}`);
  }

  return parts.length > 0 ? parts.join(' ') + '.' : '';
}

// Infer content pillars from profile
export function inferContentPillars(profile: OnboardingProfile): string[] {
  const pillars: string[] = [];

  // From pain points
  const painPoints = profile.q9_pain_points ?? [];
  painPoints.slice(0, 2).forEach((pain) => {
    pillars.push(`Solving: ${pain}`);
  });

  // From differentiators
  const differentiators = profile.q13_differentiators ?? [];
  differentiators.slice(0, 2).forEach((diff) => {
    pillars.push(diff);
  });

  // Offer focus
  if (profile.q6_offer_name && pillars.length < 3) {
    pillars.push(`${profile.q6_offer_name} focus`);
  }

  return pillars.slice(0, 5);
}
