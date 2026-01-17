begin;
-- Allow Edge Functions using the service role key to invoke the seed RPC.
grant execute on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) to service_role;
commit;
