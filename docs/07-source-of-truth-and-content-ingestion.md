# 07 Source Of Truth And Content Ingestion

| Related | [06-subject-pack-model](06-subject-pack-model.md), [16-technical-architecture](16-technical-architecture.md), [18-rag-ocr-grading-architecture](18-rag-ocr-grading-architecture.md) |

## 1. Source Model

SMMAHUB must distinguish three classes of information:

| Type | Meaning |
|---|---|
| Canonical source | Human-trusted truth that can be cited and used for decisions |
| Derived context | Structured records assembled from sources |
| Generated output | AI-produced artifact that may inform work but is not truth by default |

## 2. Ingestion Principles

- Prefer structured inputs over free text when the workflow allows it.
- Preserve provenance, version, freshness, and owner on every artifact.
- Never overwrite canonical sources with AI output.
- Keep stale or conflicting sources visible.
- Separate ingest quality from generation quality.

## 3. Accepted Source Types

- agency operating docs
- client onboarding forms
- brand guidelines
- offers and positioning docs
- meeting notes and transcripts
- approved content
- performance reports
- assets and uploaded files
- approval records

## 4. Ingestion Pipeline

1. Receive source material.
2. Classify source type, tenant, and owner.
3. Extract text or structured fields.
4. Normalize into searchable records.
5. Attach provenance, freshness, and version metadata.
6. Route low-confidence records to review when needed.
7. Index records for retrieval and downstream workflows.

## 5. Conflict Rules

1. Prefer explicit policy over inferred context.
2. Prefer more recent approved canonical sources over stale records.
3. Prefer client-specific truth over generic assumptions.
4. Escalate unresolved conflicts instead of silently merging them.

## 6. Governance Rules

- Approved client messages may become trusted sources if explicitly promoted.
- Generated briefs remain derived artifacts unless approved as a new source.
- Every source needs an owner and refresh policy.
- Material source changes should invalidate dependent packs or summaries.

## 7. Operational Outcome

The ingestion layer should keep client operating records current enough that AI can work from governed evidence instead of reconstructed memory.
