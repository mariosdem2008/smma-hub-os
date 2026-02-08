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

-- Phase 2: match_ai_embeddings_scoped privileges (should be service_role only)
select case
  when not has_function_privilege('anon', oid, 'execute')
   and not has_function_privilege('authenticated', oid, 'execute')
   and has_function_privilege('service_role', oid, 'execute')
  then 'PASS' else 'FAIL'
end as match_ai_embeddings_scoped_privileges
from pg_proc
where proname = 'match_ai_embeddings_scoped'
limit 1;

-- Phase 2: Gemini shadow match privileges (should be service_role only)
select case
  when not has_function_privilege('anon', oid, 'execute')
   and not has_function_privilege('authenticated', oid, 'execute')
   and has_function_privilege('service_role', oid, 'execute')
  then 'PASS' else 'FAIL'
end as match_ai_embeddings_shadow_gemini_privileges
from pg_proc
where proname = 'match_ai_embeddings_shadow_gemini'
limit 1;

select case
  when not has_function_privilege('anon', oid, 'execute')
   and not has_function_privilege('authenticated', oid, 'execute')
   and has_function_privilege('service_role', oid, 'execute')
  then 'PASS' else 'FAIL'
end as match_ai_embeddings_shadow_gemini_scoped_privileges
from pg_proc
where proname = 'match_ai_embeddings_shadow_gemini_scoped'
limit 1;

-- 2) RLS enabled checks (spot check the AI/RAG and brain modules tables)
select case when relrowsecurity then 'PASS' else 'FAIL' end as brain_documents_rls
from pg_class
where relname = 'brain_documents';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_documents_rls
from pg_class
where relname = 'ai_documents';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_ingestion_sources_rls
from pg_class
where relname = 'ai_ingestion_sources';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_episodic_buffers_rls
from pg_class
where relname = 'ai_episodic_buffers';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_embeddings_shadow_gemini_vector_rls
from pg_class
where relname = 'ai_embeddings_shadow_gemini_vector';

-- Phase 1: onboarding state + persona + turn logs must be tenant-scoped
select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_onboarding_status_rls
from pg_class
where relname = 'ai_onboarding_status';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_persona_vectors_rls
from pg_class
where relname = 'ai_persona_vectors';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_onboarding_turn_logs_rls
from pg_class
where relname = 'ai_onboarding_turn_logs';

-- Phase 7: observability tables must remain tenant-scoped under RLS
select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_runs_rls
from pg_class
where relname = 'ai_runs';

select case when relrowsecurity then 'PASS' else 'FAIL' end as ai_otel_spans_rls
from pg_class
where relname = 'ai_otel_spans';

-- Phase 1 hardening: trigger guards for client -> agency consistency
select case
  when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ai_onboarding_status'
      and t.tgname = 'trg_ai_onboarding_status_client_agency_guard'
      and not t.tgisinternal
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_status_client_agency_guard;

select case
  when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ai_persona_vectors'
      and t.tgname = 'trg_ai_persona_vectors_client_agency_guard'
      and not t.tgisinternal
  ) then 'PASS' else 'FAIL'
end as ai_persona_vectors_client_agency_guard;

select case
  when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ai_onboarding_turn_logs'
      and t.tgname = 'trg_ai_onboarding_turn_logs_client_agency_guard'
      and not t.tgisinternal
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_turn_logs_client_agency_guard;

select case
  when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    where c.relname = 'ai_onboarding_turn_logs'
      and t.tgname = 'trg_ai_onboarding_turn_logs_status_scope_guard'
      and not t.tgisinternal
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_turn_logs_status_scope_guard;

-- Phase 2 onboarding turn engine persistence checks
select case
  when exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_onboarding_turn_logs'
      and column_name = 'client_turn_id'
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_turn_logs_client_turn_id_column;

select case
  when exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_onboarding_turn_logs'
      and column_name = 'response_json'
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_turn_logs_response_json_column;

select case
  when exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'ai_onboarding_turn_logs'
      and indexname = 'idx_ai_onboarding_turn_logs_idempotency'
  ) then 'PASS' else 'FAIL'
end as ai_onboarding_turn_logs_idempotency_index;
