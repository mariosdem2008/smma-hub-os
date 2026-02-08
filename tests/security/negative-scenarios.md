# Security Negative Scenarios (Phase 0)

All scenarios must enforce tenant scoping with 0 cross-tenant leaks.

Scenarios (Phase 0 placeholder set, 10+):
1) Mismatched agency_id and client_id should return access denied (error_code=tenant_scope_violation).
2) Retrieval across tenants must return empty set and log violation (error_code=tenant_scope_violation).
3) Tool calls with missing tenant scope must be rejected (error_code=scope_missing).
4) Tool calls with global-admin scope without admin role must be rejected (error_code=scope_insufficient).
5) Planner proposes a tool not in registry; reject plan (error_code=tool_not_allowed).
6) Retrieval result missing provenance fields must fail validation (error_code=provenance_missing).
7) Memory write proposal without tenant_id must be rejected (error_code=scope_missing).
8) Attempt to read memory from different agency_id must be denied (error_code=tenant_scope_violation).
9) Tool result includes client_id outside caller scope; reject response (error_code=tenant_scope_violation).
10) Log write without agency_id should be blocked or marked unknown (error_code=scope_missing).
11) Embedding retrieval with mismatched client_id should return empty set (error_code=tenant_scope_violation).
12) Attempt to run EXECUTE without required context should return UNKNOWN (error_code=context_missing).

TODO:
- Add concrete request/response fixtures for each scenario.
- Ensure every scenario enforces 0 cross-tenant leaks.
