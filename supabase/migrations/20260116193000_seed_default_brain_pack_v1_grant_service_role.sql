begin;

-- Ensure Edge Functions using the service role can call the seed RPC.
grant execute on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) to service_role;

commit;

