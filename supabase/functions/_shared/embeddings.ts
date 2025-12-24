import "https://deno.land/x/xhr@0.1.0/mod.ts";

export const DEFAULT_EMBEDDING_DIM = 1536;

export function tokenize(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function buildChunks(
  tokens: string[],
  chunkSizeTokens: number,
  overlapTokens: number,
  maxChunks: number,
) {
  const chunks: { text: string; tokenCount: number; start: number; end: number }[] = [];
  if (tokens.length === 0) return chunks;

  const step = Math.max(chunkSizeTokens - overlapTokens, 1);
  for (let start = 0; start < tokens.length && chunks.length < maxChunks; start += step) {
    const end = Math.min(start + chunkSizeTokens, tokens.length);
    const slice = tokens.slice(start, end);
    chunks.push({
      text: slice.join(" "),
      tokenCount: slice.length,
      start,
      end,
    });
    if (end === tokens.length) break;
  }
  return chunks;
}

export async function embedText(text: string, apiKey: string, model: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Embedding API error: ${response.status} ${message}`);
  }

  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding API response missing vector");
  }
  return vector;
}
