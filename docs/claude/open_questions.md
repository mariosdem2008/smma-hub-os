# Open Questions (Need Clarification)

**Generated:** 2025-12-24
**Status:** Evidence gaps and ambiguities requiring product/engineering decisions

---

## 1. Onboarding Resume Flow Architecture

**Question:** Does AiOnboardingV2Chat currently support resuming draft brains, and if so, which code path handles it?

**Evidence:**
- Audit flagged potential direct reads: docs/ai/baseline_audit.md:90-91
- Component exists: src/components/ai/AiOnboardingV2Chat.tsx
- Migration restricts access: supabase/migrations/20251224103000_strategy_docs_and_embeddings.sql:70-73

**Why It Matters:**
If resume flow exists and uses direct `.from("client_brains").select(...)`, it's broken post-migration. If it doesn't exist, we can safely defer implementing it.

**Required Clarification:**
1. Is "resume onboarding" a required v1 feature? (User starts onboarding, navigates away, returns later)
2. If yes, what is the expected UX? (Show prior answers? Start fresh?)
3. Should locked brains be editable (create v2 draft) or read-only?

**Recommended Action:**
- Manual test: Start onboarding, save 2 answers, navigate away, return → does it resume?
- Code audit: Search AiOnboardingV2Chat.tsx for brain read logic

---

## 2. Agency Brain Usable Flag (Missing)

**Question:** Should `agency_brains` have a `usable` flag like `client_brains`, or is every locked agency brain assumed usable?

**Evidence:**
- client_brains has usable: supabase/migrations/20251224090000_brain_spine_v1.sql:3-4
- agency_brains schema: supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:7-18
- No usable column for agency_brains
- ai-strategy-generate only gates on client_brains.usable: supabase/functions/ai-strategy-generate/index.ts:97

**Why It Matters:**
If agency brain is incomplete (missing voice/tone or strategy defaults), client strategy generation may produce generic/low-quality output. Unclear if this is acceptable or should be gated.

**Required Clarification:**
1. Can client strategy be generated with an incomplete agency brain?
2. If no, define required fields for agency brain usability (analogous to client brain)
3. If yes, document that agency brain is "best effort" and incompleteness degrades quality but doesn't block

**Recommended Action:**
- Document decision in docs/ai/brain_spine_v1_contract.md
- If agency usable required, add migration to add column + update ai-brain-ingest logic

---

## 3. Platforms Field Target in Client Brain Mapping

**Question:** Onboarding question "platforms" should map to which canonical brain field?

**Evidence:**
- Mapping spec: docs/ai/brain_spine_v1_contract.md:156
- TODO comment: "TODO: confirm target field"
- Client brain schema: docs/ai/brain_spine_v1_contract.md:53-102
- No obvious `platforms` field in canonical schema

**Why It Matters:**
Raw onboarding response for platforms is captured but not mapped to canonical schema, causing data loss.

**Required Clarification:**
1. Should platforms be stored in `assets_links.key_urls` (current assumption)?
2. Or add new top-level field `platforms: string[]`?
3. Or is this metadata not needed for strategy generation?

**Recommended Action:**
- Confirm with product owner where platforms data is used (strategy generation? reporting?)
- Update canonical schema + mapping logic in ai-brain-ingest

---

## 4. ai_runs vs ai_usage_logs Ownership

**Question:** When should edge functions log to `ai_runs` vs `ai_usage_logs`?

**Evidence:**
- Both tables exist: supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:16-24, :97-115
- ai_usage_logs is simpler (endpoint, model, tokens_estimate, latency_ms, unknown, cost_usd)
- ai_runs is detailed (prompt_id, tokens_in/out, citations, escalate_to_human)
- Current usage: ai-ask logs to ai_usage_logs (supabase/functions/ai-ask/index.ts:461-470)

**Why It Matters:**
Unclear which table is canonical for tier enforcement. If both are used, risk of drift or double-counting.

**Required Clarification:**
1. Is ai_runs intended for detailed audit trail only (not tier enforcement)?
2. Should all endpoints log to BOTH tables, or only ai_usage_logs?
3. If both, define which fields overlap and which are unique to each table

**Recommended Action:**
- Document in docs/ai/logging_contract.md (covered in next_3_steps.md Step 3)
- Update all edge functions to follow consistent logging pattern

---

## 5. Strategy Draft Retrieval and Versioning

**Question:** When a new strategy draft is generated, should previous drafts be deleted or versioned?

**Evidence:**
- ai-strategy-generate stores draft as doc_type=strategy_draft: supabase/functions/ai-strategy-generate/index.ts:261-285
- No explicit delete or version check before insert
- ai_documents schema has no version field

**Why It Matters:**
If multiple drafts exist for same client, RAG retrieval may pull outdated strategy context, polluting future generation.

**Required Clarification:**
1. Should each client have only 1 active strategy_draft (delete old on new generation)?
2. Or version them (add version field to ai_documents)?
3. Or keep all and filter retrieval by recency (current implicit behavior)?

**Recommended Action:**
- Define strategy draft lifecycle (1 active vs versioned history)
- Update ai-strategy-generate to delete old drafts or add version metadata
- Update match_ai_embeddings filters if needed

---

## 6. Client Portal Ask Scope and Escalation Rules

**Question:** What types of questions are in-scope vs out-of-scope for client portal AI ask?

