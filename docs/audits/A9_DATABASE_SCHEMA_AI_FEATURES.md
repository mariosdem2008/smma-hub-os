# A9 — Database Schema for AI Features (Current Truth)

## Purpose
Collect the authoritative database schema for all AI-related tables/RPCs/policies used by SMMAHUB (brains, RAG, logging, strategy storage). This matters because stabilizing AI infrastructure requires knowing exactly what tables exist, how they are protected (RLS), and how RPCs behave.

## Key Findings Summary
- Core AI logging tables include `ai_runs` (detailed run records) and `ai_usage_logs` (lightweight usage metrics).
- Brain systems are represented by `agency_brains`, `client_brains`, and modular `brain_documents` / `brain_document_versions`.
- RAG index is implemented through `ai_documents`, `ai_document_chunks`, and `ai_embeddings`.
- Strategy storage uses `strategies`, `strategy_documents`, and `strategy_modules` (plus decisions/tasks/history depending on migrations).
- `match_ai_embeddings` is an RPC used for vector retrieval and must be restricted to service role to prevent cross-tenant leakage.
- There is a contract mismatch risk between product docs and DB enum `public.strategy_module` values (see strategy migrations).

## Detailed Analysis
### Tables (AI + brains + strategy)
This audit pulls full migration SQL for AI/brain/strategy/embedding/match_ai to derive:
- CREATE TABLE statements
- RLS policies
- Indexes

### RPCs
This audit includes migrations defining RPCs such as:
- `match_ai_embeddings`
- `create_strategy_snapshot`
- client brain status / default brain pack helpers (where present)

## Code Evidence
### Migrations: `*ai_employee*.sql`

```sql
=== 20251223150000_ai_employee_v1_sprint1.sql ===
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

```

### Migrations: `*brain*.sql`

