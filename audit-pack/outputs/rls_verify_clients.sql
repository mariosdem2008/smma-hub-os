select id, agency_id, name
from public.clients
where agency_id in (
  select agency_id from public.agency_members
  where user_id = auth.uid()
    and role in ('owner','admin','manager')
);
