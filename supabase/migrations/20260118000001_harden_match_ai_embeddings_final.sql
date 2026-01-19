-- SECURITY CRITICAL: Restrict match_ai_embeddings to service_role only
do $$
declare
  func_sig text;
begin
  for func_sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname = 'match_ai_embeddings'
  loop
    execute format('revoke all on function public.match_ai_embeddings(%s) from anon', func_sig);
    execute format('revoke all on function public.match_ai_embeddings(%s) from authenticated', func_sig);
    execute format('revoke all on function public.match_ai_embeddings(%s) from public', func_sig);
    execute format('grant execute on function public.match_ai_embeddings(%s) to service_role', func_sig);
  end loop;
end $$;

