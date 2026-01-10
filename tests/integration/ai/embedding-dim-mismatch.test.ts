import { describe, expect, it, vi } from "vitest";
import { embedWithPolicy } from "../../../supabase/functions/_shared/embedding-policy.ts";
import { embedText } from "../../../supabase/functions/_shared/embeddings.ts";
import { ai } from "../../../src/ai/router.ts";

vi.mock("../../../src/ai/router.ts", () => ({
  ai: {
    run: vi.fn(),
  },
}));

describe("embedding dimension guard", () => {
  it("throws EMBEDDING_DIM_MISMATCH when vector length mismatches", async () => {
    process.env.AI_EMBED_DIM_EXPECTED = "3";
    (ai.run as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ output: [1, 2] });

    await expect(embedText("hello", "key", "model")).rejects.toMatchObject({
      code: "EMBEDDING_DIM_MISMATCH",
    });
  });

  it("does not return a fallback vector on dimension mismatch", async () => {
    const error = new Error("Embedding dimension mismatch") as Error & { code?: string };
    error.code = "EMBEDDING_DIM_MISMATCH";

    const result = await embedWithPolicy({
      text: "hello",
      apiKey: "key",
      failHard: false,
      embed: async () => {
        throw error;
      },
    });

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("EMBEDDING_DIM_MISMATCH");
  });
});
