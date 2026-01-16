import { supabase } from "@/integrations/supabase/client";

export type SeedDefaultBrainPackResponse = {
  seeded: boolean;
  repaired: boolean;
  inserted_count: number;
  document_ids: string[];
  ingested_count: number;
  failed_ids: string[];
  errors?: Array<{ stage: string; document_id?: string; message: string }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryInvokeSeedDefaultBrainPack(agencyId: string) {
  const { data, error } = await supabase.functions.invoke("ai-seed-default-brain-pack", {
    body: { agency_id: agencyId },
  });

  if (error) throw error;
  return data as SeedDefaultBrainPackResponse;
}

export type AutoSeedDefaultBrainPackOptions = {
  agencyId: string;
  maxAttempts?: number;
  retryDelayMs?: number[];
  onSettled?: (result: SeedDefaultBrainPackResponse | null) => void;
  onFailure?: (error: unknown) => void;
};

export function autoSeedDefaultBrainPackV1InBackground(options: AutoSeedDefaultBrainPackOptions) {
  const { agencyId } = options;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? [0, 1500, 5000];

  let attempt = 0;

  const runAttempt = async (): Promise<void> => {
    attempt += 1;
    try {
      const result = await tryInvokeSeedDefaultBrainPack(agencyId);
      options.onSettled?.(result);
    } catch (error) {
      if (attempt >= maxAttempts) {
        options.onSettled?.(null);
        options.onFailure?.(error);
        return;
      }
      const delay = retryDelayMs[Math.min(attempt, retryDelayMs.length - 1)] ?? 1000;
      await sleep(delay);
      await runAttempt();
    }
  };

  void runAttempt();
}
