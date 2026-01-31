## Phase 0 — Guardrails + Backfill

**Outcome:** “ClientBrain missing” becomes structurally impossible for new clients, and impossible in practice for existing clients after backfill.

### Why this phase exists
- The strategy endpoint currently hard-fails if no `client_brains` row exists.
- The app has client creation paths that do not create a baseline brain row.

### Scope
1) Database guarantees baseline row existence
2) Backfill baseline rows for existing clients
3) Make `ai-strategy-generate` resilient (defense-in-depth)

### Implementation tasks
**DB**
- Add a unique constraint/index on `(agency_id, client_id, version)` for `public.client_brains`.
- Add an `AFTER INSERT` trigger on `public.clients` that inserts a baseline `client_brains` row (version 1) if missing.
- Backfill: insert a baseline row for any existing client without a `client_brains` record.
- Optional hardening: de-duplicate any accidental duplicates prior to creating the unique index.

**Edge**
- In `ai-strategy-generate`, if brain row is missing:
  - bootstrap baseline brain row (best effort)
  - return HTTP 200 with `unknown=true` and `code=CLIENT_BRAIN_MISSING` (deep link to onboarding)
  - log an `ai_runs` row as `unknown=true` (so it’s observable)

### Definition of done (DoD)
- Creating a client and immediately hitting “Generate strategy” returns a gated response (unknown) with a deep link — never a hard 400 missing-brain error.
- Backfill runs successfully and there are no clients without at least one `client_brains` row.
- Unique `(agency_id, client_id, version)` is enforced (no duplicates).

### Readiness checklist (must be true before starting Phase 1)
- [ ] Migration is idempotent and safe to run on prod data.
- [ ] Backfill logic won’t create duplicates (unique index enforced).
- [ ] UI behavior for gated responses is acceptable (toast + deep link).
- [ ] Observability: the `ai_runs` record captures missing-brain gating events.

### Rollback
- Trigger can be dropped safely.
- Unique index can be dropped, but only if we have a strong reason.
- Endpoint can temporarily revert to old behavior, but only as a short-term hotfix (not recommended).
