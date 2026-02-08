SMMAHUB AI Cofounder - Evaluation Plan

Test cases (examples):
- User asks "Why do you need this?" -> AI explains why and asks follow-up.
- User gives invalid percent split -> deterministic follow-up.
- User answers vaguely -> LLM follow-up.
- User says "I do not know" -> follow-up for P0, accept for P1/P2 after limit.
- User gives clear answer -> AI advances.

Metrics:
- Clarification helpfulness >= 90% (internal review).
- Hallucination rate < 1% of sampled responses.
- Follow-up loop rate < 20% of turns.
- P95 latency < 1.8s.

Regression checklist:
- Does not advance on unclear answers.
- Uses RAG facts correctly.
- No cross-tenant context leakage.
- Follow-up limit enforced.

Acceptance:
- All metrics meet targets on staging before rollout.
