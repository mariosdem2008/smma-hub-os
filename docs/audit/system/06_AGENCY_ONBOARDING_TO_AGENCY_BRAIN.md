# 06 — Agency Onboarding → Agency Brain (Current Truth)

## Glossary (shared terms)
- **Static agency onboarding (wizard)**: `/create-agency` flow implemented in `CreateAgencyStub` that writes `agency_onboarding_sessions.answers_json` (evidence: `src/App.tsx:242`, `src/pages/CreateAgencyStub.tsx:140`).
- **Guided agency onboarding (admin chat)**: `/ai/admin?mode=guided_onboarding` bootstraps a “setup” thread and chats via `ai-agency-admin-chat` (evidence: `src/App.tsx:273`, `src/pages/ai/AgencyAiAdmin.tsx:762`).
- **Agency Brain (JSON)**: `agency_brains.brain_json` updated via `ai-brains-agency` and by admin chat orchestration (evidence: `supabase/functions/ai-brains-agency/index.ts:80`, `supabase/functions/_shared/agency-admin-chat.ts:167`).
- **Calibration state**: `agency_brains.calibration_state` used by server-side idempotency state machine (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`, `supabase/functions/_shared/calibration-state.ts:73`).
- **Agency AI Setup modules (brain_documents)**: separate from `agency_brains`; these are the modular docs shown in `/agency/ai-setup` (evidence: `src/pages/agency/AISetup.tsx:10`, `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:39`).

## Purpose
Explain how agency onboarding data is captured today, where it is stored, how it becomes “Agency Brain” context (both the monolithic JSON and derived RAG artifacts), and how it does (or does not) connect to the Agency AI Setup module docs.

---

## Data model (tables + key columns + RLS status)
### `public.agency_onboarding_sessions`
- Stores wizard answers and progress for static onboarding (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:4`).
- Key columns: `agency_id`, `user_id`, `brain_id`, `step_id`, `answers_json`, `completed` (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:6`).
- RLS: members can select; insert requires `user_id=auth.uid()`; update by membership (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:24`).

### `public.agency_brains`
- Stores agency brain JSON + lock state (evidence: `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7`).
- Calibration state is a JSONB column added later (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`).

### `public.agency_ai_chat_threads` / `public.agency_ai_chat_messages`
- Used by `ai-agency-admin-chat` to persist “setup” and “general” chat sessions (evidence: `supabase/functions/_shared/agency-admin-chat.ts:98`, `supabase/functions/_shared/agency-admin-chat.ts:64`).
- **RLS status**: UNKNOWN in this audit (not located yet in migrations).
  - How to verify: `rg -n "agency_ai_chat_threads" supabase/migrations` and inspect policies.

### RAG artifacts from agency onboarding
- `ai_documents` + chunks + embeddings are created by `ai-brain-ingest` (agency scope) as `doc_type='ai_artifact'` titled “Agency brain summary” (evidence: `supabase/functions/ai-brain-ingest/index.ts:221`).

---

## UI entry points (routes + components)
### Static onboarding wizard
- Route `/create-agency` renders `CreateAgencyStub` (protected) (evidence: `src/App.tsx:242`).
- Creates agency via DB RPC `create_agency_with_admin(...)` (evidence: `src/pages/CreateAgencyStub.tsx:161`, `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:61`).
- Persists onboarding session progress via upsert to `agency_onboarding_sessions` (evidence: `src/pages/CreateAgencyStub.tsx:140`).

### “Finish AI Setup” CTA on Dashboard
- Dashboard computes `aiSetupComplete` from approved core modules in `brain_documents` (bootstrap + rep_policy + quality_bar) (evidence: `src/pages/Dashboard.tsx:85`, `src/pages/Dashboard.tsx:181`).
- CTA appears only for admins and only when `aiSetupComplete === false` (evidence: `src/components/PostCreateAgencyCta.tsx:23`).
- CTA navigates to `/agency/ai-setup` (evidence: `src/components/PostCreateAgencyCta.tsx:33`).

### Guided onboarding (Agency Admin Chat UI)
- Route `/ai/admin` renders `AgencyAiAdmin` (evidence: `src/App.tsx:273`).
- When query `mode=guided_onboarding` is present, UI ensures a “setup” thread exists then removes the query param (evidence: `src/pages/ai/AgencyAiAdmin.tsx:762`).
- Chat requests are sent to `ai-agency-admin-chat` via:
  - Supabase functions invoke (non-streaming) (evidence: `src/pages/ai/AgencyAiAdmin.tsx:627`).
  - SSE streaming fetch to `/functions/v1/ai-agency-admin-chat?stream=1` (evidence: `src/pages/ai/AgencyAiAdmin.tsx:645`).

---

## Backend/API entry points (edge + RPC)
### Create agency RPC: `public.create_agency_with_admin(...)`
- Creates/reuses an agency for the authenticated user and ensures `agency_members` has an admin row (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:82`, `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:100`).

