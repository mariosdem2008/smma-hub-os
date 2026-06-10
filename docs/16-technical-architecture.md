# 16 Technical Architecture

| Related | [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md), [17-data-entities-high-level](17-data-entities-high-level.md), [18-rag-ocr-grading-architecture](18-rag-ocr-grading-architecture.md) |

## 1. System Overview

SMMAHUB should be built as a multi-tenant web application with a governed AI pipeline. The browser handles user interaction, the backend enforces tenant and workflow rules, and the AI layer operates only on structured context assembled from approved records, packs, and sources.

## 2. Core Layers

| Layer | Responsibility |
|---|---|
| Frontend | Agency workspace and client portal experiences |
| API and data layer | Auth, RLS, validation, business rules |
| Edge orchestration | AI runs, jobs, webhooks, automations |
| Database | Source of truth, derived records, approvals, audits |
| Retrieval layer | Search, embedding, chunk storage, evidence selection |
| Evaluation layer | Grading, policy checks, release gating |

## 3. Governing Principle

AI must never act on a raw prompt alone. Every governed run should receive:

1. actor role and workflow state
2. agency rules
3. client context
4. active pack set and pack versions
5. relevant source documents and evidence
6. required output contract
7. risk and approval policy

## 4. AI Pipeline

```text
source ingestion -> record normalization -> retrieval -> context assembly -> orchestration -> generation -> grading -> approval -> write-back -> audit
```

## 5. Agent Model

| Agent class | Example jobs | Restrictions |
|---|---|---|
| Setup agents | Setup guidance, gap detection | Cannot activate packs or publish policy alone |
| Strategy agents | Diagnosis, strategic recommendation, brief creation | Must cite evidence and surface assumptions |
| Execution agents | Task briefs, summaries, next-action suggestions | Must stay within approved strategy scope |
| Compliance agents | Claim review, safety checks | Can block or escalate, not silently rewrite policy |
| Follow-up agents | Approval reminders, status summaries | Must respect communication rules and cadence limits |

## 6. Multi-Tenancy Rules

- Every agency-scoped table must enforce RLS.
- Client portal access must be scoped to the correct client and contact.
- Pack selection and retrieval must never cross tenant boundaries.
- Cross-tenant jobs must run only in explicit server-side processes.

## 7. Design Constraints

- Keep approvals first-class.
- Keep evidence attached to outputs.
- Keep orchestration deterministic enough to audit.
- Keep the stack operable by a small team.
