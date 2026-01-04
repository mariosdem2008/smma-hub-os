import { describe, expect, it } from "vitest";
import { getAutosaveLabel } from "@/components/strategy-os/shared/autosave";

describe("getAutosaveLabel", () => {
  it("returns saving when dirty", () => {
    expect(getAutosaveLabel({ dirty: true, pending: false, error: false })).toBe("Saving...");
  });

  it("returns saving while pending", () => {
    expect(getAutosaveLabel({ dirty: true, pending: true, error: false })).toBe("Saving...");
  });

  it("returns save failed on error", () => {
    expect(getAutosaveLabel({ dirty: true, pending: false, error: true })).toBe("Save failed");
  });

  it("returns saved when not dirty and not pending", () => {
    expect(getAutosaveLabel({ dirty: false, pending: false, error: false })).toBe("Saved");
  });
});
