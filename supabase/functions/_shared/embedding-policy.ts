type EmbedFn = (text: string) => Promise<number[]>;

export type EmbedPolicyOptions = {
  text: string;
  apiKey?: string;
  failHard: boolean;
  embed: EmbedFn;
  zeroVector: number[];
};

export type EmbedPolicyResult = {
  vector: number[];
  legacyZeroVector: boolean;
};

export async function embedWithPolicy(options: EmbedPolicyOptions): Promise<EmbedPolicyResult> {
  if (!options.apiKey) {
    if (options.failHard) {
      const error = new Error("OPENAI_API_KEY is not configured") as Error & { code?: string };
      error.code = "MISSING_API_KEY";
      throw error;
    }
    return { vector: options.zeroVector, legacyZeroVector: true };
  }

  try {
    const vector = await options.embed(options.text);
    return { vector, legacyZeroVector: false };
  } catch (error) {
    if (options.failHard) {
      const wrapped = new Error("Embedding failed") as Error & { code?: string };
      wrapped.code = "EMBEDDING_FAILED";
      throw wrapped;
    }
    throw error;
  }
}
