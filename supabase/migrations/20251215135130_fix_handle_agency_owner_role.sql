-- Recreate function to run with elevated privileges
create or replace function public.handle_agency_owner_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.user_id, 'owner')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- Make sure the owner is postgres (important for SECURITY DEFINER)
alter function public.handle_agency_owner_role() owner to postgres;
