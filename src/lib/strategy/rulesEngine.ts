// Strategy OS - Rules Engine for completion + blockers

import type {
  StrategyModule,
  ModuleContent,
  StrategyBlocker,
  BlockerSeverity,
  StrategyStatus,
  PositioningContent,
  PillarsContent,
  CampaignPlanContent,
  WeeklyPlanContent,
  ChannelAdaptationsContent,
  RulesConstraintsContent,
} from './types';

export interface ModuleEvaluationResult {
  completion_percent: number;
  blockers: StrategyBlocker[];
  status: StrategyStatus;
}

export interface RulesEngineContext {
  modules?: Partial<Record<StrategyModule, ModuleContent>>;
  currentStatus?: StrategyStatus;
  isLocked?: boolean;
}

const severityRank: Record<BlockerSeverity, number> = {
  low: 1,
  med: 2,
  high: 3,
};

function pushBlocker(
  blockers: StrategyBlocker[],
  code: string,
  message: string,
  severity: BlockerSeverity,
  field_path?: string
) {
  blockers.push({ code, message, severity, field_path });
}

function getHighestSeverity(blockers: StrategyBlocker[]): BlockerSeverity | null {
  if (blockers.length === 0) return null;
  return blockers.reduce((highest, blocker) =>
    severityRank[blocker.severity] > severityRank[highest] ? blocker.severity : highest
  , blockers[0].severity);
}

