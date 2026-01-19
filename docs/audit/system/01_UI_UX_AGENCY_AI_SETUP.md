# 01 — UI/UX: Agency AI Setup (Current Truth)

## Glossary (shared terms)
- **AI Setup (UI)**: the `/agency/ai-setup` experience that manages `brain_documents` modules (evidence: `src/App.tsx:267`, `src/pages/agency/AISetup.tsx:24`).
- **Module**: a `BrainModule` key used in URL `/agency/ai-setup/:moduleKey` and in DB `brain_documents.module` (evidence: `src/App.tsx:268`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:10`).
- **Draft**: `brain_documents.status in ('draft','pending_approval')` shown as “Draft” in UI (evidence: `src/lib/brain/statusTypes.ts:50`, `src/pages/agency/AISetup.tsx:53`).
- **Active**: `brain_documents.status='approved'` and no ingestion health error for the approved modules checked by the UI (evidence: `src/lib/brain/statusTypes.ts:46`, `src/pages/agency/AISetup.tsx:63`).
- **Needs attention**: UI status “error” when module is approved but missing from `ai_documents` ingestion health check (evidence: `src/lib/brain/statusTypes.ts:47`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:1`).
- **Quick Setup**: UI banner that calls `ai-seed-default-brain-pack` with `mode='seed_or_repair'` (evidence: `src/pages/agency/AISetup.tsx:127`, `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).

## Purpose
Document the *current* UI routes, states, and calls involved in Agency AI Setup and Default Brain Pack v1. This audit is about what the UI does today, how it maps to DB state, and where it diverges from backend enforcement.

---

## UI entry points (routes + components)
### Primary navigation entry
- Sidebar item “AI Setup” routes to `/agency/ai-setup` (evidence: `src/components/AppSidebar.tsx:60`).

### Routes
- `/agency/ai-setup` → `AISetup` page (evidence: `src/App.tsx:267`).
- `/agency/ai-setup/:moduleKey` → `ModuleDetail` page (evidence: `src/App.tsx:268`).
- Legacy redirects:
  - `/agency/brain` redirects to `/agency/ai-setup` (evidence: `src/App.tsx:271`).

### Main page: `AISetup`
- Loads documents via `useDocumentsByModule()` (reads `brain_documents`) (evidence: `src/pages/agency/AISetup.tsx:27`, `src/hooks/useBrainDocuments.ts:24`).
- Builds per-module effective doc:
  - latest draft/pending_approval else latest approved (evidence: `src/pages/agency/AISetup.tsx:51`, `src/pages/agency/AISetup.tsx:62`).
- Computes display status via `computeDisplayStatus(document, hasIngestionError)` (evidence: `src/pages/agency/AISetup.tsx:64`, `src/lib/brain/statusTypes.ts:43`).
- Shows Quick Setup banner when core modules not complete:
  - “core modules” hard-coded as `bootstrap`, `rep_policy`, `quality_bar` (evidence: `src/pages/agency/AISetup.tsx:30`).
  - Banner shown when `coreProgress.completed < coreProgress.total` (evidence: `src/pages/agency/AISetup.tsx:127`).

### Module list cards: `ModuleCard`
- Click navigates to module detail: `navigate(/agency/ai-setup/${moduleKey})` (evidence: `src/components/ai-setup/ModuleCard.tsx:28`).
- Action label is derived from UI status (Set up / Fix / View) (evidence: `src/components/ai-setup/ModuleCard.tsx:18`).

### Module detail: `ModuleDetail`
Key UI states:
- `not-started`: shows “Set up {config.name}” and opens `ContentWizard` with initial method template/upload/write (evidence: `src/pages/agency/ModuleDetail.tsx:180`, `src/pages/agency/ModuleDetail.tsx:195`).
- `error`: shows “Your AI can’t use this content” and provides “Retry Processing” which calls seed pack in `ingest_only` mode (evidence: `src/pages/agency/ModuleDetail.tsx:228`, `src/pages/agency/ModuleDetail.tsx:135`).
- `draft` or `active`: shows preview and actions (Activate / Edit / Archive) (evidence: `src/pages/agency/ModuleDetail.tsx:244`, `src/pages/agency/ModuleDetail.tsx:291`).

### Upload and analysis UX
- Upload step accepts `.pdf`, `.docx`, `.md`, `.txt` (evidence: `src/components/ai-setup/ContentWizard/UploadStep.tsx:7`).
- Upload triggers `uploadAndAnalyze({ mode: "transformed" })` (evidence: `src/components/ai-setup/ContentWizard/UploadStep.tsx:59`).
- Upload pipeline:
  1) Upload to storage bucket `brain-documents` with path `${agencyId}/${module}/...` (evidence: `src/hooks/useBrainDocumentUpload.ts:36`, `src/hooks/useBrainDocumentUpload.ts:40`).
  2) Invoke edge function `ai-brain-analyze` (evidence: `src/hooks/useBrainDocumentUpload.ts:60`).
  3) Insert `brain_documents` draft + create `brain_document_versions` version 1 (evidence: `src/hooks/useBrainDocumentUpload.ts:167`, `src/hooks/useBrainDocumentUpload.ts:183`).

---

## Data model (tables + key columns + RLS status)
This UI’s core “source of truth” tables are:
- `public.brain_documents` (module docs) (evidence: `src/hooks/useBrainDocuments.ts:25`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).
- `public.brain_document_versions` (history) (evidence: `src/hooks/useBrainDocuments.ts:112`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:57`).
- `public.ai_documents` for ingestion-health checks (`doc_type='brain_document'`) (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`).
- `public.ai_document_chunks` and `public.ai_embeddings` indirectly (ingestion status and retrieval) (evidence: `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`, `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:71`).

RLS reality that affects UI:
- `brain_documents` insert/update are restricted to agency owner/admin (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:121`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:133`).
- Storage upload policy for `brain-documents` allows `owner/admin/manager` (evidence: `supabase/migrations/20260117160000_brain_documents_storage_bucket.sql:58`).

---

## Backend/API entry points (from the UI)
### `ai-seed-default-brain-pack` (Quick Setup / retry processing)
- Called by Quick Setup banner with `{agency_id, mode:'seed_or_repair'}` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
- Called by “Retry Processing” with `{mode:'ingest_only'}` (evidence: `src/pages/agency/ModuleDetail.tsx:135`).

### `ai-brain-document-approve` (Activate button)
- `useApproveBrainDocument` invokes edge function with `{document_id}` (evidence: `src/hooks/useBrainDocuments.ts:256`).

### `ai-default-brain-pack-ingestion-health` (error state detection)
- UI calls edge function with `{agency_id, approved_modules}` to compute missing ingested modules (evidence: `src/hooks/useDefaultBrainPackIngestionHealth.ts:23`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:16`).

