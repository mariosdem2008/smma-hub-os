SMMAHUB AI Cofounder - Overview

Executive summary:
1) Build a dedicated AI Cofounder assistant for onboarding that behaves like the SMMAHUB owner.
2) Use RAG over SMMAHUB product docs plus tenant data to ground answers.
3) Keep deterministic onboarding flow but add natural, helpful clarifications.
4) Ensure zero cross-tenant leakage via scoped retrieval and service_role access only.
5) Maintain sub-1.5s median response time for onboarding turns.
6) Provide consistent tone and clear explanations of why each answer matters.
7) Capture unresolved P0 fields for follow-up and audits.
8) Log all LLM usage and quality signals for evaluation and tuning.
9) Roll out behind feature flags with shadow mode and staged enablement.
10) Keep RAG handbook as a single canonical source of truth.

Goals:
- Build AI Cofounder that explains, guides, and answers clarifications.
- Ground responses in real SMMAHUB docs and agency brain data.
- Improve onboarding completion quality and reduce confusion.

Non-goals:
- Replace all admin chat across the app (onboarding only for now).
- Train a custom model in phase 1.
- Add new UI redesigns outside onboarding.

Scope:
- Onboarding only, agency scope.
- Clarification and follow-up behavior.
- RAG ingestion and retrieval for product knowledge.

Success criteria:
- Latency: p50 < 1.2s, p95 < 1.8s per onboarding turn.
- Quality: >= 90% of clarification answers judged helpful by internal review.
- Hallucination rate: < 1% of responses contradict documented product facts.
- Completion: +15% increase in P0 completion rate vs baseline.
