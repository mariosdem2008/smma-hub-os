import { describe, expect, it } from "vitest";
import { formatDecisionLabel, mapDecisionToArtifactStatus } from "@/lib/strategy/v2/approvals";

describe("strategy v2 approvals", () => {
  it("maps review decisions to artifact statuses", () => {
    expect(mapDecisionToArtifactStatus("approved")).toBe("approved");
    expect(mapDecisionToArtifactStatus("rejected")).toBe("rejected");
    expect(mapDecisionToArtifactStatus("changes_requested")).toBe("review");
  });

  it("formats approval decisions for display", () => {
    expect(formatDecisionLabel("approved")).toBe("Approved");
    expect(formatDecisionLabel("changes_requested")).toBe("Changes requested");
    expect(formatDecisionLabel(undefined)).toBe("Pending review");
  });
});
