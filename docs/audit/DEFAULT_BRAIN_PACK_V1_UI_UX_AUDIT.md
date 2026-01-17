# Default Brain Pack v1 — UI/UX Audit (post AI Setup redesign)

## Current Screens & Components

- Routes
  - `/agency/ai-setup` → `src/pages/agency/AISetup.tsx`
  - `/agency/ai-setup/:moduleKey` → `src/pages/agency/ModuleDetail.tsx`
  - Legacy redirects
    - `/agency/brain` → redirect in `src/App.tsx`
    - `/agency/brain/:layer` → mapped redirect in `src/App.tsx`
- Module naming + grouping: `src/lib/brain/moduleConfig.ts`
- Status model (includes ingestion failure): `src/lib/brain/statusTypes.ts`
- Overview list row: `src/components/ai-setup/ModuleCard.tsx`
- Status badge: `src/components/ai-setup/StatusBadge.tsx`
- Quick Setup (seed/repair defaults): `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx`
- Content creation (template/upload/write → draft): `src/components/ai-setup/ContentWizard/ContentWizard.tsx`

## What Changed vs Legacy “Agency Brain”

- Replaced the visualization-first overview with a checklist-style grouped list (“Core Setup”, “Response Templates”, “Advanced Settings”).
- Reduced competing CTAs by rendering one primary action per state (not started/draft/active/error) on the module page.
- Made ingestion failures visible (approved-but-not-indexed default modules show “Needs Attention”).
- Added explicit role gating messaging (non-admins can view but cannot edit/activate).

## Status Mapping (what users see)

- Source-of-truth inputs:
  - Document state: `brain_documents.status` (draft/pending_approval/approved)
  - Ingestion health: `useDefaultBrainPackIngestionHealth` (approved defaults missing from `ai_documents`)
- Display status: `computeDisplayStatus` in `src/lib/brain/statusTypes.ts`
  - No document → `not-started`
  - Draft/pending_approval → `draft`
  - Approved + ingested → `active`
  - Approved + missing ingestion (default modules only) → `error`

## Primary User Flows (current)

- **Quick Setup (core defaults)**
  - Trigger: shown when core modules are not all Active.
  - Action: calls `ai-seed-default-brain-pack` with `mode=seed_or_repair` via `useSeedDefaultBrainPack`.
- **Manual setup**
  - Not started → choose Template / Upload / Write (template emphasized).
  - Wizard save creates a draft via existing upload+analyze flow: `src/hooks/useBrainDocumentUpload.ts`.
  - Draft → Activate calls existing approve endpoint: `src/hooks/useBrainDocuments.ts` (invokes `ai-brain-document-approve`).
- **Error recovery (default modules only)**
  - Error state → “Retry Processing” calls `ai-seed-default-brain-pack` with `mode=ingest_only`.

## Remaining UX Gaps / Follow-ups

- “Retry Processing” is pack-level (ingest-only reindexes approved defaults). This is correct for Default Brain Pack v1, but can feel ambiguous while viewing a specific module.
- Preview is best-effort: renders `raw_content` if present, otherwise JSON (`content_json`).
- Advanced/Templates modules are not part of Default Brain Pack v1 (only 3 core defaults are seeded). Keep copy clear so users don’t expect auto-creation.

