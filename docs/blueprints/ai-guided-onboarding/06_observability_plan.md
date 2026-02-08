# Observability Plan (ai_otel_spans + ai_runs)

Goals:
1. Make every onboarding turn debuggable end-to-end.
2. Make quality measurable (repair-pass rate, UNKNOWN rate, calibration loops).
3. Keep tenant isolation intact (no cross-tenant visibility; no secret logging).

## 1. Events / spans to log per onboarding turn

Each onboarding request should produce a trace with spans at minimum:
1. `onboarding.turn.start`
2. `onboarding.auth` (token validation + membership check)
3. `onboarding.snapshot.load` (load current brain JSON snapshot)
4. `onboarding.resolver` (brainResolver ready vs calibration_needed)
5. `onboarding.ai.call` (one or more: planner/extract/suggest)
6. `onboarding.schema.validate` (pass/fail)
7. `onboarding.schema.repair` (only if needed)
8. `onboarding.suggestions` (generation + safety filter)
9. `onboarding.persist` (draft write, final write, status update)
10. `onboarding.ingest` (ai-brain-ingest trigger, if invoked)
11. `onboarding.turn.end`

Recommended counters/ratios derived from spans:
- `unknown_rate` = count(unknown=true) / count(turns)
- `repair_pass_rate` = count(repair_attempted=true) / count(structured_ai_calls)
- `calibration_needed_rate` = count(state=calibration_needed) / count(turns)
- `suggestions_fallback_rate` = count(suggestions_fallback=true) / count(turns)

## 2. Required fields in `ai_runs` and `ai_otel_spans`

### 2.1 `ai_otel_spans` (per span)

Required:
- `trace_id`, `span_id`, `parent_span_id`
- `stage` (use the stage names above)
- `task_type` (or `onboarding` for non-model spans)
- `agency_id`, optional `client_id`, optional `user_id`
- `latency_ms`
- `attributes` (json)

Recommended `attributes` keys (onboarding):
- `fn_version` (edge function version)
- `request_id` (idempotency key / client_turn_id)
- `step_id` / `module_key`
- `state` = `ready` | `calibration_needed`
- `missing_fields_count`
- `schema_ok` boolean
- `repair_attempted` boolean
- `unknown` boolean
- `unknown_reason` string
- `suggestions_count` (must be 3 or 4 for input turns)
- `suggestions_fallback` boolean
- `suggestions_filtered_count`
- `suggestion_sources` (array of JSON paths; no raw PII)
- `persist_action` = `draft_write` | `final_write` | `status_complete`
- `cache_invalidated` boolean

### 2.2 `ai_runs` (per model call)

Required (existing schema may already cover these):
- `agency_id`, optional `client_id`, optional `user_id`
- `model`, `tokens_in`, `tokens_out`, `cost_usd`, `latency_ms`
- `success`, `unknown`
- `citations` (json), `escalate_to_human`, `escalation_reason`

Recommended:
- `endpoint` / `usageEndpoint` (source: task registry)
- `task_type` (TaskType)
- `trace_id` and `span_id` linkage (if available)
- `schema_ok` boolean (structured tasks)
- `repair_attempted` boolean and `repair_success` boolean

## 3. Dashboards / queries (SQL snippets allowed)

All queries must be scoped by `agency_id` when used in multi-tenant tooling.

### 3.1 p95 latency by stage (last 24h)

```sql
select
  stage,
  percentile_cont(0.95) within group (order by latency_ms) as p95_ms,
  count(*) as span_count
from public.ai_otel_spans
where created_at >= now() - interval '24 hours'
  and agency_id = :agency_id
group by stage
order by p95_ms desc;
```

### 3.2 Error rate and UNKNOWN rate (last 24h)

```sql
select
  count(*) filter (where (attributes->>'unknown')::boolean = true) as unknown_spans,
  count(*) as total_spans,
  round(100.0 * count(*) filter (where (attributes->>'unknown')::boolean = true) / nullif(count(*),0), 2) as unknown_rate_pct
from public.ai_otel_spans
where created_at >= now() - interval '24 hours'
  and agency_id = :agency_id
  and stage = 'onboarding.turn.end';
```

### 3.3 Repair-pass rate (structured calls)

```sql
select
  round(
    100.0 * count(*) filter (where (attributes->>'repair_attempted')::boolean = true)
    / nullif(count(*),0),
    2
  ) as repair_attempt_rate_pct,
  round(
    100.0 * count(*) filter (where (attributes->>'repair_success')::boolean = true)
    / nullif(count(*) filter (where (attributes->>'repair_attempted')::boolean = true),0),
    2
  ) as repair_success_rate_pct
from public.ai_otel_spans
where created_at >= now() - interval '24 hours'
  and agency_id = :agency_id
  and stage = 'onboarding.schema.validate';
```

### 3.4 Calibration loops per module

```sql
select
  attributes->>'module_key' as module_key,
  count(*) filter (where attributes->>'state' = 'calibration_needed') as calibration_turns,
  count(*) as total_turns
from public.ai_otel_spans
where created_at >= now() - interval '7 days'
  and agency_id = :agency_id
  and stage = 'onboarding.resolver'
group by module_key
order by calibration_turns desc;
```

## 4. SLOs (numbers)

Targets for production (initial, adjust after baseline):
1. p95 onboarding turn latency (end-to-end): <= 1800 ms (excluding model time) and <= 12000 ms (including model time).
2. Error rate (5xx from `ai-onboarding`): <= 0.5% per day.
3. Repair-pass attempted rate (structured steps): <= 8% rolling 1 hour; alert if > 12%.
4. Repair-pass failure rate (attempted but still invalid): <= 1% rolling 24 hours.
5. Calibration-needed turns per module: median <= 1; alert if p95 > 3.
6. Suggestion fallback rate: <= 2% rolling 24 hours.

Required dashboards:
- Turn latency by stage
- UNKNOWN rate by step/module
- Repair-pass attempted + success rates
- Calibration-needed frequency and time-to-ready
- Suggestions fallback/filtered counts

