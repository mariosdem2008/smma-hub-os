import { describe, expect, it } from "vitest";
import { buildBrainDocumentReferences, formatBrainDocumentReferencesMarkdown } from "../strategy-references.ts";

describe("strategy references", () => {
  it("formats deterministic, capped brain_document references", () => {
    const matches = [
      { doc_type: "brain_document", document_id: "ai-doc-2", chunk_id: "c2" },
      { doc_type: "brain_document", document_id: "ai-doc-1", chunk_id: "c1" },
      { doc_type: "client_guidelines", document_id: "cg-1", chunk_id: "c3" },
    ];

    const aiDocuments = [
      {
        id: "ai-doc-1",
        title: "Bootstrap Profile",
        metadata: { module: "bootstrap", brain_document_id: "bd-1", version: 1 },
      },
      {
        id: "ai-doc-2",
        title: "Rep Policy",
        metadata: { module: "rep_policy", brain_document_id: "bd-2", version: 2 },
      },
    ];

    const refs = buildBrainDocumentReferences({ matches, aiDocuments, maxReferences: 1 });
    expect(refs).toHaveLength(1);

    const text = formatBrainDocumentReferencesMarkdown({ references: refs, maxReferences: 10 });
    expect(text).toContain("References:");
    expect(text).toMatch(/module=/);
    expect(text).toMatch(/title="/);
    expect(text).toMatch(/brain_document_id=/);
    expect(text).toMatch(/version=/);
  });

  it("sorts references stably by module then title", () => {
    const matches = [
      { doc_type: "brain_document", document_id: "ai-doc-2" },
      { doc_type: "brain_document", document_id: "ai-doc-1" },
    ];

    const aiDocuments = [
      { id: "ai-doc-2", title: "Zed", metadata: { module: "rep_policy", brain_document_id: "bd-2", version: 1 } },
      { id: "ai-doc-1", title: "Alpha", metadata: { module: "bootstrap", brain_document_id: "bd-1", version: 1 } },
    ];

    const refs = buildBrainDocumentReferences({ matches, aiDocuments, maxReferences: 20 });
    expect(refs.map((r) => r.module)).toEqual(["bootstrap", "rep_policy"]);
  });
});

