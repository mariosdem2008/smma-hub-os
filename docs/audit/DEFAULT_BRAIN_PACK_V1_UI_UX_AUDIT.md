# Default Brain Pack v1 — UI/UX Audit

## Screens & Components in Scope

- Routes: `src/App.tsx:245` (overview) and `src/App.tsx:246` (layer detail).
- Overview page: `src/pages/agency/AgencyBrain.tsx:19`.
- Layer detail page: `src/pages/agency/BrainLayerDetail.tsx:84`.
- Visualization status (configured/approved): `src/components/brain/visualization/BrainModuleNode.tsx:64`.
- Module editor (draft/save): `src/components/brain/BrainModuleEditor.tsx:36`.
- “Example structure” panel: `src/pages/agency/BrainLayerDetail.tsx:295` and `src/components/brain/layer-detail/ExampleDocCard.tsx:115`.

## Finished

- **Module overview rendering**
  - Uses `effectiveByModule` for configured/approved: `src/pages/agency/AgencyBrain.tsx:20` and `src/pages/agency/AgencyBrain.tsx:112`.
  - Pending modules banner: `src/pages/agency/AgencyBrain.tsx:94` (mobile) and `src/pages/agency/AgencyBrain.tsx:145` (desktop).
- **Layer detail: active document selection**
  - Picks approved > pending > draft: `src/pages/agency/BrainLayerDetail.tsx:109`.
- **Example personalization placeholders**
  - Uses agency values when available, otherwise keeps placeholders: `src/components/brain/layer-detail/ExampleDocCard.tsx:124`.
  - Example markdown source per module: `src/lib/brain/examples.ts:22`.

## Unfinished / UX Debt

- **Default Brain Pack CTA + repair path**
  - CTA shows when any default module missing: `src/pages/agency/BrainLayerDetail.tsx:107`.
  - CTA action calls edge in seed/repair mode: `src/pages/agency/BrainLayerDetail.tsx:199`.
  - Edge chooses seed vs repair automatically: `supabase/functions/ai-seed-default-brain-pack/index.ts:103`.
  - Repair RPC inserts only missing defaults (no duplicates): `supabase/migrations/20260116210000_repair_default_brain_pack_v1_rpc.sql:8`.

- **Ingestion Health banner + retry ingest**
  - Health check compares approved default modules vs `ai_documents` presence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:7`.
  - Warning banner + “Retry ingest” button: `src/pages/agency/BrainLayerDetail.tsx:415`.
  - Retry calls edge in ingest-only mode (no inserts): `src/pages/agency/BrainLayerDetail.tsx:214` and `supabase/functions/ai-seed-default-brain-pack/index.ts:104`.
- **Layer detail empty state mixes multiple actions without role gating**
  - UI offers Upload/Configure/Generate even when module has 0 docs: `src/pages/agency/BrainLayerDetail.tsx:421`.
  - DB RLS requires admin/owner for insert/update: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:113`.
  - UNKNOWN whether UI hides/locks these actions for non-admin members (no gating found in `src/pages/agency/BrainLayerDetail.tsx`); verify by checking membership role logic at runtime.
    - Verification: search for a role check around this page: `rg -n \"useRole|role\" src/pages/agency/BrainLayerDetail.tsx`.
- **Error UX: “seeded but not ingested” is surfaced only on the layer detail page**
  - Alert for partial failure exists: `src/pages/agency/BrainLayerDetail.tsx:434`.
  - Overview page does not surface ingestion failures (only pending approvals): `src/pages/agency/AgencyBrain.tsx:141`.

## Editor + Save/Approve flows (what happens)

- Save:
  - New doc: inserts `brain_documents` draft: `src/hooks/useBrainDocuments.ts:146`.
  - Existing doc: updates only if not approved: `src/hooks/useBrainDocuments.ts:207`.
  - Query invalidation: `src/hooks/useBrainDocuments.ts:171` and `src/hooks/useBrainDocuments.ts:236`.
- Approve (“Set Live”):
  - UI calls `useApproveBrainDocument` which invokes edge: `src/hooks/useBrainDocuments.ts:256`.
  - Edge approves and ingests: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:60`.
  - Layer detail uses this for “Set Live”: `src/pages/agency/BrainLayerDetail.tsx:576`.

## Example UX vs Default Pack v1 (mismatch risk)

- Example templates exist for all 9 modules: `src/lib/brain/examples.ts:22`.
- Default Brain Pack v1 seeds only 3 modules: `supabase/functions/_shared/defaultBrainPackV1.ts:97`.
- Users can “Open Example” for modules that will never be auto-seeded, which is fine, but the UI copy should not imply it is part of the default pack.

## Trust/Clarity: Strategy references + debug

- Strategy generation returns `rag_debug` including brain_document chunk counts + references:
  - `supabase/functions/ai-strategy-generate/index.ts:627`.
- References are deterministic and capped (module/title/brain_document_id/version):
  - `supabase/functions/_shared/strategy-references.ts:1`.
