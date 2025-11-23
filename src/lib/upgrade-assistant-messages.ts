import type { AssistantReason } from '@/contexts/UpgradeAssistantContext';
import type { PlanType } from './plan-limits';

export interface AssistantMessage {
  title: string;
  message: string;
  recommendedPlan: PlanType;
  features: string[];
}

export function getAssistantMessage(
  reason: AssistantReason,
  currentPlan: PlanType
): AssistantMessage {
  const messages: Record<AssistantReason, AssistantMessage> = {
    storage_near_limit: {
      title: "You're running out of storage",
      message: "You've uploaded a lot of content recently — Pro gives you 500GB of storage.",
      recommendedPlan: 'pro',
      features: ['500GB storage', 'Unlimited uploads', 'Full-quality assets'],
    },
    client_limit_reached: {
      title: currentPlan === 'free' ? 'Great momentum!' : 'Ready to scale?',
      message: currentPlan === 'free' 
        ? 'Add more clients by upgrading to Starter or Pro.'
        : 'Upgrade to Pro to manage up to 10 clients.',
      recommendedPlan: currentPlan === 'free' ? 'pro' : 'pro',
      features: ['10 clients', '10 team members', 'White-label', 'Approval workflows'],
    },
    team_limit_reached: {
      title: 'Your team is growing',
      message: 'Add more team members with Pro or Agency Plus.',
      recommendedPlan: currentPlan === 'starter' ? 'pro' : 'agency_plus',
      features: ['10+ team members', 'Role management', 'Client assignments'],
    },
    analytics_interest: {
      title: 'Unlock full analytics',
      message: 'It looks like you rely on analytics. Starter unlocks full 30-day insights.',
      recommendedPlan: 'starter',
      features: ['Full analytics history', 'Advanced reports', 'Export data'],
    },
    ai_usage_high: {
      title: 'You love our AI tools',
      message: 'Get unlimited AI generations with Pro or Agency Plus.',
      recommendedPlan: 'pro',
      features: ['Unlimited AI tools', 'Advanced AI features', 'Priority processing'],
    },
    onboarding_growth_detected: {
      title: 'Welcome to SMMAHUB!',
      message: "You're off to a great start. Unlock your full potential with Pro.",
      recommendedPlan: 'pro',
      features: ['10 clients', 'White-label', 'Full analytics', 'Workflows'],
    },
    white_label_interest: {
      title: 'Brand it your way',
      message: 'Pro unlocks full white-label so you can brand SMMAHUB as your agency.',
      recommendedPlan: 'pro',
      features: ['Full white-label', 'Custom branding', 'Remove SMMAHUB branding'],
    },
    workflows_interest: {
      title: 'Streamline your process',
      message: 'Pro includes approval workflows to manage client content efficiently.',
      recommendedPlan: 'pro',
      features: ['Approval workflows', 'Content review', 'Client approvals'],
    },
    bulk_actions_interest: {
      title: 'Save time with bulk actions',
      message: 'Schedule multiple posts at once with Starter or Pro.',
      recommendedPlan: 'starter',
      features: ['Bulk scheduling', 'Multi-post upload', 'Templates library'],
    },
    time_trigger_72h: {
      title: 'Ready to level up?',
      message: "You've been using SMMAHUB for a few days. See what Pro can do.",
      recommendedPlan: 'pro',
      features: ['10 clients', 'White-label', 'Full analytics', '500GB storage'],
    },
    session_trigger: {
      title: 'Make the most of SMMAHUB',
      message: 'Upgrade to unlock all features and grow your agency faster.',
      recommendedPlan: currentPlan === 'free' ? 'starter' : 'pro',
      features: ['All features', 'Priority support', 'Advanced tools'],
    },
  };

  return messages[reason];
}

export function getRecommendedPlan(currentPlan: PlanType): PlanType {
  switch (currentPlan) {
    case 'free':
      return 'pro';
    case 'starter':
    case 'ltd_starter':
      return 'pro';
    case 'pro':
    case 'ltd_pro':
      return 'agency_plus';
    default:
      return 'pro';
  }
}
