create or replace function public.get_agency_members(p_agency_id uuid)
returns table (
  user_id uuid,
  role text,
  full_name text,
  email text
)
language sql
security definer
set search_path = public
as $$
  -- authorize caller is member OR owner (runs with definer privileges, no recursion)
  select
    am.user_id,
    am.role::text,
    p.full_name,
    p.email
  from public.agency_members am
  left join public.profiles p on p.id = am.user_id
  where am.agency_id = p_agency_id
    and (
      exists (select 1 from public.agencies a where a.id = p_agency_id and a.user_id = auth.uid())
      or exists (select 1 from public.agency_members me where me.agency_id = p_agency_id and me.user_id = auth.uid())
    );
$$;

revoke all on function public.get_agency_members(uuid) from public;
grant execute on function public.get_agency_members(uuid) to authenticated;
