# AI Employee Baseline Audit (Repo Snapshot)

Purpose
- Provide an evidence-based GO/NO-GO audit of the current repo baseline against the “AI Employee” vision: 2-level brains, a single usability signal, UNKNOWN safety, tenant boundaries, coherent embeddings/RAG, and usage logging for future tiers.

Scope
- Repo code + migrations in this workspace (no production DB introspection beyond what migrations imply).
- Edge functions under `supabase/functions/` and client gating under `src/pages/ClientDetail.tsx`.

Non-goals
- Implementing fixes or changing behavior.
- Verifying remote Supabase state (local `supabase status/db diff` failed due to Docker not running; see Appendix).

Acceptance criteria
- Report contains: (A) architecture diagram, (B) PASS/FAIL checklist (>=20), (C) top 10 risks with severity and file:line evidence, (D) <=10 required fixes (proposal only), (E) 1 next-step recommendation.
- Required command outputs are recorded in Appendix.

---

## A) Architecture Diagram (Text)

Actors
- Web app (React) authenticated as a Supabase user.
- Supabase Postgres (RLS-enforced).
- Supabase Edge Functions (service-role DB access + OpenAI calls).

Data plane (today)
1) Client app
   - Reads/writes operational tables through Supabase JS client.
   - Invokes edge functions for AI workflows.
2) Brain persistence
   - `agency_brains` and `client_brains` store JSON “brain” versions.
   - Canonical mapping + usable computation happens server-side in `ai-brain-ingest`.
3) Documents → chunks → embeddings
   - `ai-documents-ingest` inserts `ai_documents`, chunks into `ai_document_chunks`, embeds into `ai_embeddings` (real vectors if `OPENAI_API_KEY` present, otherwise a zero-vector placeholder).
4) Retrieval
   - `match_ai_embeddings` SQL RPC returns top-k chunk matches filtered by `agency_id` (and optional `client_id`) and doc types.
5) Generation
   - `ai-ask` performs RAG Q&A with UNKNOWN safety fallback + citations.
   - `ai-strategy-generate` gates on usable and generates a draft with citations; stores draft as a document for future retrieval.
6) Logging
   - New `ai_usage_logs` logs endpoint/model/tokens/latency/unknown.
   - Legacy `ai_history` and `ai_generation_usage` also exist (separate logging streams).

---

## B) PASS/FAIL Checklist (Evidence-Based)

1) 2-level personalization tables exist (`agency_brains`, `client_brains`). PASS
- Created in `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:163` and surrounding.

2) Single “usable” signal exists on `client_brains`. PASS
- Added in `supabase/migrations/20251224090000_brain_spine_v1.sql:3`.

3) Canonical brain contract exists in app code. PASS
- `src/lib/ai/brainContracts.ts:48` defines `ClientBrain` shape + templates.

4) Onboarding captures raw responses and locks v1. PASS
- `src/components/ai/AiOnboardingV2Chat.tsx:334` (Lock v1) calls `ai-brains-*` action `lock`.

5) Server-side ingestion maps raw onboarding → canonical brain and sets usable. PASS
- Mapping + usable set in `supabase/functions/ai-brain-ingest/index.ts:133` (agency mapping) and `supabase/functions/ai-brain-ingest/index.ts:246` + `:251` (usable update).

6) UNKNOWN gate logic exists and is centralized. PASS
- `supabase/functions/_shared/brain-quality.ts:42` computes `usable/missing_fields/questions`.

7) Strategy generation endpoint enforces gate before generation. PASS
- `supabase/functions/ai-strategy-generate/index.ts:95` and `:97` return UNKNOWN if not usable.

8) Retrieval uses a batched RPC with tenant filters. PASS (by SQL body)
- `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:26` filters `where d.agency_id = p_agency_id` and optional `d.client_id`.

9) Edge functions verify user token and agency membership. PASS
- Example: `supabase/functions/ai-ask/index.ts:77`–`:103`, `supabase/functions/ai-strategy-generate/index.ts:55`–`:80`.

10) RLS is enabled for AI tables. PASS
- `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:163`–`:172`.

11) Service-role boundary exists for embeddings access. PASS (policy intent)
- `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:75`–`:78` restricts `ai_embeddings` select to `service_role`.

12) App has a client detail gate on `client_brains.usable`. PASS (code exists)
- Gate UI in `src/pages/ClientDetail.tsx:261`–`:309`.

13) Client detail gate can actually read `client_brains.usable` as a normal user. FAIL (policy mismatch risk)
- UI calls `db.from("client_brains").select("usable, brain_json")` in `src/data/index.ts:182`–`:188`.
- Latest migration restricts select to service role in `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70`–`:73`.

14) AI onboarding UI can read existing brain rows as a normal user. FAIL (policy mismatch risk)
- Onboarding does client-side `.from("client_brains").select(...)` in `src/components/ai/AiOnboardingV2Chat.tsx:167`–`:175`.
- Latest migration restricts select to service role in `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70`–`:73`.

