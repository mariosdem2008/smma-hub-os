# Next 3 Steps (Highest Leverage)

**Generated:** 2025-12-24
**Priority:** Execute in order before adding new AI features

---

## Step 1: Verify Onboarding Resume Flow Uses Service-Role Access Only

### Why This Matters (Severity 5)

The RLS policy change in migration 20251224103000 restricted `client_brains` SELECT to service_role only. If AiOnboardingV2Chat still attempts direct client-side reads for resume flow, onboarding will fail with RLS permission errors, blocking users from completing "Lock v1".

**Evidence of Risk:**
- Audit flagged direct reads: docs/ai/baseline_audit.md:90-91, :132-134
- Onboarding code path: src/components/ai/AiOnboardingV2Chat.tsx:167-175

### What To Do

1. **Audit all brain read paths in AiOnboardingV2Chat.tsx:**
   - Search for `.from("client_brains").select(` and `.from("agency_brains").select(`
   - Verify NO direct reads exist for resume flow
   - If direct reads found, replace with edge function call to `ai-brains-client` or `ai-brains-agency` (add "get" action if needed)

2. **Add "get" action to ai-brains-client if missing:**
   ```typescript
   // supabase/functions/ai-brains-client/index.ts
   if (action === "get") {
     const { data, error } = await supabase
       .from("client_brains")
       .select("id, agency_id, client_id, version, status, locked")
       .eq("agency_id", agencyId)
       .eq("client_id", clientId)
       .order("version", { ascending: false })
       .limit(1)
       .maybeSingle();
     // Return safe fields only, NOT brain_json
   }
   ```

3. **Update UI to call edge function for resume:**
   ```typescript
   // src/components/ai/AiOnboardingV2Chat.tsx
   const { data } = await supabase.functions.invoke("ai-brains-client", {
     body: { action: "get", agency_id: agencyId, client_id: clientId }
   });
   ```

### Acceptance Tests

**Test 1: Resume Draft Brain**
1. Create draft client brain via onboarding (save 2-3 answers, do NOT lock)
2. Navigate away and return to onboarding
3. Verify answers are restored (resume flow works)
4. Expected: NO RLS permission errors in console
5. File: Manual test (add to docs/ai/how_to_test_brain_spine.md)

**Test 2: Resume After Lock**
1. Complete onboarding and "Lock v1"
2. Navigate back to onboarding for same client
3. Verify UI shows "brain locked" state or redirects appropriately
4. Expected: NO RLS permission errors
5. File: Manual test

**Test 3: RLS Rejection (Negative Case)**
1. Temporarily add direct `.from("client_brains").select("brain_json")` call in UI
2. Attempt to load onboarding
3. Expected: RLS permission error, proving service_role boundary is enforced
4. File: src/data/__tests__/clientBrainStatus.test.ts (add negative RLS test)

### Success Criteria

- Zero direct `.from("client_brains").select(...)` or `.from("agency_brains").select(...)` calls in UI code
- Onboarding resume flow works for draft brains
- Manual test suite updated with resume flow tests

---

## Step 2: Add Explicit Error Handling for Missing OPENAI_API_KEY in Embedding Workflows

### Why This Matters (Severity 3)

Current implementation silently falls back to zero vectors when OPENAI_API_KEY is missing. This causes retrieval to degrade to random results (all embeddings equal), breaking RAG quality while still appearing to "work". Users receive low-quality or nonsensical UNKNOWN responses.

**Evidence of Risk:**
- Zero vector fallback: supabase/functions/ai-documents-ingest/index.ts:134-170
- Zero vector fallback: supabase/functions/ai-brain-ingest/index.ts:285-321
- Audit finding: docs/ai/baseline_audit.md:148-150

### What To Do

1. **Add explicit check at ingest entry point:**
   ```typescript
   // supabase/functions/ai-documents-ingest/index.ts (top of handler)
   const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
   if (!OPENAI_API_KEY) {
     console.error("CRITICAL: OPENAI_API_KEY not set, embeddings will fail");
     return jsonResponse(
       { error: "AI service unavailable (missing API key). Contact support." },
       503,
       corsHeaders(req)
     );
   }
   ```

