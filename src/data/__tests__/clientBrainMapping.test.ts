import { describe, it, expect } from "vitest";

import { evaluateClientBrainForStrategy } from "../../../supabase/functions/_shared/brain-quality";
import { mapV3AnswersToClientBrain } from "../../../supabase/functions/_shared/client-brain-mapping";

describe("mapV3AnswersToClientBrain", () => {
  it("produces a usable brain from minimal V3 required answers (no pillars/constraints selected)", () => {
    const answers = {
      brand: "Acme Co",
      website: "https://acme.example",
      niche: "saas",
      offers: ["offer_a"],
      audience: ["persona_a"],
      differentiators: ["diff_a", "diff_b"],
      tone: ["professional", "friendly", "educational"],
      platforms: ["instagram"],
      primary_platform: "instagram",
      goals: ["awareness"],
      kpis: ["reach"],
      constraints: [],
      approval_cadence: "weekly_batch",
      approver_contact: "Jane Doe",
    } as const;

    const brain = mapV3AnswersToClientBrain(answers as any, {}, "2025-12-25T00:00:00.000Z");

    expect(Array.isArray(brain.pillars)).toBe(true);
    expect(brain.pillars.length).toBeGreaterThan(0);
    expect(Array.isArray(brain.constraints?.banned_claims)).toBe(true);
    expect(brain.constraints.banned_claims.length).toBeGreaterThan(0);

    const gate = evaluateClientBrainForStrategy(brain as any);
    expect(gate.usable).toBe(true);
    expect(gate.missing_fields).toEqual([]);
  });

  it("preserves user-provided pillars and taboo topics (no fallback override)", () => {
    const answers = {
      brand: "Acme Co",
      website: "https://acme.example",
      niche: "saas",
      offers: ["offer_a"],
      audience: ["persona_a"],
      differentiators: ["diff_a", "diff_b"],
      tone: ["professional", "friendly", "educational"],
      platforms: ["instagram"],
      primary_platform: "instagram",
      goals: ["awareness"],
      kpis: ["reach"],
      pillars: ["Customer stories", "Product education", "Behind-the-scenes"],
      taboo_topics: ["politics", "religion"],
      approval_cadence: "weekly_batch",
      approver_contact: "Jane Doe",
    } as const;

    const brain = mapV3AnswersToClientBrain(answers as any, {}, "2025-12-25T00:00:00.000Z");

    expect(brain.pillars.map((pillar: any) => pillar.name)).toEqual(answers.pillars);
    expect(brain.constraints.taboo_topics).toEqual(answers.taboo_topics);
  });
});
