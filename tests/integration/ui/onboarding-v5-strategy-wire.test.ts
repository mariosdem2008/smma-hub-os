import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("client onboarding chat strategy wiring", () => {
  it("routes through chat onboarding and relies on server-side completion/job flow", () => {
    const routePath = resolve(process.cwd(), "src/pages/ai/AiOnboardingClient.tsx");
    const chatShellPath = resolve(process.cwd(), "src/components/onboarding-chat-client/ClientOnboardingChatShell.tsx");
    const edgePath = resolve(process.cwd(), "supabase/functions/ai-onboarding-client-chat/index.ts");
    const route = readFileSync(routePath, "utf8");
    const chatShell = readFileSync(chatShellPath, "utf8");
    const edge = readFileSync(edgePath, "utf8");

    expect(route).toContain("ClientOnboardingChatShell");
    expect(route).not.toContain("OnboardingV5Wizard");
    expect(chatShell).toContain("ai-onboarding-client-chat");
    expect(chatShell).not.toContain("ai-brain-ingest");
    expect(chatShell).not.toContain("ai-strategy-generate");
    expect(edge).toContain("complete_onboarding_profile");
  });
});
