# Security Logging Requirements (Phase 0)

Purpose:
- Ensure tenant boundary violations are logged with enough context to enforce 0 cross-tenant leaks.

Required fields (ai_runs / ai_otel_spans attributes):
- error_code (string)
- task_type
- agency_id
- client_id
- user_id (if available)
- trace_id / span_id (if available)
- violation_type (e.g., tenant_scope_violation, scope_missing)

Error code taxonomy (Phase 0):
- tenant_scope_violation: mismatch between agency_id/client_id scope and data accessed
- scope_missing: required agency_id or client_id not present
- scope_insufficient: caller lacks required tool scope
- tool_not_allowed: tool id not in allowlist
- provenance_missing: retrieval result missing provenance fields
- context_missing: required context missing for task

Logging rules:
- Log every tenant boundary rejection with error_code and violation_type.
- Do not emit sensitive payloads in logs.
- Preserve trace_id linkage for root cause analysis.

Owner:
- AI Platform
