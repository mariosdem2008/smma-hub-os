# Default Brain Pack v1 — Action Plan (Updated after AI Setup redesign)

## Status Summary (current)

- Backend seed/repair/ingest-only pipeline exists and is stable:
  - Templates + renderer: `supabase/functions/_shared/defaultBrainPackV1.ts`
  - Orchestration: `supabase/functions/_shared/seed-default-brain-pack.ts`
  - Entry points: `supabase/functions/ai-seed-default-brain-pack/index.ts` and `supabase/functions/ai-seed-default-brain-pack-admin/index.ts`
- UI/UX redesign shipped (frontend-only):
  - New overview: `src/pages/agency/AISetup.tsx`
  - New module detail: `src/pages/agency/ModuleDetail.tsx`
  - Legacy `/agency/brain/*` redirects: `src/App.tsx`
  - Ingestion failures surfaced on overview + detail via `useDefaultBrainPackIngestionHealth`: `src/hooks/useDefaultBrainPackIngestionHealth.ts`
  - Quick Setup uses existing `ai-seed-default-brain-pack (mode=seed_or_repair)`: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx`
  - Retry Processing uses existing `ai-seed-default-brain-pack (mode=ingest_only)`: `src/pages/agency/ModuleDetail.tsx`

## Open Work (prioritized)

1) P0 / Risk 5 / Backend: Keep `ai_documents` delete safely scoped
   - Target: `supabase/functions/_shared/brain-documents.ts` (delete should include `agency_id`)
   - Verify: ingest in one agency does not delete another agency’s rows.

2) P0 / Risk 5 / Backend: Confirm approval authorization model and enforce it consistently
   - Target: `supabase/functions/_shared/ai-brain-document-approve-handler.ts`
   - Verify: member/non-admin cannot approve if admin-only.

3) P1 / Risk 3 / UX: Clarify “Retry Processing” scope
   - Current behavior: `mode=ingest_only` reindexes approved default modules (pack-level).
   - Goal: copy that makes it clear this re-processes core defaults (not arbitrary modules).

4) P1 / Risk 3 / UX: Improve preview fidelity for JSON module docs
   - Current: shows `raw_content` when present, otherwise JSON string.
   - Goal: module-aware view components for core modules (Agency Profile, Communication Style, Quality Standards).

## Manual Verification Checklist (UI)

1) **New user flow**
   - Go to `/agency/ai-setup`
   - Confirm Quick Setup appears when core is incomplete.
   - Run Quick Setup → core modules become Active (after approve+ingest completes).

2) **Manual setup flow**
   - Go to a module → Template → Save Draft → Activate → status becomes Active.

3) **Error recovery flow (default modules only)**
   - Delete one default module’s `ai_documents` row
   - Confirm overview shows “Needs Attention” and module page shows error state
   - Click “Retry Processing” → ingestion health clears after refresh.

4) **Role restriction**
   - Login as member (not admin/owner)
   - Confirm actions are disabled and read-only messaging appears.

5) **Navigation**
   - Old URLs (`/agency/brain/*`) redirect to `/agency/ai-setup/*`.

