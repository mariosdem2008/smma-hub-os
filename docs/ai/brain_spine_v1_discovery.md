# Brain & Memory Spine v1 Discovery

## Existing brain-related tables (from `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`)
- `public.agency_brains`: id, agency_id, version, status, locked, brain_json, json_diff, confidence, created_at, updated_at.
- `public.client_brains`: id, agency_id, client_id, version, status, locked, brain_json, json_diff, confidence, created_at, updated_at.
- `public.ai_documents`: id, agency_id, client_id, doc_type, title, content, extracted_text, source, source_url, file_ref, file_name, file_size_mb, mime_type, metadata, created_at, updated_at.
- `public.ai_document_chunks`: id, document_id, chunk_index, chunk_text, token_count, chunk_meta, created_at.
- `public.ai_embeddings`: id, agency_id, client_id, doc_type, document_id, chunk_id, embedding, model, metadata, created_at.
- `public.ai_prompt_registry`, `public.ai_runs`, `public.ai_budgets`, `public.ai_rate_limits`, `public.ai_escalations`.

## Existing embeddings/vector setup
- `vector` extension enabled (same migration).
- `public.ai_embeddings.embedding` uses `vector(1536)`.
- `ai-documents-ingest` currently inserts embeddings with a zero vector placeholder.

## Existing edge functions (AI related)
- `ai-brains-agency`: create/update/lock agency brain rows.
- `ai-brains-client`: create/update/lock client brain rows.
- `ai-answer-quality-check`: validates onboarding answers + logs ai_runs.
- `ai-ask`: placeholder RAG endpoint with budgets/rate limits and UNKNOWN response.
- `ai-documents-ingest`: chunk + store documents + zero-vector embeddings.
- `ai-backfill-brains`: builds basic brains from legacy data.
- `generate-ai-content`: OpenAI-powered content generation (not brain-aware).

## Current onboarding v2 output storage
- `AiOnboardingV2Chat` writes answers to `agency_brains` or `client_brains` via `ai-brains-*`.
- Stored under `brain_json.raw_responses` and `brain_json.followup_responses`.
- Lock action only toggles status; no structured brain mapping yet.

## Gaps / TODOs
- Missing ingestion step to map onboarding responses into canonical AgencyBrain/ClientBrain JSON.
- No `client_brains.usable` flag for safe strategy gating.
- No `ai_memory_items` table (needed for summary memory spine).
- No `ai_usage_logs` table or view (usage logging is in `ai_runs` only).
- No retrieval endpoint; no `match_ai_embeddings` RPC for vector search.
- Embeddings are currently zero vectors (need real embedding generation).
- No strategy generation endpoint to enforce UNKNOWN quality gates.
- No storage yet for approved strategy outputs or client approval feedback (needed for retrieval sources).