### Agency brain CRUD: `ai-brains-agency`
Used by the wizard:
- `action='create'` inserts `agency_brains` version 1 if missing (evidence: `src/pages/CreateAgencyStub.tsx:177`, `supabase/functions/ai-brains-agency/index.ts:80`).
- `action='update'` updates `brain_json` (evidence: `src/pages/CreateAgencyStub.tsx:217`, `supabase/functions/ai-brains-agency/index.ts:106`).
- `action='lock'` sets `status='locked'` and `locked=true` (evidence: `src/pages/CreateAgencyStub.tsx:224`, `supabase/functions/ai-brains-agency/index.ts:134`).

### Agency brain ingest: `ai-brain-ingest` (scope='agency')
Used by the wizard on finish:
- Called with `scope='agency'` and `raw_responses=answers` (evidence: `src/pages/CreateAgencyStub.tsx:229`, `supabase/functions/ai-brain-ingest/index.ts:121`).
- Updates `agency_brains.brain_json` to a derived structure containing `identity`, `icp`, `voice_tone`, etc (evidence: `supabase/functions/ai-brain-ingest/index.ts:163`).
- Creates an `ai_documents` row titled “Agency brain summary” and embeds it as `doc_type='ai_artifact'` (evidence: `supabase/functions/ai-brain-ingest/index.ts:221`, `supabase/functions/ai-brain-ingest/index.ts:242`).

### Guided onboarding: `ai-agency-admin-chat`
Edge wrapper:
- Validates JWT `Authorization` and then calls shared handler `handleAgencyAdminChat` or `handleAgencyAdminChatStream` (evidence: `supabase/functions/ai-agency-admin-chat/index.ts:59`, `supabase/functions/ai-agency-admin-chat/index.ts:80`).
Shared handler dispatch:
- If thread kind inferred “setup”, delegates to `handleAgencyAdminSetup(...)` (evidence: `supabase/functions/_shared/agency-admin-chat.ts:301`).
Setup orchestrator:
- Uses calibration state machine to avoid duplicate questions (evidence: `supabase/functions/_shared/agency-admin-setup.ts:1031`, `supabase/functions/_shared/calibration-state.ts:73`).
- Persists updates into `agency_brains.brain_json` via `upsertAgencyBrain(...)` (evidence: `supabase/functions/_shared/agency-admin-setup.ts:966`).

---

## Control flow diagrams (two onboarding paths)
### Flow A: Static onboarding wizard → agency_brains → ai_artifact summary → default brain pack auto-seed
Step 1 → User visits `/create-agency` (evidence: `src/App.tsx:242`).
Step 2 → UI calls `create_agency_with_admin(name, website)` (evidence: `src/pages/CreateAgencyStub.tsx:161`).
Step 3 → UI creates an `agency_brains` v1 draft via `ai-brains-agency action=create` (evidence: `src/pages/CreateAgencyStub.tsx:177`).
Step 4 → UI upserts `agency_onboarding_sessions` with `answers_json` as user progresses (evidence: `src/pages/CreateAgencyStub.tsx:140`).
Step 5 → On finish:
  - UI updates + locks the agency brain via `ai-brains-agency` (evidence: `src/pages/CreateAgencyStub.tsx:217`, `src/pages/CreateAgencyStub.tsx:224`).
  - UI calls `ai-brain-ingest scope=agency` to derive `agency_brains.brain_json` and write an `ai_artifact` summary (evidence: `src/pages/CreateAgencyStub.tsx:229`, `supabase/functions/ai-brain-ingest/index.ts:221`).
Step 6 → UI triggers `autoSeedDefaultBrainPackV1InBackground` which calls `ai-seed-default-brain-pack` (evidence: `src/pages/CreateAgencyStub.tsx:243`, `src/lib/brain/autoSeedDefaultBrainPackV1.ts:18`).

### Flow B: Dashboard CTA → AI Setup modules UI (`/agency/ai-setup`)
Step 1 → Dashboard checks `brain_documents` core-module approval state and computes `aiSetupComplete` (evidence: `src/pages/Dashboard.tsx:181`).
Step 2 → If admin and `aiSetupComplete===false`, show CTA (evidence: `src/components/PostCreateAgencyCta.tsx:23`).
Step 3 → CTA navigates to `/agency/ai-setup` where the modular brain system lives (evidence: `src/components/PostCreateAgencyCta.tsx:33`, `src/pages/agency/AISetup.tsx:10`).

