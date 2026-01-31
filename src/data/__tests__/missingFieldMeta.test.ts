import { describe, expect, it } from "vitest";
import { getMissingFieldMeta, normalizeMissingFieldKey } from "@/data";

describe("missing field meta", () => {
  it("normalizes q16_enabled_channels", () => {
    expect(normalizeMissingFieldKey("q16_enabled_channels")).toBe("enabled_channels");
  });

  it("resolves meta label for enabled_channels", () => {
    const meta = getMissingFieldMeta("q16_enabled_channels");
    expect(meta?.label).toBe("Connect channels");
  });

  it("normalizes brand_basics.name to business_name", () => {
    expect(normalizeMissingFieldKey("brand_basics.name")).toBe("business_name");
    const meta = getMissingFieldMeta("brand_basics.name");
    expect(meta?.label).toBe("Add business name");
  });
});