```sql
=== 20251224090000_brain_spine_v1.sql ===
-- Brain & Memory Spine v1 (additive)

alter table public.client_brains
  add column if not exists usable boolean not null default false;

create table if not exists public.ai_memory_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  type text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  endpoint text not null,
  model text,
  tokens_estimate integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_memory_items_agency_client on public.ai_memory_items(agency_id, client_id, created_at);
create index if not exists idx_ai_usage_logs_agency_client on public.ai_usage_logs(agency_id, client_id, created_at);

alter table public.ai_memory_items enable row level security;
alter table public.ai_usage_logs enable row level security;

create policy "ai_memory_items_select" on public.ai_memory_items
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_insert" on public.ai_memory_items
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_update" on public.ai_memory_items
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_memory_items_delete" on public.ai_memory_items
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_select" on public.ai_usage_logs
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_insert" on public.ai_usage_logs
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_update" on public.ai_usage_logs
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_usage_logs_delete" on public.ai_usage_logs
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where e.agency_id = p_agency_id
    and (p_client_id is null or e.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

=== 20251224121500_get_client_brain_status_rpc.sql ===
-- Tenant-safe client brain status surface

create or replace function public.get_client_brain_status(p_client_id uuid)
returns table (
  client_id uuid,
  usable boolean,
  missing_fields_count integer,
  missing_fields text[],
  status text,
  locked boolean,
  version integer,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  brain_row record;
  missing text[] := ARRAY[]::text[];
  banned_claims_len integer := 0;
  taboo_topics_len integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.clients c
    join public.agency_members am on am.agency_id = c.agency_id
    where c.id = p_client_id
      and am.user_id = auth.uid()
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select
    cb.client_id,
    cb.usable,
    cb.status,
    cb.locked,
    cb.version,
    cb.updated_at,
    cb.brain_json
  into brain_row
  from public.client_brains cb
  where cb.client_id = p_client_id
  order by cb.version desc
  limit 1;

  if brain_row.client_id is null then
    return;
  end if;

  if coalesce(nullif(btrim(brain_row.brain_json #>> '{brand_basics,name}'), ''), '') = '' then
    missing := array_append(missing, 'brand_basics.name');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json #> '{offer_details,products_services}') = 'array'
        then jsonb_array_length(brain_row.brain_json #> '{offer_details,products_services}')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'offer_details.products_services');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json #> '{audience,problems}') = 'array'
        then jsonb_array_length(brain_row.brain_json #> '{audience,problems}')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'audience.problems');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json -> 'pillars') = 'array'
        then jsonb_array_length(brain_row.brain_json -> 'pillars')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'pillars');
  end if;

  if (
    case
      when jsonb_typeof(brain_row.brain_json -> 'goals') = 'array'
        then jsonb_array_length(brain_row.brain_json -> 'goals')
      else 0
    end
  ) = 0 then
    missing := array_append(missing, 'goals');
  end if;

  banned_claims_len := case
    when jsonb_typeof(brain_row.brain_json #> '{constraints,banned_claims}') = 'array'
      then jsonb_array_length(brain_row.brain_json #> '{constraints,banned_claims}')
    else 0
  end;
  taboo_topics_len := case
    when jsonb_typeof(brain_row.brain_json #> '{constraints,taboo_topics}') = 'array'
      then jsonb_array_length(brain_row.brain_json #> '{constraints,taboo_topics}')
    else 0
  end;

  if banned_claims_len = 0 and taboo_topics_len = 0 then
    missing := array_append(missing, 'constraints.banned_claims_or_taboo_topics');
  end if;

  client_id := brain_row.client_id;
  usable := brain_row.usable;
  missing_fields := coalesce(missing, ARRAY[]::text[]);
  missing_fields_count := coalesce(array_length(missing, 1), 0);
  status := brain_row.status;
  locked := brain_row.locked;
  version := brain_row.version;
  updated_at := brain_row.updated_at;

  return next;
end;
$$;

alter function public.get_client_brain_status(uuid) owner to postgres;

revoke all on function public.get_client_brain_status(uuid) from public;
revoke execute on function public.get_client_brain_status(uuid) from anon;
grant execute on function public.get_client_brain_status(uuid) to authenticated;
grant execute on function public.get_client_brain_status(uuid) to service_role;

=== 20251228174120_brain_documents_and_calibration_state.sql ===
-- Migration: Brain Documents System + Calibration State
-- Purpose: Implement versioned brain documents for Agency Brain system
--          and add calibration_state for idempotent setup flow

-- ============================================================================
-- PHASE 1: Brain Documents Tables
-- ============================================================================

-- Brain document module types (matches BrainModule enum in TypeScript)
CREATE TYPE public.brain_module AS ENUM (
  'bootstrap',
  'rep_policy',
  'sop_strategy',
  'sop_scripting',
  'tone_voice',
  'faq_objections',
  'ai_permissions',
  'offer_stack',
  'quality_bar'
);

-- Brain document status types
CREATE TYPE public.brain_document_status AS ENUM (
  'draft',
  'pending_approval',
  'approved',
  'archived'
);

-- Brain document source types
CREATE TYPE public.brain_document_source AS ENUM (
  'onboarding',
  'chat',
  'manual',
  'ai_proposed'
);

-- brain_documents: individual brain artifacts with versioning
CREATE TABLE public.brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module public.brain_module NOT NULL,
  title TEXT NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  status public.brain_document_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  parent_version_id UUID REFERENCES public.brain_documents(id),
  source public.brain_document_source NOT NULL DEFAULT 'manual',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- brain_document_versions: immutable version history for audit trail
CREATE TABLE public.brain_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.brain_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content_json JSONB NOT NULL,
  diff_json JSONB,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for brain_documents
CREATE INDEX idx_brain_docs_agency_module ON public.brain_documents(agency_id, module);
CREATE INDEX idx_brain_docs_agency_status ON public.brain_documents(agency_id, status);
CREATE INDEX idx_brain_docs_updated_at ON public.brain_documents(updated_at DESC);

-- Unique constraint: only one approved document per module per agency
CREATE UNIQUE INDEX idx_brain_docs_unique_approved ON public.brain_documents(agency_id, module)
  WHERE status = 'approved';

-- Indexes for brain_document_versions
CREATE INDEX idx_brain_doc_versions_doc ON public.brain_document_versions(document_id, version);
CREATE INDEX idx_brain_doc_versions_created ON public.brain_document_versions(created_at DESC);

-- Trigger to update updated_at on brain_documents
CREATE OR REPLACE FUNCTION public.update_brain_document_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_brain_documents_updated_at
  BEFORE UPDATE ON public.brain_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_brain_document_updated_at();

-- ============================================================================
-- PHASE 1: RLS Policies for Brain Documents
-- ============================================================================

ALTER TABLE public.brain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_document_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read brain documents for agencies they are members of
CREATE POLICY brain_docs_select_policy ON public.brain_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

-- Policy: Users can insert brain documents for agencies they are admin/owner of
CREATE POLICY brain_docs_insert_policy ON public.brain_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can update brain documents for agencies they are admin/owner of
CREATE POLICY brain_docs_update_policy ON public.brain_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- Policy: Only owners can delete brain documents
CREATE POLICY brain_docs_delete_policy ON public.brain_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = brain_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role = 'owner'
    )
  );

-- Policy: Users can read version history for documents they can access
CREATE POLICY brain_doc_versions_select_policy ON public.brain_document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brain_documents bd
      JOIN public.agency_members am ON am.agency_id = bd.agency_id
      WHERE bd.id = brain_document_versions.document_id
        AND am.user_id = auth.uid()
    )
  );

-- Policy: Users can insert version history for documents they can edit
CREATE POLICY brain_doc_versions_insert_policy ON public.brain_document_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brain_documents bd
      JOIN public.agency_members am ON am.agency_id = bd.agency_id
      WHERE bd.id = brain_document_versions.document_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- PHASE 1: RPCs for Brain Documents
-- ============================================================================

-- Get all approved brain documents for an agency
CREATE OR REPLACE FUNCTION public.get_approved_brain_documents(p_agency_id UUID)
RETURNS SETOF public.brain_documents
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM public.brain_documents
  WHERE agency_id = p_agency_id
    AND status = 'approved'
  ORDER BY module;
$$;

-- Get brain document by agency and module (includes drafts)
CREATE OR REPLACE FUNCTION public.get_brain_document(
  p_agency_id UUID,
  p_module public.brain_module,
  p_status public.brain_document_status DEFAULT NULL
)
RETURNS SETOF public.brain_documents
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM public.brain_documents
  WHERE agency_id = p_agency_id
    AND module = p_module
    AND (p_status IS NULL OR status = p_status)
  ORDER BY
    CASE status
      WHEN 'approved' THEN 1
      WHEN 'pending_approval' THEN 2
      WHEN 'draft' THEN 3
      ELSE 4
    END,
    updated_at DESC
  LIMIT 1;
$$;

-- Create a new brain document draft
CREATE OR REPLACE FUNCTION public.create_brain_document_draft(
  p_agency_id UUID,
  p_module public.brain_module,
  p_title TEXT,
  p_content_json JSONB,
  p_source public.brain_document_source DEFAULT 'manual'
)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result public.brain_documents;
BEGIN
  v_user_id := auth.uid();

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = p_agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: user is not an admin of this agency';
  END IF;

  -- Insert new draft
  INSERT INTO public.brain_documents (
    agency_id, module, title, content_json, status, source, created_by
  ) VALUES (
    p_agency_id, p_module, p_title, p_content_json, 'draft', p_source, v_user_id
  )
  RETURNING * INTO v_result;

  -- Create initial version record
  INSERT INTO public.brain_document_versions (
    document_id, version, content_json, change_summary, created_by
  ) VALUES (
    v_result.id, 1, p_content_json, 'Initial draft created', v_user_id
  );

  RETURN v_result;
END;
$$;

-- Update a brain document (creates new version)
CREATE OR REPLACE FUNCTION public.update_brain_document(
  p_document_id UUID,
  p_content_json JSONB,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_doc public.brain_documents;
  v_new_version INTEGER;
  v_diff JSONB;
BEGIN
  v_user_id := auth.uid();

  -- Get current document
  SELECT * INTO v_current_doc
  FROM public.brain_documents
  WHERE id = p_document_id;

  IF v_current_doc IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = v_current_doc.agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Prevent editing approved documents directly
  IF v_current_doc.status = 'approved' THEN
    RAISE EXCEPTION 'Cannot edit approved document directly. Create a new draft instead.';
  END IF;

  -- Calculate new version
  v_new_version := v_current_doc.version + 1;

  -- Update document
  UPDATE public.brain_documents
  SET
    content_json = p_content_json,
    version = v_new_version,
    updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_current_doc;

  -- Create version record
  INSERT INTO public.brain_document_versions (
    document_id, version, content_json, change_summary, created_by
  ) VALUES (
    p_document_id, v_new_version, p_content_json,
    COALESCE(p_change_summary, 'Content updated'),
    v_user_id
  );

  RETURN v_current_doc;
END;
$$;

-- Approve a brain document
CREATE OR REPLACE FUNCTION public.approve_brain_document(p_document_id UUID)
RETURNS public.brain_documents
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_doc public.brain_documents;
BEGIN
  v_user_id := auth.uid();

  -- Get document
  SELECT * INTO v_doc
  FROM public.brain_documents
  WHERE id = p_document_id;

  IF v_doc IS NULL THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify user has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_members am
    WHERE am.agency_id = v_doc.agency_id
      AND am.user_id = v_user_id
      AND am.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Archive existing approved document for this module
  UPDATE public.brain_documents
  SET status = 'archived'
  WHERE agency_id = v_doc.agency_id
    AND module = v_doc.module
    AND status = 'approved'
    AND id != p_document_id;

  -- Approve the document
  UPDATE public.brain_documents
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = v_user_id,
    updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO v_doc;

  RETURN v_doc;
END;
$$;

-- Get version history for a document
CREATE OR REPLACE FUNCTION public.get_brain_document_history(p_document_id UUID)
RETURNS SETOF public.brain_document_versions
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT v.*
  FROM public.brain_document_versions v
  JOIN public.brain_documents d ON d.id = v.document_id
  JOIN public.agency_members am ON am.agency_id = d.agency_id
  WHERE v.document_id = p_document_id
    AND am.user_id = auth.uid()
  ORDER BY v.version DESC;
$$;

-- ============================================================================
-- PHASE 3: Calibration State Column
-- ============================================================================

-- Add calibration_state column to agency_brains for idempotent setup tracking
ALTER TABLE public.agency_brains
ADD COLUMN IF NOT EXISTS calibration_state JSONB DEFAULT '{}';

COMMENT ON COLUMN public.agency_brains.calibration_state IS
  'Server-side calibration tracking for idempotent setup flow. Schema: { session_id, current_step, answered_keys[], last_question_id, last_question_hash, completed_at }';

-- Create index for faster calibration state lookups
CREATE INDEX IF NOT EXISTS idx_agency_brains_calibration_state
  ON public.agency_brains USING gin (calibration_state);

-- ============================================================================
-- PHASE 4 (Preview): Task Module Requirements Table
-- ============================================================================

-- task_module_requirements: which brain modules each task type needs
CREATE TABLE public.task_module_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  module public.brain_module NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  field_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_type, module)
);

-- Seed data for task-to-module mapping
INSERT INTO public.task_module_requirements (task_type, module, required, field_paths) VALUES
  ('STRATEGY_PLAN', 'bootstrap', true, ARRAY['identity.offers', 'icp.industries']),
  ('STRATEGY_PLAN', 'tone_voice', true, ARRAY['adjectives', 'writing_rules']),
  ('STRATEGY_PLAN', 'sop_strategy', true, ARRAY['pillars']),
  ('CONTENT_IDEAS', 'bootstrap', true, ARRAY['identity.offers']),
  ('CONTENT_IDEAS', 'tone_voice', false, ARRAY[]::TEXT[]),
  ('SCRIPT_WRITING', 'sop_scripting', true, ARRAY['hooks', 'cta_templates']),
  ('SCRIPT_WRITING', 'tone_voice', true, ARRAY['adjectives', 'banned_words']),
  ('CLIENT_PORTAL_QA', 'faq_objections', true, ARRAY['faqs']),
  ('CLIENT_PORTAL_QA', 'rep_policy', true, ARRAY['boundaries']),
  ('AGENCY_ADMIN_GENERAL_CHAT', 'bootstrap', false, ARRAY[]::TEXT[]),
  ('AGENCY_ADMIN_GENERAL_CHAT', 'rep_policy', false, ARRAY[]::TEXT[])
ON CONFLICT (task_type, module) DO NOTHING;

-- RLS for task_module_requirements (read-only for all authenticated users)
ALTER TABLE public.task_module_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_module_requirements_select_policy ON public.task_module_requirements
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT USAGE ON TYPE public.brain_module TO authenticated;
GRANT USAGE ON TYPE public.brain_document_status TO authenticated;
GRANT USAGE ON TYPE public.brain_document_source TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_documents TO authenticated;
GRANT SELECT, INSERT ON public.brain_document_versions TO authenticated;
GRANT SELECT ON public.task_module_requirements TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_approved_brain_documents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brain_document(UUID, public.brain_module, public.brain_document_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_brain_document_draft(UUID, public.brain_module, TEXT, JSONB, public.brain_document_source) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_brain_document(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_brain_document(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brain_document_history(UUID) TO authenticated;

=== 20260108123000_brain_documents_rag.sql ===
-- Add brain_document doc type and enforce approved-only retrieval for brain docs

alter table public.ai_documents
  drop constraint if exists ai_documents_doc_type_check;

alter table public.ai_documents
  add constraint ai_documents_doc_type_check
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact',
    'strategy_draft',
    'brain_document'
  ));

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

=== 20260110120000_seed_default_brain_pack_v1_rpc.sql ===
begin;

-- Seed Default Brain Pack v1 (draft) for an agency, atomically and idempotently.
--
-- Idempotency rule: seed ONLY when the agency has 0 brain_documents total.
-- Atomicity: function runs in a single transaction, with an advisory lock per agency to prevent races.
create or replace function public.seed_default_brain_pack_v1(
  p_agency_id uuid,
  p_user_id uuid,
  p_docs jsonb
)
returns table (document_id uuid, module text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_agency_id is null then
    raise exception 'p_agency_id is required';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_docs is null or jsonb_typeof(p_docs) <> 'array' then
    raise exception 'p_docs must be a JSON array';
  end if;

  if jsonb_array_length(p_docs) <> 3 then
    raise exception 'p_docs must contain exactly 3 docs';
  end if;

  -- Prevent races on concurrent seed attempts per agency
  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text, 0));

  -- Resolve user identity: prefer auth.uid() when present, otherwise allow explicit p_user_id.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif v_user_id <> p_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  -- Permission check: only admin/owner can seed
  if not exists (
    select 1
    from public.agency_members am
    where am.agency_id = p_agency_id
      and am.user_id = v_user_id
      and am.role in ('owner', 'admin')
  ) then
    raise exception 'Permission denied: user is not an admin of this agency';
  end if;

  -- Idempotent no-op if any brain_documents exist for this agency
  if exists (
    select 1
    from public.brain_documents
    where agency_id = p_agency_id
    limit 1
  ) then
    return;
  end if;

  return query
  with input_docs as (
    select
      (doc->>'module')::public.brain_module as module,
      nullif(btrim(doc->>'title'), '') as title,
      coalesce(doc->'content_json', '{}'::jsonb) as content_json,
      coalesce(nullif(doc->>'source', ''), 'onboarding')::public.brain_document_source as source
    from jsonb_array_elements(p_docs) doc
  ),
  validated as (
    select
      module,
      coalesce(title, initcap(replace(module::text, '_', ' '))) as title,
      content_json,
      source
    from input_docs
  ),
  inserted as (
    insert into public.brain_documents (
      agency_id,
      module,
      title,
      content_json,
      status,
      version,
      source,
      created_by
    )
    select
      p_agency_id,
      v.module,
      v.title,
      v.content_json,
      'draft'::public.brain_document_status,
      1,
      v.source,
      v_user_id
    from validated v
    returning id, module, content_json
  ),
  versions as (
    insert into public.brain_document_versions (
      document_id,
      version,
      content_json,
      change_summary,
      created_by
    )
    select
      i.id,
      1,
      i.content_json,
      'Seeded Default Brain Pack v1',
      v_user_id
    from inserted i
    returning document_id
  )
  select i.id as document_id, i.module::text as module
  from inserted i
  order by i.module::text;
end;
$$;

revoke all on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) from public;
grant execute on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) to authenticated;

commit;


=== 20260111100000_list_agencies_with_zero_brain_documents.sql ===
create or replace function public.list_agencies_with_zero_brain_documents(
  p_limit int default 200,
  p_offset int default 0
)
returns table (agency_id uuid)
language sql
stable
as $$
  select a.id as agency_id
  from public.agencies a
  where not exists (
    select 1
    from public.brain_documents d
    where d.agency_id = a.id
  )
  order by a.created_at asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;


=== 20260111140000_seed_default_brain_pack_v1_grant_service_role.sql ===
begin;
-- Allow Edge Functions using the service role key to invoke the seed RPC.
grant execute on function public.seed_default_brain_pack_v1(uuid, uuid, jsonb) to service_role;
commit;

=== 20260116210000_repair_default_brain_pack_v1_rpc.sql ===
begin;

-- Repair Default Brain Pack v1 for an agency (seed missing defaults only), atomically and idempotently.
--
-- Modules: bootstrap, rep_policy, quality_bar
-- Atomicity: function runs in a single transaction, with an advisory lock per agency to prevent races.
-- Idempotency rule: insert ONLY modules that do not already exist (status <> 'archived') for this agency.
create or replace function public.repair_default_brain_pack_v1(
  p_agency_id uuid,
  p_user_id uuid,
  p_docs jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing_modules text[];
  v_missing_modules text[];
  v_inserted_ids uuid[];
begin
  if p_agency_id is null then
    raise exception 'p_agency_id is required';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_docs is null or jsonb_typeof(p_docs) <> 'array' then
    raise exception 'p_docs must be a JSON array';
  end if;

  if jsonb_array_length(p_docs) <> 3 then
    raise exception 'p_docs must contain exactly 3 docs';
  end if;

  -- Prevent races on concurrent repair attempts per agency
  perform pg_advisory_xact_lock(hashtextextended(p_agency_id::text, 0));

  -- Resolve user identity: prefer auth.uid() when present, otherwise allow explicit p_user_id.
  v_user_id := auth.uid();
  if v_user_id is null then
    v_user_id := p_user_id;
  elsif v_user_id <> p_user_id then
    raise exception 'p_user_id must match auth.uid()';
  end if;

  -- Permission check: only admin/owner can repair
  if not exists (
    select 1
    from public.agency_members am
    where am.agency_id = p_agency_id
      and am.user_id = v_user_id
      and am.role in ('owner', 'admin')
  ) then
    raise exception 'Permission denied: user is not an admin of this agency';
  end if;

  select coalesce(array_agg(distinct bd.module::text), '{}'::text[])
    into v_existing_modules
  from public.brain_documents bd
  where bd.agency_id = p_agency_id
    and bd.status <> 'archived'
    and bd.module in ('bootstrap'::public.brain_module, 'rep_policy'::public.brain_module, 'quality_bar'::public.brain_module);

  select array_agg(m.module)
    into v_missing_modules
  from (
    select unnest(array['bootstrap','rep_policy','quality_bar']::text[]) as module
    except
    select unnest(v_existing_modules)
  ) m;

  if v_missing_modules is null or array_length(v_missing_modules, 1) is null then
    return jsonb_build_object(
      'inserted_count', 0,
      'inserted_document_ids', '[]'::jsonb,
      'skipped_existing_modules', coalesce(to_jsonb(v_existing_modules), '[]'::jsonb)
    );
  end if;

  with input_docs as (
    select
      (doc->>'module')::public.brain_module as module,
      nullif(btrim(doc->>'title'), '') as title,
      coalesce(doc->'content_json', '{}'::jsonb) as content_json,
      coalesce(nullif(doc->>'source', ''), 'onboarding')::public.brain_document_source as source
    from jsonb_array_elements(p_docs) doc
  ),
  filtered as (
    select
      d.module,
      coalesce(d.title, initcap(replace(d.module::text, '_', ' '))) as title,
      d.content_json,
      d.source
    from input_docs d
    where d.module::text = any(v_missing_modules)
  ),
  inserted as (
    insert into public.brain_documents (
      agency_id,
      module,
      title,
      content_json,
      status,
      version,
      source,
      created_by
    )
    select
      p_agency_id,
      f.module,
      f.title,
      f.content_json,
      'draft'::public.brain_document_status,
      1,
      f.source,
      v_user_id
    from filtered f
    returning id, content_json
  ),
  versions as (
    insert into public.brain_document_versions (
      document_id,
      version,
      content_json,
      change_summary,
      created_by
    )
    select
      i.id,
      1,
      i.content_json,
      'Repaired Default Brain Pack v1 (seed missing modules)',
      v_user_id
    from inserted i
    returning document_id
  )
  select coalesce(array_agg(i.id), '{}'::uuid[])
    into v_inserted_ids
  from inserted i;

  return jsonb_build_object(
    'inserted_count', coalesce(array_length(v_inserted_ids, 1), 0),
    'inserted_document_ids', coalesce(to_jsonb(v_inserted_ids), '[]'::jsonb),
    'skipped_existing_modules', coalesce(to_jsonb(v_existing_modules), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) from public;
grant execute on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) to authenticated;
grant execute on function public.repair_default_brain_pack_v1(uuid, uuid, jsonb) to service_role;

commit;


=== 20260117160000_brain_documents_storage_bucket.sql ===
begin;

-- Storage bucket for Agency AI Setup document uploads (used by ai-brain-analyze).
insert into storage.buckets (id, name, public)
values ('brain-documents', 'brain-documents', false)
on conflict (id) do update set name = excluded.name;

-- RLS policies for storage.objects (brain-documents)
drop policy if exists "Brain documents can read" on storage.objects;
drop policy if exists "Brain documents can insert" on storage.objects;
drop policy if exists "Brain documents can update" on storage.objects;
drop policy if exists "Brain documents can delete" on storage.objects;

create policy "Brain documents can read"
  on storage.objects
  for select
  using (
    bucket_id = 'brain-documents'
    and (
      exists (
        select 1
        from public.agency_members m
        where m.user_id = auth.uid()
          and m.agency_id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
      or exists (
        select 1
        from public.agencies a
        where a.user_id = auth.uid()
          and a.id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
    )
  );

create policy "Brain documents can insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
    and (
      exists (
        select 1
        from public.agency_members m
        where m.user_id = auth.uid()
          and m.role in ('owner', 'admin', 'manager')
          and m.agency_id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
      or exists (
        select 1
        from public.agencies a
        where a.user_id = auth.uid()
          and a.id = (
            case
              when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(name, '/', 1)::uuid
              else null
            end
          )
      )
    )
  );

create policy "Brain documents can update"
  on storage.objects
  for update
  using (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
  );

create policy "Brain documents can delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'brain-documents'
    and auth.role() = 'authenticated'
  );

commit;


```

