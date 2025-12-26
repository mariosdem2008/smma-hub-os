begin;

-- Canonical accept is `accept_agency_invite(_invite_id uuid)`.
-- Drop the legacy token-based overload to prevent parallel acceptance systems.
drop function if exists public.accept_agency_invite(text, uuid);

commit;
