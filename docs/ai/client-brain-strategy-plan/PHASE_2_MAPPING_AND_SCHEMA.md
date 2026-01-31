## Phase 2 — Canonical Mapping + Schema Alignment

**Outcome:** A single, stable contract maps `client_onboarding_profiles` → canonical `client_brains.brain_json`, and the schema matches reality (or reality is upgraded deliberately).

### Current gaps
- UI currently constructs `raw_responses` in multiple places.
- `docs/ai/client_brain.schema.json` expects some richer shapes than the current mapping emits (e.g., competitors as objects vs strings).

### Implementation tasks
- Create a single server-side mapper:
  - `onboarding_profile` → `raw_responses` (for ingestion)
  - then reuse `mapV3AnswersToClientBrain(raw, followups)` to produce canonical brain
- Decide and document canonical types:
  - competitors: string list (v1) vs `{name, notes}` objects (v2)
  - constraints fields: ensure required “at least one of banned claims/taboo topics” is satisfied
- Update JSON schema or mapping accordingly.

### DoD
- Only one mapping path exists for onboarding → brain.
- Schema validation is achievable for the canonical brain produced by ingest.

### Readiness checklist (before Phase 3)
- [ ] Versioning plan exists if schema upgrades are needed (v1→v2).
- [ ] Downstream consumers (strategy prompts, UI) won’t break on schema alignment.