2. **Log warning in ai_usage_logs when embedding fails:**
   ```typescript
   // supabase/functions/_shared/embeddings.ts
   export async function embedText(text: string): Promise<number[]> {
     const key = Deno.env.get("OPENAI_API_KEY");
     if (!key) {
       console.error("OPENAI_API_KEY missing, cannot embed");
       throw new Error("Embedding service unavailable");
     }
     try {
       // ... OpenAI call
     } catch (error) {
       console.error("Embedding failed:", error);
       throw error; // Do NOT silently return zero vector
     }
   }
   ```

3. **Update ai-ask and ai-strategy-generate to return UNKNOWN if embedding fails:**
   ```typescript
   // supabase/functions/ai-ask/index.ts
   let queryEmbedding: number[];
   try {
     queryEmbedding = await embedText(question);
   } catch (error) {
     console.error("Failed to embed question:", error);
     return jsonResponse(
       buildUnknown(["AI service temporarily unavailable. Please try again later."]),
       200,
       corsHeaders(req)
     );
   }
   ```

### Acceptance Tests

**Test 1: Ingest Fails Without Key**
1. Unset OPENAI_API_KEY in supabase/.env
2. Attempt to ingest a document via ai-documents-ingest
3. Expected: HTTP 503 error with message "AI service unavailable"
4. File: Manual test (add to docs/ai/how_to_test_brain_spine.md)

**Test 2: Ask Returns UNKNOWN Without Key**
1. Unset OPENAI_API_KEY
2. Call ai-ask with a question
3. Expected: HTTP 200 with {answer: "UNKNOWN", unknown: true, questions: ["AI service temporarily unavailable..."]}
4. File: Manual test

**Test 3: Strategy Returns UNKNOWN Without Key**
1. Unset OPENAI_API_KEY
2. Call ai-strategy-generate with usable brain
3. Expected: HTTP 200 with UNKNOWN response
4. File: Manual test

**Test 4: Zero Vector No Longer Inserted**
1. Unset OPENAI_API_KEY
2. Attempt document ingest
3. Query ai_embeddings table
4. Expected: NO new rows inserted (ingest failed cleanly)
5. File: SQL query test (add to docs/ai/sql_smoke_tests.md)

### Success Criteria

- All embedding workflows throw explicit errors when OPENAI_API_KEY missing
- No zero vectors inserted into ai_embeddings table after change
- User-facing error messages are actionable ("service unavailable, try later")
- ai_usage_logs records embedding failures with unknown=true

---

## Step 3: Consolidate AI Logging and Document Canonical Usage Source

### Why This Matters (Severity 3)

Multiple logging tables exist (`ai_history`, `ai_generation_usage`, `ai_usage_logs`, `ai_runs`) with unclear ownership. This creates:
- Risk of double-counting usage for tier enforcement
- Confusion about which table to query for billing/analytics
- Inconsistent logging (some endpoints log to legacy tables, some to new)

**Evidence of Risk:**
- Legacy tables: supabase/migrations/20251124133649_*.sql (ai_generation_usage), 20251201192305_*.sql (ai_history)
- New logging: supabase/migrations/20251224090000_brain_spine_v1.sql:16-24 (ai_usage_logs), :97-115 (ai_runs)
- Audit finding: docs/ai/baseline_audit.md:140-143

### What To Do

1. **Document canonical logging source:**
   Create `docs/ai/logging_contract.md`:
   ```markdown
   # AI Logging Contract

   ## Canonical Usage Log: ai_usage_logs

   All AI endpoints MUST log to `ai_usage_logs` with:
   - agency_id, client_id, endpoint, model, tokens_estimate, latency_ms, unknown, cost_usd, created_at

   ## Detailed Run Log: ai_runs (optional)

   Edge functions MAY log to `ai_runs` for extended metadata:
   - prompt_id, prompt_version, tokens_in/out, success, citations, escalate_to_human

   ## Legacy Tables (Deprecated)

   - `ai_history`: DO NOT USE (pre-v1 logging)
   - `ai_generation_usage`: DO NOT USE (replaced by ai_usage_logs)

   Migration plan: backfill ai_usage_logs from legacy tables if needed for historical analytics.

   ## Tier Enforcement Source

   Budget and rate limit enforcement MUST query `ai_usage_logs` only.
   ```

