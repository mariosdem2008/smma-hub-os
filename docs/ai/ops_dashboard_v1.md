# AI Ops Dashboard v1

## Purpose
Read-only views for AI observability and rollout control. This is measure + control + prepare cleanup (no refactors).

## Data windows
- v_ai_runs_last_24h: last 24 hours
- v_ai_budget_health: last 30 days
- v_ai_timeouts_retries: last 7 days
- v_ai_rag_health: last 7 days
- v_ai_citation_failures: last 30 days
- v_ai_embeddings_health: last 30 days
- v_ai_router_compliance: last 7 days
- v_ai_legacy_table_writes: last 7 days

## Known limitations (best-effort)
- Provider/task_type values are derived from available fields; ai_usage_logs does not store explicit provider/task_type today.
- Timeout/retry metrics rely on ai_runs.metadata fields when present (error_code, retry_attempts).
- Router compliance uses ai_runs to ai_usage_logs time-window matching (best-effort, not perfect).

## Security / Execution Context
- Views are SECURITY INVOKER and respect RLS for normal authenticated users.
- If dashboards run with service_role, RLS is bypassed and all tenants are visible.
- Rule: never expose service_role dashboards in UI; use per-agency admin context.

## Dashboard queries (exact SQL)

### 1) v_ai_runs_last_24h
```sql
select * from public.v_ai_runs_last_24h
order by total_calls desc;
```

### 2) v_ai_budget_health
```sql
select * from public.v_ai_budget_health
order by total_spend_usd desc, cost_estimation_method;
```

### 3) v_ai_timeouts_retries
```sql
select * from public.v_ai_timeouts_retries
order by timeout_rate desc nulls last, retry_rate desc nulls last;
```

### 4) v_ai_rag_health
```sql
select * from public.v_ai_rag_health;
```

### 5) v_ai_citation_failures
```sql
select * from public.v_ai_citation_failures;
```

### 6) v_ai_embeddings_health
```sql
select * from public.v_ai_embeddings_health;
```

### 7) v_ai_router_compliance
```sql
select * from public.v_ai_router_compliance;
```

### 8) v_ai_legacy_table_writes
```sql
select * from public.v_ai_legacy_table_writes;
```

## Thresholds and actions

- v_ai_runs_last_24h
  - Target: error_rate stable and low (no formal threshold defined).
  - Action: if error_rate spikes, check v_ai_timeouts_retries and provider status; consider disabling AI_PROVIDER_TIMEOUTS or AI_PROVIDER_RETRIES if failures are provider-driven.

- v_ai_budget_health
  - Target: estimation drift stays near 0; follow budget accuracy alerting in docs/ai/migration_map_v1.md (delta > $1 or >1%).
  - Action: if estimate_vs_token_based_pct diverges sharply, keep cost_estimation_method as "estimate_chars_div3" until pricing reconciliation is updated.

- v_ai_timeouts_retries
  - Targets: timeouts <2%, retries <5% (per migration_map_v1.md Phase 2).
  - Actions: if timeouts >2%, set AI_PROVIDER_TIMEOUTS=false; if retries >5%, set AI_PROVIDER_RETRIES=false and investigate provider status.

- v_ai_rag_health
  - Targets: citation coverage >90%, context_truncated rate stable (<20% recommended), avg retrieval_count ~= 12 when AI_RAG_CENTRALIZED=true.
  - Actions: if citation coverage <90%, keep AI_SCHEMA_STRICT=false; if context_truncated spikes, reduce retrieval_count or increase max_context_chars in ragPolicy.

- v_ai_citation_failures
  - Target: total_error_runs trending down.
  - Actions: if errors increase, keep AI_SCHEMA_STRICT=false and inspect top_error_types; fix schema validation issues before strict mode.

- v_ai_embeddings_health
  - Targets: embed_failure_rate <5% (per migration_map_v1.md Phase 2), legacy_zero_vector_true_rate_30d -> 0.
  - Actions: if embed_failure_rate >5%, set AI_EMBEDDING_FAIL_HARD=false; if zero_vectors_remaining >0, plan cleanup per migration_map_v1.md.
  - Note: zero_vectors_remaining may require a full scan of ai_embeddings; if row count exceeds 1,000,000, consider adding an index or maintaining a nightly aggregate/job. Acceptable for staging/small prod today.

- v_ai_router_compliance
  - Target: >95% (per architecture_target_v2_frozen.md).
  - Actions: if below target, audit endpoints with direct provider calls; require router path.

- v_ai_legacy_table_writes
  - Target: 0 inserts in last 7 days.
  - Actions: if >0, identify callers and block new writes (triggers already in place per Phase 2).

## Rollout checklist: AI_RAG_CENTRALIZED
1. Deploy with AI_RAG_CENTRALIZED=false.
2. Enable 10% rollout: AI_RAG_CENTRALIZED=10.
3. Monitor v_ai_rag_health and v_ai_citation_failures for 48h.
4. If stable, set AI_RAG_CENTRALIZED=25.
5. Monitor 48h.
6. If stable, set AI_RAG_CENTRALIZED=50.
7. Monitor 48h.
8. If stable, set AI_RAG_CENTRALIZED=100 (or true).
9. Keep AI_SCHEMA_STRICT=false until citation coverage >90% consistently.
10. Document final rollout decision in docs/ai/implementation_phase4_notes.md.

## 10-step incident playbook (kill switches)
1. Confirm incident scope (which endpoints/tasks, time window, % impact).
2. If RAG quality drops, set AI_RAG_CENTRALIZED=false.
3. If citation errors spike, set AI_SCHEMA_STRICT=false.
4. If timeouts spike, set AI_PROVIDER_TIMEOUTS=false.
5. If retry storms occur, set AI_PROVIDER_RETRIES=false.
6. If embedding failures spike, set AI_EMBEDDING_FAIL_HARD=false.
7. Verify stabilization via v_ai_runs_last_24h and v_ai_timeouts_retries.
8. Collect samples from ai_runs (unknown/escalate_to_human) for root cause.
9. Apply targeted fix or rollback the last deploy.
10. Re-enable flags gradually with the rollout checklist once metrics recover.
