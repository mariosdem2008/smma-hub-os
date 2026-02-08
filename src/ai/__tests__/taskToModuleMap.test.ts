import { describe, expect, it } from "vitest";
import { getTaskModules } from "../taskToModuleMap.ts";
import { TaskType } from "../taskTypes.ts";

describe("task to module map", () => {
  it("requires full onboarding module set for guided onboarding", () => {
    const modules = getTaskModules(TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2);
    const keys = modules.map((item) => item.module);

    expect(keys).toEqual([
      "bootstrap",
      "offer_stack",
      "tone_voice",
      "sop_strategy",
      "rep_policy",
      "faq_objections",
    ]);

    const bootstrap = modules.find((item) => item.module === "bootstrap");
    expect(bootstrap?.fieldPaths).toEqual(["agency_name", "services", "target_industries"]);
  });
});
