-- Draft SQL for AI Employee v1 (spec-only)
-- Requires pgvector if vector(1536) is used.

create table if not exists agency_brains (
  id uuid primary key,
  agency_id uuid not null,
  version integer not null,
  status text not null, -- draft|usable|complete|locked
  locked boolean not null default false,
  brain_json jsonb not null,
  json_diff jsonb,
  confidence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_brains (
  id uuid primary key,
  agency_id uuid not null,
  client_id uuid not null,
  version integer not null,
  status text not null, -- draft|usable|complete|locked
  locked boolean not null default false,
  brain_json jsonb not null,
  json_diff jsonb,
  confidence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_documents (
  id uuid primary key,
  agency_id uuid not null,
  client_id uuid,
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

create table if not exists ai_document_chunks (
  id uuid primary key,
  document_id uuid not null references ai_documents(id),
  chunk_index integer not null,
  chunk_text text not null,
  token_count integer not null,
  chunk_meta jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_embeddings (
  id uuid primary key,
  agency_id uuid not null,
  client_id uuid,
  doc_type text not null,
  document_id uuid not null references ai_documents(id),
  chunk_id uuid not null references ai_document_chunks(id),
  embedding vector(1536) not null,
  model text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ai_prompt_registry (
  id uuid primary key,
  name text not null,
  version integer not null,
  status text not null, -- draft|active|deprecated
  task_type text not null, -- answer_quality_check|rag_ask
  model text not null,
  max_tokens integer not null,
  template text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists ai_runs (
  id uuid primary key,
  agency_id uuid not null,
  client_id uuid,
  user_id uuid,
  prompt_id uuid,
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

create table if not exists ai_budgets (
  id uuid primary key,
  agency_id uuid not null,
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

create table if not exists ai_rate_limits (
  id uuid primary key,
  agency_id uuid not null,
  user_id uuid not null,
  day_yyyy_mm_dd text not null,
  limit_per_day integer not null default 20,
  used_count integer not null default 0,
  reset_time_utc time not null default '00:00',
  reset_timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_escalations (
  id uuid primary key,
  agency_id uuid not null,
  client_id uuid,
  user_id uuid,
  question text not null,
  reason text not null,
  status text not null default 'open',
  assignee_role text not null default 'agency_admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_documents_agency_client_type on ai_documents(agency_id, client_id, doc_type);
create index if not exists idx_ai_chunks_doc on ai_document_chunks(document_id);
create index if not exists idx_ai_embeddings_filter on ai_embeddings(agency_id, client_id, doc_type);
create index if not exists idx_ai_runs_filter on ai_runs(agency_id, client_id, created_at);
create index if not exists idx_ai_escalations_agency_status on ai_escalations(agency_id, status);
