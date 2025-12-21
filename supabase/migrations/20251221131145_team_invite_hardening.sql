begin;

create extension if not exists "pgcrypto";

alter table public.agency_invites
  add column if not exists accepted_at timestamptz;

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

-- ✅ MUST DROP (can't change return type via OR REPLACE)
drop function if exists public.get_agency_invite_by_token(text);

create or replace function public.get_agency_invite_by_token(_token text)
returns table (
  id uuid,
  agency_id uuid,
  role text,
  expires_at timestamptz,
  accepted boolean,
  email text,
  agency_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    ai.id,
    ai.agency_id,
    ai.role,
    ai.expires_at,
    ai.accepted,
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

-- ✅ ALSO DROP if you changed return type previously
drop function if exists public.accept_agency_invite(text, uuid);

create or replace function public.accept_agency_invite(_invite_token text, _user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.agency_invites%rowtype;
  v_profile_email text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  if _user_id is null or _user_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'user_mismatch');
  end if;

  select * into v_invite
  from public.agency_invites
  where token = _invite_token
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'invite_not_found');
  end if;

  if v_invite.accepted then
    return jsonb_build_object('success', false, 'error', 'invite_already_accepted', 'agency_id', v_invite.agency_id);
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return jsonb_build_object('success', false, 'error', 'invite_expired');
  end if;

  select email into v_profile_email
  from public.profiles
  where id = v_uid;

  if v_profile_email is null then
    return jsonb_build_object('success', false, 'error', 'profile_missing_email');
  end if;

  if lower(v_profile_email) <> lower(v_invite.email) then
    return jsonb_build_object('success', false, 'error', 'email_mismatch');
  end if;

  insert into public.agency_members(agency_id, user_id, role)
  values (v_invite.agency_id, v_uid, v_invite.role)
  on conflict (agency_id, user_id) do update
    set role = excluded.role;

  update public.agency_invites
  set accepted = true,
      accepted_at = now()
  where id = v_invite.id;

  return jsonb_build_object('success', true, 'agency_id', v_invite.agency_id);
end;
$$;

revoke all on function public.accept_agency_invite(text, uuid) from public;
grant execute on function public.accept_agency_invite(text, uuid) to authenticated;

commit;