15) Retrieval endpoint exists separate from ai-ask. PASS
- `supabase/functions/ai-retrieve-context/index.ts` calls `match_ai_embeddings` (see `docs/ai/baseline_audit_rg_output.txt`).

16) Strategy generation stores a retrievable artifact. PASS
- `ai-strategy-generate` inserts a `strategy_draft` doc (see `supabase/functions/ai-strategy-generate/index.ts:261` onward; citations derived from `matches`).

17) Citations are included in responses. PARTIAL
- `ai-ask` includes `sources.memory_citations` built from matches in `supabase/functions/ai-ask/index.ts:422`–`:431`.
- `ai-strategy-generate` returns a `citations` array (built from matches) in `supabase/functions/ai-strategy-generate/index.ts:261` onward.
- No enforcement that model output references citations in-text (only returned alongside).

18) Usage logging exists for ingest/ask/retrieve/strategy. PASS
- Functions insert into `ai_usage_logs` (e.g., `supabase/functions/ai-documents-ingest/index.ts:178`, `supabase/functions/ai-ask/index.ts:461`, `supabase/functions/ai-brain-ingest/index.ts:327`).

19) Logging includes enough fields for future tier enforcement. PASS (schema), PARTIAL (consistency)
- Extra columns added in `supabase/migrations/20251224110000_expand_ai_usage_logs.sql:2`–`:5`.
- There is also legacy usage logging in `ai_generation_usage` and `ai_history` (see Risks).

20) pgvector is enabled for embeddings. PASS (migration intent)
- `supabase/migrations/0000_enable_extensions.sql:2`–`:3` enables `"vector"`.

21) RPC execution privileges and safety hardening are explicit. FAIL/UNKNOWN
- `match_ai_embeddings` is created without explicit `REVOKE/GRANT EXECUTE` statements in `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:26`–`:63`.

22) “UNKNOWN” policy is documented. PASS
- `docs/ai/safety_unknown_policy.md` exists (referenced in rg output and repo tabs).

---

## C) Critical Risks (Top 10)

Severity scale: 1 (low) → 5 (critical).

1) ClientDetail gate depends on a table the app may no longer be allowed to read (likely blocks all client workspaces). Severity 5
- Gate fetch: `src/data/index.ts:182`–`:188` selects from `client_brains`.
- RLS select policy replaced to service-role only: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70`–`:73`.
- Impact: `client_brains.usable` becomes unreadable for authenticated app users → gate likely always fails/throws → hard block.

2) Onboarding v2 UI may be broken for the same reason (cannot load existing brain rows). Severity 5
- Client-side select of `client_brains`: `src/components/ai/AiOnboardingV2Chat.tsx:167`–`:175`.
- Policy replacement: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70`–`:73`.
- Impact: onboarding cannot resume or read prior answers safely; UX regressions and inability to “Lock v1”.

3) No tenant-safe “derived status” surface for the app (usable + missing fields) despite needing it for gating and UX. Severity 5
- Gate UI expects missing fields count: `src/pages/ClientDetail.tsx:263`–`:279`.
- Missing safe read path is noted as a TODO in `docs/ai/spec_gaps.md` (see TODO #8).

4) Multiple AI logging systems exist (risk of inconsistent enforcement and analytics). Severity 3
- Legacy tables: `ai_history` (`supabase/migrations/20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql:2`) and `ai_generation_usage` (`supabase/migrations/20251124133649_334878d3-6f11-41c7-ac57-53e7e85a4c1b.sql:6`).
- New logging: `ai_runs` and `ai_usage_logs` (`supabase/migrations/20251224090000_brain_spine_v1.sql:16`).

5) `match_ai_embeddings` privileges and execution surface are not explicitly constrained. Severity 3
- Function created without explicit grants in `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:26`–`:63`.
- RLS likely prevents leakage, but lack of explicit EXECUTE policy is a footgun (future changes could accidentally expose).

6) Embeddings may silently degrade to zero vectors without OPENAI key, impacting retrieval quality and safety. Severity 3
- Fallback to zero vector: `supabase/functions/ai-documents-ingest/index.ts:134`–`:170` and `supabase/functions/ai-brain-ingest/index.ts:285`–`:321`.
- Impact: retrieval becomes effectively random/low-signal; UNKNOWN policy helps, but UX will feel “broken”.

7) Strategy generation uses `OPENAI_API_KEY` for chat completions as well as embeddings (naming confusion; operational risk). Severity 2
- `ai-strategy-generate` uses `embeddingApiKey` for chat: `supabase/functions/ai-strategy-generate/index.ts:120`–`:226`.

8) Legacy `generate-ai-content` does not clearly follow UNKNOWN+citation constraints. Severity 3
- Prompts are not “context-only”; no citations; different quota model: `supabase/functions/generate-ai-content/index.ts:173`–`:219`.

