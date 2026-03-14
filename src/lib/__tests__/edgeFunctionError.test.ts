import { describe, expect, it } from "vitest";
import { parseEdgeFunctionResponse } from "@/lib/edgeFunctionError";

describe("edge function error parsing", () => {
  it("parses readiness-scope gating with deep link and questions", () => {
    const parsed = parseEdgeFunctionResponse({
      unknown: true,
      code: "READINESS_SCOPE_INCOMPLETE",
      deep_link: "/onboarding/client/client-1?stage=progressive_enrichment",
      missing_fields: ["pricing_and_budget"],
      questions: ["Please confirm the budget range before recommendations are finalized."],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error).toEqual({
      code: "READINESS_SCOPE_INCOMPLETE",
      message: "Please confirm the budget range before recommendations are finalized.",
      deepLink: "/onboarding/client/client-1?stage=progressive_enrichment",
      missingFields: ["pricing_and_budget"],
      questions: ["Please confirm the budget range before recommendations are finalized."],
    });
  });

  it("parses activation-required gating with deep link and required mode", () => {
    const parsed = parseEdgeFunctionResponse({
      code: "AGENT_ACTIVATION_REQUIRED",
      error: "client facing agent requires certification before operational usage.",
      deep_link: "/agency/ai-setup/readiness/preview/client_facing",
      required_mode: "operational",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error).toEqual({
      code: "AGENT_ACTIVATION_REQUIRED",
      message: "client facing agent requires certification before operational usage.",
      deepLink: "/agency/ai-setup/readiness/preview/client_facing",
      unlockState: undefined,
      activationMode: undefined,
      missingCertificationScenarios: undefined,
      missingFields: undefined,
      questions: undefined,
      requiredMode: "operational",
    });
  });

  it("parses activation metadata for cause-aware blocking UX", () => {
    const parsed = parseEdgeFunctionResponse({
      code: "AGENT_ACTIVATION_REQUIRED",
      error: "client facing agent requires certification before operational usage.",
      deep_link: "/agency/ai-setup/readiness/preview/client_facing",
      required_mode: "operational",
      unlock_state: "operational",
      activation_mode: "operational",
      missing_certification_scenarios: ["client_response_certification"],
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error).toEqual({
      code: "AGENT_ACTIVATION_REQUIRED",
      message: "client facing agent requires certification before operational usage.",
      deepLink: "/agency/ai-setup/readiness/preview/client_facing",
      requiredMode: "operational",
      unlockState: "operational",
      activationMode: "operational",
      missingCertificationScenarios: ["client_response_certification"],
      missingFields: undefined,
      questions: undefined,
    });
  });
});
