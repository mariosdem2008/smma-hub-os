# OpenTelemetry Plan (Decision + Trace Schema)

## Instrumentation approach (implemented)
A) Supabase Edge Functions (Deno)
- Implemented: Emit span records to `ai_otel_spans` via `src/ai/otel.ts` helper.
- Implemented: Edge endpoints wrap router invocations and log spans at entry/exit.
- Decision logged in `tests/perf/otel-exporter-feasibility.md` (OTLP not verified; DB spans only in Phase 0).

B) Node/TS runtime in src/*
- Implemented: `src/ai/router.ts` logs a `router.run` span per request.
- Planned: OTel SDK for Node providers + tool spans once exporter support is confirmed.

## Trace and span schema (current)
Trace ID
- Generate local trace ids in router; no inbound propagation yet.
- TODO: accept W3C traceparent/tracestate when available.

Span names (minimum set)
- router.run
- planner.plan
- executor.step
- tool.call
- rag.retrieve
- memory.read
- memory.write
- logging.write

Required attributes
- task_type, agency_id, client_id, user_id (tenant scoping; 0 cross-tenant leaks)
- latency_ms
- attributes (jsonb) for provider/model/schema_ok/etc.

## Propagation headers
- Current: none (internal trace ids only)
- Planned: traceparent/tracestate + x-smma-trace-id fallback

Header format examples (planned)
- traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
- tracestate: "vendor=key"
- x-smma-trace-id: 32 hex chars (e.g., "4bf92f3577b34da6a3ce929d0e0e4736")
Header length expectations (planned)
- traceparent: 55 chars (version(2) + 1 + trace_id(32) + 1 + span_id(16) + 1 + flags(2))
- tracestate: <= 512 chars (implementation limit TBD)
- x-smma-trace-id: 32 chars

## Exact insertion points (implemented)
Edge Functions
- `supabase/functions/ai-ask/index.ts`
- `supabase/functions/ai-assistant/index.ts`
- `supabase/functions/ai-strategy-generate/index.ts`
- `supabase/functions/ai-retrieve-context/index.ts`
- `supabase/functions/ai-agency-admin-chat/index.ts`
- `supabase/functions/ai-onboarding-guide/index.ts`
- `supabase/functions/ai-onboarding-scan/index.ts`
- `supabase/functions/ai-onboarding-suggest/index.ts`
- `supabase/functions/ai-rep-chat/index.ts`
- `supabase/functions/ai-answer-quality-check/index.ts`
- `supabase/functions/ai-brain-analyze/index.ts`
- `supabase/functions/ai-brain-ingest/index.ts`
- `supabase/functions/ai-documents-ingest/index.ts`
- `supabase/functions/ai-job-worker/index.ts`
- `supabase/functions/ai-brain-document-approve/index.ts`
- `supabase/functions/ai-brains-agency/index.ts`
- `supabase/functions/ai-brains-client/index.ts`
- `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts`
- `supabase/functions/ai-seed-default-brain-pack/index.ts`
- `supabase/functions/ai-seed-default-brain-pack-admin/index.ts`

Node/TS runtime
- `src/ai/router.ts` run/runStream entry/exit

Storage and RLS
- `supabase/migrations/20260201001000_add_ai_otel_spans.sql` adds `ai_otel_spans` with RLS on `agency_id` for 0 cross-tenant leaks.

## Log to OTel attribute mapping (Phase 0)
Source: `ai_runs` / `ai_usage_logs` fields
- task_type -> span.task_type
- agency_id -> span.agency_id
- client_id -> span.client_id
- user_id -> span.user_id
- provider -> attributes.provider
- model -> attributes.model
- tokens_in -> attributes.tokens_in
- tokens_out -> attributes.tokens_out
- latency_ms -> span.latency_ms
- unknown -> attributes.unknown
- success -> attributes.success
- error_code -> attributes.error_code

## Dashboard spec
Dashboards must include:
- p95 latency by task_type and stage span
- workflow success rate (>= 95%)
- EXECUTE schema validity (>= 99%)
- groundedness score (> 85%)
- cross-tenant leak count (must be 0)

## Open questions (tracked)
- OTLP exporter support in Supabase Edge: NOT REQUIRED for Phase 0/1; use DB span logging only (see `tests/perf/otel-exporter-feasibility.md`).
- Telemetry sink selection (Phase 0 decision): `ai_otel_spans` table in Supabase Postgres (RLS scoped by agency_id; 0 cross-tenant leaks).

## Evidence (Phase 0/1)
- `tests/perf/results/2026-02-01_ai-otel-spans_sample.json` shows tenant-scoped span reads working under RLS.
