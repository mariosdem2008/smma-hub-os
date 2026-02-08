# Alert Thresholds (Phase 2 Prep)

Purpose: define production alert thresholds for Phase 2 readiness and cutover monitoring.

Core alerts (from report targets)
- p95 latency (end-to-end)
  - warn: > 2500ms for 2 consecutive 15-minute windows
  - critical: > 3500ms for 1 window
- workflow success rate
  - warn: < 0.95 for 2 windows
  - critical: < 0.90 for 1 window
- EXECUTE schema validity
  - warn: < 0.99 for 2 windows
  - critical: < 0.97 for 1 window
- groundedness (mean)
  - warn: < 0.85 for 2 windows
  - critical: < 0.80 for 1 window
- cross-tenant leaks
  - critical: any leak_count > 0 (0 cross-tenant leaks)

Required dimensions/filters
- agency_id (tenant scoping; never aggregate cross-tenant unless explicitly global-admin)
- task_type
- stage (router/planner/executor/tools/rag/memory/logging)
- time window

Implementation notes (UNKNOWN until dashboard tooling chosen)
- UNKNOWN: exact alerting system (Supabase alerts vs external tool) and ownership.
- TODO: map each alert to a concrete query over `ai_otel_spans` and/or `ai_runs`.

