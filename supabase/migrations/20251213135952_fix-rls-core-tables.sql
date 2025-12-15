-- Helper: check membership without triggering RLS recursion
create or replace function public.is_agency_member(p_agency_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members
    where agency_id = p_agency_id
      and user_id = p_user_id
  );
$$;

-- Lock it down: only callable by authenticated users
revoke all on function public.is_agency_member(uuid, uuid) from public;
grant execute on function public.is_agency_member(uuid, uuid) to authenticated;


