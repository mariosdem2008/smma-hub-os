import { describe, expect, it } from "vitest";
import { applyRagPolicy, getRagConfig } from "../../../src/ai/ragPolicy.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { validateCitations } from "../../../src/ai/citations.ts";

function buildMatches(docType: string, count: number, baseScore: number) {
  return Array.from({ length: count }, (_, idx) => ({
    doc_type: docType,
    chunk_text: `${docType}-chunk-${idx}`,
    similarity: baseScore + idx / 100,
    document_id: `${docType}-doc-${idx}`,
    chunk_id: `${docType}-chunk-${idx}`,
  }));
}

describe("rag correctness", () => {
  it("ai-ask retrieves expected count and citations are subset of matches", () => {
    const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
    const matches = [
      ...buildMatches("client_memory", 6, 0.9),
      ...buildMatches("onboarding_v3", 4, 0.8),
      ...buildMatches("strategy_plan", 4, 0.7),
      ...buildMatches("agency_memory", 4, 0.6),
      ...buildMatches("setup_progress_v1", 4, 0.5),
      ...buildMatches("exemplar", 2, 0.4),
    ];

    const result = applyRagPolicy(matches, config);
    expect(result.retrievalCount).toBe(12);

    const citations = result.selectedMatches.map((match) => ({
      doc_id: match.document_id,
      chunk_id: match.chunk_id,
      doc_type: match.doc_type,
      similarity: match.similarity ?? 0,
    }));

    const validation = validateCitations(
      { sources: { memory_citations: citations, client_brain_fields: [], agency_brain_fields: [] }, unknown: false },
      result.selectedMatches,
    );
    expect(validation.valid).toBe(true);
  });

  it("ai-strategy-generate retrieves expected count and citations are subset of matches", () => {
    const config = getRagConfig(TaskType.STRATEGY_PLAN);
    const matches = [
      ...buildMatches("client_guidelines", 6, 0.9),
      ...buildMatches("client_notes", 6, 0.8),
      ...buildMatches("approved_posts", 6, 0.7),
      ...buildMatches("ai_artifact", 6, 0.6),
      ...buildMatches("strategy_draft", 6, 0.5),
      ...buildMatches("agency_sop", 4, 0.4),
      ...buildMatches("brain_document", 2, 0.95),
      ...buildMatches("agency_exemplar_strategy", 2, 0.3),
    ];

    const result = applyRagPolicy(matches, config);
    expect(result.retrievalCount).toBe(12);
    expect(result.docTypesUsed).toContain("brain_document");

    const citations = result.selectedMatches.map((match) => ({
      doc_id: match.document_id,
      chunk_id: match.chunk_id,
      doc_type: match.doc_type,
      similarity: match.similarity ?? 0,
    }));

    const validation = validateCitations(
      { sources: { memory_citations: citations, client_brain_fields: [], agency_brain_fields: [] }, unknown: false },
      result.selectedMatches,
    );
    expect(validation.valid).toBe(true);
  });

  it("flags context truncation when max_context_chars is small", () => {
    const config = getRagConfig(TaskType.CLIENT_PORTAL_QA);
    const matches = buildMatches("client_memory", 2, 0.9).map((match) => ({
      ...match,
      chunk_text: "x".repeat(200),
    }));

    const result = applyRagPolicy(matches, { ...config, max_context_chars: 50 });
    expect(result.contextTruncated).toBe(true);
  });
});
