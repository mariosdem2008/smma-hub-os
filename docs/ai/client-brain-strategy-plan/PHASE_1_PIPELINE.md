## Phase 1 — Enforce Onboarding → Brain Ingest → Strategy

**Outcome:** Onboarding completion reliably yields a canonical ClientBrain and (when usable) a generated strategy, using a single orchestrated pipeline.

### Problem solved
- Brain creation/ingestion is currently duplicated in client-side onboarding code and can drift.
- Strategy generation can be attempted before ingestion has run.

### Target behavior
- `client_onboarding_profiles.completed_at` implies the latest ClientBrain has been ingested at least once.
- Strategy generation is attempted only when:
  - `client_brains.usable=true`
  - agency brain documents readiness is satisfied

### Implementation tasks
**Jobs**
- Ensure onboarding completion enqueues:
  - `ingest_client_brain` job (maps onboarding → canonical brain, sets `usable`)
- The ingest job enqueues `seed_strategy` only when:
  - client brain gate passes (`usable=true`)
  - agency brain documents readiness is satisfied
- Dedupe keys prevent job spam.

**Worker**
- Implement job handlers in `ai-job-worker`:
  - ingest handler loads onboarding profile, maps to raw responses, calls brain ingest mapping + gate, persists results
  - seed strategy handler calls strategy generation (or returns gated status)

**UI**
- Onboarding UI only triggers onboarding completion and then polls job progress / shows status (no direct multi-step client-side brain ingest chain).

### DoD
- Onboarding completion results in a ClientBrain that is canonical (not only raw_responses) and `usable` is up to date.
- Strategy is auto-generated when all gates pass.

### Readiness checklist (before Phase 2)
- [ ] There is exactly one server-side source of truth for “how to ingest onboarding into brain”.
- [ ] Idempotency: repeated onboarding completion does not create duplicate versions or duplicate strategies.
- [ ] Failure modes are observable (ai_runs + job last_error).
