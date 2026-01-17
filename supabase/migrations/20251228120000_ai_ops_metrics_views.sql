-- AI Ops Metrics Views (Phase 4)

create or replace view public.v_ai_runs_last_24h as
with base as (
  select
    endpoint as task_type,
    model as runtime_model,
    latency_ms,
    unknown,
    case
      when model ilike 'gpt-%' or model ilike 'text-embedding-%' then 'openai'
      when model ilike 'claude%' or model ilike '%anthropic%' then 'anthropic'
      when model is null then 'unknown'
      else 'unknown'
    end as provider,
    case
      when coalesce(unknown, false) = true
        or model in ('context-missing', 'embeddings-not-configured', 'retrieval-only')
      then 1
      else 0
    end as is_error
  from public.ai_usage_logs
  where created_at >= now() - interval '24 hours'
)
select
  task_type,
  provider,
  runtime_model,
  count(*) as total_calls,
  avg(latency_ms) as avg_latency_ms,
  sum(is_error) as error_calls,
  (sum(is_error)::float / nullif(count(*), 0)) as error_rate
from base
group by task_type, provider, runtime_model;
create or replace view public.v_ai_budget_health as
with base as (
  select
    agency_id,
    coalesce(metadata->>'cost_estimation_method', 'unknown') as cost_estimation_method,
    cost_usd
  from public.ai_runs
  where created_at >= now() - interval '30 days'
),
agg as (
  select
    agency_id,
    cost_estimation_method,
    sum(cost_usd) as spend_usd
  from base
  group by agency_id, cost_estimation_method
),
totals as (
  select
    agency_id,
    sum(case when cost_estimation_method = 'token_based' then spend_usd else 0 end) as token_based_spend_usd,
    sum(case when cost_estimation_method <> 'token_based' then spend_usd else 0 end) as estimated_spend_usd,
    sum(spend_usd) as total_spend_usd
  from agg
  group by agency_id
)
select
  agg.agency_id,
  agg.cost_estimation_method,
  agg.spend_usd,
  totals.total_spend_usd,
  totals.token_based_spend_usd,
  totals.estimated_spend_usd,
  case
    when totals.token_based_spend_usd > 0 then
      ((totals.estimated_spend_usd - totals.token_based_spend_usd) / totals.token_based_spend_usd) * 100
    else null
  end as estimate_vs_token_based_pct
from agg
join totals using (agency_id);
create or replace view public.v_ai_timeouts_retries as
with base as (
  select
    coalesce(metadata->>'task_type', 'unknown') as task_type,
    coalesce((metadata->>'retry_attempts')::int, 0) as retry_attempts,
    coalesce(metadata->>'error_code', '') as error_code
  from public.ai_runs
  where created_at >= now() - interval '7 days'
)
select
  task_type,
  count(*) as total_calls,
  count(*) filter (where error_code ilike '%timeout%') as timeout_count,
  (count(*) filter (where error_code ilike '%timeout%')::float / nullif(count(*), 0)) as timeout_rate,
  count(*) filter (where retry_attempts = 0) as retry_attempts_0,
  count(*) filter (where retry_attempts = 1) as retry_attempts_1,
  count(*) filter (where retry_attempts = 2) as retry_attempts_2,
  (count(*) filter (where retry_attempts > 0)::float / nullif(count(*), 0)) as retry_rate
from base
group by task_type;
create or replace view public.v_ai_rag_health as
with runs as (
  select
    citations,
    metadata
  from public.ai_runs
  where created_at >= now() - interval '7 days'
    and metadata ? 'rag_policy_version'
),
doc_type_counts as (
  select
    jsonb_array_elements_text(coalesce(metadata->'doc_types_used', '[]'::jsonb)) as doc_type,
    count(*) as count
  from runs
  group by doc_type
),
rag_policy_counts as (
  select
    coalesce(metadata->>'rag_policy_version', 'unknown') as rag_policy_version,
    count(*) as count
  from runs
  group by rag_policy_version
)
select
  now() - interval '7 days' as window_start,
  now() as window_end,
  count(*) as total_runs,
  (
    count(*) filter (
      where (
        jsonb_array_length(coalesce(citations->'memory_citations', '[]'::jsonb)) > 0
        or jsonb_array_length(coalesce(citations->'client_brain_fields', '[]'::jsonb)) > 0
        or jsonb_array_length(coalesce(citations->'agency_brain_fields', '[]'::jsonb)) > 0
      )
    )::float / nullif(count(*), 0)
  ) as citation_coverage_rate,
  (
    count(*) filter (where coalesce(metadata->>'context_truncated', 'false') = 'true')::float
    / nullif(count(*), 0)
  ) as context_truncated_rate,
  avg(coalesce((metadata->>'retrieval_count')::int, 0)) as avg_retrieval_count,
  coalesce((select jsonb_object_agg(doc_type, count) from doc_type_counts), '{}'::jsonb) as doc_types_used_distribution,
  coalesce((select jsonb_object_agg(rag_policy_version, count) from rag_policy_counts), '{}'::jsonb) as rag_policy_version_distribution
