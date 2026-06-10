# 17 Data Entities High Level

| Related | [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md), [16-technical-architecture](16-technical-architecture.md), [18-rag-ocr-grading-architecture](18-rag-ocr-grading-architecture.md) |

## 1. Core Entities

| Entity | Purpose |
|---|---|
| Agency | Tenant boundary and operating model |
| User | Internal staff member |
| Client | Client business record |
| Client contact | External stakeholder |
| Subject pack | Governed policy and context layer |
| Source document | Canonical or ingested source artifact |
| Operating record | Structured client truth derived from sources |
| Strategy brief | Governed planning artifact |
| Work item | Task, brief, or execution unit |
| Approval | Decision record |
| Request | Client-initiated work intake |
| Agent run | AI execution event |
| Evaluation result | Grading outcome and failure detail |
| Audit log | Immutable trace record |

## 2. Key Relationships

- An agency owns many users, clients, packs, sources, and runs.
- A client owns many operating-record facts, sources, strategies, requests, work items, and approvals.
- A subject pack may apply to many runs and many clients within its scope.
- A source document may support many operating-record facts and outputs.
- A strategy brief may produce many work items and approvals.

## 3. Critical Attributes

| Entity | Critical attributes |
|---|---|
| Agency | name, status, locale, governance settings |
| Client | industry, goals, lifecycle state, risk profile |
| Subject pack | type, scope, version, owner, state, source set |
| Source document | type, owner, version, freshness, provenance |
| Strategy brief | status, evidence set, reviewer, revision history |
| Work item | type, owner, due date, dependency state |
| Agent run | input context, pack set, output, grade, state |

## 4. Shared State Concepts

- draft
- in review
- approved
- blocked
- rework required
- active
- archived

## 5. Data Standards

- Every important entity should have an owner.
- Every output should reference the source set and pack set used.
- Every approval should preserve who, when, why, and what changed.
- Every client-facing artifact should retain client boundary metadata.
