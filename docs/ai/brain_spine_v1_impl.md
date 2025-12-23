# Brain Spine v1 Implementation

## Purpose
Describe the end-to-end flow from onboarding to strategy generation with safety gates.

## Core Objects
- AgencyBrain and ClientBrain JSON shapes in `docs/ai/brain_spine_v1_contract.md`.
- `client_brains.usable` is the gate for strategy generation.
- Memory stored in `ai_documents` + `ai_embeddings`.

## End-to-End Flow
1) Onboarding v2 collects raw answers.
2) `ai-brain-ingest` maps raw answers into canonical brain JSON.
3) `client_brains.usable` toggles based on required fields.
4) `ai-strategy-generate` runs:
   - Phase A: gate (UNKNOWN if missing fields)
   - Phase B: RAG draft (citations + stored `strategy_draft`)
5) Strategy Hub shows UNKNOWN gate or draft strategy result.
6) Usage logged in `ai_usage_logs`.

## Endpoints
- `ai-brain-ingest`: maps raw responses -> canonical brains + usable flag.
- `ai-retrieve-context`: returns top-k chunks via `match_ai_embeddings`.
- `ai-ask`: RAG retrieval + UNKNOWN policy.
- `ai-strategy-generate`: gate + draft strategy (stores `strategy_draft`).

## Data Storage
- Brains: `agency_brains`, `client_brains`.
- Memory: `ai_documents`, `ai_document_chunks`, `ai_embeddings`.
- Summary memory: `ai_memory_items`.
- Usage: `ai_usage_logs`.

## Safety
UNKNOWN responses follow `docs/ai/safety_unknown_policy.md`.

## Known Constraints
- Embeddings use OpenAI; if key missing, endpoints return UNKNOWN.
- `strategy_draft` is stored as `ai_documents` and embedded for retrieval.

## TODO
- Confirm full strategy generation prompt and output schema.
