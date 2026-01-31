type EmbedFn = (text: string) => Promise<number[]>;

export type EmbedPolicyOptions = {
  text: string;
  apiKey?: string;
  failHard: boolean;
  embed: EmbedFn;
};

export type EmbedPolicyResult = {
  vector?: number[];
  status: "ok" | "failed";
  errorCode?: string;
};

export async function embedWithPolicy(options: EmbedPolicyOptions): Promise<EmbedPolicyResult> {
  if (!options.apiKey) {
    if (options.failHard) {
      const error = new Error("AI provider API key is not configured") as Error & { code?: string };
      error.code = "MISSING_API_KEY";
      throw error;
    }
    return { status: "failed", errorCode: "MISSING_API_KEY" };
  }

  try {
    const vector = await options.embed(options.text);
    return { vector, status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("API_KEY is not configured")) {
      if (options.failHard) {
        const wrapped = new Error(message) as Error & { code?: string };
        wrapped.code = "MISSING_API_KEY";
        throw wrapped;
      }
      return { status: "failed", errorCode: "MISSING_API_KEY" };
    }
    if ((error as any)?.code === "EMBEDDING_DIM_MISMATCH") {
      return { status: "failed", errorCode: "EMBEDDING_DIM_MISMATCH" };
    }
    if (options.failHard) {
      const wrapped = new Error("Embedding failed") as Error & { code?: string };
      wrapped.code = "EMBEDDING_FAILED";
      throw wrapped;
    }
    return { status: "failed", errorCode: "EMBEDDING_FAILED" };
  }
}
