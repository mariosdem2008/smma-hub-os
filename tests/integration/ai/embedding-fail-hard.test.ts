import { describe, expect, it } from "vitest";
import { embedWithPolicy } from "../../../supabase/functions/_shared/embedding-policy.ts";

describe("embedding fail-hard", () => {
  it("throws MISSING_API_KEY when fail-hard is on and key is missing", async () => {
    const zeroVector = Array(3).fill(0);
    await expect(embedWithPolicy({
      text: "hello",
      apiKey: undefined,
      failHard: true,
      embed: async () => [1, 2, 3],
      zeroVector,
    })).rejects.toMatchObject({ code: "MISSING_API_KEY" });
  });

  it("throws EMBEDDING_FAILED when embed fails and fail-hard is on", async () => {
    const zeroVector = Array(3).fill(0);
    await expect(embedWithPolicy({
      text: "hello",
      apiKey: "test-key",
      failHard: true,
      embed: async () => {
        throw new Error("boom");
      },
      zeroVector,
    })).rejects.toMatchObject({ code: "EMBEDDING_FAILED" });
  });

  it("returns zero vector when fail-hard is off and key is missing", async () => {
    const zeroVector = Array(3).fill(0);
    const result = await embedWithPolicy({
      text: "hello",
      apiKey: undefined,
      failHard: false,
      embed: async () => [1, 2, 3],
      zeroVector,
    });

    expect(result.legacyZeroVector).toBe(true);
    expect(result.vector).toEqual(zeroVector);
  });
});
