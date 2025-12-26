begin;

-- Bootstrap RPC: returns memberships + pending invites for the authenticated user.
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

  -- Memberships = owned agency + agency_members rows (dedup by agency_id, owner wins)
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

  -- Pending invites for my auth email only (no token required)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invite_id', ai.id,
        'agency_id', ai.agency_id,
        'role', ai.role,
        'email', ai.email,
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

-- Accept pending invites for the authenticated user (by auth email).
create or replace function public.accept_pending_agency_invites()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count int := 0;
  v_agencies uuid[] := '{}'::uuid[];
  v_invite record;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'not_authenticated');
  end if;

  select email into v_email
  from auth.users
  where id = v_uid;

  if v_email is null then
    return jsonb_build_object('success', false, 'error', 'user_missing_email');
  end if;

  for v_invite in
    select ai.*
    from public.agency_invites ai
    where ai.accepted = false
      and (ai.expires_at is null or ai.expires_at > now())
      and lower(ai.email) = lower(v_email)
    order by ai.created_at desc
  loop
    insert into public.agency_members(agency_id, user_id, role, accepted_at)
    values (v_invite.agency_id, v_uid, v_invite.role, now())
    on conflict (agency_id, user_id) do update
      set role = excluded.role,
          accepted_at = coalesce(public.agency_members.accepted_at, excluded.accepted_at);

    update public.agency_invites
      set accepted = true,
          accepted_at = now()
      where id = v_invite.id;

    v_count := v_count + 1;
    v_agencies := array_append(v_agencies, v_invite.agency_id);
  end loop;

  return jsonb_build_object(
    'success', true,
    'accepted_count', v_count,
    'agency_ids', coalesce(to_jsonb(v_agencies), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.accept_pending_agency_invites() from public;
grant execute on function public.accept_pending_agency_invites() to authenticated;

commit;
