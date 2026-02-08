# Legacy Decommission Checklist (Phase 2 Prep)

Purpose: safely decommission legacy/unused AI paths after Phase 2 stabilization without creating tenant leaks.

Checklist
1) Confirm Phase 2 stable window
- 14 consecutive days meeting targets (p95/success/schema/groundedness) with 0 cross-tenant leaks.

2) Identify legacy paths
- Enumerate legacy endpoints, tables, and flags to disable/remove.
- Confirm no active traffic depends on legacy paths.

3) Disable writes first
- Ensure any legacy write paths are disabled before disabling reads.

4) Disable traffic
- Remove/disable legacy endpoints and cron jobs.
- Confirm no errors spike after disabling.

5) Data retention
- Confirm retention policy for old logs/embeddings.
- Ensure no tenant data is deleted incorrectly (0 cross-tenant leaks / no cross-tenant deletes).

Exit criteria
- Legacy paths disabled with no regressions.
- Rollback plan exists until decommission is irreversible.

