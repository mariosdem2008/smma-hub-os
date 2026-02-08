type MarketingLinks = {
  siteUrl: string;
  calUrl: string;
  demoUrl: string | null;
};

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("LOOM_ID")) return null;
  return trimmed;
}

export const marketing: MarketingLinks = {
  siteUrl:
    normalizeUrl(import.meta.env.VITE_PUBLIC_SITE_URL) ??
    normalizeUrl(import.meta.env.VITE_PUBLIC_URL) ??
    "https://smmahub.net",
  calUrl: normalizeUrl(import.meta.env.VITE_PUBLIC_CAL_URL) ?? "https://cal.com/SMMAHUB/fit",
  demoUrl: normalizeUrl(import.meta.env.VITE_PUBLIC_DEMO_URL),
};
