import { describe, expect, it } from "vitest";
import { buildAdminSetupOrchestratorPrompt } from "../../../supabase/functions/_shared/agency-admin-setup-orchestrator";
import { EXPERT_QUESTION_REGISTRY } from "../../../supabase/functions/_shared/agency-admin-setup-expert-questions";

describe("agency admin setup orchestrator prompt", () => {
  it("includes bootstrap summary, known/missing fields, registry, and retrieval snippets", () => {
    const prompt = buildAdminSetupOrchestratorPrompt({
      contextSnapshot: { agency: { name: "Rocket Agency", website: "https://rocket.test" } },
      knownFields: ["setup_profile_v1.agency.primary_services"],
      missingFields: ["setup_profile_v1.agency.deliverables_standard"],
      depthPreference: 2,
      registry: EXPERT_QUESTION_REGISTRY,
      retrievedSnippets: ["Snippet A", "Snippet B"],
    });

    expect(prompt).toContain("BOOTSTRAP_SUMMARY:");
    expect(prompt).toContain("Rocket Agency");
    expect(prompt).toContain("https://rocket.test");
    expect(prompt).toContain("KNOWN_FIELDS_JSON:");
    expect(prompt).toContain("MISSING_FIELDS_JSON:");
    expect(prompt).toContain("CANDIDATE_QUESTIONS_JSON:");
    expect(prompt).toContain("RETRIEVED_SNIPPETS:");
    expect(prompt).toContain("Snippet A");
    expect(prompt).toContain("Snippet B");
  });
});
