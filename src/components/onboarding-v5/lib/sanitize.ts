const BLOCKLIST_TOKENS = ['pp', 'pr', 'le', 'ncs'];
const MIN_LENGTH = 8;

function hasBlockedToken(value: string): boolean {
  const lower = value.toLowerCase();
  return BLOCKLIST_TOKENS.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(lower));
}

export function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < MIN_LENGTH) return null;

  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 2) return null;

  const lastToken = words[words.length - 1] ?? '';
  if (lastToken.length <= 2) return null;

  if (hasBlockedToken(normalized)) return null;

  return normalized;
}

export function sanitizeList(values: Array<string | null | undefined> | null | undefined): string[] {
  if (!values) return [];
  return values
    .map((value) => sanitizeText(value))
    .filter((value): value is string => Boolean(value));
}