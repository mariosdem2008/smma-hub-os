import { describe, it, expect } from "vitest";

import { mapV3AnswersToClientBrain } from "../../../supabase/functions/_shared/client-brain-mapping";
import { evaluateClientBrainForStrategy } from "../../../supabase/functions/_shared/brain-quality";
import { decideAiRepResponse } from "../../../supabase/functions/_shared/ai-rep-chat";

describe("AI Rep end-to-end (logical chain)", () => {
  it("maps minimal V3 answers -> usable brain + client_brief_v1 -> ai-rep-chat not UNKNOWN", () => {
    const minimalAnswers = {
      brand: "Acme Co",
      website: "https://acme.example",
      niche: "saas",
      offers: ["Onboarding"],
      audience: ["Founders"],
      differentiators: ["Fast setup", "Hands-on support"],
      tone: ["professional", "friendly", "educational"],
      platforms: ["instagram"],
      primary_platform: "instagram",
      goals: ["awareness"],
      kpis: ["reach"],
      constraints: [],
      approval_cadence: "weekly_batch",
      approver_contact: "Jane Doe",
    };

    const brain = mapV3AnswersToClientBrain(minimalAnswers as any, {}, "2025-12-25T00:00:00.000Z") as any;

    const gate = evaluateClientBrainForStrategy(brain);
    expect(gate.usable).toBe(true);
    expect(gate.missing_fields).toEqual([]);

    expect(brain.client_brief_v1).toBeTruthy();
    expect(Array.isArray(brain.client_brief_v1.pillars)).toBe(true);
    expect(brain.client_brief_v1.pillars.length).toBeGreaterThanOrEqual(3);

    const rep = decideAiRepResponse({ brief: brain.client_brief_v1, message: "What should we post next?" });
    expect(rep.unknown).toBe(false);
    expect(rep.used_sections).toContain("client_brief_v1");
  });
});

