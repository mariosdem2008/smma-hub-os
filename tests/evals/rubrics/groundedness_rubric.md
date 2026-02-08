# Groundedness Rubric (v1)

Goal: Measure factual grounding of responses to retrieved sources.

Scoring
- citation_coverage = cited_chunks / retrieved_chunks (cap 1.0)
- provenance_match = cited_chunks_in_retrieval / cited_chunks (cap 1.0)
- score = 0.5 * citation_coverage + 0.5 * provenance_match

Pass threshold
- Mean score >= 0.85
- No single example below 0.60

Reviewer checklist
- All citations refer to retrieved sources
- No unsupported factual claims
- Tenant scope preserved in sources
