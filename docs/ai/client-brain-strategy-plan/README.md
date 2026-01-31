## ClientBrain + Strategy Generation Stabilization Plan

**Goal:** Fix `CLIENT_BRAIN_MISSING` during strategy generation and establish a safe, versioned, continuously improving ClientBrain lifecycle that all AI calls can depend on.

**Primary invariant:** A client must never reach strategy generation without at least a baseline `client_brains` row and a clear “gated” UX path to complete requirements.

### Current problem (as of 2026-01-29)
- `ai-strategy-generate` reads latest `public.client_brains` row for `(agency_id, client_id)`.
- If no row exists, it returns HTTP 400 with `code: CLIENT_BRAIN_MISSING`.
- Some client creation paths create `clients` without creating `client_brains`, so Strategy OS “Generate” can hit the hard error before onboarding runs.

### Phases
1) Phase 0: Guardrails + backfill (eliminate missing brain rows, degrade to gated UX)
2) Phase 1: Enforce onboarding → brain ingest → (optional) strategy pipeline (single orchestrator)
3) Phase 2: Canonical onboarding→brain mapping + schema alignment
4) Phase 3: Continuous collaboration (signals → proposals → versioned brain updates)
5) Phase 4: Route all AI calls through the router with safe tools + context loading

### Success criteria
- No user action can produce `CLIENT_BRAIN_MISSING` as a hard error; it is always handled as a gated flow with a deep link.
- `client_brains.usable` remains derived from canonical `brain_json` and is not manually toggled by UI.
- Brain evolution is versioned, explainable, and approval-gated for risky fields.

### Documents
- `docs/ai/client-brain-strategy-plan/PHASE_0_GUARDRAILS.md`
- `docs/ai/client-brain-strategy-plan/PHASE_1_PIPELINE.md`
- `docs/ai/client-brain-strategy-plan/PHASE_2_MAPPING_AND_SCHEMA.md`
- `docs/ai/client-brain-strategy-plan/PHASE_3_CONTINUOUS_COLLAB.md`
- `docs/ai/client-brain-strategy-plan/PHASE_4_ROUTER_UNIFICATION.md`
- `docs/ai/client-brain-strategy-plan/ROLL_OUT_AND_OBSERVABILITY.md`
- `docs/ai/client-brain-strategy-plan/TEST_PLAN.md`
- `docs/ai/client-brain-strategy-plan/DECISIONS_AND_RISKS.md`
