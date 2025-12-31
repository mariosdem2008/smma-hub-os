// Strategy OS - Default Content Schemas

import type {
  PositioningContent,
  PillarsContent,
  CampaignPlanContent,
  WeeklyPlanContent,
  ChannelAdaptationsContent,
  RulesConstraintsContent,
  StrategyModule,
  ModuleContent,
} from './types';

// Get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Get current week in YYYY-Www format
function getCurrentWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// Default Positioning content
export const DEFAULT_POSITIONING_CONTENT: PositioningContent = {
  meta: { source: 'MANUAL' },
  sentence: {
    target: '',
    category: '',
    differentiator: '',
    benefit: '',
  },
  finalSentence: '',
  proofPoints: [],
  differentiators: [],
  boundaries: {
    allowedPromises: [],
    riskyPromises: [],
    forbiddenPromises: [],
  },
  decisions: {
    sentenceLocked: false,
    differentiatorsLocked: false,
  },
};

// Default Pillars content
export const DEFAULT_PILLARS_CONTENT: PillarsContent = {
  meta: { source: 'MANUAL' },
  pillars: [],
  proofInventory: [],
  decisions: {
    pillarNamesLocked: false,
    coverageLocked: false,
    bannedAnglesLocked: false,
  },
};

// Default Campaign Plan content
export const DEFAULT_CAMPAIGN_PLAN_CONTENT: CampaignPlanContent = {
  meta: { source: 'MANUAL' },
  selectedMonth: getCurrentMonth(),
  campaigns: [],
  stopDoing: [],
  decisions: {
    monthlyOffersLocked: false,
    activeCampaignsLocked: false,
  },
};