function clampCompletion(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function evaluateStrategyModule(
  module: StrategyModule,
  content: ModuleContent,
  context: RulesEngineContext = {}
): ModuleEvaluationResult {
  const blockers: StrategyBlocker[] = [];
  let completion = 0;
  let hasContent = false;

  switch (module) {
    case 'positioning': {
      const data = content as PositioningContent;
      const hasFinalSentence = !!data.finalSentence?.trim();
      const proofPoints = data.proofPoints ?? [];
      const differentiators = data.differentiators ?? [];
      const forbiddenPromises = data.boundaries?.forbiddenPromises ?? [];
      const proofPointsWithEvidence = proofPoints.filter((p) => p.evidence?.trim());

      hasContent =
        hasFinalSentence || proofPoints.length > 0 || differentiators.length > 0 || forbiddenPromises.length > 0;

      const criteria = [
        hasFinalSentence,
        proofPoints.length >= 3,
        proofPointsWithEvidence.length === proofPoints.length && proofPoints.length > 0,
        differentiators.length >= 2,
        forbiddenPromises.length > 0,
      ];

      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!hasFinalSentence) {
        pushBlocker(blockers, 'positioning.final_sentence_missing', 'Add the final positioning sentence.', 'high', 'finalSentence');
      }
      if (proofPoints.length < 3) {
        pushBlocker(blockers, 'positioning.proof_points_min', 'Add at least 3 proof points.', 'med', 'proofPoints');
      }
      if (proofPoints.length > 0 && proofPointsWithEvidence.length !== proofPoints.length) {
        pushBlocker(blockers, 'positioning.proof_points_evidence', 'All proof points need evidence links.', 'high', 'proofPoints');
      }
      if (differentiators.length < 2) {
        pushBlocker(blockers, 'positioning.differentiators_min', 'Add at least 2 differentiators.', 'med', 'differentiators');
      }
      if (forbiddenPromises.length === 0) {
        pushBlocker(blockers, 'positioning.forbidden_promises', 'Define at least one forbidden promise.', 'med', 'boundaries.forbiddenPromises');
      }
      break;
    }
    case 'pillars': {
      const data = content as PillarsContent;
      const pillars = data.pillars ?? [];
      const coverageSum = pillars.reduce((sum, pillar) => sum + (pillar.coveragePercent ?? 0), 0);
      const examplesComplete = pillars.every((pillar) => (pillar.examples ?? []).length >= 3);

      hasContent = pillars.length > 0;

      const criteria = [
        pillars.length >= 3 && pillars.length <= 6,
        coverageSum === 100,
        examplesComplete && pillars.length > 0,
      ];

      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (pillars.length < 3 || pillars.length > 6) {
        pushBlocker(blockers, 'pillars.count_range', 'Keep between 3 and 6 pillars.', 'high', 'pillars');
      }
      if (pillars.length > 0 && coverageSum !== 100) {
        pushBlocker(blockers, 'pillars.coverage_sum', 'Pillar coverage must equal 100%.', 'med', 'pillars');
      }
      if (pillars.some((pillar) => (pillar.examples ?? []).length < 3)) {
        pushBlocker(blockers, 'pillars.examples_min', 'Add at least 3 examples per pillar.', 'med', 'pillars.examples');
      }
      break;
    }
    case 'campaign_plan': {
      const data = content as CampaignPlanContent;
      const campaigns = data.campaigns ?? [];
      const monthCampaigns = campaigns.filter((campaign) =>
        campaign.startDate?.startsWith(data.selectedMonth)
      );
      const hasCampaignForMonth = monthCampaigns.length > 0;
      const assetsComplete = monthCampaigns.every((campaign) => (campaign.assets ?? []).length > 0);
      const offersComplete = monthCampaigns.every(
        (campaign) =>
          !!campaign.offer?.trim() &&
          !!campaign.cta?.trim() &&
          !!campaign.startDate?.trim() &&
          !!campaign.endDate?.trim()
      );

      hasContent = campaigns.length > 0;

      const criteria = [
        hasCampaignForMonth,
        assetsComplete && monthCampaigns.length > 0,
        offersComplete && monthCampaigns.length > 0,
      ];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!hasCampaignForMonth) {
        pushBlocker(blockers, 'campaigns.none', 'Add a campaign for the selected month.', 'high', 'campaigns');
      }
      if (monthCampaigns.some((campaign) => (campaign.assets ?? []).length === 0)) {
        pushBlocker(blockers, 'campaigns.assets_missing', 'Add assets checklist entries for each campaign.', 'high', 'campaigns.assets');
      }
      if (!offersComplete && monthCampaigns.length > 0) {
        pushBlocker(blockers, 'campaigns.offer_cta_dates', 'Each campaign needs an offer, CTA, and dates.', 'high', 'campaigns');
      }
      break;
    }
    case 'weekly_plan': {
      const data = content as WeeklyPlanContent;
      const objective = data.weeklyFocus?.objective ?? '';
      const productionChecklist = data.productionChecklist ?? [];
      const cadenceMatrix = data.cadenceMatrix ?? {};

      hasContent = !!objective.trim() || productionChecklist.length > 0;

      const enabledChannels = (() => {
        const channelContent = context.modules?.channel_adaptations as ChannelAdaptationsContent | undefined;
        if (!channelContent) return [] as Array<{ key: string; enabled: boolean }>;
        return (channelContent.channels ?? []).map((channel) => ({ key: channel.platform, enabled: channel.enabled }));
      })();

      const activeChannelKeys = enabledChannels.length
        ? enabledChannels.filter((channel) => channel.enabled).map((channel) => channel.key)
        : Object.keys(cadenceMatrix);

      const cadenceComplete = activeChannelKeys.length > 0
        ? activeChannelKeys.every((channel) => (cadenceMatrix as Record<string, number>)[channel] > 0)
        : false;

      const criteria = [!!objective.trim(), cadenceComplete, productionChecklist.length > 0];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (!objective.trim()) {
        pushBlocker(blockers, 'weekly.objective_missing', 'Add a weekly objective.', 'high', 'weeklyFocus.objective');
      }
      if (!cadenceComplete) {
        pushBlocker(blockers, 'weekly.cadence_missing', 'Cadence is missing for at least one active channel.', 'med', 'cadenceMatrix');
      }
      if (productionChecklist.length === 0) {
        pushBlocker(blockers, 'weekly.production_missing', 'Add items to the production checklist.', 'high', 'productionChecklist');
      }
      break;
    }
    case 'channel_adaptations': {
      const data = content as ChannelAdaptationsContent;
      const channels = data.channels ?? [];
      const enabledChannels = channels.filter((channel) => channel.enabled);
      const ctaRulesComplete = enabledChannels.every((channel) => (channel.ctaRules ?? []).length > 0);
      const translationRows = data.translationTable ?? [];

      const enabledKeys = enabledChannels.map((channel) => channel.platform);
      const translationComplete =
        translationRows.length > 0 &&
        translationRows.every((row) => {
          const hasCore = !!row.coreMessage?.trim();
          const variants = row.variants ?? {};
          const hasVariants = enabledKeys.every((key) => !!variants[key]?.trim());
          return hasCore && hasVariants;
        });

      hasContent = enabledChannels.length > 0 || translationRows.length > 0;

      const criteria = [enabledChannels.length >= 2, ctaRulesComplete, translationComplete];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (enabledChannels.length < 2) {
        pushBlocker(blockers, 'channels.count_min', 'Enable at least 2 channels.', 'high', 'channels');
      }
      if (!ctaRulesComplete && enabledChannels.length > 0) {
        pushBlocker(blockers, 'channels.cta_rules', 'Add CTA rules for each enabled channel.', 'med', 'channels.ctaRules');
      }
      if (!translationComplete) {
        pushBlocker(blockers, 'channels.translation_table', 'Translation table needs a core message and variants.', 'high', 'translationTable');
      }
      break;
    }
    case 'rules_constraints': {
      const data = content as RulesConstraintsContent;
      const claimsPolicy = data.claimsPolicy ?? [];
      const proofRequiredMissing = claimsPolicy.filter(
        (claim) => claim.status === 'proof_required' && !claim.proofLink
      );

      hasContent = claimsPolicy.length > 0 || (data.bannedWords ?? []).length > 0;

      const criteria = [proofRequiredMissing.length === 0 && claimsPolicy.length > 0, (data.bannedWords ?? []).length > 0, (data.approvalTriggers ?? []).length > 0];
      completion = (criteria.filter(Boolean).length / criteria.length) * 100;

      if (proofRequiredMissing.length > 0) {
        pushBlocker(blockers, 'rules.proof_links', 'Proof-required claims need proof links.', 'high', 'claimsPolicy');
      }
      if ((data.bannedWords ?? []).length === 0) {
        pushBlocker(blockers, 'rules.banned_terms', 'Add banned terms.', 'med', 'bannedWords');
      }
      if ((data.approvalTriggers ?? []).length === 0) {
        pushBlocker(blockers, 'rules.approval_triggers', 'Add approval triggers.', 'med', 'approvalTriggers');
      }
      break;
    }
  }

  const currentStatus = context.currentStatus;
  const isLocked = context.isLocked ?? false;
  const highestSeverity = getHighestSeverity(blockers);
  const hasBlockers = blockers.length > 0;

  let status: StrategyStatus = 'draft';

  if (!hasContent) {
    status = 'empty';
  } else if (isLocked) {
    status = 'locked';
  } else if (hasBlockers) {
    if (completion >= 80 && highestSeverity === 'low') {
      status = 'review';
    } else {
      status = 'draft';
    }
  } else if (currentStatus === 'approved') {
    status = 'approved';
  } else if (completion >= 80) {
    status = 'review';
  } else {
    status = 'draft';
  }

  return {
    completion_percent: clampCompletion(completion),
    blockers,
    status,
  };
}
