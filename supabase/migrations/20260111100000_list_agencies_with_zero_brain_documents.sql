create or replace function public.list_agencies_with_zero_brain_documents(
  p_limit int default 200,
  p_offset int default 0
)
returns table (agency_id uuid)
language sql
stable
as $$
  select a.id as agency_id
  from public.agencies a
  where not exists (
    select 1
    from public.brain_documents d
    where d.agency_id = a.id
  )
  order by a.created_at asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

