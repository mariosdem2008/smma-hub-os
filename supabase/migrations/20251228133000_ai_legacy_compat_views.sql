-- Legacy compat views + lockdown logging fields (additive)

alter table public.ai_usage_logs
  add column if not exists status_code integer,
  add column if not exists error_code text;

create or replace view public.ai_history_compat_v as
select
  id,
  agency_id,
  client_id,
  nullif(metadata->>'project_id', '')::uuid as project_id,
  metadata->>'mode' as mode,
  metadata->'input' as input,
  metadata->'output' as output,
  created_at
from public.ai_runs
where metadata->>'legacy_source' = 'generate-ai-content';

create or replace view public.ai_generation_usage_compat_v as
select
  id,
  user_id,
  agency_id,
  metadata->>'mode' as generation_type,
  to_char(created_at, 'YYYY-MM') as month_year,
  created_at
from public.ai_runs
where metadata->>'legacy_source' = 'generate-ai-content';
