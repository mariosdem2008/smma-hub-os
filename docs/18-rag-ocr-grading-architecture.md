# 18 RAG OCR Grading Architecture

| Related | [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md), [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md), [16-technical-architecture](16-technical-architecture.md) |

## 1. Purpose

This architecture ensures SMMAHUB can ingest documents, retrieve the right evidence, assemble bounded context, and grade AI outputs before they move into execution or client-facing surfaces.

## 2. Pipeline

1. Ingest file or text source.
2. Run OCR when the source is scanned or image-based.
3. Extract and normalize text and metadata.
4. Chunk content with structural references.
5. Create embeddings and store them with provenance.
6. Retrieve the smallest relevant context set for the workflow.
7. Assemble a run package with packs, records, and sources.
8. Generate output.
9. Grade output against quality and safety rules.
10. Write back results, evidence, and audit events.

## 3. OCR Requirements

- preserve document structure where possible
- capture page and section references
- mark low-confidence extraction
- route unreadable or ambiguous documents to review

## 4. Retrieval Rules

- prefer agency and client sources over generic world knowledge
- prefer approved and recent sources over drafts or stale records
- prefer exact evidence for compliance-sensitive tasks
- keep retrieval scope minimal but sufficient
- expose evidence references for downstream review

## 5. Grading Dimensions

| Dimension | Check |
|---|---|
| Grounding | Claims are supported by evidence |
| Relevance | Output addresses the workflow job |
| Completeness | Required fields and sections are present |
| Safety | Policy, brand, and risk rules are respected |
| Actionability | Output can move the workflow forward |
| Confidence | Missing context and uncertainty are surfaced |

## 6. Failure Handling

- block low-confidence output
- show missing-context warnings
- retry retrieval when evidence is too weak
- escalate critical gaps to human review
- record failure reasons for future pack or source improvements

## 7. Architectural Outcome

The system should make ungrounded generation expensive and grounded generation routine.
