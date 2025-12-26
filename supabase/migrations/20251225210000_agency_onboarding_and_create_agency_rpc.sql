begin;

-- Agency onboarding sessions (static onboarding v1)
create table if not exists public.agency_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  brain_id uuid null,
  step_id text not null default 'identity',
  answers_json jsonb not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_session_per_agency unique (agency_id)
);

create index if not exists idx_agency_onboarding_sessions_user_updated
  on public.agency_onboarding_sessions (user_id, updated_at desc);

alter table public.agency_onboarding_sessions enable row level security;

-- RLS: agency members can read; only the creator can insert; members can update (session is agency-scoped)
create policy "agency_onboarding_sessions_select" on public.agency_onboarding_sessions
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "agency_onboarding_sessions_insert" on public.agency_onboarding_sessions
  for insert to authenticated
  with check (
    agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    and user_id = auth.uid()
  );

create policy "agency_onboarding_sessions_update" on public.agency_onboarding_sessions
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "agency_onboarding_sessions_delete" on public.agency_onboarding_sessions
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

-- Trigger to auto-update updated_at
create or replace function public.update_agency_onboarding_session_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_agency_onboarding_session_timestamp on public.agency_onboarding_sessions;
create trigger update_agency_onboarding_session_timestamp
  before update on public.agency_onboarding_sessions
  for each row
  execute function public.update_agency_onboarding_session_timestamp();

-- Secure agency creation: creates an agency and makes the caller an admin member.
create or replace function public.create_agency_with_admin(
  _name text,
  _website text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_agency_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if _name is null or length(btrim(_name)) = 0 then
    raise exception 'name_required';
  end if;

  -- If an agency already exists for this user (unique(user_id)), reuse it.
  select id into v_agency_id
  from public.agencies
  where user_id = v_uid
  limit 1;

  if v_agency_id is null then
    v_agency_id := gen_random_uuid();
    insert into public.agencies (id, user_id, name, website)
    values (v_agency_id, v_uid, btrim(_name), nullif(btrim(_website), ''));
  else
    -- keep website/name fresh (safe, owner-only semantics)
    update public.agencies
      set name = btrim(_name),
          website = nullif(btrim(_website), '')
    where id = v_agency_id and user_id = v_uid;
  end if;

  -- Ensure membership exists with admin role for this user (required by the product flow)
  insert into public.agency_members (agency_id, user_id, role, accepted_at)
  values (v_agency_id, v_uid, 'admin', now())
  on conflict (agency_id, user_id) do update
    set role = 'admin',
        accepted_at = coalesce(public.agency_members.accepted_at, excluded.accepted_at);

  return v_agency_id;
end;
$$;

revoke all on function public.create_agency_with_admin(text, text) from public;
grant execute on function public.create_agency_with_admin(text, text) to authenticated;

commit;

