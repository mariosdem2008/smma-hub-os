# Spec Gaps (AI Employee v1)

## Decisions Locked
1) Chunking defaults: chunk_size_tokens=900, overlap_tokens=140, max_chunks_per_doc=120.
2) Retrieval defaults: top_k_total=12 (allocation: 6 client_memory, 4 agency_memory, 2 exemplars), recency_half_life_days=45, filters by agency_id required and client_id optional.
3) Embeddings defaults: embedding_dim=1536, similarity=cosine.
4) Model policy: Answer Quality Check uses cheap model; RAG Ask uses strong model (both configured in prompt registry).
5) Citation rules: factual >= 1 citation or explicit brain_fields; policy/compliance >= 2 citations; creative outputs cite brain fields used.
6) Budget reset: 00:00 UTC on day 1 of month.
7) Rate limit reset: 00:00 UTC daily.
8) Escalation destination: ai_escalations table, owner agency admins, SLA < 24 hours.
9) Brain versioning after lock: v1 locked, edits create v2 draft, store full snapshot + json_diff.
10) Ingestion limits: allowed PDF, DOCX, TXT, MD, URL; max_file_size_mb=20; max_extracted_chars_per_doc=150000.

## Remaining Decisions (with options)
1) Model IDs in prompt registry:
   - Option A: provider small model for answer_quality_check + provider flagship model for rag_ask.
   - Option B: same model for both with different max_tokens.
2) Escalation notification channel:
   - Option A: in-app notifications only.
   - Option B: in-app + email to agency admins.
