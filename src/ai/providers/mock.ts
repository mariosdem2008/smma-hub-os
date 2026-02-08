import type { EmbedParams, EmbedResult, GenerateParams, GenerateResult } from "./types.ts";

export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const text = params.messages.map((m) => m.content).join("\n").slice(0, 200);
  return {
    text: `[mock:${params.model}] ${text}`,
    model: params.model,
    usage: { inputTokens: 1, outputTokens: 1 },
  };
}

export async function generateJson(params: GenerateParams): Promise<GenerateResult> {
  const payload = { model: params.model, ok: true };
  return {
    text: JSON.stringify(payload),
    model: params.model,
    usage: { inputTokens: 1, outputTokens: 1 },
    raw: payload,
  };
}

export async function embed(params: EmbedParams): Promise<EmbedResult> {
  const size = params.outputDimensionality && params.outputDimensionality > 0 ? params.outputDimensionality : 3;
  return { embedding: Array(size).fill(0) };
}
