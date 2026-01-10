begin;

-- Fix ON CONFLICT inference: Postgres cannot infer partial unique indexes here.
-- Replace the partial unique index with a regular unique index (NULLs remain allowed and distinct).
drop index if exists public.ai_jobs_dedupe_unique;

create unique index if not exists ai_jobs_dedupe_unique
  on public.ai_jobs (job_type, client_id, dedupe_key);

commit;

