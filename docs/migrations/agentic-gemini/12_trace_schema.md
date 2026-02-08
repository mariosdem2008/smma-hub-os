# Trace Schema

Fields
- id: uuid (server generated)
- trace_id: 32 hex chars (16 bytes)
- span_id: 16 hex chars
- parent_span_id: 16 hex chars or null
- stage: span name string (e.g., router.run, planner.plan, tool.call)
- task_type: task identifier
- agency_id: tenant id
- client_id: tenant sub-scope id
- user_id: user id
- latency_ms: integer
- attributes: json object (provider/model/schema_ok/etc.)
- created_at: timestamp with time zone

Stage names
- router.run
- planner.plan
- executor.step
- tool.call
- rag.retrieve
- memory.read
- memory.write
- logging.write

Required attributes per span
- trace_id, span_id, stage, task_type, latency_ms
- agency_id and client_id must be present if available (tenant scoping; 0 cross-tenant leaks)

Trace headers (planned)
- traceparent length: 55 chars
- tracestate length: <= 512 chars (implementation limit TBD)
- x-smma-trace-id length: 32 chars
