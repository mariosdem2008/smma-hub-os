import { describe, expect, it } from "vitest";
import { computeDisplayStatus } from "@/lib/brain/statusTypes";

describe("computeDisplayStatus", () => {
  it("returns not-started when no document", () => {
    expect(computeDisplayStatus(null, false)).toBe("not-started");
  });

  it("maps draft/pending_approval to draft", () => {
    const base = {
      id: "doc",
      agency_id: "agency",
      module: "bootstrap",
      title: "t",
      content_json: {},
      version: 1,
      approved_at: null,
      approved_by: null,
      parent_version_id: null,
      source: "manual",
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    expect(computeDisplayStatus({ ...base, status: "draft" }, false)).toBe("draft");
    expect(computeDisplayStatus({ ...base, status: "pending_approval" }, false)).toBe("draft");
  });

  it("maps approved to active unless ingestion error", () => {
    const doc = {
      id: "doc",
      agency_id: "agency",
      module: "bootstrap",
      title: "t",
      content_json: {},
      status: "approved",
      version: 1,
      approved_at: new Date().toISOString(),
      approved_by: "user",
      parent_version_id: null,
      source: "manual",
      created_by: "user",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any;

    expect(computeDisplayStatus(doc, false)).toBe("active");
    expect(computeDisplayStatus(doc, true)).toBe("error");
  });
});

