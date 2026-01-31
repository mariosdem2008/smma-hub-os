## Rollout + Observability

### Release sequence
1) Phase 0: DB guardrails + endpoint resilience (safe, backwards compatible)
2) Phase 1: Move orchestration server-side (jobs)
3) Phase 2: Mapping/schema alignment (may require migration/version bump)
4) Phase 3: Continuous collaboration (new tables + approvals)
5) Phase 4: Router unification (refactor endpoints)

### Metrics to watch
- Count of `CLIENT_BRAIN_MISSING` gated events (should go to ~0 after backfill)
- Count of `BRAIN_INCOMPLETE` gated events (should decrease as onboarding improves)
- Strategy generation success rate (ai_runs success=true)
- Job failure rate (ai_jobs last_error not null)

### Logging requirements
- Every strategy generation attempt writes `ai_runs` (success/unknown/failure).
- Gated responses are logged as `unknown=true` with `metadata.code`.

### Operational playbook
- If gating spikes unexpectedly:
  - verify trigger/backfill coverage
  - verify onboarding profile presence and ingest job execution
- If strategy generation fails:
  - check agency brain documents readiness gate
  - check embeddings/config (API keys, chunk embedding status)
