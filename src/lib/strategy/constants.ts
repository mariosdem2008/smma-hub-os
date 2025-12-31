// Strategy OS - Constants

import { Target, Layers, Calendar, CalendarDays, Share2, Shield, LayoutDashboard } from 'lucide-react';
import type { StrategyModule, StrategyStatus, Platform, AICopilotMode } from './types';

// Module definitions with metadata
export interface ModuleDefinition {
  key: StrategyModule;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof Target;
}

export const STRATEGY_MODULES: ModuleDefinition[] = [
  {
    key: 'positioning',
    label: 'Positioning',
    shortLabel: 'Position',
    description: 'Define the single-sentence positioning that anchors every campaign.',
    icon: Target,
  },
  {
    key: 'pillars',
    label: 'Pillars',
    shortLabel: 'Pillars',
    description: '3-6 pillars that shape content themes, proof, and differentiation.',
    icon: Layers,
  },
  {
    key: 'campaign_plan',
    label: 'Campaign Plan',
    shortLabel: 'Campaign',
    description: 'Monthly arcs, offers, and priorities that drive pipeline impact.',
    icon: Calendar,
  },
  {
    key: 'weekly_plan',
    label: 'Weekly Plan',
    shortLabel: 'Weekly',
    description: 'Weekly goals, cadence, and production focus.',
    icon: CalendarDays,
  },
  {
    key: 'channel_adaptations',
    label: 'Channel Adaptations',
    shortLabel: 'Channels',
    description: 'How strategy shifts by channel while keeping the core message.',
    icon: Share2,
  },
  {
    key: 'rules_constraints',
    label: 'Rules / Constraints',
    shortLabel: 'Rules',
    description: 'Guardrails, claims, and compliance notes for safe execution.',
    icon: Shield,
  },
];

// Status definitions with colors
export interface StatusDefinition {
  key: StrategyStatus;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const STRATEGY_STATUSES: StatusDefinition[] = [
  {
    key: 'empty',
    label: 'Empty',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
    borderColor: 'border-muted',
  },
  {
    key: 'draft',
    label: 'Draft',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  {
    key: 'review',
    label: 'In Review',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    key: 'approved',
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    key: 'locked',
    label: 'Locked',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
];

// Platform definitions
export interface PlatformDefinition {
  key: Platform;
  label: string;
  shortLabel: string;
  color: string;
}

export const PLATFORMS: PlatformDefinition[] = [
  { key: 'instagram', label: 'Instagram', shortLabel: 'IG', color: 'text-pink-400' },
  { key: 'tiktok', label: 'TikTok', shortLabel: 'TT', color: 'text-cyan-400' },
  { key: 'linkedin', label: 'LinkedIn', shortLabel: 'LI', color: 'text-blue-400' },
  { key: 'facebook', label: 'Facebook', shortLabel: 'FB', color: 'text-blue-500' },
  { key: 'youtube', label: 'YouTube', shortLabel: 'YT', color: 'text-red-400' },
];

// AI Copilot mode definitions
export interface AICopilotModeDefinition {
  key: AICopilotMode;
  label: string;
  description: string;
  gated?: boolean;
}

export const AI_COPILOT_MODES: AICopilotModeDefinition[] = [
  {
    key: 'assist',
    label: 'Assist',
    description: 'Shows suggestions without changing content. User must manually apply.',
  },
  {
    key: 'draft',
    label: 'Draft',
    description: 'AI generates content drafts. Shows preview for approval before applying.',
  },
  {
    key: 'autopilot',
    label: 'Autopilot',
    description: 'AI auto-applies suggestions. Requires explicit unlock.',
    gated: true,
  },
];

// Right rail tab definitions
export const RIGHT_RAIL_TABS = [
  { key: 'ai', label: 'AI Copilot' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'history', label: 'History' },
  { key: 'tasks', label: 'Tasks' },
] as const;

// Mission control nav item
export const MISSION_CONTROL_NAV = {
  key: 'mission-control' as const,
  label: 'Mission Control',
  shortLabel: 'Overview',
  description: 'Strategy overview and health metrics.',
  icon: LayoutDashboard,
};

// Helper functions
export function getModuleDefinition(module: StrategyModule): ModuleDefinition | undefined {
  return STRATEGY_MODULES.find((m) => m.key === module);
}

export function getStatusDefinition(status: StrategyStatus): StatusDefinition | undefined {
  return STRATEGY_STATUSES.find((s) => s.key === status);
}

export function getPlatformDefinition(platform: Platform): PlatformDefinition | undefined {
  return PLATFORMS.find((p) => p.key === platform);
}

// Pillar purpose labels
export const PILLAR_PURPOSE_LABELS: Record<string, string> = {
  reach: 'Reach',
  authority: 'Authority',
  leads: 'Leads',
  proof: 'Proof',
};

// Task priority labels and colors
export const TASK_PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-muted-foreground', bgColor: 'bg-muted/30' },
  medium: { label: 'Medium', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  high: { label: 'High', color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  urgent: { label: 'Urgent', color: 'text-red-400', bgColor: 'bg-red-500/10' },
};

// Task status labels
export const TASK_STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
  pushed: 'Pushed to Pipeline',
};

// History event type labels
export const HISTORY_EVENT_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  locked: 'Locked',
  unlocked: 'Unlocked',
  seeded: 'Template Draft',
  approved: 'Approved',
  task_created: 'Task Created',
  task_generated: 'Tasks Generated',
  task_pushed: 'Tasks Pushed',
};