### `ai-brain-analyze` (Upload step)
- UI invokes edge function as part of upload pipeline (evidence: `src/hooks/useBrainDocumentUpload.ts:60`).

---

## Control flow diagram (UI → DB/API) in text
### Flow A: Visit AI Setup
Step 1 → Route `/agency/ai-setup` renders `AISetup` (evidence: `src/App.tsx:267`).
Step 2 → `useDocumentsByModule()` queries `brain_documents` for current `agency_id` and filters out `archived` (evidence: `src/hooks/useBrainDocuments.ts:24`).
Step 3 → UI selects effective doc per module (draft/pending_approval else approved) (evidence: `src/pages/agency/AISetup.tsx:51`).
Step 4 → UI requests ingestion health for approved modules (not just core modules) (evidence: `src/pages/agency/AISetup.tsx:29`, `src/hooks/useDefaultBrainPackIngestionHealth.ts:15`).
Step 5 → UI computes display status:
- no doc → `not-started`
- approved → `active` unless `hasIngestionError`
- draft/pending → `draft` (evidence: `src/lib/brain/statusTypes.ts:43`).

### Flow B: Quick Setup (Default Brain Pack v1)
Step 1 → User clicks “Set Up Core Settings Automatically” (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:83`).
Step 2 → UI calls `ai-seed-default-brain-pack` with `mode='seed_or_repair'` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
Step 3 → Edge function returns document ids + failed ids; UI surfaces success/partial failure steps text (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:32`).
Step 4 → UI invalidates brain-documents queries to refresh state (evidence: `src/hooks/useSeedDefaultBrainPack.ts:29`).

