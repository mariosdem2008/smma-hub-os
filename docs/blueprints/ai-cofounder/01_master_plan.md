SMMAHUB AI Cofounder - Master Plan

Phase 0 - Foundations
Objective: Define persona, rules, and knowledge scope.
Deliverables:
- Owner persona spec (tone, boundaries, guardrails).
- Canonical RAG handbook outline and sections.
- Onboarding field intent map (why_needed, impact).
Dependencies: none.
Exit criteria: docs approved, scope locked.

Phase 1 - RAG Backbone
Objective: Ground AI in product docs and agency brain data.
Deliverables:
- RAG handbook ingested as brain_documents (module=product_docs).
- Embeddings written to ai_embeddings + shadow gemini embeddings.
- Retrieval config for onboarding clarifications.
Dependencies: Phase 0.
Exit criteria: retrieval returns relevant chunks in dev.

Phase 2 - AI Cofounder Clarifier
Objective: Add owner-style clarifications to onboarding.
Deliverables:
- ONBOARDING_CLARIFY task and prompt.
- Clarification flow in ai-onboarding.
- Logging of clarify decisions and outcomes.
Dependencies: Phase 1.
Exit criteria: clarification responses include why + how used.

Phase 3 - Validation + Follow-up Logic
Objective: Accurate data capture without user frustration.
Deliverables:
- Deterministic validation rules for input types.
- Follow-up limit with unresolved P0 tracking.
- Metrics for follow-up frequency and outcomes.
Dependencies: Phase 2.
Exit criteria: follow-ups <= 2 per field; unresolved P0 tracked.

Phase 4 - Evaluation and Quality Gates
Objective: Prove behavior and reduce hallucinations.
Deliverables:
- Eval test cases and rubric.
- Latency benchmarks and success thresholds.
- Regression checklist.
Dependencies: Phase 3.
Exit criteria: quality metrics meet targets.

Phase 5 - Rollout
Objective: Safe production deployment.
Deliverables:
- Feature flags for onboarding-only rollout.
- Shadow mode and staged rollout plan.
- Backout procedures.
Dependencies: Phase 4.
Exit criteria: stable in production with monitoring.

Rollout plan:
1) Shadow mode: 7 days.
2) Internal users: 1 week.
3) 10% of agencies: 1 week.
4) 50% of agencies: 1 week.
5) 100% after metrics stable.