### Migrations: `*strategy*.sql`

```sql
=== 20251224103000_strategy_docs_and_embeddings.sql ===
-- Strategy draft doc type + embeddings RPC update + tighter brain/embedding RLS

alter table public.ai_documents
  drop constraint if exists ai_documents_doc_type_check;

alter table public.ai_documents
  add constraint ai_documents_doc_type_check
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact',
    'strategy_draft'
  ));

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

drop policy if exists "agency_brains_select" on public.agency_brains;
create policy "agency_brains_select_service" on public.agency_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "client_brains_select" on public.client_brains;
create policy "client_brains_select_service" on public.client_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "ai_embeddings_select" on public.ai_embeddings;
create policy "ai_embeddings_select_service" on public.ai_embeddings
  for select to authenticated
  using (auth.role() = 'service_role');

=== 20251229100000_strategy_os.sql ===
-- Strategy OS Migration
-- Creates tables for the Strategy OS feature: strategy_modules, strategy_history, strategy_tasks

-- Strategy module types (6 modules only)
DO $$ BEGIN
  CREATE TYPE public.strategy_module AS ENUM (
    'positioning',
    'pillars',
    'campaign_plan',
    'weekly_plan',
    'channel_adaptations',
    'rules_constraints'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Strategy status
DO $$ BEGIN
  CREATE TYPE public.strategy_status AS ENUM (
    'empty',
    'ai_draft',
    'draft',
    'review',
    'approved',
    'locked'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main strategy modules table
CREATE TABLE IF NOT EXISTS public.strategy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  module public.strategy_module NOT NULL,
  content_json JSONB NOT NULL DEFAULT '{}',
  status public.strategy_status NOT NULL DEFAULT 'empty',
  completion_percent INTEGER DEFAULT 0,
  blocker_count INTEGER DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  ai_generated BOOLEAN DEFAULT false,
  ai_confidence INTEGER,
  owner_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, module)
);

-- History events for audit trail
CREATE TABLE IF NOT EXISTS public.strategy_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.strategy_modules(id) ON DELETE SET NULL,
  module public.strategy_module,
  event_type TEXT NOT NULL, -- 'created', 'updated', 'locked', 'unlocked', 'seeded', 'approved'
  event_data JSONB DEFAULT '{}',
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strategy tasks per module
CREATE TABLE IF NOT EXISTS public.strategy_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.strategy_modules(id) ON DELETE SET NULL,
  module public.strategy_module,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'pushed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  pipeline_task_id UUID, -- linked pipeline task after push
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategy_modules_client ON public.strategy_modules(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_modules_agency ON public.strategy_modules(agency_id);
CREATE INDEX IF NOT EXISTS idx_strategy_modules_status ON public.strategy_modules(status);
CREATE INDEX IF NOT EXISTS idx_strategy_history_client ON public.strategy_history(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_history_module ON public.strategy_history(module_id);
CREATE INDEX IF NOT EXISTS idx_strategy_history_created ON public.strategy_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_client ON public.strategy_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_module ON public.strategy_tasks(module_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_status ON public.strategy_tasks(status);

-- Enable RLS
ALTER TABLE public.strategy_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for strategy_modules
CREATE POLICY strategy_modules_select ON public.strategy_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_insert ON public.strategy_modules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_update ON public.strategy_modules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_modules_delete ON public.strategy_modules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_modules.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for strategy_history
CREATE POLICY strategy_history_select ON public.strategy_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_history.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_history_insert ON public.strategy_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_history.client_id
        AND am.user_id = auth.uid()
    )
  );

-- RLS Policies for strategy_tasks
CREATE POLICY strategy_tasks_select ON public.strategy_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_insert ON public.strategy_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_update ON public.strategy_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_tasks_delete ON public.strategy_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_tasks.client_id
        AND am.user_id = auth.uid()
    )
  );

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_strategy_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS strategy_modules_updated_at ON public.strategy_modules;
CREATE TRIGGER strategy_modules_updated_at
  BEFORE UPDATE ON public.strategy_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_modules_updated_at();

DROP TRIGGER IF EXISTS strategy_tasks_updated_at ON public.strategy_tasks;
CREATE TRIGGER strategy_tasks_updated_at
  BEFORE UPDATE ON public.strategy_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_modules_updated_at();

-- Helper function to get strategy modules for a client
CREATE OR REPLACE FUNCTION public.get_strategy_modules(p_client_id UUID)
RETURNS SETOF public.strategy_modules
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.strategy_modules
  WHERE client_id = p_client_id
  ORDER BY
    CASE module
      WHEN 'positioning' THEN 1
      WHEN 'pillars' THEN 2
      WHEN 'campaign_plan' THEN 3
      WHEN 'weekly_plan' THEN 4
      WHEN 'channel_adaptations' THEN 5
      WHEN 'rules_constraints' THEN 6
    END;
$$;

-- Helper function to upsert a strategy module
CREATE OR REPLACE FUNCTION public.upsert_strategy_module(
  p_client_id UUID,
  p_agency_id UUID,
  p_module public.strategy_module,
  p_content_json JSONB,
  p_status public.strategy_status DEFAULT 'draft',
  p_ai_generated BOOLEAN DEFAULT false,
  p_ai_confidence INTEGER DEFAULT NULL
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_modules (
    client_id, agency_id, module, content_json, status,
    ai_generated, ai_confidence, created_by
  )
  VALUES (
    p_client_id, p_agency_id, p_module, p_content_json, p_status,
    p_ai_generated, p_ai_confidence, v_user_id
  )
  ON CONFLICT (client_id, module) DO UPDATE SET
    content_json = EXCLUDED.content_json,
    status = EXCLUDED.status,
    ai_generated = EXCLUDED.ai_generated,
    ai_confidence = EXCLUDED.ai_confidence,
    version = strategy_modules.version + 1,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Helper function to lock/unlock a strategy module
CREATE OR REPLACE FUNCTION public.toggle_strategy_module_lock(
  p_module_id UUID,
  p_lock BOOLEAN
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.strategy_modules
  SET
    locked = p_lock,
    locked_at = CASE WHEN p_lock THEN now() ELSE NULL END,
    locked_by = CASE WHEN p_lock THEN v_user_id ELSE NULL END,
    status = CASE WHEN p_lock THEN 'locked'::public.strategy_status ELSE 'approved'::public.strategy_status END
  WHERE id = p_module_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Helper function to add history event
CREATE OR REPLACE FUNCTION public.add_strategy_history(
  p_client_id UUID,
  p_module_id UUID,
  p_module public.strategy_module,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS public.strategy_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_history;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_history (
    client_id, module_id, module, event_type, event_data, actor_id
  )
  VALUES (
    p_client_id, p_module_id, p_module, p_event_type, p_event_data, v_user_id
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

=== 20251229120000_strategy_os_grants.sql ===
-- Strategy OS - Grant permissions to authenticated users
-- The original migration created tables and RLS policies but forgot GRANT statements

-- Grant permissions on strategy_modules
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_modules TO authenticated;
GRANT ALL ON public.strategy_modules TO service_role;

-- Grant permissions on strategy_history
GRANT SELECT, INSERT ON public.strategy_history TO authenticated;
GRANT ALL ON public.strategy_history TO service_role;

-- Grant permissions on strategy_tasks
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_tasks TO authenticated;
GRANT ALL ON public.strategy_tasks TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_strategy_module_lock(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, public.strategy_module, TEXT, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.toggle_strategy_module_lock(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, public.strategy_module, TEXT, JSONB) TO service_role;

-- Grant usage on sequences if any exist (auto-generated)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

=== 20251230090000_strategy_os_ops.sql ===
-- Strategy OS versioning, decisions, and integration extensions

-- 1) Strategies table
CREATE TABLE IF NOT EXISTS public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  version_int INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, version_int)
);

CREATE INDEX IF NOT EXISTS idx_strategies_client ON public.strategies(client_id);
CREATE INDEX IF NOT EXISTS idx_strategies_agency ON public.strategies(agency_id);

-- 2) Strategy decisions table
CREATE TABLE IF NOT EXISTS public.strategy_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module public.strategy_module NOT NULL,
  decision_key TEXT NOT NULL,
  value JSONB DEFAULT NULL,
  locked BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, module, decision_key)
);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_strategy ON public.strategy_decisions(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_decisions_client ON public.strategy_decisions(client_id);

-- 3) Extend strategy_modules with strategy_id, blockers, and review tracking
ALTER TABLE public.strategy_modules
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS blockers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_strategy_modules_strategy ON public.strategy_modules(strategy_id);

-- Drop unique constraint on (client_id, module) if present
ALTER TABLE public.strategy_modules
  DROP CONSTRAINT IF EXISTS strategy_modules_client_id_module_key;

ALTER TABLE public.strategy_modules
  ADD CONSTRAINT strategy_modules_strategy_id_module_key UNIQUE (strategy_id, module);

-- 4) Extend strategy_history with strategy_id
ALTER TABLE public.strategy_history
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_strategy_history_strategy ON public.strategy_history(strategy_id);

-- 5) Extend strategy_tasks for tasks + pipeline links
ALTER TABLE public.strategy_tasks
  ADD COLUMN IF NOT EXISTS strategy_id UUID REFERENCES public.strategies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period_key TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Update task status default/check to align with tasks table
ALTER TABLE public.strategy_tasks
  ALTER COLUMN status SET DEFAULT 'todo';

ALTER TABLE public.strategy_tasks
  DROP CONSTRAINT IF EXISTS strategy_tasks_status_check;

-- Backfill status values to new enum set
UPDATE public.strategy_tasks
SET status = CASE
  WHEN status IN ('todo', 'in_progress', 'completed', 'pushed') THEN status
  WHEN status = 'pending' THEN 'todo'
  ELSE 'todo'
END;

ALTER TABLE public.strategy_tasks
  ADD CONSTRAINT strategy_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'completed', 'pushed'));

CREATE INDEX IF NOT EXISTS idx_strategy_tasks_strategy ON public.strategy_tasks(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_task ON public.strategy_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_strategy_tasks_project ON public.strategy_tasks(project_id);

ALTER TABLE public.strategy_tasks
  DROP CONSTRAINT IF EXISTS strategy_tasks_strategy_module_period_slug_key;

ALTER TABLE public.strategy_tasks
  ADD CONSTRAINT strategy_tasks_strategy_module_period_slug_key UNIQUE (strategy_id, module, period_key, slug);

-- 6) Backfill strategies for existing clients
INSERT INTO public.strategies (client_id, agency_id, version_int, status, created_at, updated_at)
SELECT DISTINCT sm.client_id, sm.agency_id, 1, 'active', now(), now()
FROM public.strategy_modules sm
ON CONFLICT (client_id, version_int) DO NOTHING;

-- 7) Backfill strategy_id on existing modules
UPDATE public.strategy_modules sm
SET strategy_id = s.id
FROM public.strategies s
WHERE sm.client_id = s.client_id
  AND s.version_int = 1
  AND sm.strategy_id IS NULL;

ALTER TABLE public.strategy_modules
  ALTER COLUMN strategy_id SET NOT NULL;

-- Normalize legacy status values
UPDATE public.strategy_modules
SET status = 'draft'
WHERE status = 'ai_draft';

-- 8) Backfill strategy_id on existing history rows
UPDATE public.strategy_history sh
SET strategy_id = sm.strategy_id
FROM public.strategy_modules sm
WHERE sh.module_id = sm.id
  AND sh.strategy_id IS NULL;

UPDATE public.strategy_history sh
SET strategy_id = s.id
FROM public.strategies s
WHERE sh.strategy_id IS NULL
  AND sh.client_id = s.client_id
  AND s.version_int = 1;

-- 9) Backfill strategy_id on existing tasks
UPDATE public.strategy_tasks st
SET strategy_id = sm.strategy_id
FROM public.strategy_modules sm
WHERE st.module_id = sm.id
  AND st.strategy_id IS NULL;

UPDATE public.strategy_tasks st
SET strategy_id = s.id
FROM public.strategies s
WHERE st.strategy_id IS NULL
  AND st.client_id = s.client_id
  AND s.version_int = 1;

-- 10) Update updated_at trigger function to track last_updated_at
CREATE OR REPLACE FUNCTION public.update_strategy_modules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_TABLE_NAME = 'strategy_modules' THEN
    NEW.last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11) Strategy table updated_at trigger
CREATE OR REPLACE FUNCTION public.update_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS strategies_updated_at ON public.strategies;
CREATE TRIGGER strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategies_updated_at();

DROP TRIGGER IF EXISTS strategy_decisions_updated_at ON public.strategy_decisions;
CREATE TRIGGER strategy_decisions_updated_at
  BEFORE UPDATE ON public.strategy_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategies_updated_at();

-- 12) Update RPC functions to include strategy_id
DROP FUNCTION IF EXISTS public.get_strategy_modules(UUID);
CREATE OR REPLACE FUNCTION public.get_strategy_modules(p_strategy_id UUID)
RETURNS SETOF public.strategy_modules
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.strategy_modules
  WHERE strategy_id = p_strategy_id
  ORDER BY
    CASE module
      WHEN 'positioning' THEN 1
      WHEN 'pillars' THEN 2
      WHEN 'campaign_plan' THEN 3
      WHEN 'weekly_plan' THEN 4
      WHEN 'channel_adaptations' THEN 5
      WHEN 'rules_constraints' THEN 6
    END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_strategy_module(
  p_client_id UUID,
  p_agency_id UUID,
  p_strategy_id UUID,
  p_module public.strategy_module,
  p_content_json JSONB,
  p_status public.strategy_status DEFAULT 'draft',
  p_ai_generated BOOLEAN DEFAULT false,
  p_ai_confidence INTEGER DEFAULT NULL
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_modules (
    client_id, agency_id, strategy_id, module, content_json, status,
    ai_generated, ai_confidence, created_by
  )
  VALUES (
    p_client_id, p_agency_id, p_strategy_id, p_module, p_content_json, p_status,
    p_ai_generated, p_ai_confidence, v_user_id
  )
  ON CONFLICT (strategy_id, module) DO UPDATE SET
    content_json = EXCLUDED.content_json,
    status = EXCLUDED.status,
    ai_generated = EXCLUDED.ai_generated,
    ai_confidence = EXCLUDED.ai_confidence,
    version = strategy_modules.version + 1,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_strategy_module_lock(
  p_module_id UUID,
  p_lock BOOLEAN
)
RETURNS public.strategy_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_modules;
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.strategy_modules
  SET
    locked = p_lock,
    locked_at = CASE WHEN p_lock THEN now() ELSE NULL END,
    locked_by = CASE WHEN p_lock THEN v_user_id ELSE NULL END,
    status = CASE WHEN p_lock THEN 'locked'::public.strategy_status ELSE status END
  WHERE id = p_module_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_strategy_history(
  p_client_id UUID,
  p_strategy_id UUID,
  p_module_id UUID,
  p_module public.strategy_module,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'
)
RETURNS public.strategy_history
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.strategy_history;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.strategy_history (
    client_id, strategy_id, module_id, module, event_type, event_data, actor_id
  )
  VALUES (
    p_client_id, p_strategy_id, p_module_id, p_module, p_event_type, p_event_data, v_user_id
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 13) RLS policies for strategies and decisions
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategy_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategies_select ON public.strategies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategies_insert ON public.strategies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategies_update ON public.strategies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategies.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_select ON public.strategy_decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_insert ON public.strategy_decisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_update ON public.strategy_decisions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_decisions_delete ON public.strategy_decisions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      JOIN public.clients c ON c.agency_id = am.agency_id
      WHERE c.id = strategy_decisions.client_id
        AND am.user_id = auth.uid()
    )
  );

=== 20251230100000_strategy_os_ops_grants.sql ===
-- Strategy OS Ops - Grant permissions for strategies and strategy_decisions tables
-- The 20251230090000_strategy_os_ops.sql migration created these tables but forgot GRANT statements

-- Grant permissions on strategies table
GRANT SELECT, INSERT, UPDATE ON public.strategies TO authenticated;
GRANT ALL ON public.strategies TO service_role;

-- Grant permissions on strategy_decisions table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_decisions TO authenticated;
GRANT ALL ON public.strategy_decisions TO service_role;

-- Grant execute on updated functions (with new signatures)
GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, UUID, public.strategy_module, TEXT, JSONB) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_strategy_modules(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_strategy_module(UUID, UUID, UUID, public.strategy_module, JSONB, public.strategy_status, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_strategy_history(UUID, UUID, UUID, public.strategy_module, TEXT, JSONB) TO service_role;

=== 20260106120000_strategy_documents.sql ===
-- Strategy documents table + storage bucket

CREATE TABLE IF NOT EXISTS public.strategy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  content_markdown TEXT,
  content_html TEXT,
  source TEXT NOT NULL CHECK (source IN ('ai', 'upload', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  generated_by_user_id UUID REFERENCES auth.users(id),
  model TEXT,
  generation_instruction TEXT,
  derived_from_hash TEXT,
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_documents_client_active
  ON public.strategy_documents(client_id, is_active, updated_at DESC);

ALTER TABLE public.strategy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategy_documents_select ON public.strategy_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_insert ON public.strategy_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_update ON public.strategy_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
    )
  );

CREATE POLICY strategy_documents_delete ON public.strategy_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.agency_members am
      WHERE am.agency_id = strategy_documents.agency_id
        AND am.user_id = auth.uid()
        AND am.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION public.update_strategy_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS strategy_documents_updated_at ON public.strategy_documents;
CREATE TRIGGER strategy_documents_updated_at
  BEFORE UPDATE ON public.strategy_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_strategy_documents_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'strategy-documents',
  'strategy-documents',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'text/markdown',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agency members can upload strategy documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'strategy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete strategy documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'strategy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT am.agency_id::text
    FROM agency_members am
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view strategy documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'strategy-documents');

=== 20260108143000_strategy_snapshot_rpc.sql ===
-- Atomic strategy snapshot write: modules + document + optional decisions/tasks

create or replace function public.create_strategy_snapshot(
  p_client_id uuid,
  p_agency_id uuid,
  p_strategy_id uuid,
  p_user_id uuid,
  p_modules jsonb,
  p_document_markdown text,
  p_document_html text,
  p_model text,
  p_instruction text,
  p_derived_hash text,
  p_decisions jsonb default null,
  p_tasks jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strategy_id uuid := p_strategy_id;
  v_document_id uuid;
  v_version int;
  v_module jsonb;
  v_decision jsonb;
  v_task jsonb;
  v_module_id uuid;
begin
  if v_strategy_id is null then
    select coalesce(max(version_int), 0) + 1 into v_version
    from public.strategies
    where client_id = p_client_id;

    insert into public.strategies (client_id, agency_id, version_int, status, created_by)
    values (p_client_id, p_agency_id, v_version, 'active', p_user_id)
    returning id into v_strategy_id;
  end if;

  update public.strategy_documents
  set is_active = false
  where client_id = p_client_id;

  insert into public.strategy_documents (
    agency_id,
    client_id,
    content_markdown,
    content_html,
    source,
    is_active,
    generated_by_user_id,
    model,
    generation_instruction,
    derived_from_hash
  )
  values (
    p_agency_id,
    p_client_id,
    p_document_markdown,
    p_document_html,
    'ai',
    true,
    p_user_id,
    p_model,
    p_instruction,
    p_derived_hash
  )
  returning id into v_document_id;

  for v_module in select * from jsonb_array_elements(p_modules) loop
    insert into public.strategy_modules (
      client_id,
      agency_id,
      strategy_id,
      module,
      content_json,
      status,
      ai_generated,
      ai_confidence,
      created_by
    )
    values (
      p_client_id,
      p_agency_id,
      v_strategy_id,
      (v_module->>'module')::public.strategy_module,
      v_module->'content_json',
      'draft',
      true,
      case when v_module ? 'ai_confidence' then (v_module->>'ai_confidence')::int else null end,
      p_user_id
    )
    on conflict (strategy_id, module) do update set
      content_json = excluded.content_json,
      status = excluded.status,
      ai_generated = excluded.ai_generated,
      ai_confidence = excluded.ai_confidence,
      version = public.strategy_modules.version + 1,
      updated_at = now()
    returning id into v_module_id;
  end loop;

  if p_decisions is not null then
    for v_decision in select * from jsonb_array_elements(p_decisions) loop
      insert into public.strategy_decisions (
        strategy_id,
        client_id,
        module,
        decision_key,
        value,
        locked
      )
      values (
        v_strategy_id,
        p_client_id,
        (v_decision->>'module')::public.strategy_module,
        v_decision->>'decision_key',
        v_decision->'value',
        coalesce((v_decision->>'locked')::boolean, false)
      )
      on conflict (strategy_id, module, decision_key) do update set
        value = excluded.value,
        locked = excluded.locked,
        updated_at = now();
    end loop;
  end if;

  if p_tasks is not null then
    for v_task in select * from jsonb_array_elements(p_tasks) loop
      if v_task->>'module' is not null then
        select id into v_module_id
        from public.strategy_modules
        where strategy_id = v_strategy_id
          and module = (v_task->>'module')::public.strategy_module;
      else
        v_module_id := null;
      end if;

      insert into public.strategy_tasks (
        strategy_id,
        client_id,
        module_id,
        module,
        title,
        description,
        priority,
        status,
        period_key,
        slug,
        dedupe_key,
        created_by
      )
      values (
        v_strategy_id,
        p_client_id,
        v_module_id,
        case when v_task->>'module' is null then null else (v_task->>'module')::public.strategy_module end,
        v_task->>'title',
        v_task->>'description',
        coalesce(v_task->>'priority', 'medium'),
        'todo',
        v_task->>'period_key',
        v_task->>'slug',
        v_task->>'dedupe_key',
        p_user_id
      );
    end loop;
  end if;

  return jsonb_build_object(
    'strategy_id', v_strategy_id,
    'document_id', v_document_id
  );
end;
$$;

revoke all on function public.create_strategy_snapshot(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.create_strategy_snapshot(
  uuid, uuid, uuid, uuid, jsonb, text, text, text, text, text, jsonb, jsonb
) to service_role;

=== 20260109133000_strategy_documents_grants_and_consistency.sql ===
begin;

-- Fix 403 "permission denied" from PostgREST by granting table privileges.
-- RLS still applies via policies on the table.
grant select, insert, update, delete on table public.strategy_documents to authenticated;

-- Ensure data consistency: strategy_documents.agency_id must always match clients.agency_id.
create or replace function public.set_strategy_documents_agency_id_from_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency_id uuid;
begin
  select c.agency_id into v_agency_id
  from public.clients c
  where c.id = new.client_id;

  if v_agency_id is null then
    raise exception 'client_not_found';
  end if;

  new.agency_id := v_agency_id;
  return new;
end;
$$;

drop trigger if exists strategy_documents_set_agency_id on public.strategy_documents;
create trigger strategy_documents_set_agency_id
before insert or update of client_id on public.strategy_documents
for each row
execute function public.set_strategy_documents_agency_id_from_client();

commit;


```

