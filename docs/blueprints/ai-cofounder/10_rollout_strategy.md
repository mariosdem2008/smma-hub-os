SMMAHUB AI Cofounder - Rollout Strategy

Feature flags:
- AI_COFUNDER_ONBOARDING (default false)
- AI_COFUNDER_SHADOW (default true in staging)

Stages:
1) Shadow mode in staging (1 week).
2) Internal team only (1 week).
3) 10% agencies (1 week).
4) 50% agencies (1 week).
5) 100% after metrics stable.

Backout plan:
- Toggle AI_COFUNDER_ONBOARDING=false.
- Revert to deterministic-only clarifications.
- Monitor ai_runs and ai_otel_spans for recovery.

Success gates:
- P95 latency < 1.8s.
- Hallucination rate < 1%.
- Follow-up loops <= 2 per field.
