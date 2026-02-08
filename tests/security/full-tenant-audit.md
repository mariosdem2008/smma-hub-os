# Full Tenant Audit Plan (Phase 2 Gate)

Goal: demonstrate "0 cross-tenant leaks" across RAG, tools, memory, and logs.

Scope (must be covered)
- RAG retrieval (ai_documents/ai_document_chunks/ai_embeddings + RPC match paths)
- Tool execution paths (all tool types, including report tools)
- Memory tables (ai_memory_items, brains/brain_documents, checkpoints)
- Logging/telemetry tables (ai_runs/ai_usage_logs/ai_otel_spans)
- Any "admin" or "service_role" paths that could be exposed to authenticated users

Definitions
- A "leak" is any response/tool result/log view that returns data from a different agency_id than the caller's agency_id.
- Pass criteria: 0 leaks across all negative scenarios below; all violations are denied and logged.

Pre-reqs
- Two agencies: Agency A and Agency B
- One client per agency: Client A (belongs to Agency A), Client B (belongs to Agency B)
- Two users: User A is a member of Agency A only; User B is a member of Agency B only
- A valid JWT for each user (do not store in repo)

Audit steps
1) RLS smoke check (SQL)
- Run `supabase/tests/cross-tenant-isolation.sql` and confirm it passes.
- Confirm ai tables have RLS enabled and policies reference agency membership.

2) REST/Edge negative tests (manual)
- As User A, attempt to read Client B rows via REST:
  - clients?id=eq.<ClientB>
  - tasks?client_id=eq.<ClientB>
  - ai_documents?agency_id=eq.<AgencyB>
  - ai_document_chunks?document_id=in.(<doc ids from AgencyB>)
  - ai_otel_spans?agency_id=eq.<AgencyB>
- Expected: 403/empty result under RLS (never returns B data). Any returned B data is a failure ("0 cross-tenant leaks").

3) Tool executor negative scenarios (must deny + log)
- As User A, call any edge endpoint that executes tools with a mismatched tenant_id/client_id payload.
- Examples:
  - search_knowledge_base: tenant_id=<AgencyB>
  - get_client_history: client_id=<ClientB>
  - update_client_record: client_id=<ClientB>
  - generate_strategy_report: client_id=<ClientB>
- Expected: denial (tenant_scope_violation) and a log entry (ai_history and/or ai_otel_spans) that includes agency_id and an error code.

4) Memory boundaries
- As User A, attempt to propose memory write with tenant_id=<AgencyB>.
- As User A, attempt to read memory rows for Agency B (where applicable).
- Expected: denial and logged tenant violation.

5) Telemetry/logging boundaries
- Confirm User A can read ai_otel_spans for Agency A, and cannot read ai_otel_spans for Agency B.
- Confirm user-visible dashboards/queries never aggregate across agencies unless explicitly global-admin and protected.

Artifacts to capture (evidence)
- For each section above: record request + response status + a short excerpt proving correct tenant scoping.
- Store sanitized evidence summaries under `tests/security/results/` (no JWTs, no PII).

Exit criteria
- 0 cross-tenant leaks across all checks.
- Any failure blocks Phase 2.