### Migrations: `*embedding*.sql`

```sql
=== 20251224103000_strategy_docs_and_embeddings.sql ===
-- Strategy draft doc type + embeddings RPC update + tighter brain/embedding RLS

alter table public.ai_documents
  drop constraint if exists ai_documents_doc_type_check;

alter table public.ai_documents
  add constraint ai_documents_doc_type_check
  check (doc_type in (
    'agency_exemplar_strategy',
    'agency_sop',
    'client_guidelines',
    'client_notes',
    'approved_posts',
    'ai_artifact',
    'strategy_draft'
  ));

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

drop policy if exists "agency_brains_select" on public.agency_brains;
create policy "agency_brains_select_service" on public.agency_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "client_brains_select" on public.client_brains;
create policy "client_brains_select_service" on public.client_brains
  for select to authenticated
  using (auth.role() = 'service_role');

drop policy if exists "ai_embeddings_select" on public.ai_embeddings;
create policy "ai_embeddings_select_service" on public.ai_embeddings
  for select to authenticated
  using (auth.role() = 'service_role');

=== 20251224133000_harden_match_ai_embeddings_exec.sql ===
-- Harden match_ai_embeddings execution to service role only

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from public;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from anon;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from authenticated;

grant execute on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) to service_role;

=== 20260105140000_embedding_chunk_status.sql ===
-- Add embedding status to chunks and ignore failed chunks in retrieval

alter table public.ai_document_chunks
  add column if not exists embedding_status text not null default 'ok'
  check (embedding_status in ('ok', 'failed'));

update public.ai_document_chunks
  set embedding_status = 'ok'
  where embedding_status is null;

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
$$;

=== 20260108134500_match_ai_embeddings_filters.sql ===
-- Add filters and thresholds to match_ai_embeddings

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null,
  p_modules text[] default null,
  p_min_similarity float8 default 0.2
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (p_modules is null or (d.metadata->>'module') = any(p_modules))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
    and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit least(p_match_count, 12);
$$;

=== 20260118000001_harden_match_ai_embeddings_final.sql ===
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


```

