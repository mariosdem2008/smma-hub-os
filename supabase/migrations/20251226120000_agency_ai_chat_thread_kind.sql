begin;

alter table public.agency_ai_chat_threads
  add column if not exists kind text not null default 'general'
  check (kind in ('general', 'setup'));

update public.agency_ai_chat_threads
  set kind = 'general'
  where kind is null;

create unique index if not exists agency_ai_chat_threads_one_setup_idx
  on public.agency_ai_chat_threads (agency_id)
  where kind = 'setup';

commit;
