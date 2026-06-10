# 08 AI Trust Safety And Evaluation

| Related | [06-subject-pack-model](06-subject-pack-model.md), [07-source-of-truth-and-content-ingestion](07-source-of-truth-and-content-ingestion.md), [18-rag-ocr-grading-architecture](18-rag-ocr-grading-architecture.md) |

## 1. Safety Objective

AI in SMMAHUB must be useful, bounded, reviewable, and auditable. It should accelerate work without fabricating client truth, violating brand policy, or bypassing approvals.

## 2. Risk Levels

| Risk level | Example | Minimum control |
|---|---|---|
| Low | Internal note or summary | Retrieval trace and basic grading |
| Medium | Draft content or brief | Pack constraints, grading, internal review |
| High | Client-facing recommendation | Human review, explicit approval path |
| Critical | Compliance-sensitive claim or account action | Strong evidence, blocked autonomy, full audit trail |

## 3. Required Controls

- structured pack selection
- source grounding with visible evidence
- output grading before release
- missing-context detection
- approval workflows for publishable material
- logging of prompts, sources, grades, and decisions
- override and revert capability

## 4. Evaluation Dimensions

| Dimension | Check |
|---|---|
| Grounding | Claims align with cited evidence |
| Brand compliance | Voice, claims, and constraints are respected |
| Task fit | Output matches the requested job |
| Completeness | Required sections and fields are present |
| Risk handling | Uncertainty and missing context are surfaced |
| Workflow readiness | Output can move to the next valid state |

## 5. Failure Modes

- hallucinated client facts
- stale source usage
- brand or compliance violations
- wrong approval route
- overconfident recommendations
- agent actions beyond delegated scope

## 6. Evaluation Loop

1. Assemble governed context.
2. Generate bounded output.
3. Grade against pack rubric and safety policy.
4. Block, downgrade, revise, or route for review.
5. Store failures and reviewer decisions.
6. Feed recurring issues back into packs, prompts, or source quality.

## 7. Non-Negotiables

- no hidden retrieval sources
- no client-facing AI output without a review path
- no unlogged sensitive actions
- no autonomy that outruns evidence quality