### Migrations: `*match_ai*.sql`

```sql
=== 20251224133000_harden_match_ai_embeddings_exec.sql ===
-- Harden match_ai_embeddings execution to service role only

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from public;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from anon;

revoke all on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) from authenticated;

grant execute on function public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
) to service_role;

=== 20260108134500_match_ai_embeddings_filters.sql ===
-- Add filters and thresholds to match_ai_embeddings

drop function if exists public.match_ai_embeddings(
  uuid,
  vector(1536),
  uuid,
  int,
  text[]
);

create or replace function public.match_ai_embeddings(
  p_agency_id uuid,
  p_query_embedding vector(1536),
  p_client_id uuid default null,
  p_match_count int default 8,
  p_doc_types text[] default null,
  p_modules text[] default null,
  p_min_similarity float8 default 0.2
)
returns table (
  document_id uuid,
  chunk_id uuid,
  doc_type text,
  chunk_text text,
  score float8,
  title text,
  source jsonb,
  source_url text
)
language sql
stable
as $$
  select
    e.document_id,
    e.chunk_id,
    e.doc_type,
    c.chunk_text,
    1 - (e.embedding <=> p_query_embedding) as score,
    d.title,
    d.source,
    d.source_url
  from public.ai_embeddings e
  join public.ai_document_chunks c on c.id = e.chunk_id
  join public.ai_documents d on d.id = e.document_id
  where d.agency_id = p_agency_id
    and c.embedding_status = 'ok'
    and (p_client_id is null or d.client_id = p_client_id)
    and (p_doc_types is null or e.doc_type = any(p_doc_types))
    and (p_modules is null or (d.metadata->>'module') = any(p_modules))
    and (e.doc_type <> 'brain_document' or (d.metadata->>'status') = 'approved')
    and (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  order by e.embedding <=> p_query_embedding
  limit least(p_match_count, 12);
$$;

=== 20260118000001_harden_match_ai_embeddings_final.sql ===
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


```

