alter table public.ai_usage_logs
  add column if not exists tokens_in integer,
  add column if not exists tokens_out integer,
  add column if not exists latency_ms integer,
  add column if not exists unknown boolean;