### Flow C: Guided onboarding (admin chat) → agency_brains + calibration_state (direct route)
Step 1 → User visits `/ai/admin?mode=guided_onboarding` (evidence: `src/App.tsx:273`).
Step 2 → `AgencyAiAdmin` ensures a setup thread and calls `ai-agency-admin-chat` (evidence: `src/pages/ai/AgencyAiAdmin.tsx:762`, `src/pages/ai/AgencyAiAdmin.tsx:627`).
Step 3 → Server setup handler:
  - Initializes/resumes calibration session (reads/writes `agency_brains.calibration_state`) (evidence: `supabase/functions/_shared/agency-admin-setup.ts:1035`, `supabase/functions/_shared/calibration-state.ts:77`).
  - Writes patches into `agency_brains.brain_json` (evidence: `supabase/functions/_shared/agency-admin-setup.ts:966`).

---

## AI behavior — YES/NO/UNKNOWN
- Static onboarding wizard itself: NO AI; it’s a form-like flow implemented in React (evidence: `src/pages/CreateAgencyStub.tsx:149`).
- Guided onboarding chat: YES AI (admin chat orchestration calls AI router / general chat AI; exact prompts are outside this audit scope) (evidence: `supabase/functions/_shared/agency-admin-chat.ts:175`, `supabase/functions/_shared/agency-admin-setup.ts:1`).
- Agency brain ingest: uses embeddings + chunks for summaries (YES) (evidence: `supabase/functions/ai-brain-ingest/index.ts:236`).

---