### Index/policy/table creation lines filtered (`rg CREATE TABLE|INDEX|POLICY ... | grep ai_/brain/strateg/embed`)

```text

supabase/migrations\20251124133649_334878d3-6f11-41c7-ac57-53e7e85a4c1b.sql:6:CREATE TABLE IF NOT EXISTS 
public.ai_generation_usage (
supabase/migrations\20251124133649_334878d3-6f11-41c7-ac57-53e7e85a4c1b.sql:44:CREATE INDEX idx_ai_usage_month_agency 
ON public.ai_generation_usage(month_year, agency_id);
supabase/migrations\20260106120000_strategy_documents.sql:3:CREATE TABLE IF NOT EXISTS public.strategy_documents (
supabase/migrations\20260106120000_strategy_documents.sql:21:CREATE INDEX IF NOT EXISTS 
idx_strategy_documents_client_active
supabase/migrations\20260106120000_strategy_documents.sql:26:CREATE POLICY strategy_documents_select ON 
public.strategy_documents
supabase/migrations\20260106120000_strategy_documents.sql:35:CREATE POLICY strategy_documents_insert ON 
public.strategy_documents
supabase/migrations\20260106120000_strategy_documents.sql:44:CREATE POLICY strategy_documents_update ON 
public.strategy_documents
supabase/migrations\20260106120000_strategy_documents.sql:53:CREATE POLICY strategy_documents_delete ON 
public.strategy_documents
supabase/migrations\20260106120000_strategy_documents.sql:93:CREATE POLICY "Agency members can upload strategy 
documents"
supabase/migrations\20260106120000_strategy_documents.sql:106:CREATE POLICY "Agency members can delete strategy 
documents"
supabase/migrations\20260106120000_strategy_documents.sql:119:CREATE POLICY "Public can view strategy documents"
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:39:CREATE TABLE public.brain_documents (
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:57:CREATE TABLE 
public.brain_document_versions (
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:69:CREATE INDEX 
idx_brain_docs_agency_module ON public.brain_documents(agency_id, module);
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:70:CREATE INDEX 
idx_brain_docs_agency_status ON public.brain_documents(agency_id, status);
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:71:CREATE INDEX idx_brain_docs_updated_at 
ON public.brain_documents(updated_at DESC);
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:78:CREATE INDEX 
idx_brain_doc_versions_doc ON public.brain_document_versions(document_id, version);
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:79:CREATE INDEX 
idx_brain_doc_versions_created ON public.brain_document_versions(created_at DESC);
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:103:CREATE POLICY 
brain_docs_select_policy ON public.brain_documents
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:114:CREATE POLICY 
brain_docs_insert_policy ON public.brain_documents
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:126:CREATE POLICY 
brain_docs_update_policy ON public.brain_documents
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:138:CREATE POLICY 
brain_docs_delete_policy ON public.brain_documents
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:150:CREATE POLICY 
brain_doc_versions_select_policy ON public.brain_document_versions
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:162:CREATE POLICY 
brain_doc_versions_insert_policy ON public.brain_document_versions
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:414:CREATE INDEX IF NOT EXISTS 
idx_agency_brains_calibration_state
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:422:CREATE TABLE 
public.task_module_requirements (
supabase/migrations\20251228174120_brain_documents_and_calibration_state.sql:450:CREATE POLICY 
task_module_requirements_select_policy ON public.task_module_requirements
supabase/migrations\20251230090000_strategy_os_ops.sql:4:CREATE TABLE IF NOT EXISTS public.strategies (
supabase/migrations\20251230090000_strategy_os_ops.sql:18:CREATE INDEX IF NOT EXISTS idx_strategies_client ON 
public.strategies(client_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:19:CREATE INDEX IF NOT EXISTS idx_strategies_agency ON 
public.strategies(agency_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:22:CREATE TABLE IF NOT EXISTS public.strategy_decisions (
supabase/migrations\20251230090000_strategy_os_ops.sql:37:CREATE INDEX IF NOT EXISTS idx_strategy_decisions_strategy 
ON public.strategy_decisions(strategy_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:38:CREATE INDEX IF NOT EXISTS idx_strategy_decisions_client ON 
public.strategy_decisions(client_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:47:CREATE INDEX IF NOT EXISTS idx_strategy_modules_strategy ON 
public.strategy_modules(strategy_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:60:CREATE INDEX IF NOT EXISTS idx_strategy_history_strategy ON 
public.strategy_history(strategy_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:89:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_strategy ON 
public.strategy_tasks(strategy_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:90:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_task ON 
public.strategy_tasks(task_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:91:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_project ON 
public.strategy_tasks(project_id);
supabase/migrations\20251230090000_strategy_os_ops.sql:302:CREATE POLICY strategies_select ON public.strategies
supabase/migrations\20251230090000_strategy_os_ops.sql:311:CREATE POLICY strategies_insert ON public.strategies
supabase/migrations\20251230090000_strategy_os_ops.sql:320:CREATE POLICY strategies_update ON public.strategies
supabase/migrations\20251230090000_strategy_os_ops.sql:329:CREATE POLICY strategy_decisions_select ON 
public.strategy_decisions
supabase/migrations\20251230090000_strategy_os_ops.sql:339:CREATE POLICY strategy_decisions_insert ON 
public.strategy_decisions
supabase/migrations\20251230090000_strategy_os_ops.sql:349:CREATE POLICY strategy_decisions_update ON 
public.strategy_decisions
supabase/migrations\20251230090000_strategy_os_ops.sql:359:CREATE POLICY strategy_decisions_delete ON 
public.strategy_decisions
supabase/migrations\20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:2:CREATE TABLE IF NOT EXISTS 
public.ai_history (
supabase/migrations\20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:40:CREATE INDEX idx_ai_history_agency_id 
ON public.ai_history(agency_id);
supabase/migrations\20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:41:CREATE INDEX idx_ai_history_client_id 
ON public.ai_history(client_id);
supabase/migrations\20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:42:CREATE INDEX idx_ai_history_project_id 
ON public.ai_history(project_id);
supabase/migrations\20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:43:CREATE INDEX idx_ai_history_created_at 
ON public.ai_history(created_at DESC);
supabase/migrations\20251229100000_strategy_os.sql:33:CREATE TABLE IF NOT EXISTS public.strategy_modules (
supabase/migrations\20251229100000_strategy_os.sql:56:CREATE TABLE IF NOT EXISTS public.strategy_history (
supabase/migrations\20251229100000_strategy_os.sql:68:CREATE TABLE IF NOT EXISTS public.strategy_tasks (
supabase/migrations\20251229100000_strategy_os.sql:84:CREATE INDEX IF NOT EXISTS idx_strategy_modules_client ON 
public.strategy_modules(client_id);
supabase/migrations\20251229100000_strategy_os.sql:85:CREATE INDEX IF NOT EXISTS idx_strategy_modules_agency ON 
public.strategy_modules(agency_id);
supabase/migrations\20251229100000_strategy_os.sql:86:CREATE INDEX IF NOT EXISTS idx_strategy_modules_status ON 
public.strategy_modules(status);
supabase/migrations\20251229100000_strategy_os.sql:87:CREATE INDEX IF NOT EXISTS idx_strategy_history_client ON 
public.strategy_history(client_id);
supabase/migrations\20251229100000_strategy_os.sql:88:CREATE INDEX IF NOT EXISTS idx_strategy_history_module ON 
public.strategy_history(module_id);
supabase/migrations\20251229100000_strategy_os.sql:89:CREATE INDEX IF NOT EXISTS idx_strategy_history_created ON 
public.strategy_history(created_at DESC);
supabase/migrations\20251229100000_strategy_os.sql:90:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_client ON 
public.strategy_tasks(client_id);
supabase/migrations\20251229100000_strategy_os.sql:91:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_module ON 
public.strategy_tasks(module_id);
supabase/migrations\20251229100000_strategy_os.sql:92:CREATE INDEX IF NOT EXISTS idx_strategy_tasks_status ON 
public.strategy_tasks(status);
supabase/migrations\20251229100000_strategy_os.sql:100:CREATE POLICY strategy_modules_select ON public.strategy_modules
supabase/migrations\20251229100000_strategy_os.sql:109:CREATE POLICY strategy_modules_insert ON public.strategy_modules
supabase/migrations\20251229100000_strategy_os.sql:118:CREATE POLICY strategy_modules_update ON public.strategy_modules
supabase/migrations\20251229100000_strategy_os.sql:127:CREATE POLICY strategy_modules_delete ON public.strategy_modules
supabase/migrations\20251229100000_strategy_os.sql:138:CREATE POLICY strategy_history_select ON public.strategy_history
supabase/migrations\20251229100000_strategy_os.sql:148:CREATE POLICY strategy_history_insert ON public.strategy_history
supabase/migrations\20251229100000_strategy_os.sql:159:CREATE POLICY strategy_tasks_select ON public.strategy_tasks
supabase/migrations\20251229100000_strategy_os.sql:169:CREATE POLICY strategy_tasks_insert ON public.strategy_tasks
supabase/migrations\20251229100000_strategy_os.sql:179:CREATE POLICY strategy_tasks_update ON public.strategy_tasks
supabase/migrations\20251229100000_strategy_os.sql:189:CREATE POLICY strategy_tasks_delete ON public.strategy_tasks


```

