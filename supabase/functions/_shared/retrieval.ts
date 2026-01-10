export const MAX_MATCH_COUNT = 12;

export function clampMatchCount(value: number | undefined, fallback = 8) {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value as number);
  return Math.max(1, Math.min(rounded, MAX_MATCH_COUNT));
}

export function estimateTokens(text: string) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function capMatchesByTokenBudget<T extends { chunk_text?: string }>(
  matches: T[],
  tokenBudget: number
) {
  if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    return { matches: [] as T[], tokensUsed: 0, truncated: matches.length > 0 };
  }

  const selected: T[] = [];
  let used = 0;

  for (const match of matches) {
    const text = typeof match.chunk_text === "string" ? match.chunk_text : "";
    const tokens = estimateTokens(text);
    if (used + tokens > tokenBudget) break;
    selected.push(match);
    used += tokens;
  }

  return {
    matches: selected,
    tokensUsed: used,
    truncated: selected.length < matches.length,
  };
}
