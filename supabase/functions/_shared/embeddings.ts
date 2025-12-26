import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

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
  const result = await ai.run({
    taskType: TaskType.EMBED_TEXT,
    input: text,
    context: { environment: "prod" },
    metadata: { modelOverride: model },
  });
  const vector = result.output;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding API response missing vector");
  }
  return vector;
}
