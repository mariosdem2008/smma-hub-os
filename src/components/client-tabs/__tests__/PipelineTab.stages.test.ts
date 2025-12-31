import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES } from "../PipelineTab";

describe("PIPELINE_STAGES", () => {
  it("matches the expected 9-stage pipeline including published", () => {
    expect(PIPELINE_STAGES).toHaveLength(9);
    expect(PIPELINE_STAGES.some((stage) => stage.key === "published")).toBe(true);
  });
});
