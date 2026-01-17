# Default Brain Pack v1 — Legacy / Unused / Unexpected Quarantine List (post AI Setup redesign)

## Legacy/Unexpected (still present, still risky)

- **Two “brain” systems with overlapping product concepts**
  - Strategy generation “brain JSON”: `agency_brains` / `client_brains` used in `supabase/functions/ai-strategy-generate/index.ts`
  - Module docs used for RAG: `brain_documents` exposed via AI Setup UI (`src/pages/agency/AISetup.tsx`)
  - Risk: users assume editing module docs modifies the strategy brain JSON directly; it only affects strategy output if ingestion succeeds.

- **Legacy UI pages still exist (but are redirected)**
  - `src/pages/agency/AgencyBrain.tsx`
  - `src/pages/agency/BrainLayerDetail.tsx`
  - Router redirects `/agency/brain/*` → `/agency/ai-setup/*`: `src/App.tsx`
  - Risk: internal references/tests may still mention old page names; keep redirects until fully removed.

- **Duplicate migrations for `brain_documents`**
  - `supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql`
  - `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql`
  - Risk: maintainers may patch the wrong file or assume the wrong canonical schema.

## Likely-unused / dead paths (needs confirmation)

- Old onboarding redirect is still routed for backwards-compat:
  - `src/pages/ai/AiOnboardingAgency.tsx` redirects to `/agency/ai-setup`
  - Status: USED (keep as safe redirect).

- Any remaining references to “Agency Brain” in UI copy should be treated as cleanup debt (naming collision is a known source of confusion).

