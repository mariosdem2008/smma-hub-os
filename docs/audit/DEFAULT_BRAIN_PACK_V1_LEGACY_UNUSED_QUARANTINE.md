# Default Brain Pack v1 — Legacy / Unused / Unexpected Quarantine List

## Legacy/Unexpected (still present, still risky)

- **Two “brain” systems with overlapping product language**
  - “Agency Brain” UI is `brain_documents`: `src/pages/agency/AgencyBrain.tsx:20`.
  - Strategy generation “Agency Brain” is `agency_brains`: `supabase/functions/ai-strategy-generate/index.ts:199`.
  - Redirect page reinforces naming confusion: `src/pages/ai/AiOnboardingAgency.tsx:10`.
  - Risk: users believe configuring module docs changes the strategy brain directly; it only affects RAG if ingestion succeeds.
- **Duplicate migrations for brain_documents**
  - `supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql:39`
  - `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`
  - Risk: future maintainers may patch the wrong file; production may have drift depending on applied migration history.

## Likely-unused / dead paths (needs confirmation)

- Old “Agency onboarding page” is a redirect but still routed for backwards-compat:
  - Route: `src/App.tsx:248`.
  - Implementation: `src/pages/ai/AiOnboardingAgency.tsx:10`.
  - Status: USED (keep; safe redirect).

- Demo route `/ai/field-demo` was not referenced anywhere except the router (no UI links found).
  - Evidence search (no hits outside the file): `rg -n "ai/field-demo|AiFieldDemo" -S src`
  - Quarantine action:
    - Removed route from router (no longer reachable): `src/App.tsx:1`.
    - Left file with “QUARANTINED” header comment: `src/pages/ai/AiFieldDemo.tsx:1`.
  - Status: QUARANTINED.
- Endpoint guard allows an explicit bypass flag: `supabase/functions/_shared/endpoint-guard.ts:29`.
  - Risk: enabling `ENABLE_UNUSED_AI_ENDPOINTS=true` may expose endpoints you intended disabled (requires ops discipline).

## What to quarantine (recommended)

- Move legacy audit docs out of `docs/audit/` to avoid confusion (done in this audit run):
  - All prior audit docs were moved under `docs/audit-archive/` (git move).
  - UNKNOWN whether external links reference old paths; verify via `rg -n \"docs/audit/\" -S .`.
