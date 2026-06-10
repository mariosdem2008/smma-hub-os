# 06 Subject Pack Model

| Related | [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md), [08-ai-trust-safety-and-evaluation](08-ai-trust-safety-and-evaluation.md), [16-technical-architecture](16-technical-architecture.md), [17-data-entities-high-level](17-data-entities-high-level.md) |

## 1. Definition

A subject pack is a governed policy and context specification for a stable operational domain. It tells SMMAHUB how AI and workflows should behave for that domain without turning the platform into a generic prompt library.

A pack may reference source documents, approved exemplars, templates, and grading rules. A pack is not the source of truth itself, and generated outputs are not pack contents by default.

## 2. Purpose

Subject packs exist to make agency expertise reusable, reviewable, and enforceable across clients. They bridge agency rules, client context, workflow state, and AI behavior.

## 3. Pack Types

| Pack type | Scope | Example |
|---|---|---|
| Agency pack | Agency-wide operating logic | Positioning, offers, standards |
| Client pack | One client's governed context layer | Brand rules, audience constraints |
| Offer pack | Offer-specific strategy and delivery logic | Lead gen, retention, launch |
| Channel pack | Channel execution rules | LinkedIn, Meta, TikTok |
| Compliance pack | Risk and approval rules | Claims, legal, regulated content |
| Workflow pack | Task-specific output contract | Strategy brief, content brief, report summary |

## 4. Pack Composition

An agent run may use multiple packs. Composition must be deterministic.

| Order | Layer | Rule |
|---|---|---|
| 1 | Compliance pack | Highest priority. Cannot be overridden by lower layers. |
| 2 | Client pack | Client-specific constraints override generic agency defaults. |
| 3 | Agency pack | Defines default operating model and standards. |
| 4 | Offer pack | Refines behavior for the commercial service being delivered. |
| 5 | Channel pack | Adds channel-specific rules and output expectations. |
| 6 | Workflow pack | Defines the exact job, format, and grading contract. |

If rules conflict and no deterministic resolution exists, the run must block and request human review.

## 5. Required Pack Schema

Every pack must define:

- purpose
- scope
- tenant scope
- owner
- status
- version
- effective dates
- upstream source set
- allowed behaviors
- disallowed behaviors
- supported tasks
- required output contract
- grading rubric
- approval requirements
- escalation rule

## 6. Ownership And Tenancy

| Pack scope | Ownership model | Notes |
|---|---|---|
| Agency-scoped | Owned by agency | Reusable across many clients |
| Client-scoped | Owned by agency and attached to one client | Inherits from agency rules |
| Template | Owned by platform or agency admin | Must be copied or pinned before live use |

Clients do not directly own packs. They may influence client-scoped packs through approvals or source documents, but the agency remains accountable for governance.

## 7. Lifecycle

1. Draft from trusted inputs or reviewed AI suggestions.
2. Validate against canonical sources and upstream policies.
3. Review by the required owner or reviewer role.
4. Approve and activate a version.
5. Use only active versions in governed runs.
6. Record failures, overrides, and review outcomes.
7. Revise, supersede, or archive when sources or policies change.

## 8. Operational Rules

- Draft packs must not power live client-facing generation.
- Every agent run must pin exact pack versions.
- Material source changes should trigger pack revalidation.
- Packs must support auditability and rollback.
- Packs should model stable policy domains, not one-off prompts.

## 9. Anti-Patterns

- A new pack for every single task or prompt.
- Packs that duplicate raw source documents without structure.
- Packs that store generated outputs as truth.
- Packs with no owner, no grading rule, or no activation state.
