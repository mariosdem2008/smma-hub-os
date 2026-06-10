import { describe, expect, it } from "vitest";
import { getTaskConfig, TASK_REGISTRY } from "../taskRegistry.ts";
import { TaskType } from "../taskTypes.ts";

describe("task registry", () => {
  it("requires freeformReason for freeform tasks", () => {
    const freeformTasks = Object.values(TASK_REGISTRY).filter((task) => task.outputMode === "freeform");
    for (const task of freeformTasks) {
      expect(task.freeformReason).toBeTruthy();
    }
  });

  it("registers report insight as structured JSON", () => {
    const config = getTaskConfig(TaskType.REPORT_INSIGHT);
    expect(config.outputMode).toBe("json_schema");
    if (config.outputMode !== "json_schema") throw new Error("expected json_schema");

    const result = config.schema.validate({
      headline: "June performance held steady.",
      performance_summary: "Based on the KPI table, reach and engagement are the key reads.",
      insights: [{ point: "Reach created the main read.", evidence: "1,200 reach" }],
      recommendations: [{ action: "Review the top post.", why: "It ties to 1,200 reach.", owner: "agency" }],
      risks_or_blockers: [],
    });

    expect(result.ok).toBe(true);
  });
});
