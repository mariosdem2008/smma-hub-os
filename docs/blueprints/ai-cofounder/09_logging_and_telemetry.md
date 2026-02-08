SMMAHUB AI Cofounder - Logging and Telemetry

ai_runs (per LLM call):
- task_type
- provider, model
- tokens_in, tokens_out
- latency_ms
- success, unknown
- error_code

ai_otel_spans (per request stage):
- edge.ai-onboarding.turn_start
- onboarding.snapshot.load
- onboarding.clarify (new)
- onboarding.validation
- onboarding.persist
- edge.ai-onboarding.turn_end

Alert thresholds:
- LLM error rate > 2% in 30 minutes
- P95 latency > 2.5s in 30 minutes
- RAG empty rate > 15% in 24 hours
- Unresolved P0 rate > 10% in 7 days

Dashboards:
- Clarification rate by field_path
- Follow-up count distribution
- Unresolved P0 list by agency
