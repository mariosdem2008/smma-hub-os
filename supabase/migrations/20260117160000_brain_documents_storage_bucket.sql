begin;

-- Storage bucket for Agency AI Setup document uploads (used by ai-brain-analyze).
insert into storage.buckets (id, name, public)
values ('brain-documents', 'brain-documents', false)
on conflict (id) do update set name = excluded.name;

-- RLS policies for storage.objects (brain-documents)
drop policy if exists "Brain documents can read" on storage.objects;
drop policy if exists "Brain documents can insert" on storage.objects;
drop policy if exists "Brain documents can update" on storage.objects;
drop policy if exists "Brain documents can delete" on storage.objects;

create policy "Brain documents can read"
  on storage.objects
  for select
  using (
    bucket_id = 'brain-documents'
    and (
      exists (
        select 1
        from public.agency_members m
        where m.user_id = auth.uid()
          and m.agency_id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
      or exists (
        select 1
        from public.agencies a
        where a.user_id = auth.uid()
          and a.id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
    )
  );

create policy "Brain documents can insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
    and (
      exists (
        select 1
        from public.agency_members m
        where m.user_id = auth.uid()
          and m.role in ('owner', 'admin', 'manager')
          and m.agency_id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
      or exists (
        select 1
        from public.agencies a
        where a.user_id = auth.uid()
          and a.id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
    )
  );

create policy "Brain documents can update"
  on storage.objects
  for update
  using (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
  );

create policy "Brain documents can delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
  );

commit;

