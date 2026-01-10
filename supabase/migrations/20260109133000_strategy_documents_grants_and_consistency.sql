begin;

-- Fix 403 "permission denied" from PostgREST by granting table privileges.
-- RLS still applies via policies on the table.
grant select, insert, update, delete on table public.strategy_documents to authenticated;

-- Ensure data consistency: strategy_documents.agency_id must always match clients.agency_id.
create or replace function public.set_strategy_documents_agency_id_from_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  select c.agency_id into v_agency_id
  from public.clients c
  where c.id = new.client_id;

  if v_agency_id is null then
    raise exception 'client_not_found';
  end if;

  new.agency_id := v_agency_id;
  return new;
end;
$$;

drop trigger if exists strategy_documents_set_agency_id on public.strategy_documents;
create trigger strategy_documents_set_agency_id
before insert or update of client_id on public.strategy_documents
for each row
execute function public.set_strategy_documents_agency_id_from_client();

commit;

