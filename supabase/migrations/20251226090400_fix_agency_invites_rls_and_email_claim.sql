begin;

-- Fix 403/42501 errors:
-- - RLS policies must not query auth.users (authenticated role lacks access).
-- - Agency admins must be able to SELECT invites for their agency (Team page).

-- Replace invited-user SELECT policy to use JWT email claim (no auth.users access).
drop policy if exists agency_invites_select_invited on public.agency_invites;
create policy agency_invites_select_invited
  on public.agency_invites
  for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Add admin SELECT policy (so admins can view pending invites in Team UI).
drop policy if exists agency_invites_select_admin on public.agency_invites;
create policy agency_invites_select_admin
  on public.agency_invites
  for select
  to authenticated
  using (public.is_agency_admin(agency_id, auth.uid()));

-- Update canonical RPCs to use JWT email claim instead of querying auth.users.
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
    and lower(ai.email) = lower(auth.jwt() ->> 'email')
  order by ai.created_at desc;
$$;

create or replace function public.accept_agency_invite(_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_invite public.agency_invites%rowtype;
  v_role text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

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

create or replace function public.decline_agency_invite(_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_invite public.agency_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

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

-- Update bootstrap to use JWT email claim (avoids auth.users read).
create or replace function public.get_user_agency_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_memberships jsonb;
  v_pending jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_email is null then
    raise exception 'user_missing_email';
  end if;

  with owned as (
    select
      a.id as agency_id,
      'owner'::text as role,
      a.name as agency_name,
      true as is_owner
    from public.agencies a
    where a.user_id = v_uid
  ),
  member as (
    select
      am.agency_id,
      am.role::text as role,
      a.name as agency_name,
      false as is_owner,
      am.created_at
    from public.agency_members am
    join public.agencies a on a.id = am.agency_id
    where am.user_id = v_uid
  ),
  combined as (
    select agency_id, role, agency_name, is_owner, null::timestamptz as created_at from owned
    union all
    select agency_id, role, agency_name, is_owner, created_at from member
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        partition by c.agency_id
        order by c.is_owner desc, c.created_at desc nulls last
      ) as rn
    from combined c
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'agency_id', r.agency_id,
        'role', r.role,
        'agency_name', r.agency_name,
        'is_owner', r.is_owner
      )
      order by r.is_owner desc, r.agency_name asc
    ),
    '[]'::jsonb
  )
  into v_memberships
  from ranked r
  where r.rn = 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invite_id', ai.id,
        'agency_id', ai.agency_id,
        'role', ai.role,
        'email', ai.email,
        'created_at', ai.created_at,
        'expires_at', ai.expires_at,
        'agency_name', a.name
      )
      order by ai.created_at desc
    ),
    '[]'::jsonb
  )
  into v_pending
  from public.agency_invites ai
  join public.agencies a on a.id = ai.agency_id
  where ai.accepted = false
    and ai.declined = false
    and (ai.expires_at is null or ai.expires_at > now())
    and lower(ai.email) = lower(v_email);

  return jsonb_build_object(
    'memberships', v_memberships,
    'pending_invites', v_pending,
    'last_agency_id', null
  );
end;
$$;

commit;

