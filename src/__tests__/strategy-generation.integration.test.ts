import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("strategy generation implementation", () => {
  it("returns gated codes with deep links", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain("BRAIN_INCOMPLETE");
    expect(fn).toContain("AGENCY_BRAIN_INCOMPLETE");
    expect(fn).toContain("READINESS_SCOPE_INCOMPLETE");
    expect(fn).toContain("/agency/ai-setup");
    expect(fn).toContain("/onboarding/client/");
    expect(fn).toContain("deep_link");
  });

  it("keeps strategy plan artifacts in review instead of auto-approving them", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain('artifactType: "strategy_plan_v2"');
    expect(fn).toContain('status: "review"');
    expect(fn).not.toContain("Auto-approved during V2-to-legacy publication flow.");
  });

  it("self-heals missing retrieval docs from approved brain documents before gating", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain("fetchApprovedBrainDocuments");
    expect(fn).toContain("ingestBrainDocumentForRag");
    expect(fn).toContain("Failed to self-heal agency brain retrieval documents");
  });

  it("appends references section to generated markdown", () => {
    const fn = read("supabase/functions/ai-strategy-generate/index.ts");
    expect(fn).toContain('replace(/^References:/, "## References")');
  });

  it("extends STRATEGY_PLAN timeout to 3 minutes", () => {
    const router = read("src/ai/router.ts");
    expect(router).toContain("case TaskType.STRATEGY_PLAN");
    expect(router).toContain("180_000");
  });

  it("does not require agency_brains for STRATEGY_PLAN", () => {
    const registry = read("src/ai/taskRegistry.ts");
    expect(registry).toContain("[TaskType.STRATEGY_PLAN]");
    expect(registry).toContain("requires: { agency: false, client: false }");
  });

  it("hardens match_ai_embeddings to service_role only", () => {
    const migration = read("supabase/migrations/20260118000001_harden_match_ai_embeddings_final.sql");
    expect(migration).toMatch(/revoke all on function public\.match_ai_embeddings/i);
    expect(migration).toMatch(/grant execute on function public\.match_ai_embeddings/i);
    expect(migration).toMatch(/service_role/i);
  });

  it("blocks downstream content generation until approved recommendation and plan exist", () => {
    const fn = read("supabase/functions/generate-ai-content/index.ts");
    expect(fn).toContain("STRATEGY_APPROVAL_REQUIRED");
    expect(fn).toContain("strategy_recommendation");
    expect(fn).toContain("strategy_plan_v2");
    expect(fn).toContain("?tab=strategy");
  });

  it("enforces agency AI setup activation before strategy and creator workflows run", () => {
    const strategyFn = read("supabase/functions/ai-strategy-generate/index.ts");
    const contentFn = read("supabase/functions/generate-ai-content/index.ts");
    const sharedGate = read("supabase/functions/_shared/agency-ai-setup.ts");
    expect(strategyFn).toContain("AGENT_ACTIVATION_REQUIRED");
    expect(strategyFn).toContain('agentClass: "strategy"');
    expect(strategyFn).toContain('requiredMode: "internal_assist_only"');
    expect(contentFn).toContain("enforceAgencyAgentActivation");
    expect(contentFn).toContain('agentClass: "creator"');
    expect(contentFn).toContain('requiredMode: "internal_assist_only"');
    expect(sharedGate).toContain("AGENT_ACTIVATION_REQUIRED");
    expect(sharedGate).toContain("required_mode");
  });

  it("requires certification for operational client-facing workflows", () => {
    const repFn = read("supabase/functions/ai-rep-chat/index.ts");
    const sharedGate = read("supabase/functions/_shared/agency-ai-setup.ts");
    expect(repFn).toContain('agentClass: "client_facing"');
    expect(repFn).toContain('requiredMode: "operational"');
    expect(repFn).toContain("client_response_certification");
    expect(repFn).toContain("/agency/ai-setup/readiness/preview/client_facing");
    expect(repFn).toContain("needs certification revalidation before operational usage");
    expect(repFn).toContain("stale_certification_scenarios");
    expect(repFn).toContain('from("agency_ai_setup_status_v2")');
    expect(sharedGate).toContain('client_facing: ["client_response_certification"]');
    expect(sharedGate).toContain("missing_certification_scenarios");
    expect(sharedGate).toContain("stale_certification_scenarios");
    expect(sharedGate).toContain("needs certification revalidation before operational usage");
    expect(sharedGate).toContain("agency_ai_setup_status_v2");
    expect(sharedGate).toContain("agency_operating_modules_v2");
  });

  it("creates and consumes creator briefs for downstream content generation", () => {
    const fn = read("supabase/functions/generate-ai-content/index.ts");
    expect(fn).toContain('artifactType: "creator_brief"');
    expect(fn).toContain("creator_brief_agent");
    expect(fn).toContain("renderCreatorBriefPromptContext");
    expect(fn).toContain("creator_brief_artifact_id");
  });
});
