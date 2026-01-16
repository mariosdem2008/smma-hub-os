import { describe, expect, it } from "vitest";
import { buildDefaultBrainPackUsageLog } from "../default-brain-pack-usage-log.ts";

describe("buildDefaultBrainPackUsageLog", () => {
  it("includes stage + agency_id and avoids document content", () => {
    const payload = buildDefaultBrainPackUsageLog({
      agencyId: "agency-1",
      userId: "user-1",
      stage: "seed_rpc_called",
      insertedCount: 3,
      documentIds: ["doc-1", "doc-2", "doc-3"],
      ingestedCount: 3,
      failedIds: [],
      errorCode: null as any,
      statusCode: 200,
      latencyMs: 123,
    });

    expect(payload.agency_id).toBe("agency-1");
    expect(payload.user_id).toBe("user-1");
    expect(payload.metadata).toMatchObject({
      stage: "seed_rpc_called",
      inserted_count: 3,
      document_ids: ["doc-1", "doc-2", "doc-3"],
      ingested_count: 3,
      failed_ids: [],
    });
  });
});

