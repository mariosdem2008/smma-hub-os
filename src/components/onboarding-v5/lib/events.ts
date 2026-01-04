export type OnboardingEvent =
  | 'onboarding_started'
  | 'onboarding_section_viewed'
  | 'onboarding_field_changed'
  | 'onboarding_autosave_success'
  | 'onboarding_autosave_error'
  | 'onboarding_scan_started'
  | 'onboarding_scan_completed'
  | 'onboarding_scan_applied'
  | 'onboarding_preview_expanded'
  | 'onboarding_preview_collapsed'
  | 'onboarding_generate_clicked'
  | 'onboarding_strategy_created';

export function trackOnboardingEvent(event: OnboardingEvent, payload: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined') {
    const anyWindow = window as typeof window & {
      analytics?: { track?: (name: string, props?: Record<string, unknown>) => void };
      dataLayer?: Array<Record<string, unknown>>;
    };

    if (anyWindow.analytics?.track) {
      anyWindow.analytics.track(event, payload);
    }

    if (Array.isArray(anyWindow.dataLayer)) {
      anyWindow.dataLayer.push({ event, ...payload });
    }
  }
}
