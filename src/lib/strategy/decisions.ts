// Strategy OS - Decisions metadata

import type { StrategyModule } from './types';

export interface StrategyDecisionDefinition {
  key: string;
  label: string;
}

export const STRATEGY_DECISIONS: Record<StrategyModule, StrategyDecisionDefinition[]> = {
  positioning: [
    { key: 'positioning_sentence_locked', label: 'Positioning sentence' },
    { key: 'top_differentiators_locked', label: 'Top differentiators' },
  ],
  pillars: [
    { key: 'pillar_names_locked', label: 'Pillar names' },
    { key: 'coverage_locked', label: 'Coverage split' },
  ],
  campaign_plan: [
    { key: 'monthly_offers_locked', label: 'Monthly offers' },
    { key: 'active_campaigns_locked', label: 'Active campaigns' },
  ],
  weekly_plan: [
    { key: 'weekly_objective_locked', label: 'Weekly objective' },
    { key: 'cadence_locked', label: 'Cadence matrix' },
  ],
  channel_adaptations: [
    { key: 'channel_cta_rules_locked', label: 'Channel CTA rules' },
    { key: 'channel_do_dont_locked', label: 'Do/Don\'t rules' },
  ],
  rules_constraints: [
    { key: 'forbidden_claims_locked', label: 'Forbidden claims' },
    { key: 'banned_terms_locked', label: 'Banned terms' },
  ],
};
