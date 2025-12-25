-- Agency Admin "Revelation Chat" persistence

create table if not exists public.agency_ai_chat_threads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New session',
  created_at timestamptz not null default now()
);

create index if not exists agency_ai_chat_threads_agency_id_created_at_idx
  on public.agency_ai_chat_threads (agency_id, created_at desc);

create table if not exists public.agency_ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.agency_ai_chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agency_ai_chat_messages_thread_id_created_at_idx
  on public.agency_ai_chat_messages (thread_id, created_at asc);

alter table public.agency_ai_chat_threads enable row level security;
alter table public.agency_ai_chat_messages enable row level security;

-- Policies: admin-only (same semantic as useRole().isAdmin)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agency_ai_chat_threads'
      and policyname='agency_ai_chat_threads_admin_select'
  ) then
    execute $p$
      create policy "agency_ai_chat_threads_admin_select"
      on public.agency_ai_chat_threads
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = agency_ai_chat_threads.agency_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agency_ai_chat_threads'
      and policyname='agency_ai_chat_threads_admin_insert'
  ) then
    execute $p$
      create policy "agency_ai_chat_threads_admin_insert"
      on public.agency_ai_chat_threads
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and exists (
          select 1
          from public.agency_members am
          where am.agency_id = agency_ai_chat_threads.agency_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agency_ai_chat_threads'
      and policyname='agency_ai_chat_threads_admin_update'
  ) then
    execute $p$
      create policy "agency_ai_chat_threads_admin_update"
      on public.agency_ai_chat_threads
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = agency_ai_chat_threads.agency_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.agency_members am
          where am.agency_id = agency_ai_chat_threads.agency_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agency_ai_chat_messages'
      and policyname='agency_ai_chat_messages_admin_select'
  ) then
    execute $p$
      create policy "agency_ai_chat_messages_admin_select"
      on public.agency_ai_chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.agency_ai_chat_threads t
          join public.agency_members am on am.agency_id = t.agency_id
          where t.id = agency_ai_chat_messages.thread_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='agency_ai_chat_messages'
      and policyname='agency_ai_chat_messages_admin_insert'
  ) then
    execute $p$
      create policy "agency_ai_chat_messages_admin_insert"
      on public.agency_ai_chat_messages
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.agency_ai_chat_threads t
          join public.agency_members am on am.agency_id = t.agency_id
          where t.id = agency_ai_chat_messages.thread_id
            and am.user_id = auth.uid()
            and am.role = 'admin'
        )
      );
    $p$;
  end if;
end $$;

