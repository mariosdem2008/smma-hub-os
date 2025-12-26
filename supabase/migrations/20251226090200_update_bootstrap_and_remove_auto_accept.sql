begin;

-- Remove deprecated "auto-accept all invites" RPC to avoid multiple acceptance systems.
drop function if exists public.accept_pending_agency_invites();

-- Ensure bootstrap includes pending invites but never accepts automatically.
create or replace function public.get_user_agency_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_memberships jsonb;
  v_pending jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select email into v_email
  from auth.users
  where id = v_uid;

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

revoke all on function public.get_user_agency_bootstrap() from public;
grant execute on function public.get_user_agency_bootstrap() to authenticated;

commit;

