\echo '=== CROSS-TENANT ISOLATION TESTS ==='

-- 1) match_ai_embeddings privileges (should be service_role only)
select case
  when not has_function_privilege('anon', oid, 'execute')
   and not has_function_privilege('authenticated', oid, 'execute')
   and has_function_privilege('service_role', oid, 'execute')
  then 'PASS' else 'FAIL'
end as match_ai_embeddings_privileges
from pg_proc
where proname = 'match_ai_embeddings'
limit 1;

-- 2) RLS enabled checks (spot check the AI/RAG and brain modules tables)
select case when relrowsecurity then 'PASS' else 'FAIL' end as brain_documents_rls
from pg_class
where relname = 'brain_documents';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_documents_rls
from pg_class
where relname = 'ai_documents';

