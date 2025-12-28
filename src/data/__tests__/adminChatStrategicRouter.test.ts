import { describe, it, expect } from "vitest";
import { routeAdminChatPlaybook } from "../../ai/adminChatStrategic";

describe("admin chat strategic router", () => {
  it("routes core_offer examples", () => {
    expect(routeAdminChatPlaybook("Need pricing tiers for our core offer")).toBe("core_offer");
    expect(routeAdminChatPlaybook("Build a retainer package and positioning")).toBe("core_offer");
    expect(routeAdminChatPlaybook("Create a service menu with 3 tiers")).toBe("core_offer");
  });

  it("routes strategy examples", () => {
    expect(routeAdminChatPlaybook("Draft a growth plan and funnel map")).toBe("strategy");
    expect(routeAdminChatPlaybook("Need a content strategy calendar for Q1")).toBe("strategy");
    expect(routeAdminChatPlaybook("Plan a campaign with content pillars")).toBe("strategy");
  });

  it("routes copywriting examples", () => {
    expect(routeAdminChatPlaybook("Write ad scripts for our offer")).toBe("copywriting");
    expect(routeAdminChatPlaybook("Need hooks and CTAs for a new campaign")).toBe("copywriting");
    expect(routeAdminChatPlaybook("Draft headline and caption variants")).toBe("copywriting");
  });

  it("avoids accidental matches", () => {
    expect(routeAdminChatPlaybook("Admin dashboard status update")).toBe("core_offer");
  });
});