### Flow C: Upload a document to create a draft
Step 1 → User picks file in Content Wizard upload step (evidence: `src/components/ai-setup/ContentWizard/UploadStep.tsx:73`).
Step 2 → UI uploads to storage bucket `brain-documents` (evidence: `src/hooks/useBrainDocumentUpload.ts:40`).
Step 3 → UI calls `ai-brain-analyze` (evidence: `src/hooks/useBrainDocumentUpload.ts:60`).
Step 4 → UI inserts `brain_documents` row with `status='draft'` (evidence: `src/hooks/useBrainDocumentUpload.ts:167`).
Step 5 → UI inserts `brain_document_versions` row version 1 (evidence: `src/hooks/useBrainDocumentUpload.ts:183`).

### Flow D: Activate (approve) a draft
Step 1 → In ModuleDetail, user clicks “Activate” (button is gated by `canApproveContent`) (evidence: `src/pages/agency/ModuleDetail.tsx:291`).
Step 2 → UI invokes `ai-brain-document-approve` with `document_id` (evidence: `src/hooks/useBrainDocuments.ts:256`).
Step 3 → Server approves doc and triggers ingest-to-RAG (see backend audit) (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:61`).
Step 4 → UI refetches brain docs and module status becomes `active` if ingestion succeeded (core) (evidence: `src/hooks/useBrainDocuments.ts:265`, `src/lib/brain/statusTypes.ts:46`).

### Flow E: “Needs Attention” → Retry Processing
Step 1 → ModuleDetail sees `status==='error'` (approved doc but missing in ingestion-health list) (evidence: `src/pages/agency/ModuleDetail.tsx:87`).
Step 2 → User clicks “Retry Processing” → `ai-seed-default-brain-pack` with `mode='ingest_only'` (re-index only 3 default modules) (evidence: `src/pages/agency/ModuleDetail.tsx:135`, `supabase/functions/_shared/seed-default-brain-pack.ts:111`).
Step 3 → If ingestion succeeds, `ai_documents` rows reappear and error clears on next health check (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:78`).

---

## AI behavior (RAG? chunking? embeddings? retrieval?) — YES/NO/UNKNOWN
- **RAG retrieval used by the AI Setup UI itself**: NO. The UI reads/writes `brain_documents` and only checks ingestion health via an edge function (evidence: `src/pages/agency/AISetup.tsx:27`, `src/hooks/useDefaultBrainPackIngestionHealth.ts:23`).
- **Chunking/embeddings for module docs**: YES, but only after approval (ingest is performed server-side during approve/seed flows) (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:62`, `supabase/functions/_shared/brain-documents.ts:618`).
- **File “AI analysis” on upload**: currently NO real AI transform.
  - The edge function contains TODOs and returns placeholder structured outputs (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`, `supabase/functions/ai-brain-analyze/index.ts:167`).

---

## “Source of truth” (what decides UI state)
- **Module effective document**: computed from latest draft/pending/approved ordering in UI (evidence: `src/pages/agency/AISetup.tsx:51`).
- **Display status**:
  - `not-started` when no doc (evidence: `src/lib/brain/statusTypes.ts:44`).
  - `draft` when `brain_documents.status != 'approved'` (evidence: `src/lib/brain/statusTypes.ts:51`).
  - `active` when `status='approved'` and no ingestion error (evidence: `src/lib/brain/statusTypes.ts:47`).
  - `error` when approved but ingestion health indicates the module is missing from RAG (evidence: `src/pages/agency/AISetup.tsx:63`, `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:1`).