## Verification SQL/Commands
```bash
# Inspect migrations locally
ls supabase/migrations

# Find table/policy definitions quickly
rg -n "create table|create policy|create index" supabase/migrations -S
```

```sql
-- Sanity check: AI run logging exists
SELECT COUNT(*) FROM ai_runs;

-- Strategy module enum values (Postgres)
SELECT unnest(enum_range(NULL::public.strategy_module)) AS strategy_module;

-- Check RLS is enabled on key tables (example)
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('ai_runs','ai_documents','ai_embeddings','brain_documents','strategy_modules');
```

## Problems Found
1. Postgres ENUM `public.strategy_module` couples DB to module keys; changing module contracts requires careful migrations and coordinated frontend updates.
2. Privilege drift on `match_ai_embeddings` is a high-severity multi-tenant risk; grants must be verified after migrations.
3. AI table RLS/policy correctness is table-by-table and must be validated against actual call patterns (service-role vs user JWT).

## Recommendations
1. If adopting a new strategy module contract, migrate by adding new enum values + backfilling + updating code, then removing old values later.
2. Add automated verification for `match_ai_embeddings` privileges and RLS enablement on AI tables as part of CI/deploy checks.
3. Document “who writes what” (edge functions vs client) for each AI table to avoid accidental RLS bypass patterns.
