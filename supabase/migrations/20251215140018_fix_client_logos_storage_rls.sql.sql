-- 1) Ensure the bucket exists (and make it public since you use getPublicUrl)
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update
set public = true;

-- 2) The storage API runs as role supabase_storage_admin.
-- Some of your existing storage policies likely reference public.client_users,
-- and that role has NO privilege to read it -> "permission denied for table client_users".
grant select on table public.client_users to supabase_storage_admin;

-- 3) Create a SECURITY DEFINER helper (so policy checks can query tables safely)
create or replace function public.is_agency_member(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agency_members am
    where am.user_id = _user_id
  );
$$;

alter function public.is_agency_member(uuid) owner to postgres;

-- 4) Storage policies for the client-logos bucket
-- NOTE: these are permissive policies (safe to add).
drop policy if exists "client_logos_insert_agency_members" on storage.objects;
drop policy if exists "client_logos_select_public" on storage.objects;
drop policy if exists "client_logos_update_owner" on storage.objects;
drop policy if exists "client_logos_delete_owner" on storage.objects;

create policy "client_logos_insert_agency_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-logos'
  and public.is_agency_member(auth.uid())
);

create policy "client_logos_select_public"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'client-logos'
);

create policy "client_logos_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-logos'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'client-logos'
  and owner_id = auth.uid()::text
);

create policy "client_logos_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-logos'
  and owner_id = auth.uid()::text
);


drop policy if exists "client_logos_insert_agency_members" on storage.objects;

create policy "client_logos_insert_agency_members"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-logos'
  and owner_id = auth.uid()::text
  and public.is_agency_member(auth.uid())
);
