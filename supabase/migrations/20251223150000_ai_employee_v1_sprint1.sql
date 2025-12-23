-- AI Employee v1 Sprint 1 tables + RLS

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.agency_brains (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'usable', 'complete', 'locked')),
  locked boolean not null default false,
  brain_json jsonb not null,
  json_diff jsonb,
  confidence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_brains (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('draft', 'usable', 'complete', 'locked')),
  locked boolean not null default false,
  brain_json jsonb not null,
  json_diff jsonb,
  confidence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  doc_type text not null,
  title text not null,
  content text not null,
  extracted_text text,
  source jsonb not null,
  source_url text,
  file_ref text,
  file_name text,
  file_size_mb numeric(10,2),
  mime_type text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact'
  ))
);

create table if not exists public.ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  token_count integer not null,
  chunk_meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  doc_type text not null,
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  chunk_id uuid not null references public.ai_document_chunks(id) on delete cascade,
  embedding vector(1536) not null,
  model text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_prompt_registry (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null,
  status text not null check (status in ('draft', 'active', 'deprecated')),
  task_type text not null check (task_type in ('answer_quality_check', 'rag_ask')),
  model text not null,
  max_tokens integer not null,
  template text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  prompt_id uuid references public.ai_prompt_registry(id) on delete set null,
  prompt_version integer,
  model text not null,
  tokens_in integer not null,
  tokens_out integer not null,
  cost_usd numeric(10,4) not null,
  latency_ms integer not null,
  success boolean not null,
  citations jsonb not null,
  unknown boolean not null,
  escalate_to_human boolean not null,
  escalation_reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_budgets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  month_yyyy_mm text not null,
  budget_usd numeric(10,2) not null default 50.00,
  spent_usd numeric(10,2) not null default 0.00,
  hard_stop boolean not null default true,
  reset_day integer not null default 1,
  reset_time_utc time not null default '00:00',
  reset_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_rate_limits (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day_yyyy_mm_dd text not null,
  limit_per_day integer not null default 20,
  used_count integer not null default 0,
  reset_time_utc time not null default '00:00',
  reset_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_escalations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  question text not null,
  reason text not null,
  status text not null default 'open',
  assignee_role text not null default 'agency_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_documents_agency_client_type on public.ai_documents(agency_id, client_id, doc_type);
create index if not exists idx_ai_chunks_doc on public.ai_document_chunks(document_id);
create index if not exists idx_ai_embeddings_filter on public.ai_embeddings(agency_id, client_id, doc_type);
create index if not exists idx_ai_runs_filter on public.ai_runs(agency_id, client_id, created_at);
create index if not exists idx_ai_escalations_agency_status on public.ai_escalations(agency_id, status);

alter table public.agency_brains enable row level security;
alter table public.client_brains enable row level security;
alter table public.ai_documents enable row level security;
alter table public.ai_document_chunks enable row level security;
alter table public.ai_embeddings enable row level security;
alter table public.ai_prompt_registry enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_budgets enable row level security;
alter table public.ai_rate_limits enable row level security;
alter table public.ai_escalations enable row level security;

create policy "agency_brains_select" on public.agency_brains
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "agency_brains_insert" on public.agency_brains
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "agency_brains_update" on public.agency_brains
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "agency_brains_delete" on public.agency_brains
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "client_brains_select" on public.client_brains
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "client_brains_insert" on public.client_brains
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "client_brains_update" on public.client_brains
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "client_brains_delete" on public.client_brains
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_documents_select" on public.ai_documents
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_documents_insert" on public.ai_documents
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_documents_update" on public.ai_documents
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_documents_delete" on public.ai_documents
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_document_chunks_select" on public.ai_document_chunks
  for select to authenticated
  using (
    document_id in (
      select id from public.ai_documents
      where agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    )
  );

create policy "ai_document_chunks_insert" on public.ai_document_chunks
  for insert to authenticated
  with check (
    document_id in (
      select id from public.ai_documents
      where agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    )
  );

create policy "ai_document_chunks_update" on public.ai_document_chunks
  for update to authenticated
  using (
    document_id in (
      select id from public.ai_documents
      where agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    )
  );

create policy "ai_document_chunks_delete" on public.ai_document_chunks
  for delete to authenticated
  using (
    document_id in (
      select id from public.ai_documents
      where agency_id in (select agency_id from public.agency_members where user_id = auth.uid())
    )
  );

create policy "ai_embeddings_select" on public.ai_embeddings
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_insert" on public.ai_embeddings
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_update" on public.ai_embeddings
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_embeddings_delete" on public.ai_embeddings
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_prompt_registry_select" on public.ai_prompt_registry
  for select to authenticated
  using (true);

create policy "ai_runs_select" on public.ai_runs
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_runs_insert" on public.ai_runs
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_runs_update" on public.ai_runs
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_runs_delete" on public.ai_runs
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_budgets_select" on public.ai_budgets
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_budgets_insert" on public.ai_budgets
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_budgets_update" on public.ai_budgets
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_budgets_delete" on public.ai_budgets
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_rate_limits_select" on public.ai_rate_limits
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_rate_limits_insert" on public.ai_rate_limits
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_rate_limits_update" on public.ai_rate_limits
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_rate_limits_delete" on public.ai_rate_limits
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_escalations_select" on public.ai_escalations
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_escalations_insert" on public.ai_escalations
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_escalations_update" on public.ai_escalations
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_escalations_delete" on public.ai_escalations
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

drop trigger if exists trg_agency_brains_updated_at on public.agency_brains;
create trigger trg_agency_brains_updated_at
  before update on public.agency_brains
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_client_brains_updated_at on public.client_brains;
create trigger trg_client_brains_updated_at
  before update on public.client_brains
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ai_documents_updated_at on public.ai_documents;
create trigger trg_ai_documents_updated_at
  before update on public.ai_documents
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ai_budgets_updated_at on public.ai_budgets;
create trigger trg_ai_budgets_updated_at
  before update on public.ai_budgets
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ai_rate_limits_updated_at on public.ai_rate_limits;
create trigger trg_ai_rate_limits_updated_at
  before update on public.ai_rate_limits
  for each row execute function public.update_updated_at_column();

drop trigger if exists trg_ai_escalations_updated_at on public.ai_escalations;
create trigger trg_ai_escalations_updated_at
  before update on public.ai_escalations
  for each row execute function public.update_updated_at_column();

insert into public.ai_prompt_registry (name, version, status, task_type, model, max_tokens, template, notes)
values
  ('Answer Quality Check', 1, 'active', 'answer_quality_check', 'CHEAP_MODEL', 6000, 'quality_check_v1', 'Sprint 1 default'),
  ('RAG Ask', 1, 'active', 'rag_ask', 'STRONG_MODEL', 6000, 'rag_ask_v1', 'Sprint 1 default')
on conflict do nothing;
