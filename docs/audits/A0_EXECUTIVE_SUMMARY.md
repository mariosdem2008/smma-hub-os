# A0 — Executive Summary (Current Truth)

## Purpose
Summarize the most critical cross-cutting findings from audits A1–A10 and provide a prioritized stabilization/rewrite plan for SMMAHUB’s AI infrastructure.

## Key Findings Summary
- Strategy generation is implemented as a Supabase edge function (`ai-strategy-generate`) that orchestrates authZ, gating, RAG, AI calls, persistence, and telemetry (A3).
- Multi-tenant safety for RAG depends heavily on `match_ai_embeddings` privilege hardening (service_role only) and correct agency/client filtering (A5/A9).
- The platform currently has redundant “brain” systems (legacy JSON brains + modular brain documents) that must be unified with an explicit deprecation plan (A4).
- The AI router is flexible (providers, model policy, schema validation) but does not enable brain resolver by default (A1).
- Error handling across AI endpoints is inconsistent; a shared error contract is required to eliminate silent failures (A10).
- Strategy module contract mismatch exists between the edited plan (new 6 modules) and current DB/UI modules (Strategy OS enum), requiring a product/engineering decision before proceeding (A3/A9).

## Detailed Analysis
### Top 10 Critical Findings
1. `match_ai_embeddings` must be callable only by service_role to prevent cross-tenant retrieval (A5/A9).
2. `verify_jwt=false` on `ai-strategy-generate` is confirmed; security relies on correct in-function membership checks (A3/A8).
3. Agency brain is duplicated between `agency_brains.brain_json` and `brain_documents` → inconsistent context sources (A4).
4. Client strategy eligibility depends on `client_brains.usable` computed by `evaluateClientBrainForStrategy()` and set by `ai-brain-ingest` (A4/A7).
5. Strategy generation uses RAG + references; missing/failed embeddings materially degrade output quality and must be surfaced (A5).
6. Router-level logging + edge-function logging can double-count usage unless `skipUsageLog` is used consistently (A1/A10).
7. Strategy persistence relies on `create_strategy_snapshot` RPC; correctness depends on module contract stability (A3/A9).
8. Prompt system is split: markdown prompts exist in `/prompts`, but strategy prompting is largely implemented in TS prompt builders (A2/A1).
9. Storage-based uploads (strategy documents) are migration/setup dependent; missing buckets/policies break uploads (A6/A8).
10. The system needs a standardized error contract with `code` + `deep_link` to achieve “0 silent failures” across AI features (A10).

## Code Evidence
(See A1–A10 for full evidence blocks and full file dumps.)

## Verification SQL/Commands
```bash
# Ensure all audits exist
ls docs/audits

# Find all verify_jwt=false configs
rg -n "verify_jwt\s*=\s*false" supabase/functions -S

# Find all uses of match_ai_embeddings
rg -n "match_ai_embeddings" -S src supabase/functions
```

## Problems Found
1. Strategy module contract mismatch between product plan and current DB enum/UI modules.
2. Brain system duplication creates ambiguity and increases maintenance cost.
3. Endpoint security posture depends on `verify_jwt=false` functions being correctly guarded.

## Recommendations
1. Fix order (recommended):
   1) Enforce `match_ai_embeddings` privileges + verify drift checks.
   2) Standardize AI endpoint error contract + frontend decoding.
   3) Finalize brain source of truth and migrate callers off legacy JSON.
   4) Decide and implement the strategy module contract (DB enum + UI + AI output schema).
   5) Add monitoring/admin dashboards for ingestion health and embedding failures.
2. Blockers needing human decision:
   1) Strategy module contract: keep current Strategy OS modules vs migrate to the plan’s new 6 module keys.
   2) Product routing decisions (e.g., onboarding vs AI setup entry points) that affect deep links and user flows.
