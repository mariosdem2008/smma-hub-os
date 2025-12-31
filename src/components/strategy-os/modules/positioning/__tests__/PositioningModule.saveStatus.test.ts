import { describe, expect, it } from "vitest";
import { getSaveStatusLabel } from "../PositioningModule";

describe("getSaveStatusLabel", () => {
  it("returns unsaved changes when dirty", () => {
    expect(
      getSaveStatusLabel({ dirty: true, pending: false, success: false, error: false })
    ).toBe("Unsaved changes");
  });

  it("returns saving while pending", () => {
    expect(
      getSaveStatusLabel({ dirty: true, pending: true, success: false, error: false })
    ).toBe("Saving...");
  });

  it("returns save failed on error", () => {
    expect(
      getSaveStatusLabel({ dirty: true, pending: false, success: false, error: true })
    ).toBe("Save failed");
  });

  it("returns saved when success and not dirty", () => {
    expect(
      getSaveStatusLabel({ dirty: false, pending: false, success: true, error: false })
    ).toBe("All changes saved");
  });
});
