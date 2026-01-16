begin;

alter table public.ai_usage_logs
  add column if not exists user_id uuid,
  add column if not exists metadata jsonb;

commit;

