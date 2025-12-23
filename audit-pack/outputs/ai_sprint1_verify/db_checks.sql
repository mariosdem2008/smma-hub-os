-- AI Sprint1 DB checks
select extname from pg_extension where extname in ('uuid-ossp', 'vector') order by extname;

select tablename
from pg_tables
where schemaname = 'public'
  and tablename in (
    'agency_brains',
    'client_brains',
    'ai_documents',
    'ai_document_chunks',
    'ai_embeddings',
    'ai_prompt_registry',
    'ai_runs',
    'ai_budgets',
    'ai_rate_limits',
    'ai_escalations'
  )
order by tablename;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relname in (
  'agency_brains',
  'client_brains',
  'ai_documents',
  'ai_document_chunks',
  'ai_embeddings',
  'ai_prompt_registry',
  'ai_runs',
  'ai_budgets',
  'ai_rate_limits',
  'ai_escalations'
)
order by relname;
