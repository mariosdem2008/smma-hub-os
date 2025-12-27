import { describe, expect, it } from "vitest";
import { TASK_REGISTRY } from "../taskRegistry.ts";

describe("task registry", () => {
  it("requires freeformReason for freeform tasks", () => {
    const freeformTasks = Object.values(TASK_REGISTRY).filter((task) => task.outputMode === "freeform");
    for (const task of freeformTasks) {
      expect(task.freeformReason).toBeTruthy();
    }
  });
});
