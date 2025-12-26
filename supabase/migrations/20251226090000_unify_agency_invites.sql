begin;

create extension if not exists "pgcrypto";

-- 1) Schema updates to match canonical invite model
alter table public.agency_invites
  add column if not exists invited_by uuid references auth.users(id) on delete set null;

alter table public.agency_invites
  add column if not exists accepted_at timestamptz;

alter table public.agency_invites
  add column if not exists declined boolean not null default false;

alter table public.agency_invites
  add column if not exists declined_at timestamptz;

-- token should be optional shortcut
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agency_invites'
      and column_name = 'token'
      and is_nullable = 'NO'
  ) then
    alter table public.agency_invites alter column token drop not null;
  end if;
exception when others then
  -- ignore if column doesn't exist or already nullable
  null;
end;
$$;

-- Normalize email to lowercase at the DB layer
create or replace function public.normalize_email_lower()
returns trigger
language plpgsql
as $$
begin
  if new.email is not null then
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_agency_invites_normalize_email on public.agency_invites;
create trigger trg_agency_invites_normalize_email
  before insert or update on public.agency_invites
  for each row
  execute function public.normalize_email_lower();

-- 2) Indexes / constraints
drop index if exists idx_agency_invites_unique_pending;
drop index if exists idx_agency_invites_token;

create unique index if not exists idx_agency_invites_token_unique
  on public.agency_invites(token)
  where token is not null;

create index if not exists idx_agency_invites_email_status
  on public.agency_invites (lower(email), accepted, declined);

create unique index if not exists idx_agency_invites_unique_pending
  on public.agency_invites (agency_id, lower(email))
  where accepted = false and declined = false;

-- 3) RLS policies
alter table public.agency_invites enable row level security;

-- Allow invited users to read their own invites by auth email match (case-insensitive).
drop policy if exists agency_invites_select_invited on public.agency_invites;
create policy agency_invites_select_invited
  on public.agency_invites
  for select
  to authenticated
  using (
    lower(email) = lower((select u.email from auth.users u where u.id = auth.uid()))
  );

-- Only agency admins can create/update/delete invites for their agency.
drop policy if exists agency_invites_insert_admin on public.agency_invites;
create policy agency_invites_insert_admin
  on public.agency_invites
  for insert
  to authenticated
  with check (public.is_agency_admin(agency_id, auth.uid()));

drop policy if exists agency_invites_update_admin on public.agency_invites;
create policy agency_invites_update_admin
  on public.agency_invites
  for update
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()))
  with check (public.is_agency_admin(agency_id, auth.uid()));

drop policy if exists agency_invites_delete_admin on public.agency_invites;
create policy agency_invites_delete_admin
  on public.agency_invites
  for delete
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()));

-- 4) Canonical RPCs
create or replace function public.get_my_pending_agency_invites()
returns table (
  invite_id uuid,
  agency_id uuid,
  role text,
  email text,
  invited_by uuid,
  token text,
  created_at timestamptz,
  expires_at timestamptz,
  agency_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    ai.id as invite_id,
    ai.agency_id,
    ai.role,
    ai.email,
    ai.invited_by,
    ai.token,
    ai.created_at,
    ai.expires_at,
    a.name as agency_name
  from public.agency_invites ai
  join public.agencies a on a.id = ai.agency_id
  where ai.accepted = false
    and ai.declined = false
    and (ai.expires_at is null or ai.expires_at > now())
    and lower(ai.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
  order by ai.created_at desc;
$$;

revoke all on function public.get_my_pending_agency_invites() from public;
grant execute on function public.get_my_pending_agency_invites() to authenticated;

create or replace function public.accept_agency_invite(_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.agency_invites%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'user_missing_email';
  end if;

  select * into v_invite
  from public.agency_invites
  where id = _invite_id
  limit 1;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if v_invite.accepted then
    raise exception 'invite_already_accepted';
  end if;

  if v_invite.declined then
    raise exception 'invite_declined';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite_expired';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'email_mismatch';
  end if;

  -- Normalize to the current allowed set in agency_members (fallback to member).
  v_role := case
    when v_invite.role in ('owner','admin','manager','member') then v_invite.role
    else 'member'
  end;

  insert into public.agency_members(agency_id, user_id, role, accepted_at)
  values (v_invite.agency_id, v_uid, v_role, now())
  on conflict (agency_id, user_id) do update
    set role = excluded.role,
        accepted_at = coalesce(public.agency_members.accepted_at, excluded.accepted_at);

  update public.agency_invites
    set accepted = true,
        accepted_at = now()
    where id = v_invite.id;

  return v_invite.agency_id;
end;
$$;

revoke all on function public.accept_agency_invite(uuid) from public;
grant execute on function public.accept_agency_invite(uuid) to authenticated;

create or replace function public.decline_agency_invite(_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invite public.agency_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null then
    raise exception 'user_missing_email';
  end if;

  select * into v_invite
  from public.agency_invites
  where id = _invite_id
  limit 1;

  if not found then
    raise exception 'invite_not_found';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'email_mismatch';
  end if;

  if v_invite.accepted then
    raise exception 'invite_already_accepted';
  end if;

  update public.agency_invites
    set declined = true,
        declined_at = now()
    where id = v_invite.id;

  return true;
end;
$$;

revoke all on function public.decline_agency_invite(uuid) from public;
grant execute on function public.decline_agency_invite(uuid) to authenticated;

-- 5) Token shortcut: lookup only (no acceptance). Keep masking for anon.
create or replace function public.mask_email(_email text)
returns text
language sql
immutable
as $$
  select case
    when _email is null or position('@' in _email) = 0 then _email
    else left(split_part(_email,'@',1),1) || '***@' || split_part(_email,'@',2)
  end;
$$;

drop function if exists public.get_agency_invite_by_token(text);
create or replace function public.get_agency_invite_by_token(_token text)
returns table (
  invite_id uuid,
  agency_id uuid,
  role text,
  expires_at timestamptz,
  accepted boolean,
  declined boolean,
  email text,
  agency_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    ai.id as invite_id,
    ai.agency_id,
    ai.role,
    ai.expires_at,
    ai.accepted,
    ai.declined,
    case
      when auth.uid() is null then public.mask_email(ai.email)
      else ai.email
    end as email,
    a.name as agency_name
  from public.agency_invites ai
  join public.agencies a on a.id = ai.agency_id
  where ai.token = _token
  limit 1;
$$;

revoke all on function public.get_agency_invite_by_token(text) from public;
grant execute on function public.get_agency_invite_by_token(text) to anon, authenticated;

commit;