// Default Weekly Plan content
export const DEFAULT_WEEKLY_PLAN_CONTENT: WeeklyPlanContent = {
  meta: { source: 'MANUAL' },
  selectedWeek: getCurrentWeek(),
  weeklyFocus: {
    objective: '',
    primaryCampaignId: '',
    priorityPillarIds: [],
    kpiFocus: [],
  },
  cadenceMatrix: {
    instagram: 0,
    tiktok: 0,
    linkedin: 0,
    facebook: 0,
    youtube: 0,
  },
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

// Default Channel Adaptations content
export const DEFAULT_CHANNEL_ADAPTATIONS_CONTENT: ChannelAdaptationsContent = {
  meta: { source: 'MANUAL' },
  channels: [
    {
      id: 'instagram',
      platform: 'instagram',
      enabled: true,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
    {
      id: 'tiktok',
      platform: 'tiktok',
      enabled: true,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
    {
      id: 'linkedin',
      platform: 'linkedin',
      enabled: true,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
    {
      id: 'facebook',
      platform: 'facebook',
      enabled: false,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
    {
      id: 'youtube',
      platform: 'youtube',
      enabled: false,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
  ],
  translationTable: [],
  decisions: {
    ctasLocked: false,
    rulesLocked: false,
  },
};

// Default Rules/Constraints content
export const DEFAULT_RULES_CONSTRAINTS_CONTENT: RulesConstraintsContent = {
  meta: { source: 'MANUAL' },
  claimsPolicy: [],
  bannedWords: [],
  requiredDisclaimers: [],
  approvalTriggers: [],
  decisions: {
    forbiddenClaimsLocked: false,
    bannedTermsLocked: false,
  },
};

// Get default content for a specific module
export function getDefaultModuleContent(module: StrategyModule): ModuleContent {
  switch (module) {
    case 'positioning':
      return { ...DEFAULT_POSITIONING_CONTENT, meta: { source: 'MANUAL' } };
    case 'pillars':
      return { ...DEFAULT_PILLARS_CONTENT, meta: { source: 'MANUAL' } };
    case 'campaign_plan':
      return {
        ...DEFAULT_CAMPAIGN_PLAN_CONTENT,
        selectedMonth: getCurrentMonth(),
        meta: { source: 'MANUAL' },
      };
    case 'weekly_plan':
      return {
        ...DEFAULT_WEEKLY_PLAN_CONTENT,
        selectedWeek: getCurrentWeek(),
        meta: { source: 'MANUAL' },
      };
    case 'channel_adaptations':
      return JSON.parse(JSON.stringify({ ...DEFAULT_CHANNEL_ADAPTATIONS_CONTENT, meta: { source: 'MANUAL' } }));
    case 'rules_constraints':
      return { ...DEFAULT_RULES_CONSTRAINTS_CONTENT, meta: { source: 'MANUAL' } };
    default:
      return {};
  }
}

// Deterministic template content for seeding (used by Generate Strategy)
export const TEMPLATE_POSITIONING: PositioningContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  sentence: {
    target: 'founder-led service brands',
    category: 'short-form content systems',
    differentiator: 'strategy-to-production operator',
    benefit: 'turns expertise into consistent demand',
  },
  finalSentence:
    'For founder-led service brands who need short-form content systems, we are the only strategy-to-production operator that turns expertise into consistent demand.',
  proofPoints: [
    {
      id: 'proof-1',
      claim: 'Consistent weekly production cadence',
      evidence: 'https://example.com/proof',
      confidence: 4,
    },
    {
      id: 'proof-2',
      claim: 'Improved inquiry volume from content refresh',
      evidence: 'https://example.com/proof',
      confidence: 3,
    },
    {
      id: 'proof-3',
      claim: 'Repurposed long-form into multi-channel clips',
      evidence: 'https://example.com/proof',
      confidence: 3,
    },
  ],
  differentiators: [
    {
      id: 'diff-1',
      rank: 1,
      approvedPhrasing: 'Strategy-to-production operator',
      bannedPhrasing: ['generalist', 'one-size-fits-all'],
    },
    {
      id: 'diff-2',
      rank: 2,
      approvedPhrasing: 'Founder-led messaging focus',
      bannedPhrasing: ['faceless', 'generic'],
    },
  ],
  boundaries: {
    allowedPromises: ['Clearer messaging', 'Consistent delivery', 'Improved engagement'],
    riskyPromises: ['Specific follower growth numbers', 'Revenue claims without proof'],
    forbiddenPromises: ['Guaranteed sales', 'Overnight success', 'Outperform any competitor'],
  },
  decisions: {
    sentenceLocked: false,
    differentiatorsLocked: false,
  },
};

export const TEMPLATE_PILLARS: PillarsContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  pillars: [
    {
      id: 'pillar-1',
      name: 'Authority',
      coveragePercent: 30,
      purpose: 'authority',
      coreMessage: 'Teach the how behind results',
      contentTypes: ['Frameworks', 'Breakdowns', 'Hot takes'],
      bannedAngles: ['Clickbait', 'Unverified claims'],
      kpis: ['Saves', 'Shares', 'Qualified comments'],
      examples: ['My 3-step audit method', 'Before/after teardown', 'Weekly Q&A recap'],
    },
    {
      id: 'pillar-2',
      name: 'Proof',
      coveragePercent: 25,
      purpose: 'proof',
      coreMessage: 'Show outcomes with evidence',
      contentTypes: ['Case studies', 'Screenshots', 'Client clips'],
      bannedAngles: ['Exaggerations', 'No context'],
      kpis: ['DMs', 'Clicks', 'Replies'],
      examples: ['Client win recap', 'Snapshot of KPIs', 'Process timeline'],
    },
    {
      id: 'pillar-3',
      name: 'Connection',
      coveragePercent: 25,
      purpose: 'reach',
      coreMessage: 'Make the brand feel human',
      contentTypes: ['Behind-the-scenes', 'Founder POV', 'Story moments'],
      bannedAngles: ['Off-brand humor', 'Sensitive topics'],
      kpis: ['Views', 'Shares', 'New followers'],
      examples: ['Founder day in life', 'Team workflow', 'Origin story clip'],
    },
    {
      id: 'pillar-4',
      name: 'Conversion',
      coveragePercent: 20,
      purpose: 'leads',
      coreMessage: 'Invite the next step clearly',
      contentTypes: ['Offers', 'Breakdowns', 'FAQs'],
      bannedAngles: ['Hard sell every post', 'Scarcity without proof'],
      kpis: ['Clicks', 'Leads', 'Booked calls'],
      examples: ['Offer walkthrough', 'FAQ response', 'Process explainer'],
    },
  ],
  proofInventory: [],
  decisions: {
    pillarNamesLocked: false,
    coverageLocked: false,
    bannedAnglesLocked: false,
  },
};

export const TEMPLATE_CAMPAIGN_PLAN: CampaignPlanContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  selectedMonth: getCurrentMonth(),
  campaigns: [
    {
      id: 'campaign-1',
      name: 'Monthly Authority Sprint',
      goal: 'Drive qualified leads into discovery calls',
      offer: 'Strategy audit with action plan',
      cta: 'Book the audit',
      icp: 'Founder-led service brands',
      pillarIds: ['pillar-1', 'pillar-2', 'pillar-4'],
      angle: 'Proof-backed clarity',
      assets: [
        { name: 'Hero overview video', completed: false },
        { name: 'Case study reel', completed: false },
        { name: 'Offer carousel', completed: false },
        { name: 'FAQ short', completed: false },
      ],
      kpiTargets: { leads: 100, signups: 25 },
      startDate: `${getCurrentMonth()}-01`,
      endDate: `${getCurrentMonth()}-31`,
      status: 'planned',
    },
  ],
  stopDoing: ['Generic motivational quotes', 'Off-topic trends'],
  decisions: {
    monthlyOffersLocked: false,
    activeCampaignsLocked: false,
  },
};

export const TEMPLATE_WEEKLY_PLAN: WeeklyPlanContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  selectedWeek: getCurrentWeek(),
  weeklyFocus: {
    objective: 'Drive audit bookings with proof-backed clips',
    primaryCampaignId: 'campaign-1',
    priorityPillarIds: ['pillar-1', 'pillar-2'],
    kpiFocus: ['Inquiries', 'Saves'],
  },
  cadenceMatrix: {
    instagram: 4,
    tiktok: 5,
    linkedin: 0,
    facebook: 0,
    youtube: 0,
  },
  productionChecklist: [
    { id: 'prod-1', type: 'script', title: 'Authority clip script', owner: '', dueDate: '', completed: false },
    { id: 'prod-2', type: 'shoot', title: 'Founder delivery session', owner: '', dueDate: '', completed: false },
    { id: 'prod-3', type: 'edit', title: 'Proof reel edit', owner: '', dueDate: '', completed: false },
  ],
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

export const TEMPLATE_CHANNEL_ADAPTATIONS: ChannelAdaptationsContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  channels: [
    {
      id: 'instagram',
      platform: 'instagram',
      enabled: true,
      role: 'Primary demand capture channel',
      formats: ['Reels', 'Carousels'],
      hookRules: ['Lead with outcome', 'Show proof within 3 seconds'],
      ctaRules: ['DM for audit', 'Book via link in bio'],
      visualRules: ['Clear captions', 'Brand colors', 'On-screen proof'],
      cadence: '4-5 posts/week',
      dos: ['Pin best proof', 'Reply to comments', 'Use subtitles'],
      donts: ['Overuse stock', 'Hide CTA', 'Bury proof'],
      examples: [],
    },
    {
      id: 'tiktok',
      platform: 'tiktok',
      enabled: true,
      role: 'Top-of-funnel discovery',
      formats: ['Short-form video', 'Talking head'],
      hookRules: ['Pattern interrupt', 'Call out a pain point'],
      ctaRules: ['Follow for more', 'DM for audit'],
      visualRules: ['Native feel', 'Fast cuts', 'Captions'],
      cadence: '5-7 posts/week',
      dos: ['Keep it punchy', 'Use real examples', 'Respond quickly'],
      donts: ['Over-produce', 'Jargon-heavy intros', 'No CTA'],
      examples: [],
    },
    {
      id: 'linkedin',
      platform: 'linkedin',
      enabled: true,
      role: 'Authority and partnerships',
      formats: ['Text posts', 'Document carousels'],
      hookRules: ['Lead with a contrarian insight', 'Show data quickly'],
      ctaRules: ['Comment for checklist', 'DM for audit'],
      visualRules: ['Clean diagrams', 'Readable typography'],
      cadence: '2-3 posts/week',
      dos: ['Use data', 'Invite discussion', 'Tag collaborators'],
      donts: ['Hard sell', 'No context', 'Overuse emojis'],
      examples: [],
    },
    {
      id: 'facebook',
      platform: 'facebook',
      enabled: false,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
    {
      id: 'youtube',
      platform: 'youtube',
      enabled: false,
      role: '',
      formats: [],
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: '',
      dos: [],
      donts: [],
      examples: [],
    },
  ],
  translationTable: [
    {
      coreMessage: 'Turn expertise into consistent demand',
      variants: {
        instagram: 'Your expertise deserves consistent demand',
        tiktok: 'POV: your content finally drives leads',
        linkedin: 'How founder-led brands turn expertise into demand',
      },
    },
  ],
  decisions: {
    ctasLocked: false,
    rulesLocked: false,
  },
};

export const TEMPLATE_RULES_CONSTRAINTS: RulesConstraintsContent = {
  meta: { source: 'TEMPLATE_DRAFT' },
  claimsPolicy: [
    { id: 'claim-1', claim: 'Consistent weekly posting', status: 'proof_required', proofLink: 'https://example.com/proof' },
    { id: 'claim-2', claim: 'Improved inquiry volume', status: 'proof_required', proofLink: 'https://example.com/proof' },
    { id: 'claim-3', claim: 'Content system built in 30 days', status: 'proof_required', proofLink: 'https://example.com/proof' },
    { id: 'claim-4', claim: 'Guaranteed results', status: 'forbidden' },
    { id: 'claim-5', claim: 'Overnight success', status: 'forbidden' },
    { id: 'claim-6', claim: 'Proven content framework', status: 'allowed' },
    { id: 'claim-7', claim: 'Founder-led messaging clarity', status: 'allowed' },
    { id: 'claim-8', claim: 'Audience growth in 7 days', status: 'forbidden' },
    { id: 'claim-9', claim: 'Case study backed', status: 'proof_required', proofLink: 'https://example.com/proof' },
    { id: 'claim-10', claim: 'No ad spend required', status: 'allowed' },
  ],
  bannedWords: ['Guaranteed', 'Promise', 'Best in the world', 'Unbeatable', 'Miracle'],
  requiredDisclaimers: ['Results may vary', 'Past performance not indicative of future results'],
  approvalTriggers: [
    { id: 'trigger-1', condition: 'Income claims', action: 'Require legal review' },
    { id: 'trigger-2', condition: 'Client testimonials', action: 'Verify permission' },
    { id: 'trigger-3', condition: 'Competitor mentions', action: 'Require manager approval' },
  ],
  decisions: {
    forbiddenClaimsLocked: false,
    bannedTermsLocked: false,
  },
};

// Get deterministic template content for a specific module
export function getTemplateDraftContent(module: StrategyModule): ModuleContent {
  const generatedAt = new Date().toISOString();
  switch (module) {
    case 'positioning':
      return { ...JSON.parse(JSON.stringify(TEMPLATE_POSITIONING)), meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt } };
    case 'pillars':
      return { ...JSON.parse(JSON.stringify(TEMPLATE_PILLARS)), meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt } };
    case 'campaign_plan':
      return {
        ...JSON.parse(JSON.stringify(TEMPLATE_CAMPAIGN_PLAN)),
        selectedMonth: getCurrentMonth(),
        meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt },
      };
    case 'weekly_plan':
      return {
        ...JSON.parse(JSON.stringify(TEMPLATE_WEEKLY_PLAN)),
        selectedWeek: getCurrentWeek(),
        meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt },
      };
    case 'channel_adaptations':
      return { ...JSON.parse(JSON.stringify(TEMPLATE_CHANNEL_ADAPTATIONS)), meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt } };
    case 'rules_constraints':
      return { ...JSON.parse(JSON.stringify(TEMPLATE_RULES_CONSTRAINTS)), meta: { source: 'TEMPLATE_DRAFT', generated_at: generatedAt } };
    default:
      return {};
  }
}
