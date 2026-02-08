# RAG Shadow vs Baseline Comparison (Phase 1)

Metrics:
- Retrieval overlap (% of shared chunk_ids)
- Citation coverage (cited / retrieved)
- Groundedness score delta

Pass thresholds:
- Overlap >= 60%
- Citation coverage >= 0.80
- Groundedness mean >= 0.85

Notes:
- Enforce tenant scoping with 0 cross-tenant leaks.