---

## Cross-tenant risks + isolation points (UI-facing)
### Isolation points
- UI queries `brain_documents` with an explicit `.eq('agency_id', agencyId)` filter (in addition to RLS) (evidence: `src/hooks/useBrainDocuments.ts:27`).
- Ingestion health endpoint checks membership in `agency_members` before querying `ai_documents` (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:58`).

### Risks / mismatches
- **Role enforcement (aligned)**
  - UI now restricts edit/approve to `owner/admin` to match DB RLS and edge enforcement (evidence: `src/hooks/useRole.ts:75`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:121`).
  - DB RLS requires `owner/admin` to insert/update `brain_documents` and to insert `brain_document_versions` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:121`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:170`).
  - Approve endpoint checks `isAgencyAdminOrOwner` (owner/admin only) (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`).
  - Seed default brain pack endpoint also checks only `owner/admin` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
- **Ingestion health coverage (expanded)**: ingestion health now checks all approved modules passed from the UI, not just 3 defaults (evidence: `src/pages/agency/AISetup.tsx:29`, `src/hooks/useDefaultBrainPackIngestionHealth.ts:1`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- **YES, indirectly via RAG**, not by reading `brain_documents` directly.
- Strategy generation retrieves embeddings with `doc_type='brain_document'` as part of “agency memory” (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `src/ai/ragPolicy.ts:51`).
- Those `brain_document` ai_documents are created by ingestion of approved `brain_documents` (evidence: `supabase/functions/_shared/brain-documents.ts:669`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- **YES** for “Agency AI Setup” module docs once ingested as `doc_type='brain_document'`.
- Storage:
  - `ai_documents` stores the full markdown + metadata (evidence: `supabase/functions/_shared/brain-documents.ts:664`).
  - `ai_document_chunks` stores chunk text + `embedding_status` (evidence: `supabase/functions/_shared/brain-documents.ts:697`, `supabase/migrations/20260105140000_embedding_chunk_status.sql:3`).
  - `ai_embeddings` stores vectors (`vector(1536)`) (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:78`, `supabase/functions/_shared/embedding-store.ts:27`).

### Q11) What is the end goal, and where does current code diverge?
- **End goal (as implied by UI text)**: “Configure how your AI assistant represents your agency” using module content (evidence: `src/pages/agency/AISetup.tsx:113`).
- **Divergences**
  - Upload “AI analysis/transform” is not implemented; it returns placeholders (evidence: `supabase/functions/ai-brain-analyze/index.ts:126`).
  - UI implies admins-only in copy, but UI logic treats managers as approvers/editors while backend enforces owner/admin in critical places (evidence: `src/pages/agency/AISetup.tsx:121`, `src/hooks/useRole.ts:75`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).

---

