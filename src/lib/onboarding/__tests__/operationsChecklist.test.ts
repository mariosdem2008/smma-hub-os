import { describe, expect, it } from "vitest";
import { buildOperationsChecklist } from "@/lib/onboarding/operationsChecklist";
import type { OnboardingProfile } from "@/types/onboarding";

function buildProfile(overrides: Partial<OnboardingProfile> = {}): Partial<OnboardingProfile> {
  return {
    v5_meta: {
      operations_setup: {
        primary_contact_name: "Alex",
        primary_contact_role: "Marketing Manager",
        main_approver_name: "Chris",
        preferred_comms_channel: "Slack",
        launch_window: "Next 2 weeks",
        required_access_status: ["Meta", "Google Ads"],
        missing_assets: [],
      },
    },
    q4_languages: ["English"],
    formats: ["short_video"],
    cadence_preset: "standard",
    response_handling: "agency",
    on_camera_availability: "owner",
    ...overrides,
  };
}

describe("buildOperationsChecklist", () => {
  it("marks required setup items as blocked when missing", () => {
    const result = buildOperationsChecklist(buildProfile({
      v5_meta: {
        operations_setup: {
          primary_contact_name: "",
          main_approver_name: "",
          preferred_comms_channel: "",
          launch_window: "",
          required_access_status: [],
          missing_assets: [],
        },
      },
      response_handling: null,
    }));

    expect(result.summary.blocked).toBeGreaterThan(0);
    expect(result.sections[0].items.find((item) => item.id === "primary_contact")?.status).toBe("blocked");
    expect(result.sections[1].items.find((item) => item.id === "response_handling")?.status).toBe("blocked");
  });

  it("counts optional production inputs as recommended when they are missing", () => {
    const result = buildOperationsChecklist(buildProfile({
      q4_languages: [],
      formats: [],
      cadence_preset: null,
      cadence_per_platform: {},
      on_camera_availability: null,
    }));

    expect(result.sections[2].items.every((item) => item.status !== "blocked")).toBe(true);
    expect(result.summary.recommended).toBeGreaterThan(0);
  });

  it("surfaces saved values for completed checklist items", () => {
    const result = buildOperationsChecklist(buildProfile());
    const primaryContact = result.sections[0].items.find((item) => item.id === "primary_contact");
    const accessReadiness = result.sections[1].items.find((item) => item.id === "access_readiness");

    expect(primaryContact?.value).toContain("Alex");
    expect(accessReadiness?.value).toContain("Meta");
    expect(result.summary.complete).toBeGreaterThan(0);
  });
});
