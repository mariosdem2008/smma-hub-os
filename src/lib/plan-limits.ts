// Plan limits and feature configuration
export type PlanType = 'free' | 'starter' | 'pro' | 'agency_plus';

export interface PlanLimits {
  clients: number | null; // null = unlimited
  teamMembers: number | null;
  storage: number | null; // in bytes, null = unlimited
  analyticsHistoryDays: number | null; // null = unlimited
  features: {
    whiteLabel: boolean;
    approvalWorkflows: boolean;
    bulkActions: boolean;
    templates: boolean;
    automation: boolean;
    multiAdmin: boolean;
    dedicatedSupport: boolean;
  };
  fileUpload: {
    maxSize: number; // in bytes
    compression: boolean;
  };
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    clients: 1,
    teamMembers: 3,
    storage: null, // unlimited uploads but with file size limit
    analyticsHistoryDays: 7,
    features: {
      whiteLabel: false,
      approvalWorkflows: false,
      bulkActions: false,
      templates: false,
      automation: false,
      multiAdmin: false,
      dedicatedSupport: false,
    },
    fileUpload: {
      maxSize: 200 * 1024 * 1024, // 200MB
      compression: false,
    },
  },
  starter: {
    clients: 3,
    teamMembers: 5,
    storage: 100 * 1024 * 1024 * 1024, // 100GB
    analyticsHistoryDays: null,
    features: {
      whiteLabel: false,
      approvalWorkflows: false,
      bulkActions: true,
      templates: true,
      automation: false,
      multiAdmin: false,
      dedicatedSupport: false,
    },
    fileUpload: {
      maxSize: 500 * 1024 * 1024, // 500MB
      compression: false,
    },
  },
  pro: {
    clients: 10,
    teamMembers: 10,
    storage: 500 * 1024 * 1024 * 1024, // 500GB
    analyticsHistoryDays: null,
    features: {
      whiteLabel: true,
      approvalWorkflows: true,
      bulkActions: true,
      templates: true,
      automation: true,
      multiAdmin: false,
      dedicatedSupport: false,
    },
    fileUpload: {
      maxSize: 1024 * 1024 * 1024, // 1GB
      compression: false,
    },
  },
  agency_plus: {
    clients: null, // unlimited
    teamMembers: null,
    storage: null,
    analyticsHistoryDays: null,
    features: {
      whiteLabel: true,
      approvalWorkflows: true,
      bulkActions: true,
      templates: true,
      automation: true,
      multiAdmin: true,
      dedicatedSupport: true,
    },
    fileUpload: {
      maxSize: 2 * 1024 * 1024 * 1024, // 2GB
      compression: false,
    },
  },
};

export const PLAN_NAMES: Record<PlanType, string> = {
  free: 'Freemium',
  starter: 'Starter',
  pro: 'Pro',
  agency_plus: 'Agency Plus',
};

export const PLAN_PRICES: Record<Exclude<PlanType, 'free'>, { monthly: number; yearly?: number; currency: string }> = {
  starter: { monthly: 29, yearly: 290, currency: 'EUR' },
  pro: { monthly: 59, yearly: 590, currency: 'EUR' },
  agency_plus: { monthly: 129, yearly: 1290, currency: 'EUR' },
};

export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function canUpgrade(currentPlan: PlanType): boolean {
  const order: PlanType[] = ['free', 'starter', 'pro', 'agency_plus'];
  return order.indexOf(currentPlan) < order.length - 1;
}

export function getNextPlan(currentPlan: PlanType): PlanType | null {
  const order: PlanType[] = ['free', 'starter', 'pro', 'agency_plus'];
  const currentIndex = order.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex === order.length - 1) return null;
  return order[currentIndex + 1];
}