**Evidence:**
- ai-ask endpoint supports client_id: supabase/functions/ai-ask/index.ts:87
- UNKNOWN policy mentions escalation: docs/ai/spec_v1.md:12, :56
- No explicit escalation logic in ai-ask (only escalate_to_human flag returned)

**Why It Matters:**
Client portal users may ask billing questions, feature requests, or complaints that are out of scope for RAG-based answering. Unclear when to auto-escalate vs return UNKNOWN with questions.

**Required Clarification:**
1. What categories of questions should auto-escalate? (billing, support, complaints, feature requests)
2. Should escalation be model-driven (LLM detects intent) or rule-based (keyword matching)?
3. Where do escalations go? (ai_escalations table? email? Slack?)

**Recommended Action:**
- Define client portal question taxonomy (in-scope vs out-of-scope)
- Implement escalation detection in ai-ask
- Wire ai_escalations table to notification system

---

## 7. Brain Field Confidence Scores

**Question:** What does the `confidence` integer field on agency_brains and client_brains represent, and how is it computed?

**Evidence:**
- Schema: supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:15, :29
- Default value: 0
- No computation logic found in ai-brain-ingest or ai-brains-* functions
- Spec mentions "confidence" in review UI: docs/ai/spec_v1.md:138

**Why It Matters:**
If confidence is meant to signal quality/completeness of brain data, it should be computed and displayed in UI. If it's unused, it's clutter.

**Required Clarification:**
1. Is confidence a placeholder for future answer quality scoring?
2. Or should it be computed now (e.g., % of optional fields filled)?
3. Should it be shown in UI onboarding review step?

**Recommended Action:**
- If unused: document as "reserved for future" in schema comments
- If needed now: define computation rules and update ai-brain-ingest

---

## 8. Zero Vector Embeddings in Production Data

**Question:** If zero vectors were inserted before error handling was added, how should they be cleaned up?

**Evidence:**
- Zero vector fallback existed: supabase/functions/ai-documents-ingest/index.ts:134-170 (before fix)
- Fragility documented: docs/claude/repo_map.md (Fragility #6)

**Why It Matters:**
Existing zero vectors in production ai_embeddings table will pollute retrieval results (all scores equal).

**Required Clarification:**
1. Are there production embeddings with zero vectors currently?
2. If yes, should they be re-embedded or deleted?
3. How to detect zero vectors in SQL? (Query: `WHERE embedding = ARRAY[0,0,...]`)

**Recommended Action:**
- Query production for zero vectors: `SELECT COUNT(*) FROM ai_embeddings WHERE embedding::text = '[0,0,...]'::text`
- If found, create backfill script to re-embed or mark documents for re-ingestion

---

## 9. Brain JSON Schema Validation

**Question:** Should brain_json be validated against JSON schemas on insert/update, or is validation only in application logic?

**Evidence:**
- Canonical schemas exist: docs/ai/brain_spine_v1_contract.md:3-102
- No JSON schema constraints in DB (brain_json is just JSONB)
- Validation happens in shared/brain-quality.ts: supabase/functions/_shared/brain-quality.ts:42-57

**Why It Matters:**
Without DB-level validation, malformed brain_json can be inserted (missing required keys, wrong types), causing runtime errors in get_client_brain_status RPC.

**Required Clarification:**
1. Should DB enforce JSON schema constraints (CHECK constraint + jsonschema)?
2. Or trust application-level validation only (edge functions)?
3. If DB validation, how to handle schema evolution (migrations)?

**Recommended Action:**
- Document validation layer (app-only vs DB-enforced) in docs/ai/brain_spine_v1_contract.md
- If DB validation desired, create CHECK constraint migration

---

## 10. Multi-Tenancy Test Coverage

**Question:** Are there automated tests verifying tenant isolation for brains, embeddings, and vector search?

**Evidence:**
- RLS policies exist: supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql:163-200
- get_client_brain_status RPC validates membership: supabase/migrations/20251224121500_get_client_brain_status_rpc.sql:29-37
- No tenant isolation tests found in src/**/__tests__/ or audit-pack/

**Why It Matters:**
Critical security boundary (agency A cannot read agency B's brains or embeddings). Manual testing is insufficient for production.

**Required Clarification:**
1. Do tenant isolation tests exist elsewhere (Supabase test suite)?
2. If not, which layer should own these tests (DB unit tests vs edge function integration tests)?
3. Should these be part of CI?

**Recommended Action:**
- Create tenant isolation test suite:
  - Test 1: User in agency A calls get_client_brain_status for agency B's client → expect 403
  - Test 2: Edge function with agency A token calls match_ai_embeddings with agency B's id → expect zero results
  - Test 3: User in agency A attempts direct .from("client_brains").select() for agency B → expect RLS block
- Add to CI pipeline

---

## Summary

**High Priority (Blocking v1 Production):**
1. Onboarding resume flow architecture (#1)
2. Zero vector cleanup in production (#8)
3. Multi-tenancy test coverage (#10)

**Medium Priority (Document Now, Implement Later):**
4. Agency brain usable flag (#2)
5. Platforms field mapping (#3)
6. ai_runs vs ai_usage_logs ownership (#4)
7. Strategy draft versioning (#5)

**Low Priority (Future Features):**
8. Client portal escalation rules (#6)
9. Brain confidence computation (#7)
10. Brain JSON schema validation (#9)

**Recommended Next Action:**
Before implementing next_3_steps.md, address High Priority open questions to avoid rework.
