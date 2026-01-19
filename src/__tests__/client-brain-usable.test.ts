import { describe, expect, it } from "vitest";
import { evaluateClientBrainForStrategy } from "../../supabase/functions/_shared/brain-quality.ts";

describe("client brain usable gate", () => {
  it("marks usable when required fields are present", () => {
    const brain = {
      brand_basics: { name: "Acme" },
      offer_details: { products_services: ["Service A"] },
      audience: { problems: ["Problem A"] },
      pillars: [{ name: "Pillar A" }],
      goals: ["Increase leads"],
      constraints: { banned_claims: ["No guarantees"] },
    };

    const gate = evaluateClientBrainForStrategy(brain);
    expect(gate.usable).toBe(true);
    expect(gate.missing_fields).toEqual([]);
  });

  it("includes missing pillars in missing_fields", () => {
    const brain = {
      brand_basics: { name: "Acme" },
      offer_details: { products_services: ["Service A"] },
      audience: { problems: ["Problem A"] },
      pillars: [],
      goals: ["Increase leads"],
      constraints: { banned_claims: ["No guarantees"] },
    };

    const gate = evaluateClientBrainForStrategy(brain);
    expect(gate.usable).toBe(false);
    expect(gate.missing_fields).toContain("pillars");
  });
});

