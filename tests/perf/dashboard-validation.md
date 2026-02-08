# Dashboard Validation Checklist (Phase 2 Prep)

Goal: ensure dashboards reflect reality and are safe for multi-tenant use ("0 cross-tenant leaks").

Checks
1) Data freshness
- Confirm spans/logs are being written within the last 15 minutes for a known active tenant.

2) Tenant filtering
- Confirm dashboards require agency_id scoping by default.
- Confirm no default view aggregates multiple agencies unless explicitly global-admin.

3) Metric correctness spot-check
- Compare load test runner output (p95) vs dashboard p95 for the same time window and endpoint.
- Compare workflow replay harness success rate vs dashboard success rate (when wired).

4) Alert wiring
- Confirm alerts match `tests/perf/alert-thresholds.md`.

5) Failure drill
- Simulate a failure in staging (timeout, tool denial) and confirm it appears in logs/spans.

Exit criteria
- All checks pass.
- Any mismatch blocks Phase 2 cutover until resolved.