2. **Audit all edge functions for logging calls:**
   - Search: `rg "ai_history|ai_generation_usage" supabase/functions/`
   - For each match, verify it ALSO logs to ai_usage_logs (or replace)
   - Ensure NO tier enforcement logic reads legacy tables

3. **Add deprecation warnings to legacy tables:**
   ```sql
   -- supabase/migrations/YYYYMMDDHHMMSS_deprecate_legacy_logging.sql
   COMMENT ON TABLE public.ai_history IS 'DEPRECATED: Use ai_usage_logs instead. This table is kept for historical data only.';
   COMMENT ON TABLE public.ai_generation_usage IS 'DEPRECATED: Use ai_usage_logs instead. This table is kept for historical data only.';
   ```

4. **Create canonical usage query examples:**
   ```sql
   -- docs/ai/logging_contract.md

   -- Total AI calls by agency (last 30 days)
   SELECT agency_id, COUNT(*) as call_count, SUM(cost_usd) as total_cost
   FROM ai_usage_logs
   WHERE created_at >= NOW() - INTERVAL '30 days'
   GROUP BY agency_id
   ORDER BY total_cost DESC;

   -- UNKNOWN rate by endpoint
   SELECT endpoint,
          COUNT(*) as total_calls,
          SUM(CASE WHEN unknown THEN 1 ELSE 0 END) as unknown_count,
          ROUND(100.0 * SUM(CASE WHEN unknown THEN 1 ELSE 0 END) / COUNT(*), 2) as unknown_pct
   FROM ai_usage_logs
   WHERE created_at >= NOW() - INTERVAL '7 days'
   GROUP BY endpoint;
   ```

### Acceptance Tests

**Test 1: Single Source of Truth**
1. Query `SELECT COUNT(*) FROM ai_usage_logs WHERE endpoint = 'ai-ask' AND created_at >= NOW() - INTERVAL '1 hour'`
2. Call ai-ask 5 times
3. Re-query ai_usage_logs
4. Expected: COUNT increased by exactly 5
5. File: SQL test (add to docs/ai/sql_smoke_tests.md)

**Test 2: No Double-Logging**
1. Call ai-strategy-generate once
2. Query: `SELECT COUNT(*) FROM ai_usage_logs WHERE endpoint = 'ai-strategy-generate' AND created_at >= NOW() - INTERVAL '1 minute'`
3. Query: `SELECT COUNT(*) FROM ai_generation_usage WHERE created_at >= NOW() - INTERVAL '1 minute'`
4. Expected: ai_usage_logs = 1, ai_generation_usage = 0 (or legacy entry exists but not counted)
5. File: SQL test

**Test 3: Budget Enforcement Uses Correct Table**
1. Set ai_budgets.budget_usd = 0.01 for test agency
2. Insert fake ai_usage_logs rows with cost_usd totaling 0.02
3. Call ai-ask
4. Expected: UNKNOWN response with "budget exceeded" message
5. File: Manual test (add to docs/ai/how_to_test_brain_spine.md)

**Test 4: Legacy Tables Not Used**
1. Search codebase: `rg "ai_history|ai_generation_usage" supabase/functions/`
2. Expected: Zero matches (or only in comments/deprecation warnings)
3. File: CI lint check (add to .github/workflows/ci.yml)

### Success Criteria

- Documentation exists: docs/ai/logging_contract.md
- All edge functions log to ai_usage_logs (verified via code audit)
- Legacy tables have deprecation comments in DB schema
- Sample queries for billing/analytics use ai_usage_logs only
- CI check ensures no new legacy table usage introduced

---

## Summary

**Order of Execution:**
1. Onboarding RLS verification (blocks "Lock v1" workflow if broken)
2. Embedding error handling (silent failures degrade UX quality)
3. Logging consolidation (future-proofs tier enforcement and billing)

**After these 3 steps:**
- Core AI Employee flows are production-safe
- Security boundaries are verified end-to-end
- Observability and cost controls are reliable

**Do NOT proceed with new AI features (multi-model, streaming, advanced RAG) until these 3 steps are complete and tested.**
