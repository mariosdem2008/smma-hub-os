import { describe, expect, it, vi } from "vitest";
import { handleBrainDocumentApproveRequest } from "../ai-brain-document-approve-handler.ts";

function makeReq(headers: Record<string, string>, body: any) {
  return new Request("http://localhost/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeSupabaseMock(opts: {
  userId: string;
  docAgencyId: string;
  isAdmin: boolean;
}) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: opts.userId } }, error: null })),
    },
    from: vi.fn((table: string) => {
      if (table === "brain_documents") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: { id: "doc-1", agency_id: opts.docAgencyId }, error: null })),
            })),
          })),
        };
      }
      if (table === "agency_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: opts.isAdmin ? { agency_id: opts.docAgencyId } : null })),
                })),
              })),
            })),
          })),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe("handleBrainDocumentApproveRequest", () => {
  it("returns 403 with stable error_code for non-admin member", async () => {
    const res = await handleBrainDocumentApproveRequest(
      makeReq({ Authorization: "Bearer test" }, { document_id: "doc-1" }),
      {
        corsHeaders: {},
        supabase: makeSupabaseMock({ userId: "user-1", docAgencyId: "agency-1", isAdmin: false }) as any,
        approveBrainDocument: vi.fn(),
        ingestBrainDocumentForRag: vi.fn(),
      },
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("FORBIDDEN_ROLE");
  });

  it("returns 200 for admin/owner", async () => {
    const approve = vi.fn(async () => ({ id: "doc-1", status: "approved" }));
    const ingest = vi.fn(async () => ({ documentId: "ai-doc-1", chunksCreated: 1, tokenCount: 10 }));

    const res = await handleBrainDocumentApproveRequest(
      makeReq({ Authorization: "Bearer test" }, { document_id: "doc-1" }),
      {
        corsHeaders: {},
        supabase: makeSupabaseMock({ userId: "user-1", docAgencyId: "agency-1", isAdmin: true }) as any,
        approveBrainDocument: approve,
        ingestBrainDocumentForRag: ingest,
      },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(approve).toHaveBeenCalledTimes(1);
    expect(ingest).toHaveBeenCalledTimes(1);
  });
});

