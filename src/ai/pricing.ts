export const PRICING: Record<string, { inputPerToken: number; outputPerToken: number }> = {
  "gpt-5-nano": { inputPerToken: 0.0000015, outputPerToken: 0.000006 },
  "gpt-5-mini": { inputPerToken: 0.0000025, outputPerToken: 0.00001 },
  "text-embedding-3-small": { inputPerToken: 0.00000002, outputPerToken: 0 },
};