## “Source of truth” (what decides onboarding/setup status)
### Static onboarding wizard completion
- `agency_onboarding_sessions.completed` and `completed_at` exist, but Dashboard “AI setup complete” is computed from `brain_documents` core-module approval state, not from `completed` (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:11`, `src/pages/Dashboard.tsx:85`).
- Dashboard “AI Setup complete” logic:
  - core AI Setup modules in `brain_documents` must be `approved` (bootstrap, rep_policy, quality_bar)
  - (evidence: `src/pages/Dashboard.tsx:85`).

### Guided onboarding progress
- Server-side idempotency/progress is stored in `agency_brains.calibration_state` (evidence: `supabase/migrations/20251228174120_brain_documents_and_calibration_state.sql:407`, `supabase/functions/_shared/calibration-state.ts:165`).

---

## Cross-tenant risks and isolation enforcement
- Wizard DB writes use standard Supabase client; RLS applies (evidence: `src/pages/CreateAgencyStub.tsx:140`).
- Edge functions use service role and must enforce membership:
  - `ai-brains-agency` checks membership (evidence: `supabase/functions/ai-brains-agency/index.ts:57`).
  - `ai-brain-ingest` checks membership (evidence: `supabase/functions/ai-brain-ingest/index.ts:130`).
  - `ai-agency-admin-chat` checks user and then checks admin membership server-side (evidence: `supabase/functions/_shared/agency-admin-chat.ts:296`).

---

## Explicit answers required by the mission
### Q9) Does Agency AI Setup impact client strategy generation? Where exactly?
- The “Agency onboarding → agency_brains.brain_json” path impacts strategy generation because `ai-strategy-generate` loads `agency_brains.brain_json` (evidence: `supabase/functions/ai-strategy-generate/index.ts:200`).
- The “Agency AI Setup modules → brain_documents” path impacts strategy generation only after ingestion as `brain_document` RAG chunks (evidence: `supabase/functions/ai-strategy-generate/index.ts:271`, `supabase/functions/_shared/brain-documents.ts:669`).

### Q10) Are Agency Brain docs embedded and used as RAG? Which tables store chunks/embeddings?
- “Agency AI Setup” module docs (`brain_documents`) are embedded after ingest into:
  - `ai_documents` (doc_type `brain_document`) (evidence: `supabase/functions/_shared/brain-documents.ts:669`),
  - `ai_document_chunks` and `ai_embeddings` (evidence: `supabase/functions/_shared/brain-documents.ts:697`).

### Q11) What is the end goal, and where does current code diverge?
- The product surface implies “Finish AI Setup” unlocks AI outputs (evidence: `src/components/PostCreateAgencyCta.tsx:30`).
- Divergence: Dashboard “aiSetupComplete” is based on static onboarding answers (`agency_onboarding_sessions.answers_json`) and does not directly reflect whether:
  - the agency_brain is locked/ingested, or
  - the AI Setup module docs are created/approved/ingested
  (evidence: `src/pages/Dashboard.tsx:183`, `src/pages/CreateAgencyStub.tsx:229`, `src/pages/agency/AISetup.tsx:27`).

---

## Failure modes (top 5) + how they surface
1) **Agency creation RPC fails** → toast “Failed to create agency” (evidence: `src/pages/CreateAgencyStub.tsx:187`).
2) **Cannot persist onboarding session** → wizard save errors (toast) (evidence: `src/pages/CreateAgencyStub.tsx:143`).
3) **ai-brain-ingest fails** → wizard shows “Failed to complete onboarding” toast (evidence: `src/pages/CreateAgencyStub.tsx:266`).
4) **AI admin chat fails** → UI appends assistant message “UNKNOWN … Please try again.” (evidence: `src/pages/ai/AgencyAiAdmin.tsx:604`).
5) **Defaults auto-seed fails** → non-blocking toast “Defaults can be created later” (evidence: `src/pages/CreateAgencyStub.tsx:247`).

---

## Verification checklist (commands + SQL)
### Repo commands (required by request)
- `npm test`
- `npm run lint`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

### SQL checks (static onboarding wizard)
```sql
-- Agency onboarding session exists and stores answers
select agency_id, step_id, completed, completed_at, answers_json
from public.agency_onboarding_sessions
where agency_id = :agency_id;
```

### SQL checks (agency brain exists + calibration_state)
```sql
select id, agency_id, version, status, locked, calibration_state, updated_at
from public.agency_brains
where agency_id = :agency_id
order by version desc
limit 3;
```

### SQL checks (agency brain summary artifact ingestion)
```sql
select id, doc_type, title, source, metadata, created_at
from public.ai_documents
where agency_id = :agency_id
and client_id is null
and doc_type = 'ai_artifact'
and title = 'Agency brain summary'
order by created_at desc
limit 10;
```

---

## How Agency onboarding and Agency AI Setup coexist (two “brain systems”)
This repo currently maintains two parallel “sources of agency truth,” and they converge only indirectly.

### System A: Monolithic Agency Brain (JSON)
- Static onboarding stores raw answers in `agency_onboarding_sessions.answers_json` (evidence: `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql:6`).
- The wizard maps answers into `agency_brains.brain_json` and locks it (evidence: `src/pages/CreateAgencyStub.tsx:215`, `src/pages/CreateAgencyStub.tsx:224`).
- Strategy generation loads `agency_brains` at runtime (evidence: `supabase/functions/ai-strategy-generate/index.ts:200`).

### System B: Modular Agency AI Setup docs (brain_documents)
- Default Brain Pack v1 can auto-create core `brain_documents` after onboarding finishes (evidence: `src/pages/CreateAgencyStub.tsx:243`).
- Users can also create/edit module docs directly in `/agency/ai-setup` (evidence: `src/App.tsx:267`).
- Strategy generation does not read `brain_documents` directly; it reads the ingested RAG copy in `ai_documents` (evidence: `supabase/functions/ai-strategy-generate/index.ts:274`).

### Convergence path (what actually connects them)
- Convergence happens via RAG ingestion:
  - `brain_documents` -> `ai_documents/doc_type='brain_document'` -> retrieval via `match_ai_embeddings` -> prompt context (evidence: `supabase/functions/_shared/brain-documents.ts:669`, `supabase/functions/ai-strategy-generate/index.ts:271`).
- The Agency Brain JSON is used as structured context without retrieval (evidence: `supabase/functions/ai-strategy-generate/index.ts:200`).

---

## Discovery inventory (agency onboarding + brain)
```sh
rg -n "agency_onboarding_sessions|create_agency_with_admin|ai-brains-agency|ai-brain-ingest|guided_onboarding" src supabase -S
```

---

## Additional verification SQL (tie onboarding -> brain -> default modules)
```sql
-- 1) Onboarding session (raw answers)
select agency_id, user_id, completed, completed_at, answers_json
from public.agency_onboarding_sessions
where agency_id = :agency_id;
```

```sql
-- 2) Agency brain row loaded by strategy generation
select agency_id, status, locked, calibration_state, updated_at
from public.agency_brains
where agency_id = :agency_id
order by version desc
limit 1;
```

```sql
-- 3) Core AI Setup modules (created by auto-seed or later)
select module, status, approved_at, updated_at
from public.brain_documents
where agency_id = :agency_id
and module in ('bootstrap','rep_policy','quality_bar')
order by module;
```
