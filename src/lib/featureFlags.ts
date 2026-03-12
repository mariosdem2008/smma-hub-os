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
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] ?? false;
}
