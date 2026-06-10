-- ============================================================
-- SECURITY FIX: anon role could SELECT full client rows
-- (name, email, phone, portal_slug, agency_id, notes, ...)
-- via the clients_public_portal_discovery policy on the base
-- table. Pre-auth portal discovery must go through the
-- column-whitelisted public.portal_public_clients view
-- (created in 20251221120714_client_portal_access.sql), which
-- runs with owner privileges and exposes only safe columns.
-- ============================================================

begin;

-- 1) Remove the over-broad anon policy on the base table.
drop policy if exists "clients_public_portal_discovery" on public.clients;

-- 2) Belt and suspenders: anon must not be able to read the
--    base table at the grant level either.
revoke select on table public.clients from anon;

-- 3) Ensure the safe discovery view is readable.
grant select on public.portal_public_clients to anon;
grant select on public.portal_public_clients to authenticated;

commit;
