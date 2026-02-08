import { beforeEach, describe, expect, it } from "vitest";
import { clearPersonaPromptContextCache, resolvePersonaPromptContext } from "../persona-prompt-context.ts";

describe("persona prompt context", () => {
  beforeEach(() => {
    clearPersonaPromptContextCache();
  });

  it("loads onboarding persona and then serves cached value until version changes", async () => {
    const state = {
      onboardingVersion: "v1",
      assistantName: "Nova",
      toneTraits: ["direct", "friendly"],
      expertiseTraits: ["strategy"],
    };

    const supabase = {
      from: (table: string) => {
        if (table === "ai_onboarding_status") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({
                      data: {
                        status: "complete",
                        completed_at: "2026-02-05T00:00:00.000Z",
                        updated_at: "2026-02-05T00:00:00.000Z",
                        metadata: { prompt_cache_version: state.onboardingVersion },
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "ai_persona_vectors") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  is: () => ({
                    maybeSingle: async () => ({
                      data: {
                        assistant_name: state.assistantName,
                        tone_traits: state.toneTraits,
                        expertise_traits: state.expertiseTraits,
                        source: "onboarding",
                      },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const first = await resolvePersonaPromptContext({
      supabase: supabase as any,
      agencyId: "agency-1",
      clientId: null,
      scope: "agency",
    });
    expect(first.assistant_name).toBe("Nova");
    expect(first.reloaded).toBe(true);

    const second = await resolvePersonaPromptContext({
      supabase: supabase as any,
      agencyId: "agency-1",
      clientId: null,
      scope: "agency",
    });
    expect(second.reloaded).toBe(false);

    state.onboardingVersion = "v2";
    state.assistantName = "Iris";
    const third = await resolvePersonaPromptContext({
      supabase: supabase as any,
      agencyId: "agency-1",
      clientId: null,
      scope: "agency",
    });
    expect(third.assistant_name).toBe("Iris");
    expect(third.reloaded).toBe(true);
  });
});
