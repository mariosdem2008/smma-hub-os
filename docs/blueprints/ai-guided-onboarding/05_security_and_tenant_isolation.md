# Security and Tenant Isolation (0 cross-tenant leaks)

Hard invariants (non-negotiable):
1. 0 cross-tenant leaks (reads or writes).
2. Any retrieval using `match_ai_embeddings_scoped` runs server-side in an Edge Function using `service_role`.
3. The browser must never call scoped match RPCs and must never receive `service_role` secrets.

## 1. Threat Model: Top 10 cross-tenant leakage risks

1. Client-side RPC abuse: browser calls `match_ai_embeddings_scoped` directly (privilege or policy gap).
2. Edge Function missing membership checks: accepts `agency_id` and queries tenant data without verifying `agency_members`.
3. Incorrect RLS `USING` clause: select policies do not scope by agency membership or allow NULL agency_id paths.
4. Incorrect `WITH CHECK` clause: inserts/updates allow writing rows with another tenant's `agency_id`.
5. Leaky joins: query joins a tenant-scoped table to a non-scoped table and returns cross-tenant rows.
6. Over-broad service_role usage: Edge uses service_role but fails to add explicit `agency_id` filters and relies on app logic.
7. Cache key collisions: shared prompt/context cache across tenants due to missing agency_id in cache keys.
8. Logs and observability leaks: spans/runs store raw content and are queryable across tenants due to RLS mistakes.
9. Multi-tenant "admin" roles: elevated roles bypass RLS unintentionally (e.g., using "postgres" role in tooling).
10. Embedding retrieval scoping bug: `match_ai_embeddings_scoped` includes agency-scoped docs in an unsafe way when `client_id` is provided.

## 2. Required DB Constraints + RLS Policy Checklist

### 2.1 Tables in scope

At minimum for this blueprint:
- `ai_documents`, `ai_document_chunks`
- `ai_embeddings` (vector(1536))
- `ai_embeddings_shadow_gemini_vector` (vector(768))
- `ai_runs`, `ai_otel_spans`
- `ai_onboarding_status` (to be added)
- Raw onboarding logs table (to be added)
- Any persona/personality vectors table (to be added)

### 2.2 Constraints checklist

- [ ] Every table has `agency_id` (and optional `client_id`) where applicable.
- [ ] `agency_id` is `NOT NULL` for tenant-owned objects.
- [ ] Foreign keys reference tenant tables with `ON DELETE` behavior reviewed.
- [ ] Status fields use constrained values (check constraint or enum).
- [ ] Any JSON fields have minimal structural checks (optional but recommended) and size bounds enforced at application layer.

### 2.3 RLS checklist (must pass for every table)

- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- [ ] `SELECT` policy: `agency_id in (select agency_id from agency_members where user_id = auth.uid())`
- [ ] `INSERT` policy: `WITH CHECK (agency_id in (select ...))`
- [ ] `UPDATE` policy: `USING (agency_id in (select ...))` (and optionally `WITH CHECK` as well)
- [ ] `DELETE` policy: `USING (agency_id in (select ...))`
- [ ] No policy allows `true` unless the table is explicitly non-tenant and contains no sensitive data.
- [ ] Policies are tested with forced mismatch attempts (negative tests).

### 2.4 RPC privilege checklist (scoped retrieval)

For `public.match_ai_embeddings_scoped`:
- [ ] `revoke all` from `anon`, `authenticated`, and `public`.
- [ ] `grant execute` only to `service_role`.
- [ ] Integration test asserts `authenticated` cannot execute it.

## 3. Edge Function `service_role` handling rules

1. Only Edge Functions may read `SUPABASE_SERVICE_ROLE_KEY`.
2. Never accept a key from the client; never echo env vars in errors.
3. Always do both:
   - Membership check: verify the caller belongs to `agency_id`.
   - Explicit scoping: include `.eq('agency_id', agency_id)` in every query, even when using service_role.
4. Do not rely on RLS when using service_role (service_role can bypass RLS).
5. If retrieval uses `match_ai_embeddings_scoped`, pass `p_agency_id` from the validated membership context, not directly from request body without validation.
6. Prefer a single "tenant context" object in the function (validated `agency_id`, optional `client_id`, `user_id`) and pass it everywhere.
7. Always write `ai_otel_spans` and `ai_runs` rows with explicit agency_id to keep them tenant-scoped under RLS for authenticated reads.

## 4. Validation Plan: Prove "zero cross-tenant visibility"

### 4.1 DB-level tests (SQL)

Add/extend `supabase/tests/cross-tenant-isolation.sql` with:
1. Assert RLS enabled for each onboarding-related table.
2. For each table, attempt select as a user in a different agency and assert 0 rows.
3. Assert `match_ai_embeddings_scoped` is executable only by `service_role`.

### 4.2 Edge integration tests

Add security tests that:
1. Call `ai-onboarding` with token for Agency A but `agency_id` set to Agency B -> expect 403, 0 writes.
2. If client-scoped onboarding exists: token for Agency A with `client_id` belonging to Agency B -> expect 403/404.
3. Attempt to invoke any retrieval path without membership -> expect 403.

### 4.3 Browser/client tests

Add a repo test that scans `src/` for forbidden strings:
- `match_ai_embeddings_scoped`
- `SUPABASE_SERVICE_ROLE_KEY`
- any direct `.rpc('match_ai_embeddings_scoped'`

### 4.4 Evidence artifacts (required)

For release sign-off, attach:
1. SQL output from `cross-tenant-isolation.sql` showing all checks passing.
2. CI logs for integration/security suites.
3. Grep/scan output proving no client references to scoped match RPCs.
4. A sample `ai-onboarding` trace (trace_id) showing tenant scoping attributes without PII leakage.

