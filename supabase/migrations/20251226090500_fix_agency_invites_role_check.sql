begin;

-- Align agency_invites.role taxonomy with agency_members.role taxonomy.
-- Also fixes the original mismatch where default 'member' was not allowed by the old CHECK.

update public.agency_invites
set role = 'member'
where role is null
   or role in ('creator', 'viewer');

do $$
declare
  c record;
begin
  -- Drop any existing CHECK constraints that mention the role column.
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.agency_invites'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.agency_invites drop constraint if exists %I', c.conname);
  end loop;
end;
$$;

alter table public.agency_invites
  add constraint agency_invites_role_check
  check (role in ('owner', 'admin', 'manager', 'member'));

commit;