9) Local audit limitations: cannot verify actual DB/RLS state without Docker / remote introspection. Severity 2
- `supabase status` and `supabase db diff` fail (Appendix).

10) Gate depends on `brain_json` containing `missing_fields`, but that is not part of the canonical contract (mixed concerns). Severity 2
- Gate reads `(data?.brain_json)?.missing_fields` in `src/data/index.ts:192`–`:194`.
- Canonical contract is defined in `src/lib/ai/brainContracts.ts:48` and does not define `missing_fields` (implied to be a runtime evaluation output).

---

## D) Required Fixes Before Proceeding (Proposals Only)

1) Add a tenant-safe “client brain status” surface for app users (usable + missing field count).  
- What: create an RPC (preferred) or view that returns `{client_id, usable, missing_fields}` scoped to the caller’s agency membership; do not expose full `brain_json`.
- Files: new migration under `supabase/migrations/` + update `src/data/index.ts` to call it (proposal only; do not implement in this audit).
- Acceptance test: authenticated app user can load ClientDetail gate status without errors; cannot read other agency’s client brain status.

2) Update onboarding v2 to avoid direct `client_brains/agency_brains` selects from the client.  
- What: use edge functions only (e.g., `ai-brains-*`) to fetch/init brain state; keep `brain_json` access server-side.
- Files: `src/components/ai/AiOnboardingV2Chat.tsx` + `supabase/functions/ai-brains-*` (proposal only).
- Acceptance test: onboarding can resume answers and lock without direct table reads.

3) Decide and document the intended RLS posture for brains (service-only vs tenant-readable).  
- What: either (a) keep service-only for full brains + expose derived safe fields via RPC, or (b) allow authenticated select with strict column projection patterns (harder).
- Files: `supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql` and related policies.
- Acceptance test: security review confirms no sensitive brain JSON leaks to non-service role.

4) Explicitly constrain EXECUTE permissions for `match_ai_embeddings`.  
- What: `REVOKE ALL ON FUNCTION ... FROM public, authenticated; GRANT EXECUTE TO service_role` (or a dedicated role used by functions).
- Files: migration that amends privileges for `public.match_ai_embeddings`.
- Acceptance test: calling the RPC from the client (authenticated) fails; calling from edge function works.

5) Consolidate and standardize AI logging sources.  
- What: choose `ai_usage_logs` as the canonical usage log and document how legacy tables map; avoid double-counting.
- Files: docs (`docs/ai/*`) + optional deprecation plan (no destructive changes in this step).
- Acceptance test: one query answers “how many AI calls by agency/client per period”.

6) Add explicit “citations required” enforcement at the response layer.  
- What: if context is used, require citations array non-empty; otherwise return UNKNOWN.
- Files: `supabase/functions/ai-ask/index.ts`, `supabase/functions/ai-strategy-generate/index.ts` (proposal only).
- Acceptance test: strategy draft response includes citations and returns UNKNOWN when matches are empty.

---

## E) Next Step Recommendation (Pick 1)

Implement a tenant-safe RPC/view for `client_brains.usable` (+ optional `missing_fields` count) and migrate ClientDetail + onboarding to use it, while keeping full brain JSON service-role only.

---

## Appendix: Required Command Outputs

### Repo status snapshot
- Branch + status + last commits were captured via:
  - `git branch --show-current`
  - `git status -sb`
  - `git log --oneline --decorate -n 10`

### `supabase status`
Output:
```
failed to inspect container health: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/supabase_db_dzyhrzdwwuaorruscxcn/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Try rerunning the command with --debug to troubleshoot the error.
```

### `supabase db diff`
Output:
```
Creating shadow database...
failed to inspect docker image: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/public.ecr.aws/supabase/postgres:17.6.1.054/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Docker Desktop is a prerequisite for local development. Follow the official docs to install: https://docs.docker.com/desktop
```

### `ls supabase/migrations | tail` (PowerShell equivalent)
Output (last 10):
```
20251221113315_missing_references.sql
20251221120714_client_portal_access.sql
20251221122409_delete_portal_user.sql
20251221131145_team_invite_hardening.sql
20251221140000_invite_email_logs.sql
20251222090000_restore_client_member_access.sql
20251223150000_ai_employee_v1_sprint1.sql
20251224090000_brain_spine_v1.sql
20251224103000_strategy_docs_and_embeddings.sql
20251224110000_expand_ai_usage_logs.sql
```

### `rg -n "client_brains|agency_brains|embedding|pgvector|UNKNOWN|usage" .`
- Full output saved to `docs/ai/baseline_audit_rg_output.txt`.
- First 40 lines were printed during the audit run (see terminal output / file).

---

BASELINE: NO-GO — the repo’s latest migrations appear to make `client_brains`/`agency_brains` select service-role only, but the client UI still reads these tables directly for onboarding and gating, which can hard-break core workflows until a tenant-safe derived status surface is added.
