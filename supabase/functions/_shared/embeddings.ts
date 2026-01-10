import { ai } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

export const DEFAULT_EMBEDDING_DIM = 1536;

export function getExpectedEmbeddingDim() {
  const raw = typeof Deno !== "undefined"
    ? Deno.env.get("AI_EMBED_DIM_EXPECTED")
    : typeof process !== "undefined"
    ? process.env.AI_EMBED_DIM_EXPECTED
    : undefined;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return DEFAULT_EMBEDDING_DIM;
}

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
    metadata: {
      modelOverride: model,
      outputDimensionality: getExpectedEmbeddingDim(),
    },
  });
  const vector = result.output;
  if (!Array.isArray(vector)) {
    throw new Error("Embedding API response missing vector");
  }
  const expectedDim = getExpectedEmbeddingDim();
  if (vector.length !== expectedDim) {
    const error = new Error("Embedding dimension mismatch") as Error & { code?: string };
    error.code = "EMBEDDING_DIM_MISMATCH";
    throw error;
  }
  return vector;
}