from runs;
create or replace view public.v_ai_citation_failures as
with runs as (
  select
    r.metadata,
    coalesce(r.metadata->>'task_type', pr.task_type, 'unknown') as task_type
  from public.ai_runs r
  left join public.ai_prompt_registry pr on pr.id = r.prompt_id
  where r.created_at >= now() - interval '30 days'
    and r.metadata ? 'citation_errors'
    and jsonb_array_length(r.metadata->'citation_errors') > 0
),
error_types as (
  select
    jsonb_array_elements_text(metadata->'citation_errors') as error_type,
    count(*) as count
  from runs
  group by error_type
  order by count desc
  limit 5
),
task_counts as (
  select
    task_type,
    count(*) as count
  from runs
  group by task_type
  order by count desc
  limit 5
)
select
  (select count(*) from runs) as total_error_runs,
  coalesce(
    (select jsonb_agg(jsonb_build_object('error', error_type, 'count', count)) from error_types),
    '[]'::jsonb
  ) as top_error_types,
  coalesce(
    (select jsonb_agg(jsonb_build_object('task_type', task_type, 'count', count)) from task_counts),
    '[]'::jsonb
  ) as top_task_types;
create or replace view public.v_ai_embeddings_health as
with usage as (
  select
    endpoint,
    model,
    unknown
  from public.ai_usage_logs
  where created_at >= now() - interval '30 days'
    and endpoint in ('ai-documents-ingest', 'ai-brain-ingest', 'ai-embeddings')
),
usage_counts as (
  select
    count(*) as total_calls,
    count(*) filter (
      where coalesce(unknown, false) = true
        or model in ('embeddings-not-configured', 'embedding-error')
    ) as failure_calls
  from usage
),
recent_embeddings as (
  select
    metadata
  from public.ai_embeddings
  where created_at >= now() - interval '30 days'
),
recent_counts as (
  select
    count(*) as total_embeddings_30d,
    count(*) filter (where metadata->>'legacy_zero_vector' = 'true') as legacy_zero_vector_30d
  from recent_embeddings
)
select
  usage_counts.total_calls as total_embedding_calls_30d,
  usage_counts.failure_calls as embed_failure_calls_30d,
  (usage_counts.failure_calls::float / nullif(usage_counts.total_calls, 0)) as embed_failure_rate_30d,
  (recent_counts.legacy_zero_vector_30d::float / nullif(recent_counts.total_embeddings_30d, 0)) as legacy_zero_vector_true_rate_30d,
  (
    select count(*)
    from public.ai_embeddings
    where embedding = array_fill(0, array[1536])::vector
  ) as zero_vectors_remaining
from usage_counts, recent_counts;
create or replace view public.v_ai_router_compliance as
with runs as (
  select id, agency_id, client_id, created_at
  from public.ai_runs
  where created_at >= now() - interval '7 days'
),
matched as (
  select distinct r.id
  from runs r
  join public.ai_usage_logs u
    on u.agency_id = r.agency_id
   and u.client_id is not distinct from r.client_id
   and u.created_at between r.created_at - interval '5 seconds'
                       and r.created_at + interval '5 seconds'
)
select
  count(*) as total_runs,
  count(m.id) as runs_with_usage_log,
  (count(m.id)::float / nullif(count(*), 0)) * 100 as router_compliance_pct
from runs r
left join matched m on m.id = r.id;
create or replace view public.v_ai_legacy_table_writes as
with history as (
  select
    count(*) as ai_history_inserts_7d,
    max(created_at) as ai_history_last_insert_at
  from public.ai_history
  where created_at >= now() - interval '7 days'
),
usage as (
  select
    count(*) as ai_generation_usage_inserts_7d,
    max(created_at) as ai_generation_usage_last_insert_at
  from public.ai_generation_usage
  where created_at >= now() - interval '7 days'
)
select
  history.ai_history_inserts_7d,
  history.ai_history_last_insert_at,
  usage.ai_generation_usage_inserts_7d,
  usage.ai_generation_usage_last_insert_at
from history, usage;
