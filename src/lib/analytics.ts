type AnalyticsProps = Record<string, unknown>;

declare global {
  interface Window {
    posthog?: { capture: (event: string, properties?: AnalyticsProps) => void };
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, properties?: AnalyticsProps) {
  try {
    if (typeof window === "undefined") return;
    if (window.posthog?.capture) {
      window.posthog.capture(event, properties);
      return;
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", event, properties ?? {});
      return;
    }
    if (import.meta.env.DEV) {
      console.log(`[analytics] ${event}`, properties ?? {});
    }
  } catch {
    // No-op: analytics must never break UX.
  }
}
