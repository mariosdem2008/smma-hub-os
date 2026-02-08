# Reranker Selection Criteria (Phase 1)

Criteria:
- Supports ranking of up to K=50 items with stable ordering.
- Improves groundedness score >= 5% over baseline.
- Acceptable latency impact: <= 200ms p95 per request.
- Supports tenant scoping (no cross-tenant leaks).

Decision (Phase 1):
- Default to score-based rerank in retrieval results.
- Upgrade path: replace with model-based reranker once evaluated.
