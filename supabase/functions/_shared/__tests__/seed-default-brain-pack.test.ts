import { describe, expect, it, vi } from "vitest";
import {
  inferAgencyIdFromMemberships,
  seedApproveAndIngestDefaultBrainPackV1,
  type MinimalSupabaseClient,
} from "../seed-default-brain-pack.ts";

function makeSupabaseMock(handlers: {
  agencyRow?: any;
  seedRows?: any[];
  seedError?: { message: string } | null;
  repairData?: any;
  repairError?: { message: string } | null;
  approvedDocs?: any[];
  approvedDocsError?: { message: string } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "agencies") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: handlers.agencyRow ?? {
                id: "agency-1",
                name: "Test Agency",
                website: "https://test.example",
                niche: "General",
              },
              error: null,
            })),
          })),
        })),
      };
    }
    if (table === "brain_documents") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: handlers.approvedDocs ?? [],
                error: handlers.approvedDocsError ?? null,
              })),
            })),
          })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const rpc = vi.fn(async (fn: string) => {
    if (fn === "seed_default_brain_pack_v1") {
      return { data: handlers.seedRows ?? [], error: handlers.seedError ?? null };
    }
    if (fn === "repair_default_brain_pack_v1") {
      return { data: handlers.repairData ?? null, error: handlers.repairError ?? null };
    }
    throw new Error(`Unexpected rpc: ${fn}`);
  });

  return { from, rpc } as unknown as MinimalSupabaseClient;
}

describe("inferAgencyIdFromMemberships", () => {
  it("infers agency_id when user has exactly one membership", () => {
    const result = inferAgencyIdFromMemberships(undefined, [{ agency_id: "agency-1" }]);
    expect(result).toEqual({ agencyId: "agency-1" });
  });

  it("requires agency_id when user has multiple memberships", () => {
    const result = inferAgencyIdFromMemberships(undefined, [{ agency_id: "a" }, { agency_id: "b" }]);
    expect(result.agencyId).toBeUndefined();
    expect(result.error).toMatch(/Multiple agencies/i);
  });
});

