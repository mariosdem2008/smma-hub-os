# Phase 5 Implementation Notes

## Scope delivered
- Admin chat schema mode behind AI_ADMIN_CHAT_SCHEMA (default false).
- Schema-validated JSON output for admin chat with legacy fallback on parse failure.
- ai_runs metadata for schema mode observability.
- Tests for schema mode, fallback, and legacy mode.

## Flag usage
- AI_ADMIN_CHAT_SCHEMA=false (default): legacy prefix parsing and prompt.
- AI_ADMIN_CHAT_SCHEMA=true: strict JSON schema output + validation with legacy fallback on failure.

## Rollout checklist
1. Deploy with AI_ADMIN_CHAT_SCHEMA=false.
2. Enable 10%: AI_ADMIN_CHAT_SCHEMA=10 if supported by flag rollout system; otherwise use staged deploys.
3. Monitor schema failure rate via ai_runs.metadata.admin_chat_schema_failed.
4. If stable, increase to 25%.
5. Monitor for 48h.
6. If stable, increase to 50%.
7. Monitor for 48h.
8. If stable, increase to 100%.

## Observability (schema failures)
Query failures and mode:
```sql
select
  metadata->>'admin_chat_output_mode' as output_mode,
  count(*) as total
from ai_runs
where metadata ? 'admin_chat_output_mode'
  and created_at >= now() - interval '7 days'
group by output_mode
order by total desc;

select
  count(*) as schema_failures
from ai_runs
where metadata->>'admin_chat_schema_failed' = 'true'
  and created_at >= now() - interval '7 days';
```

## Rollback steps
1. Set AI_ADMIN_CHAT_SCHEMA=false to revert to legacy prefix parsing.
2. Monitor admin chat responses for stability.
3. If issues persist, revert Phase 5 commit.