## Failure modes (top 5) + how they surface
1) **Cannot load AI Setup** → destructive alert + retry button (evidence: `src/pages/agency/AISetup.tsx:95`).
2) **Seed/repair forbidden (non-admin)** → server returns 403 if a non-admin forces the call; UI should disable the CTA when `canEditContent=false` (evidence: `src/hooks/useRole.ts:75`, `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
3) **Approve forbidden (non-admin)** → server returns 403; UI should disable Activate when `canApproveContent=false` (evidence: `src/hooks/useRole.ts:77`, `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`).
4) **Upload bucket missing** → UI logs warning and may proceed without storage; still tries to create `brain_documents` (evidence: `src/hooks/useBrainDocumentUpload.ts:49`).
5) **Approved module not usable by AI (ingestion failed)** → ModuleDetail shows “Your AI can’t use this content” and offers “Retry Processing” (evidence: `src/pages/agency/ModuleDetail.tsx:228`, `src/pages/agency/ModuleDetail.tsx:135`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### UI verification steps
1) Navigate to `/agency/ai-setup` and confirm module cards render (evidence: `src/App.tsx:267`).
2) Click a module card and confirm navigation to `/agency/ai-setup/:moduleKey` (evidence: `src/components/ai-setup/ModuleCard.tsx:28`).
3) Run Quick Setup and confirm request hits `ai-seed-default-brain-pack` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
4) Activate a draft and confirm request hits `ai-brain-document-approve` (evidence: `src/hooks/useBrainDocuments.ts:256`).

### SQL checks (prove UI state → DB state mapping)
```sql
-- Module cards come from these rows (per active agency)
select module, status, updated_at, approved_at
from public.brain_documents
where agency_id = :agency_id
and status <> 'archived'
order by module, updated_at desc;
```

```sql
-- Ingestion health for default modules relies on these ai_documents
select id, metadata
from public.ai_documents
where agency_id = :agency_id
and doc_type = 'brain_document'
and (metadata->>'module') in ('bootstrap','rep_policy','quality_bar');
```

---

## Display status truth table (UI state -> DB + ingest state)
The module card UI status is a function of (a) which `brain_documents` row is selected as “effective” and (b) whether ingestion-health reports a missing module for the approved modules passed from the UI (evidence: `src/pages/agency/AISetup.tsx:51`, `src/pages/agency/AISetup.tsx:64`, `src/hooks/useDefaultBrainPackIngestionHealth.ts:1`).

| UI display status | Required DB state | Required ingest state | Notes / gaps |
|---|---|---|---|
| `not-started` | no effective doc found | n/a | “Effective” is chosen by preferring approved, else draft/pending (evidence: `src/pages/agency/AISetup.tsx:51`). |
| `draft` | `brain_documents.status in ('draft','pending_approval')` | n/a | Approve is server-gated to owner/admin; UI should disable Activate when `canApproveContent=false` (evidence: `src/hooks/useRole.ts:77`, `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`). |
| `active` | `brain_documents.status='approved'` | no ingest error | “Active” does not prove embeddings exist; it only means ingestion-health did not flag this approved module as missing from RAG (evidence: `src/pages/agency/AISetup.tsx:63`). |
| `error` / “Needs attention” | `brain_documents.status='approved'` | ingest missing | Missing is computed by querying `ai_documents` by `metadata->>module` for the approved modules sent by the UI (evidence: `supabase/functions/ai-default-brain-pack-ingestion-health/index.ts:74`). |

---

## Discovery inventory (UI-centric entry points)
This is a reproducible inventory for confirming where the UI triggers backend flows.

### UI triggers (frontend -> edge)
- Quick Setup triggers seeding: `mode="seed_or_repair"` (evidence: `src/components/ai-setup/QuickSetup/QuickSetupBanner.tsx:31`).
- Static agency onboarding triggers background seeding after onboarding finishes (evidence: `src/pages/CreateAgencyStub.tsx:243`, `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`).
- Module approval triggers `ai-brain-document-approve` (evidence: `src/hooks/useBrainDocuments.ts:256`).

### Verification command (inventory only)
```sh
rg -n "ai-seed-default-brain-pack|ai-brain-document-approve|/agency/ai-setup" src
```

---

## Role gating matrix (UI vs backend enforcement)
- UI “approve/edit” flags allow `manager` (evidence: `src/hooks/useRole.ts:75`).
- Backend enforce owner/admin in key flows:
  - Seeding default pack checks `isAgencyAdminOrOwner` (evidence: `supabase/functions/ai-seed-default-brain-pack/index.ts:77`).
  - Approve handler checks `isAgencyAdminOrOwner` (evidence: `supabase/functions/_shared/ai-brain-document-approve-handler.ts:55`).
