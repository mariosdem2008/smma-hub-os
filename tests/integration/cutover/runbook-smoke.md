# Cutover Runbook Smoke Test (Phase 2 Prep)

Purpose: validate the cutover runbook steps are executable in staging.

Pre-reqs
- Staging project configured
- One tenant with safe test data
- Ability to toggle runtime flags (Supabase secrets + function deploy)

Steps (smoke)
1) Baseline
- Confirm Phase 1 flags are ON and Phase 2 flags are OFF.
- Confirm core endpoints respond (ai-rep-chat, ai-agency-admin-chat, ai-strategy-generate).

2) Enable Phase 2 flags (staging only)
- Toggle:
  - ENABLE_EPISODIC_MEMORY=true
  - ENABLE_LONG_TERM_MEMORY=true
  - ENABLE_CONTEXTUAL_INGESTION=true
- Redeploy functions as required by runtime.

3) Validate behavior does not break tenant safety
- Run a subset of `tests/security/full-tenant-audit.md` negative cases.
- Requirement: 0 cross-tenant leaks.

4) Rollback
- Disable Phase 2 flags and confirm system returns to Phase 1 behavior.

Exit criteria
- All steps above executed successfully in staging.
- Any failure blocks Phase 2 cutover.

