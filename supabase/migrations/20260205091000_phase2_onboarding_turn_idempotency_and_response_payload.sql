-- Phase 2 onboarding turn engine support:
-- 1) request idempotency key per onboarding status
-- 2) persisted response payload for deterministic replay

alter table public.ai_onboarding_turn_logs
  add column if not exists client_turn_id text;

alter table public.ai_onboarding_turn_logs
  add column if not exists response_json jsonb not null default '{}'::jsonb;

drop index if exists idx_ai_onboarding_turn_logs_idempotency;
create unique index idx_ai_onboarding_turn_logs_idempotency
  on public.ai_onboarding_turn_logs(onboarding_status_id, client_turn_id)
  where client_turn_id is not null;

create index if not exists idx_ai_onboarding_turn_logs_status_turn
  on public.ai_onboarding_turn_logs(onboarding_status_id, turn_index desc);

alter table public.ai_onboarding_turn_logs
  drop constraint if exists ai_onboarding_turn_logs_client_turn_id_not_blank;

alter table public.ai_onboarding_turn_logs
  add constraint ai_onboarding_turn_logs_client_turn_id_not_blank
  check (client_turn_id is null or char_length(trim(client_turn_id)) > 0);
