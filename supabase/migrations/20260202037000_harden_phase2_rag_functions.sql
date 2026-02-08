-- SECURITY CRITICAL (Phase 2): Restrict RAG match functions to service_role only.
-- This prevents direct client invocation and reduces risk of cross-tenant leaks.

do $$
declare
  func_sig text;
  func_name text;
begin
  for func_sig in
    select pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname = 'match_ai_embeddings_scoped'
  loop
    execute format('revoke all on function public.match_ai_embeddings_scoped(%s) from anon', func_sig);
    execute format('revoke all on function public.match_ai_embeddings_scoped(%s) from authenticated', func_sig);
    execute format('revoke all on function public.match_ai_embeddings_scoped(%s) from public', func_sig);
    execute format('grant execute on function public.match_ai_embeddings_scoped(%s) to service_role', func_sig);
  end loop;

  for func_name, func_sig in
    select p.proname, pg_get_function_identity_arguments(p.oid)
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public'
      and p.proname in ('match_ai_embeddings_shadow_gemini','match_ai_embeddings_shadow_gemini_scoped')
  loop
    execute format('revoke all on function public.%I(%s) from anon', func_name, func_sig);
    execute format('revoke all on function public.%I(%s) from authenticated', func_name, func_sig);
    execute format('revoke all on function public.%I(%s) from public', func_name, func_sig);
    execute format('grant execute on function public.%I(%s) to service_role', func_name, func_sig);
  end loop;
end $$;
