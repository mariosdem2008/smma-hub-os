-- Client AI Assistant chat persistence (per-user, per-client)

create table if not exists public.client_ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'assistant' check (kind in ('assistant')),
  title text,
  summary text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists client_ai_chat_threads_unique_user_client_kind
  on public.client_ai_chat_threads (client_id, user_id, kind);

create index if not exists client_ai_chat_threads_client_updated_at_idx
  on public.client_ai_chat_threads (client_id, updated_at desc);

create table if not exists public.client_ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_ai_chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists client_ai_chat_messages_thread_created_at_idx
  on public.client_ai_chat_messages (thread_id, created_at asc);

alter table public.client_ai_chat_threads enable row level security;
alter table public.client_ai_chat_messages enable row level security;

-- Users can select only their own threads/messages
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='client_ai_chat_threads'
      and policyname='client_ai_chat_threads_select_own'
  ) then
    create policy "client_ai_chat_threads_select_own"
      on public.client_ai_chat_threads
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='client_ai_chat_messages'
      and policyname='client_ai_chat_messages_select_own'
  ) then
    create policy "client_ai_chat_messages_select_own"
      on public.client_ai_chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.client_ai_chat_threads t
          where t.id = client_ai_chat_messages.thread_id
            and t.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Grants (reads are enough for now; writes go through service role in edge functions)
grant select on table public.client_ai_chat_threads to authenticated;
grant select on table public.client_ai_chat_messages to authenticated;

