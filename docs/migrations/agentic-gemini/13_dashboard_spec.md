# Dashboard Spec

Dashboards
1) Latency
- p50, p95 latency by task_type and stage
- p95 target <= 2.5s

2) Workflow Success
- success rate by task_type
- target >= 95%

3) Schema Validity
- EXECUTE schema validity rate
- target >= 99%

4) Cross-Tenant Leaks
- leak count (must be 0)
- top sources by stage

5) Groundedness
- groundedness score distribution
- mean score target > 85%

Required filters
- agency_id
- client_id
- task_type
- time window

Alert thresholds
- p95 latency > 2.5s
- success rate < 95%
- schema validity < 99%
- groundedness < 85%
- any leak count > 0 (tenant scoping; 0 cross-tenant leaks)

Phase 2 prep references
- Threshold doc: `tests/perf/alert-thresholds.md`
- Dashboard validation checklist: `tests/perf/dashboard-validation.md`
