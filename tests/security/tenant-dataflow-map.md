# Tenant Dataflow Map (Phase 0)

Purpose:
- Map data flows that include agency_id and client_id.
- Identify all boundaries where tenant scoping must be enforced for 0 cross-tenant leaks.

Data flows (Phase 0 map):
1) RAG ingestion
- Entry: supabase/functions/ai-documents-ingest, ai-brain-ingest
- Tenant fields: agency_id, client_id
- Enforcement: RLS on storage tables; shadow embedding writes tagged with agency_id/client_id

2) RAG retrieval
- Entry: supabase/functions/ai-retrieve-context
- Tenant fields: agency_id, client_id
- Enforcement: retrieval RPC filters by tenant scope; provenance includes agency_id/client_id

3) Tool execution
- Entry: supabase/functions/_shared/tool-executor.ts
- Tenant fields: agency_id, client_id
- Enforcement: tool scope taxonomy and allowlist; reject missing scope

4) Memory access
- Entry: src/ai/router.ts and memory tables
- Tenant fields: agency_id, client_id, user_id
- Enforcement: RLS on memory tables; memory writes require approved scope

5) Logging and OTel spans
- Entry: src/ai/logging.ts, src/ai/otel.ts
- Tenant fields: agency_id, client_id, user_id, trace_id
- Enforcement: RLS on ai_runs and ai_otel_spans

RLS-protected tables (Phase 0):
- ai_runs, ai_usage_logs, ai_otel_spans
- ai_embeddings, ai_embeddings_shadow_gemini, ai_document_chunks

TODO:
- Add concrete diagram links for each data flow.
- Validate every path includes tenant_id checks.
