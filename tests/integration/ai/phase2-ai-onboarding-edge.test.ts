import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("phase2 ai-onboarding edge implementation", () => {
  const edgePath = resolve(
    process.cwd(),
    "supabase/functions/ai-onboarding/index.ts"
  );
  const source = readFileSync(edgePath, "utf8");

  it("enforces service-role, auth, endpoint guard, and agency membership", () => {
    expect(source).toContain("getEndpointGuardResponse(\"ai-onboarding\"");
    expect(source).toContain("createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("Missing Authorization header");
    expect(source).toContain("ensureAgencyMembership");
    expect(source).toContain("ensureClientBelongsToAgency");
  });

  it("uses resolver-enabled router only for onboarding path", () => {
    expect(source).toContain("createAiRouter({ useBrainResolver: true })");
    expect(source).toContain("createAiRouter({ useBrainResolver: false })");
    expect(source).toContain("TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2");
  });

  it("implements strict request/response contracts and suggestion count guarantee", () => {
    expect(source).toContain("requestSchema = z");
    expect(source).toContain("responseSchema = z.object");
    expect(source).toContain("suggestions: z.array(z.string().min(1)).min(3).max(4)");
    expect(source).toContain("client_turn_id");
    expect(source).toContain("idempotent_replay");
  });

  it("persists onboarding state, persona, turn logs, and ai_runs", () => {
    expect(source).toContain("from(\"ai_onboarding_status\")");
    expect(source).toContain("from(\"ai_persona_vectors\")");
    expect(source).toContain("from(\"ai_onboarding_turn_logs\")");
    expect(source).toContain("from(\"ai_runs\").insert");
    expect(source).toContain("trace_id: traceId");
  });
});
