/**
 * Feature flags for ClientDetail UX features
 * These flags control which features are enabled/visible
 * Set to false by default for features that are not yet fully implemented
 */

export const FEATURE_FLAGS = {
  /** Show notification badges on ClientDetail tabs (pending approvals, overdue tasks, etc.) */
  CLIENTDETAIL_TAB_BADGES: false,

  /** Show the AI/History/Tasks/Decisions right panel */
  CLIENTDETAIL_RIGHT_PANEL: true,

  /** Enable Client Onboarding V5 */
  ONBOARDING_V5: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (flag === 'ONBOARDING_V5') {
    const envFlag = import.meta.env.VITE_ONBOARDING_V5;
    if (envFlag && envFlag !== 'false' && envFlag !== '0') {
      return true;
    }

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryValue = params.get('onboarding_v5');
      if (queryValue && queryValue !== 'false' && queryValue !== '0') {
        return true;
      }
    }
  }

  return FEATURE_FLAGS[flag] ?? false;
}