describe("seedApproveAndIngestDefaultBrainPackV1", () => {
  it("returns seeded:false and does nothing when RPC returns 0 rows", async () => {
    const supabase = makeSupabaseMock({ seedRows: [] });
    const approve = vi.fn();
    const ingest = vi.fn();

    const result = await seedApproveAndIngestDefaultBrainPackV1({
      supabase,
      userId: "user-1",
      agencyId: "agency-1",
      mode: "seed",
      renderPack: () => [
        { module: "bootstrap", title: "t1", content_json: {} },
        { module: "rep_policy", title: "t2", content_json: {} },
        { module: "quality_bar", title: "t3", content_json: {} },
      ],
      approveBrainDocument: approve,
      ingestBrainDocumentForRag: ingest,
      log: vi.fn(),
    });

    expect(result.seeded).toBe(false);
    expect(result.repaired).toBe(false);
    expect(result.inserted_count).toBe(0);
    expect(result.document_ids).toEqual([]);
    expect(result.ingested_count).toBe(0);
    expect(result.failed_ids).toEqual([]);
    expect(approve).not.toHaveBeenCalled();
    expect(ingest).not.toHaveBeenCalled();
  });

  it("approves and ingests all docs when RPC inserts 3 rows", async () => {
    const supabase = makeSupabaseMock({
      seedRows: [
        { document_id: "doc-1", module: "bootstrap" },
        { document_id: "doc-2", module: "rep_policy" },
        { document_id: "doc-3", module: "quality_bar" },
      ],
    });

    const approve = vi.fn(async (_sb: any, documentId: string) => ({
      id: documentId,
      agency_id: "agency-1",
      module: "bootstrap",
      title: "t",
      content_json: {},
      status: "approved",
      version: 1,
      approved_at: new Date().toISOString(),
      approved_by: "user-1",
    }));

    const ingest = vi.fn(async () => ({ documentId: "ai-doc-1", chunksCreated: 1, tokenCount: 10 }));

    const result = await seedApproveAndIngestDefaultBrainPackV1({
      supabase,
      userId: "user-1",
      agencyId: "agency-1",
      mode: "seed",
      renderPack: () => [
        { module: "bootstrap", title: "t1", content_json: { a: "b" } },
        { module: "rep_policy", title: "t2", content_json: { c: "d" } },
        { module: "quality_bar", title: "t3", content_json: { e: "f" } },
      ],
      approveBrainDocument: approve,
      ingestBrainDocumentForRag: ingest,
      log: vi.fn(),
    });

    expect(result.seeded).toBe(true);
    expect(result.repaired).toBe(false);
    expect(result.inserted_count).toBe(3);
    expect(result.document_ids).toEqual(["doc-1", "doc-2", "doc-3"]);
    expect(result.ingested_count).toBe(3);
    expect(result.failed_ids).toEqual([]);
    expect(approve).toHaveBeenCalledTimes(3);
    expect(ingest).toHaveBeenCalledTimes(3);
  });

  it("repairs only missing defaults and approves/ingests inserted docs", async () => {
    const supabase = makeSupabaseMock({
      repairData: {
        inserted_count: 1,
        inserted_document_ids: ["doc-9"],
        skipped_existing_modules: ["bootstrap", "rep_policy"],
      },
    });

    const approve = vi.fn(async (_sb: any, documentId: string) => ({
      id: documentId,
      agency_id: "agency-1",
      module: "quality_bar",
      title: "t",
      content_json: {},
      status: "approved",
      version: 1,
      approved_at: new Date().toISOString(),
      approved_by: "user-1",
    }));

    const ingest = vi.fn(async () => ({ documentId: "ai-doc-9", chunksCreated: 1, tokenCount: 10 }));

    const result = await seedApproveAndIngestDefaultBrainPackV1({
      supabase,
      userId: "user-1",
      agencyId: "agency-1",
      mode: "repair",
      renderPack: () => [
        { module: "bootstrap", title: "t1", content_json: {} },
        { module: "rep_policy", title: "t2", content_json: {} },
        { module: "quality_bar", title: "t3", content_json: {} },
      ],
      approveBrainDocument: approve,
      ingestBrainDocumentForRag: ingest,
      log: vi.fn(),
    });

    expect(result.seeded).toBe(false);
    expect(result.repaired).toBe(true);
    expect(result.inserted_count).toBe(1);
    expect(result.document_ids).toEqual(["doc-9"]);
    expect(result.ingested_count).toBe(1);
    expect(result.failed_ids).toEqual([]);
  });

  it("supports ingest-only mode without inserting docs", async () => {
    const supabase = makeSupabaseMock({
      approvedDocs: [
        { id: "doc-1", agency_id: "agency-1", module: "bootstrap", title: "t1", content_json: {}, status: "approved", version: 1 },
      ],
    });

    const ingest = vi.fn(async () => ({ documentId: "ai-doc-1", chunksCreated: 1, tokenCount: 10 }));

    const result = await seedApproveAndIngestDefaultBrainPackV1({
      supabase,
      userId: "user-1",
      agencyId: "agency-1",
      mode: "ingest_only",
      renderPack: () => [
        { module: "bootstrap", title: "t1", content_json: {} },
        { module: "rep_policy", title: "t2", content_json: {} },
        { module: "quality_bar", title: "t3", content_json: {} },
      ],
      approveBrainDocument: vi.fn(),
      ingestBrainDocumentForRag: ingest,
      log: vi.fn(),
    });

    expect(result.seeded).toBe(false);
    expect(result.repaired).toBe(false);
    expect(result.inserted_count).toBe(0);
    expect(result.document_ids).toEqual([]);
    expect(result.ingested_count).toBe(1);
    expect(result.failed_ids).toEqual([]);
  });
});
