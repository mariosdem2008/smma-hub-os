-- OpenTelemetry span storage (Phase 0)

create table if not exists public.ai_otel_spans (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,
  span_id text not null,
  parent_span_id text,
  stage text not null,
  task_type text not null,
  agency_id uuid references public.agencies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  latency_ms integer,
  attributes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_otel_spans_trace on public.ai_otel_spans(trace_id);
create index if not exists idx_ai_otel_spans_agency on public.ai_otel_spans(agency_id, created_at);

alter table public.ai_otel_spans enable row level security;

create policy "ai_otel_spans_select" on public.ai_otel_spans
  for select to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_otel_spans_insert" on public.ai_otel_spans
  for insert to authenticated
  with check (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_otel_spans_update" on public.ai_otel_spans
  for update to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));

create policy "ai_otel_spans_delete" on public.ai_otel_spans
  for delete to authenticated
  using (agency_id in (select agency_id from public.agency_members where user_id = auth.uid()));
