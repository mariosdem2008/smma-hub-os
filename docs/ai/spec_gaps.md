# Spec Gaps (AI Employee v1)

## Decisions Locked
1) Chunking defaults: chunk_size_tokens=900, overlap_tokens=140, max_chunks_per_doc=120.
2) Retrieval defaults: top_k_total=12 (allocation: 6 client_memory, 4 agency_memory, 2 exemplars), recency_half_life_days=45, filters by agency_id required and client_id optional.
3) Embeddings defaults: embedding_dim=1536, similarity=cosine.
4) Model policy: Answer Quality Check uses cheap model; RAG Ask uses strong model (both configured in prompt registry).
5) Model IDs: answer_quality_check_model_id=CHEAP_MODEL, rag_ask_model_id=STRONG_MODEL (stored in prompt registry).
6) Citation rules: factual >= 1 citation or explicit brain_fields; policy/compliance >= 2 citations; creative outputs cite brain fields used.
7) Budget reset: 00:00 UTC on day 1 of month.
8) Rate limit reset: 00:00 UTC daily.
9) Escalation destination: ai_escalations table, owner agency admins, SLA < 24 hours.
10) Escalation notifications: in-app only.
11) Brain versioning after lock: v1 locked, edits create v2 draft, store full snapshot + json_diff.
12) Ingestion limits: allowed PDF, DOCX, TXT, MD, URL; max_file_size_mb=20; max_extracted_chars_per_doc=150000.

## Remaining Decisions (with options)
- None for v1 Sprint 1.

## TODOs
1) Client list onboarding status source: expose client_brains status/usable flag in client list API or a lightweight view. Until then the Clients list badge is a proxy based on {contact, assets, published} signals.
2) Verify RLS coverage for the `public.client_asset_counts` view (ensure clients/assets are scoped to agency_id); avoid cross-agency leakage if policies are relaxed.
3) Decide where to surface `client_brains.usable` in Dashboard/Clients readiness summaries once Brain Spine v1 is live.
4) Confirm where client onboarding "platforms" should be stored in ClientBrain (needs a dedicated field).
5) Define the actual Strategy generation endpoint implementation (currently gate-only).
6) Confirm strategy generation prompt + model ID for production (currently defaulting to gpt-5-mini).
7) Provide OPENAI_API_KEY in Supabase secrets to enable real embeddings + strategy generation.
8) Resolved (2025-12-24): Added tenant-safe RPC `get_client_brain_status` for `client_brains` gating with safe fields only.
9) Resolved (2025-12-24): Onboarding uses edge functions for brain IDs and no longer reads `agency_brains`/`client_brains` directly in the client.
10) Define policy for internal notes exposure in client portal QA (default is conservative but no final rule yet).
11) Confirm structured output contract for onboarding option generation (array shape + required keys).
12) Confirm if plan-based model routing should enforce limits or only influence model selection (currently pass-through only).
13) Define required fields for setup_progress_v1.missing_fields and how progress_percent should be computed across guided setup.
14) Decide canonical AI logging tables (ai_usage_logs/ai_runs) and migration plan for legacy ai_history/ai_generation_usage. **→ RESOLVED in plan_v1.md: migrate to canonical tables, dual-write during Phase 1, deprecate legacy after Phase 1 completion.**
15) Define model source-of-truth: prompt registry vs model policy, and ensure logged model matches runtime model. **→ RESOLVED in plan_v1.md: log runtime model from provider response, prompt registry is reference only.**
16) Decide embedding failure behavior in ingestion (hard fail vs zero-vector fallback). **→ RESOLVED in plan_v1.md: fail hard, remove zero-vector fallback in Phase 2.**
17) Cost estimation fallback formula when provider doesn't return token counts. **→ OPEN: plan_v1.md recommends chars/3 (conservative), needs validation.**
18) Provider-specific retry policies (should Anthropic use same as OpenAI?). **→ OPEN: plan_v1.md recommends same policy, needs testing if Anthropic used.**
19) Circuit breaker thresholds for provider outages (what error rate triggers circuit open?). **→ OPEN: plan_v1.md recommends 50% error rate over 5min window, needs tuning.**
20) RAG doc_type wildcard patterns (allow globs like "strategy_*"?). **→ OPEN: Phase 3 decision, not critical for v1.**
21) Prompt registry vs model policy conflict resolution (which takes precedence?). **→ OPEN: currently undefined, recommend model policy wins, prompt registry is reference only.**
22) Timeout values per task type (30s may be too short for complex tasks). **→ OPEN: plan_v1.md suggests configurable per task, default 30s, max 60s - needs implementation in Phase 2.**
23) Retry queue for failed embeddings (background worker to retry failed chunks). **→ OPEN: Phase 3 enhancement, not critical for v1.**
