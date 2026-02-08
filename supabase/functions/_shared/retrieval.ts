export const MAX_MATCH_COUNT = 12;

function readEnv(name: string) {
  if (typeof Deno !== "undefined") {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

export function isRagRerankingEnabled(): boolean {
  const raw = readEnv("ENABLE_RAG_RERANKING");
  if (raw === undefined) return false;
  return raw.toLowerCase() === "true";
}

export function getInitialMatchCount(fallback: number, rerankCount = 50) {
  return isRagRerankingEnabled() ? rerankCount : fallback;
}

export function applyScoreRerank<T extends { score?: number; similarity?: number }>(
  matches: T[],
  finalCount = MAX_MATCH_COUNT,
) {
  if (!isRagRerankingEnabled()) return matches;
  const sorted = [...matches].sort((a, b) => {
    const aScore = typeof a.score === "number" ? a.score : (a.similarity ?? 0);
    const bScore = typeof b.score === "number" ? b.score : (b.similarity ?? 0);
    return bScore - aScore;
  });
  return sorted.slice(0, finalCount);
}

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
