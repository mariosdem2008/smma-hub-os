import { describe, expect, it, beforeEach } from "vitest";
import { getEndpointGuardResponse, isEndpointAllowlisted } from "../endpoint-guard.ts";

describe("endpoint guard", () => {
  beforeEach(() => {
    delete process.env.ENABLE_UNUSED_AI_ENDPOINTS;
  });

  it("blocks endpoints not in allowlist when env flag is unset", () => {
    const response = getEndpointGuardResponse("ai-nonexistent-endpoint", {});
    expect(response?.status).toBe(403);
  });

  it("allows endpoints in allowlist by default", () => {
    expect(isEndpointAllowlisted("ai-strategy-generate")).toBe(true);
    expect(isEndpointAllowlisted("ai-onboarding")).toBe(true);
    const response = getEndpointGuardResponse("ai-strategy-generate", {});
    expect(response).toBeNull();
  });

  it("allows all endpoints when ENABLE_UNUSED_AI_ENDPOINTS=true", () => {
    process.env.ENABLE_UNUSED_AI_ENDPOINTS = "true";
    const response = getEndpointGuardResponse("ai-nonexistent-endpoint", {});
    expect(response).toBeNull();
  });
});
