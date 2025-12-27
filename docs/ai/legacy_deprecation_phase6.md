# Legacy Deprecation Plan (Phase 6)

## Current status
- Legacy tables: public.ai_history, public.ai_generation_usage.
- Legacy hook: src/hooks/useClientAIHistory.ts (reads ai_history).
- Target state: zero new writes to legacy tables; all new writes should flow to ai_runs / ai_usage_logs.

## 30-day observation checklist (use ops views)
1. Daily: check v_ai_legacy_table_writes for any inserts.
2. Daily: check v_ai_runs_last_24h for unexpected legacy task usage.
3. Weekly: review ai_runs metadata for any legacy_source signals.
4. If any legacy writes appear, identify caller and block writes (triggers or code fix).
5. Document findings in docs/ai/implementation_phase6_notes.md.

Queries:
```sql
select * from public.v_ai_legacy_table_writes;
```

```sql
select * from public.v_ai_runs_last_24h
order by total_calls desc;
```

## Phase 6.5 / Phase 7 removal plan (no deletions in Phase 6)
Phase 6.5 (after 30 days of zero writes):
1. Export legacy tables for backup (pg_dump or storage export).
2. Confirm no reads depend on legacy tables (repo search + analytics).
3. Add or confirm backward-compat views if any read paths remain.

Phase 7 (after 90 days of zero writes):
1. Announce scheduled removal in release notes.
2. Take a final backup snapshot.
3. Drop legacy tables (ai_history, ai_generation_usage) and remove any remaining hooks.
4. Re-run ops views to confirm no regressions in ai_runs coverage.

## Rollback guidance
- If legacy writes resume, pause deletion and restore any required read views.
- If a hidden dependency appears, re-enable a read-only view from ai_runs while the dependency is migrated.
