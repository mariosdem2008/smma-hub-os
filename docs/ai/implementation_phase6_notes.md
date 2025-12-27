# Phase 6 Implementation Notes

## Scope delivered
- Verified ai-retrieve-context and ai-documents-ingest have no UI callers in src/ (see cleanup evidence).
- Added AI_LOCKDOWN_UNUSED_ENDPOINTS guard for unused endpoints (default false).
- Added guard tests for lockdown behavior.
- Removed unreferenced V2 onboarding UI module (AiOnboardingV2Chat).
- Documented legacy deprecation schedule and observation plan.

## Evidence
- Repo searches recorded in docs/ai/cleanup_phase6_evidence.md.

## Lockdown guard behavior
- Flag: AI_LOCKDOWN_UNUSED_ENDPOINTS=false (default).
- When true: unauthenticated or non-member requests return 403 with code ENDPOINT_LOCKED_DOWN.
- When false: existing 401/403 behavior remains unchanged.

## Lockdown logging
- Log location: public.ai_usage_logs with status_code=403 and error_code="ENDPOINT_LOCKED_DOWN".
- Query:
```sql
select *
from public.ai_usage_logs
where error_code = 'ENDPOINT_LOCKED_DOWN'
order by created_at desc;
```

## Rollback steps
1. Set AI_LOCKDOWN_UNUSED_ENDPOINTS=false (immediate rollback).
2. Re-deploy edge functions if needed (ai-retrieve-context, ai-documents-ingest).
3. Monitor v_ai_runs_last_24h and v_ai_legacy_table_writes for unexpected activity.

## Files changed
- supabase/functions/ai-retrieve-context/index.ts
- supabase/functions/ai-documents-ingest/index.ts
- supabase/functions/_shared/lockdown.ts
- src/data/__tests__/unusedEndpointLockdown.test.ts
- docs/ai/cleanup_phase6_evidence.md
- docs/ai/legacy_deprecation_phase6.md
