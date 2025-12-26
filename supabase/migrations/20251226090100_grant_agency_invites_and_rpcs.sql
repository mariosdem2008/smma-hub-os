begin;

-- table-level grants (RLS still applies)
grant select, insert, update, delete on table public.agency_invites to authenticated;

-- grants for canonical RPCs
grant execute on function public.get_my_pending_agency_invites() to authenticated;
grant execute on function public.accept_agency_invite(uuid) to authenticated;
grant execute on function public.decline_agency_invite(uuid) to authenticated;
grant execute on function public.get_agency_invite_by_token(text) to anon, authenticated;

commit;

