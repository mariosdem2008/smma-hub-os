# AI Infrastructure Migration Map v1

**Status**: ACTIVE migration guide
**Phase 1**: ✅ COMPLETED (Budget + Logging)
**Phase 2**: 🔲 PLANNED (Timeouts + Embedding Hardening)
**Phase 3**: 🔲 PLANNED (RAG + Citations)

---

## Current → Target Module Mapping

### Core AI Modules

| Current Module | Target Module | Phase | Migration Action | Deprecate/Delete Criteria |
|----------------|---------------|-------|------------------|---------------------------|
| `src/ai/router.ts` | `src/ai/router.ts` | 1 (✅) | **MODIFIED**: Added runtime model logging (line 246, 384) | N/A - core module |
| `src/ai/taskRegistry.ts` | `src/ai/taskRegistry.ts` + `src/ai/tasks/*.ts` | 3 | **SPLIT**: Extract task configs into individual modules for maintainability | Keep monolithic file until Phase 3 |
| `src/ai/modelPolicy.ts` | `src/ai/modelPolicy.ts` | N/A | **NO CHANGE**: Model selection logic stable | N/A |
| N/A (new) | `src/ai/budgets.ts` | 1 (✅) | **CREATED**: Atomic budget operations (checkBudget, incrementBudget, calculateCost) | N/A - new module |
| N/A (new) | `src/ai/pricing.ts` | 1 (✅) | **CREATED**: Cost-per-token rates for all models | N/A - new module |
| N/A (new) | `src/ai/logging.ts` | 1 (✅) | **CREATED**: Canonical logging helpers (logUsage, logRun) | N/A - new module |
| N/A (new) | `src/ai/providers/utils.ts` | 2 | **CREATE**: Timeout/retry utilities (fetchWithTimeout, fetchWithRetry, CircuitBreaker) | N/A - new module |
| N/A (new) | `src/ai/ragPolicy.ts` | 3 | **CREATE**: Centralized RAG config (getRagConfig, buildRagContext) | N/A - new module |
| N/A (new) | `src/ai/citations.ts` | 3 | **CREATE**: Citation validation helpers | N/A - new module |

---

### Provider Adapters

| Current Module | Target Module | Phase | Migration Action | Deprecate/Delete Criteria |
|----------------|---------------|-------|------------------|---------------------------|
| `src/ai/providers/openai.ts` | `src/ai/providers/openai.ts` | 1,2 | **MODIFIED**: Phase 1 ✅ - Return runtime model in metadata; Phase 2 - Add timeout/retry wrappers | N/A - core provider |
| `src/ai/providers/anthropic.ts` | `src/ai/providers/anthropic.ts` | 2 | **MODIFY**: Add timeout/retry wrappers (same as OpenAI) | N/A - available provider |
| `src/ai/providers/types.ts` | `src/ai/providers/types.ts` | 1 | **MODIFIED**: Updated GenerateResult to include `model?: string` | N/A |

---

### Edge Functions (Supabase)

| Current Module | Target Module | Phase | Migration Action | Deprecate/Delete Criteria |
|----------------|---------------|-------|------------------|---------------------------|
| `supabase/functions/ai-ask/index.ts` | `supabase/functions/ai-ask/index.ts` | 1,3 | **MODIFIED**: Phase 1 ✅ - Atomic budget enforcement + ai_runs logging; Phase 3 - Use ragPolicy.ts | N/A - core endpoint |
| `supabase/functions/generate-ai-content/index.ts` | `supabase/functions/generate-ai-content/index.ts` | 1,2 | **MODIFIED**: Phase 1 ✅ - Dual-write to canonical logs; Phase 2 - Deprecate legacy logging | **DEPRECATE after Phase 2**: Dual-write ends, legacy tables locked |
| `supabase/functions/ai-strategy-generate/index.ts` | `supabase/functions/ai-strategy-generate/index.ts` | 3 | **MODIFY**: Use ragPolicy.ts for retrieval config | N/A - core endpoint |
| `supabase/functions/ai-agency-admin-chat/index.ts` | `supabase/functions/ai-agency-admin-chat/index.ts` | 3 | **MODIFY** (optional): Migrate to schema output OR keep freeform with explicit reason | N/A - core endpoint |
| `supabase/functions/ai-documents-ingest/index.ts` | `supabase/functions/ai-documents-ingest/index.ts` | 2 | **MODIFY**: Remove zero-vector fallback, fail hard on missing API key | N/A - core endpoint |
| `supabase/functions/ai-brain-ingest/index.ts` | `supabase/functions/ai-brain-ingest/index.ts` | 2 | **MODIFY**: Remove zero-vector fallback | N/A - core endpoint |
| `supabase/functions/ai-onboarding-guide/index.ts` | `supabase/functions/ai-onboarding-guide/index.ts` | N/A | **NO CHANGE**: EXTRACT_STRUCTURED task stable | N/A |
| `supabase/functions/ai-rep-chat/index.ts` | `supabase/functions/ai-rep-chat/index.ts` | N/A | **NO CHANGE**: Retrieval-only endpoint stable | N/A |
| `supabase/functions/ai-retrieve-context/index.ts` | `supabase/functions/ai-retrieve-context/index.ts` | 3 | **MODIFY**: Use ragPolicy.ts (or deprecate if unused) | **DEPRECATE if unused** (check UI callers) |
| `supabase/functions/generate-monthly-report/index.ts` | `supabase/functions/generate-monthly-report/index.ts` | N/A | **NO CHANGE**: SUMMARIZE task marked as freeform in Phase 3 | N/A |
| `supabase/functions/_shared/ai-router.ts` | `supabase/functions/_shared/ai-router.ts` | N/A | **NO CHANGE**: Wrapper stable | N/A |
| `supabase/functions/_shared/embeddings.ts` | `supabase/functions/_shared/embeddings.ts` | N/A | **NO CHANGE**: embedText helper stable | N/A |
| N/A (new) | `supabase/functions/_shared/budgets.ts` | 1 (✅) | **CREATED**: Deno-compatible budget helpers (calculateCost, incrementBudget) | N/A - new module |

---

### Database Tables

| Current Table | Target Table | Phase | Migration Action | Deprecate/Delete Criteria |
|---------------|--------------|-------|------------------|---------------------------|
| `ai_usage_logs` | `ai_usage_logs` | 1 (✅) | **CANONICAL**: All AI operations log here (model, tokens, latency, cost) | N/A - canonical table |
| `ai_runs` | `ai_runs` | 1 (✅) | **CANONICAL**: All user-facing AI operations log here (citations, escalations, cost) | N/A - canonical table |
| `ai_history` | **DEPRECATED** | 1,2 | **DUAL-WRITE** (Phase 1 ✅): generate-ai-content writes to both; **LOCK** (Phase 2): Add DB trigger to prevent new writes | **DELETE after 90 days** post-Phase 2 cutover (keep for historical queries) |
| `ai_generation_usage` | **DEPRECATED** | 1,2 | **DUAL-WRITE** (Phase 1 ✅): generate-ai-content writes to both; **LOCK** (Phase 2): Add DB trigger to prevent new writes | **DELETE after 90 days** post-Phase 2 cutover |
| `ai_budgets` | `ai_budgets` | 1 (✅) | **MODIFIED**: Migration `20251227090000_ai_budget_atomic_ops.sql` adds RPC `ai_budget_apply_delta` | N/A - core table |
| `ai_embeddings` | `ai_embeddings` | 2 | **CLEANUP**: Flag/delete existing zero-vector embeddings (metadata.legacy_zero_vector=true) | Zero-vectors deleted after 30 days if unreferenced |
| `ai_prompt_registry` | `ai_prompt_registry` | N/A | **NO CHANGE**: Reference-only (model policy wins in conflicts) | N/A |
| `agency_brains` | `agency_brains` | N/A | **NO CHANGE**: Schema stable (v1 migrations complete) | N/A |
| `client_brains` | `client_brains` | N/A | **NO CHANGE**: Schema stable (v1 migrations complete) | N/A |
| `ai_documents` | `ai_documents` | N/A | **NO CHANGE**: Schema stable | N/A |
| `ai_document_chunks` | `ai_document_chunks` | N/A | **NO CHANGE**: Schema stable | N/A |
| `ai_rate_limits` | `ai_rate_limits` | N/A | **NO CHANGE**: Schema stable | N/A |
| `ai_escalations` | `ai_escalations` | N/A | **NO CHANGE**: Schema stable | N/A |

---

### UI Components (Client)

| Current Component | Target Component | Phase | Migration Action | Deprecate/Delete Criteria |
|-------------------|------------------|-------|------------------|---------------------------|
| `src/components/ai/AiOnboardingV2Chat.tsx` | **DEPRECATED** | N/A | **NO CHANGE** (Phase 1-3): Onboarding V2 still functional | **DEPRECATE when V3 adoption reaches 100%** (monitor via analytics) |
| `src/components/ai/AiOnboardingV3Guided.tsx` | `src/components/ai/AiOnboardingV3Guided.tsx` | N/A | **NO CHANGE**: V3 is current onboarding path | N/A |
| `src/pages/ai/AgencyAiAdmin.tsx` | `src/pages/ai/AgencyAiAdmin.tsx` | 3 | **MODIFY** (optional): Handle schema output if admin chat migrated | N/A |
| `src/hooks/useClientAIHistory.ts` | **DEPRECATED** | 2 | **NO CHANGE** (Phase 1-2): Still reads ai_history | **DEPRECATE Phase 2**: Migrate to read ai_runs (create `useClientAIRuns` hook) |
| `src/components/client-tabs/AiRepChatTab.tsx` | `src/components/client-tabs/AiRepChatTab.tsx` | N/A | **NO CHANGE**: Client portal chat stable | N/A |

---

## Kill List + Safety Plan

### Unused/Legacy Edge Functions

| Endpoint | Usage Status | Safety Plan | Kill Criteria | Phase |
|----------|--------------|-------------|---------------|-------|
| `ai-answer-quality-check` | **UNKNOWN** | 1. Check UI callers (grep for `ai-answer-quality-check` in src/); 2. If unused, add deprecation notice; 3. Monitor invocations for 30 days; 4. Delete if zero calls | Zero invocations for 30 days + no UI callers | 2 or 3 |
| `ai-retrieve-context` | **LIKELY UNUSED** | 1. Check UI callers (grep for `ai-retrieve-context` in src/); 2. If unused, deprecate; 3. Monitor for 14 days; 4. Delete if zero calls | Zero invocations for 14 days + no UI callers | 3 |

**Action Plan**:
1. **Phase 2 Start**: Audit all edge functions for UI callers
   ```bash
   rg "ai-answer-quality-check|ai-retrieve-context" src/ --type ts
   ```
2. **If Unused**: Add deprecation warning in function (return 410 Gone with migration notice)
3. **Monitor**: Track invocations via ai_usage_logs (alert if any calls)
4. **Delete**: After grace period (14-30 days), delete function folder

---

### Legacy Logging Tables

| Table | Status | Safety Plan | Kill Criteria | Phase |
|-------|--------|-------------|---------------|-------|
| `ai_history` | **DEPRECATED** (Phase 1) | 1. Dual-write active (Phase 1 ✅); 2. Add DB trigger to prevent new writes (Phase 2); 3. Keep readable for 90 days; 4. Create view for backward compat; 5. Delete table after 90 days | 90 days post-Phase 2 cutover + zero writes + view created | 2 + 90 days |
| `ai_generation_usage` | **DEPRECATED** (Phase 1) | Same as ai_history | Same as ai_history | 2 + 90 days |

**Migration Trigger** (Phase 2):
```sql
-- Prevent new writes to ai_history
CREATE OR REPLACE FUNCTION prevent_ai_history_writes()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ai_history is deprecated. Use ai_runs instead. See docs/ai/migration_map_v1.md';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_history_deprecation_trigger
BEFORE INSERT ON ai_history
FOR EACH ROW EXECUTE FUNCTION prevent_ai_history_writes();
```

**Backward Compatibility View** (Phase 2):
```sql
CREATE VIEW ai_history AS
SELECT
  id,
  agency_id,
  client_id,
  created_at,
  metadata->>'input' as input,
  metadata->>'output' as output,
  'content_generation' as mode
FROM ai_runs
WHERE prompt_id IN (
  SELECT id FROM ai_prompt_registry WHERE task_type = 'content_ideas'
);
```

**Safety Checks**:
1. Before cutover: Query to verify all ai_history data migrated to ai_runs
   ```sql
   SELECT COUNT(*) FROM ai_history WHERE created_at > '2025-12-01';
   SELECT COUNT(*) FROM ai_runs WHERE created_at > '2025-12-01' AND metadata->>'legacy_source' = 'ai_history';
   ```
2. Alert if ai_history trigger fires (indicates code still trying to write)

---

### Legacy UI Components

| Component | Status | Safety Plan | Kill Criteria | Phase |
|-----------|--------|-------------|---------------|-------|
| `src/components/ai/AiOnboardingV2Chat.tsx` | **DEPRECATED** (soft) | 1. Monitor V2 vs V3 usage via analytics; 2. If V2 usage <1% for 60 days, add deprecation notice in UI; 3. Force-migrate remaining users; 4. Delete component | V2 usage <1% for 60 days + all users migrated to V3 | Post-v1 |
| `src/hooks/useClientAIHistory.ts` | **DEPRECATE Phase 2** | 1. Create `useClientAIRuns.ts` replacement; 2. Migrate UI components to new hook; 3. Add deprecation comment to old hook; 4. Delete after all callers migrated | Zero callers + migration complete | 2 |

**Migration Plan for useClientAIHistory**:
```typescript
// NEW: src/hooks/useClientAIRuns.ts
export function useClientAIRuns(clientId: string) {
  return useQuery({
    queryKey: ['client-ai-runs', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_runs')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data
    }
  })
}

// OLD: src/hooks/useClientAIHistory.ts (add deprecation)
/** @deprecated Use useClientAIRuns instead. ai_history is deprecated. */
export function useClientAIHistory(clientId: string) {
  // ... existing code
}
```

---

### Zero-Vector Embeddings Cleanup

| Action | Timing | Safety Plan |
|--------|--------|-------------|
| Flag existing zero-vectors | Phase 2 start | UPDATE ai_embeddings SET metadata = jsonb_set(metadata, '{legacy_zero_vector}', 'true') WHERE embedding = array_fill(0, ARRAY[1536]) |
| Monitor new zero-vectors | Phase 2 ongoing | Alert if any embeddings created with all-zero values (indicates bug) |
| Delete flagged embeddings | Phase 2 + 30 days | DELETE FROM ai_embeddings WHERE metadata->>'legacy_zero_vector' = 'true' AND created_at < now() - interval '30 days' |

**Safety Checks**:
1. Count affected embeddings before flagging:
   ```sql
   SELECT doc_type, COUNT(*) FROM ai_embeddings
   WHERE embedding = array_fill(0, ARRAY[1536])
   GROUP BY doc_type;
   ```
2. Verify no new zero-vectors after Phase 2 deployment:
   ```sql
   SELECT * FROM ai_embeddings
   WHERE created_at > '2025-12-27'
     AND embedding = array_fill(0, ARRAY[1536]);
   ```
3. Alert if zero-vector count increases (rollback signal)

---

## Rollout Plan

### Phase 1: Budget + Logging (✅ COMPLETED)

**Deployment Date**: 2025-12-27
**Status**: Merged to main

**Changes Deployed**:
1. ✅ Atomic budget RPC (`ai_budget_apply_delta`)
2. ✅ ai-ask budget enforcement (pre-reserve + reconcile pattern)
3. ✅ generate-ai-content dual-write to canonical logs
4. ✅ Runtime model logging in router + OpenAI provider
5. ✅ Budget enforcement integration tests

**Feature Flags**: None (no flags used in Phase 1)

**Rollback Plan**:
- If budget overage: Set `AI_BUDGET_ENFORCEMENT=false` in env (log-only mode)
- If logging errors: Disable canonical writes, continue legacy logging
- If RPC errors: Revert migration `20251227090000_ai_budget_atomic_ops.sql`

**Success Metrics** (48h post-deployment):
- ✅ Budget accuracy: spent_usd delta < $1 vs ai_runs.cost_usd sum
- ✅ Canonical logging coverage: >80% of calls log to ai_usage_logs
- ✅ Runtime model attribution: >95% logs show actual model (not policy default)
- ✅ Zero budget overages: spent_usd never exceeds budget_usd when hard_stop=true
- ✅ Integration tests: 100% pass rate

**Monitoring** (ongoing):
- Daily budget reconciliation query (spent_usd vs provider invoice estimate)
- Alert if model mismatch rate >5%
- Alert if ai_runs missing cost_usd (indicates logging bug)

---

### Phase 2: Timeouts + Embedding Hardening (🔲 PLANNED)

**Target Date**: TBD (Days 3-7 post-Phase 1)
**Status**: Not started

**Changes**:
1. Provider timeout/retry utilities (fetchWithTimeout, fetchWithRetry)
2. OpenAI provider timeout wrapper (30s default, 3 retries)
3. Anthropic provider timeout wrapper (same)
4. Remove zero-vector embedding fallback
5. Flag/cleanup existing zero-vector embeddings
6. Provider reliability integration tests

**Feature Flags**:
- `AI_PROVIDER_TIMEOUTS=true` (default: false initially, ramp to true)
- `AI_EMBEDDING_FAIL_HARD=true` (default: false initially, ramp to true)

**Rollout Steps**:
1. **Day 1**: Deploy timeout utilities to staging, validate with load tests
2. **Day 2**: Enable `AI_PROVIDER_TIMEOUTS=true` at 25% traffic (canary)
3. **Day 3**: Monitor timeout rate, retry rate, latency impact
4. **Day 4**: Ramp to 50% traffic if metrics healthy
5. **Day 5**: Ramp to 100% traffic
6. **Day 6**: Enable `AI_EMBEDDING_FAIL_HARD=true` at 50% traffic
7. **Day 7**: Ramp to 100%, flag zero-vector embeddings

**Success Thresholds**:
- Timeout rate <2% across all endpoints
- Retry rate <5% (indicates transient errors handled gracefully)
- Provider p95 latency <5s, p99 <10s
- Zero new zero-vector embeddings created
- Ingestion failure rate <5% (with retries)

**Kill Switches**:
- `AI_PROVIDER_TIMEOUTS=false`: Disable timeout wrapper (revert to unbounded fetch)
- `AI_EMBEDDING_FAIL_HARD=false`: Restore zero-vector fallback
- `AI_CIRCUIT_BREAKER=false`: Disable circuit breaker (allow all requests)

**Rollback Triggers**:
- Timeout rate >5% for any endpoint → rollback timeouts
- Ingestion failure rate >10% → rollback fail-hard embedding
- User-reported errors increase 2× → investigate, potentially rollback

**Monitoring**:
- Real-time dashboard: timeout rate, retry rate, circuit breaker state
- Alert if circuit opens (provider outage detected)
- Alert if zero-vector count increases (fail-hard not working)

---

### Phase 3: RAG + Citations (🔲 PLANNED)

**Target Date**: TBD (Days 7-14 post-Phase 1)
**Status**: Not started

**Changes**:
1. RAG policy module (centralized top_k + doc_types)
2. ai-ask RAG migration (use ragPolicy.ts)
3. ai-strategy-generate RAG migration
4. Freeform flags in task registry (SUMMARIZE, admin chat)
5. Optional: Admin chat schema migration
6. RAG correctness integration tests
7. RAG observability dashboard

**Feature Flags**:
- `AI_RAG_CENTRALIZED=true` (default: false, A/B test 50/50)
- `AI_ADMIN_CHAT_SCHEMA=true` (default: false, opt-in)
- `AI_SCHEMA_STRICT=true` (default: false, gradual enforcement)

**Rollout Steps**:
1. **Day 1-2**: Deploy ragPolicy.ts to staging, validate config parity with hardcoded values
2. **Day 3**: A/B test `AI_RAG_CENTRALIZED=true` at 10% traffic (Group A: new, Group B: old)
3. **Day 4-5**: Monitor quality metrics (escalation rate, unknown rate, citation coverage)
4. **Day 6**: If metrics healthy, ramp to 50% traffic
5. **Day 7**: Ramp to 100%
6. **Day 8-10**: Deploy admin chat schema migration (opt-in via flag)
7. **Day 11-12**: A/B test admin chat schema (50/50 split)
8. **Day 13**: If UX metrics healthy, enable by default
9. **Day 14**: Deploy RAG observability dashboard

**Success Thresholds**:
- RAG config centralized: 0 hardcoded top_k in edge functions
- Citation coverage: >90% of RAG answers include citations
- Unknown rate: <10% (no degradation from baseline)
- Escalation rate: <5% (no increase from baseline)
- Admin chat completion rate: >90% (if schema migrated)

**Kill Switches**:
- `AI_RAG_CENTRALIZED=false`: Revert to hardcoded top_k values
- `AI_ADMIN_CHAT_SCHEMA=false`: Revert to freeform parsing
- `AI_SCHEMA_STRICT=false`: Allow freeform outputs without schema

**Rollback Triggers**:
- Escalation rate increases >2× → rollback RAG config
- Unknown rate increases >20% → rollback RAG config
- Admin chat completion rate drops <80% → rollback schema migration
- User feedback spike (negative) → investigate, potentially rollback

**A/B Test Metrics**:
- Group A (new RAG policy): Measure escalation rate, unknown rate, citation coverage
- Group B (old hardcoded): Same metrics
- Compare: If Group A metrics within 5% of Group B, declare success

**Monitoring**:
- RAG observability dashboard (Grafana/Superset)
- Metrics: avg retrieval count, top doc_types, context truncation rate, citation coverage
- Alert if citation coverage drops <80%
- Alert if unknown rate spikes >15%

---

## Top 10 Rework Risks + Prevention

### Risk 1: Budget Double-Counting During Dual-Write
**Impact**: High (budget overruns, billing disputes)
**Probability**: Medium
**Prevention**:
- ✅ Phase 1 design: Only increment budget in canonical code path (not legacy)
- ✅ Integration test verifies single increment per call (AI-003)
- Daily reconciliation query monitors drift
- Alert if spent_usd exceeds ai_runs sum by >$1

**How This Blueprint Prevents It**:
- Budget operations centralized in `src/ai/budgets.ts` (single source of truth)
- Atomic RPC ensures no race conditions
- Dual-write only for logging tables (ai_history/ai_generation_usage), NOT budgets

---

### Risk 2: Model Policy vs Prompt Registry Conflict
**Impact**: Medium (wrong model used, cost surprise)
**Probability**: Low
**Prevention**:
- Architecture freeze: Model policy ALWAYS wins (I4 invariant)
- Prompt registry is reference-only (no runtime enforcement)
- Runtime model logged from provider response (not policy OR registry)
- Alert if logged model ≠ modelPolicy expectation

**How This Blueprint Prevents It**:
- Clear precedence order: Provider response > Model policy > Prompt registry
- Runtime model attribution (I4) logs actual model used
- Monthly reconciliation catches drift

---

### Risk 3: Timeout Too Aggressive for Complex Prompts
**Impact**: High (user-facing errors, support tickets)
**Probability**: Medium
**Prevention**:
- Configurable timeout per task type (I7 invariant)
- Default 30s, but STRATEGY_PLAN gets 60s, EMBED_TEXT gets 10s
- Graceful degradation: return UNKNOWN on timeout (not HTTP 500)
- Monitor timeout rate by task type, alert if >2%

**How This Blueprint Prevents It**:
- Task-specific timeout values defined in architecture (frozen)
- Feature flag rollout (25%→50%→100%) catches issues early
- Kill switch ready (`AI_PROVIDER_TIMEOUTS=false`)

---

### Risk 4: Zero-Vector Embedding Cleanup Breaks Existing Queries
**Impact**: Medium (retrieval results change, answer quality)
**Probability**: Low
**Prevention**:
- Flag zero-vectors first (metadata.legacy_zero_vector=true), don't delete immediately
- Monitor retrieval for 30 days before deletion
- Alert if retrieval count drops significantly after flagging
- Rollback: un-flag embeddings if quality degrades

**How This Blueprint Prevents It**:
- Phased cleanup: flag → monitor → delete (30 day grace period)
- Phase 2 removes zero-vector *creation*, not existing data immediately
- Integration tests validate retrieval behavior before/after cleanup

---

### Risk 5: RAG Config Change Degrades Answer Quality
**Impact**: Medium (worse answers, increased escalations)
**Probability**: Medium
**Prevention**:
- Start with exact parity: ragPolicy config matches current hardcoded values
- A/B test any config changes (50/50 split, monitor quality metrics)
- Gradual rollout (10%→50%→100%)
- Monitor escalation rate, unknown rate, citation coverage
- Kill switch ready (`AI_RAG_CENTRALIZED=false`)

**How This Blueprint Prevents It**:
- Centralized RAG policy (I10) makes A/B testing easy
- Default allocation frozen in architecture (6/4/2 split)
- Integration tests (AI-016) validate retrieval behavior
- Observability dashboard (AI-017) tracks metrics in real-time

---

### Risk 6: Admin Chat Schema Migration Breaks UX
**Impact**: High (admin productivity loss, setup flow broken)
**Probability**: Low
**Prevention**:
- Optional: Keep admin chat as freeform (mark with freeformReason)
- If migrated: A/B test schema vs freeform (50/50 split)
- Monitor setup completion rate (target >90%)
- Keep freeform parser as fallback if schema fails validation
- Manual override button for admins

**How This Blueprint Prevents It**:
- Schema migration is OPTIONAL (AI-015 is P3 priority)
- Freeform option preserved (I6 invariant allows explicit freeform)
- Gradual rollout with feature flag (`AI_ADMIN_CHAT_SCHEMA=false` default)

---

### Risk 7: Cost Estimation Drift from Actual Provider Pricing
**Impact**: Medium (budget tracking inaccurate, reconciliation gaps)
**Probability**: Medium
**Prevention**:
- Use actual token counts from provider response (I5 invariant)
- Pricing table in `src/ai/pricing.ts` (NOT hardcoded)
- Conservative fallback estimate (chars/3) when provider doesn't return tokens
- Monthly reconciliation compares ai_budgets.spent_usd with provider invoices
- Alert if drift >5%

**How This Blueprint Prevents It**:
- Pricing table is single source of truth (easy to update)
- Runtime token counts logged (I3: ai_runs.tokens_in/tokens_out)
- Cost calculation formula frozen in architecture (I5)
- Monthly reconciliation catches pricing drift

---

### Risk 8: Legacy Table Deprecation Breaks Unknown Dependencies
**Impact**: Medium (broken reports, dashboards, queries)
**Probability**: Low
**Prevention**:
- Audit all queries against legacy tables before deprecation (grep + DB logs)
- Create backward compat views (ai_history → ai_runs mapping)
- DB triggers prevent new writes (with migration notice in error message)
- Keep legacy tables readable for 90 days
- Monitor for trigger fires (indicates code still trying to write)

**How This Blueprint Prevents It**:
- Migration map includes audit steps (grep commands)
- Backward compat view preserves read access
- 90-day grace period allows discovery of hidden dependencies
- DB trigger provides clear migration instructions

---

### Risk 9: Provider Retry Storm During Outage
**Impact**: High (cascading failures, cost spike)
**Probability**: Low
**Prevention**:
- Circuit breaker pattern (I8 invariant)
- Open circuit after 50% error rate over 5min
- Half-open test: 1 request every 30s to check recovery
- Max retry budget per minute (prevent thundering herd)
- Exponential backoff with jitter
- Alert when circuit opens

**How This Blueprint Prevents It**:
- Circuit breaker threshold frozen in architecture (50% over 5min)
- Retry logic centralized in `src/ai/providers/utils.ts`
- Feature flag rollout catches issues early
- Kill switch ready (`AI_PROVIDER_RETRIES=false`)

---

### Risk 10: Observability Gaps Delay Incident Detection
**Impact**: Medium (blind spots, slow response to issues)
**Probability**: Medium
**Prevention**:
- Comprehensive metric coverage (router compliance, budget accuracy, timeout rate, etc.)
- Real-time dashboards (Grafana) for technical metrics
- Daily/weekly metric validation (automated health checks)
- Alerts for all critical thresholds
- Runbooks for each alert type

**How This Blueprint Prevents It**:
- Metrics frozen in architecture (compliance targets table)
- Phase 2/3 include observability tasks (AI-017)
- Migration map defines monitoring cadence
- Success thresholds defined per phase

---

## Compliance Tracking

### Router Compliance (Target: 95%+)
**Measurement Query**:
```sql
SELECT
  endpoint,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN model NOT IN ('manual', 'legacy') THEN 1 END) as router_calls,
  (COUNT(CASE WHEN model NOT IN ('manual', 'legacy') THEN 1 END)::float / COUNT(*) * 100) as compliance_pct
FROM ai_usage_logs
WHERE created_at > now() - interval '7 days'
GROUP BY endpoint
HAVING compliance_pct < 95
ORDER BY total_calls DESC;
```

**Alert Threshold**: <95% compliance for any endpoint with >100 calls

---

### Budget Accuracy (Target: 100%)
**Measurement Query**:
```sql
SELECT
  b.month_yyyy_mm,
  b.spent_usd as tracked_spend,
  COALESCE(r.actual_spend, 0) as actual_spend,
  ABS(b.spent_usd - COALESCE(r.actual_spend, 0)) as delta,
  (ABS(b.spent_usd - COALESCE(r.actual_spend, 0)) / NULLIF(b.spent_usd, 0) * 100) as delta_pct
FROM ai_budgets b
LEFT JOIN (
  SELECT
    to_char(created_at, 'YYYY-MM') as month,
    SUM(cost_usd) as actual_spend
  FROM ai_runs
  WHERE created_at >= date_trunc('month', now() - interval '3 months')
  GROUP BY to_char(created_at, 'YYYY-MM')
) r ON b.month_yyyy_mm = r.month
WHERE b.month_yyyy_mm >= to_char(now() - interval '3 months', 'YYYY-MM')
  AND (delta > 1.0 OR delta_pct > 1.0)
ORDER BY b.month_yyyy_mm DESC;
```

**Alert Threshold**: Delta >$1 OR delta_pct >1% for current month

---

### Canonical Logging Coverage (Target: 100%)
**Measurement Query**:
```sql
-- Check for AI calls that didn't log to ai_usage_logs
SELECT
  endpoint,
  DATE(created_at) as day,
  COUNT(*) as calls
FROM (
  SELECT 'ai-ask' as endpoint, created_at FROM ai_runs WHERE created_at > now() - interval '7 days'
  UNION ALL
  SELECT 'generate-ai-content' as endpoint, created_at FROM ai_runs WHERE created_at > now() - interval '7 days'
) all_calls
WHERE NOT EXISTS (
  SELECT 1 FROM ai_usage_logs ul
  WHERE ul.endpoint = all_calls.endpoint
    AND ul.created_at BETWEEN all_calls.created_at - interval '5 seconds'
                          AND all_calls.created_at + interval '5 seconds'
)
GROUP BY endpoint, DATE(created_at)
HAVING COUNT(*) > 0;
```

**Alert Threshold**: Any missing ai_usage_logs entries for ai_runs

---

### Runtime Model Attribution (Target: 100%)
**Measurement Query**:
```sql
SELECT
  endpoint,
  model,
  COUNT(*) as calls,
  COUNT(CASE WHEN model LIKE '%2025%' OR model LIKE '%2024%' THEN 1 END) as with_runtime_model,
  (COUNT(CASE WHEN model LIKE '%2025%' OR model LIKE '%2024%' THEN 1 END)::float / COUNT(*) * 100) as runtime_pct
FROM ai_usage_logs
WHERE created_at > now() - interval '7 days'
GROUP BY endpoint, model
HAVING runtime_pct < 95
ORDER BY calls DESC;
```

**Alert Threshold**: Runtime model attribution <95% for any endpoint

---

### Timeout Coverage (Target: 100% in Phase 2)
**Measurement Method**: Code review + integration tests
- Phase 2 PR checklist: All provider fetch calls use fetchWithTimeout or fetchWithRetry
- Integration test (AI-010): Mock slow provider, verify timeout triggers

---

### Zero-Vector Rate (Target: 0% in Phase 2)
**Measurement Query**:
```sql
SELECT
  doc_type,
  COUNT(*) as total_embeddings,
  COUNT(CASE WHEN embedding = array_fill(0, ARRAY[1536]) THEN 1 END) as zero_vectors,
  (COUNT(CASE WHEN embedding = array_fill(0, ARRAY[1536]) THEN 1 END)::float / COUNT(*) * 100) as zero_pct
FROM ai_embeddings
WHERE created_at > now() - interval '7 days'
GROUP BY doc_type
HAVING zero_pct > 0
ORDER BY zero_pct DESC;
```

**Alert Threshold**: Any new zero-vector embeddings after Phase 2 deployment

---

### Citation Coverage (Target: 90% in Phase 3)
**Measurement Query**:
```sql
SELECT
  DATE(created_at) as day,
  COUNT(*) as total_rag_calls,
  COUNT(CASE WHEN citations IS NOT NULL AND jsonb_array_length(citations->'memory_citations') > 0 THEN 1 END) as with_citations,
  (COUNT(CASE WHEN citations IS NOT NULL AND jsonb_array_length(citations->'memory_citations') > 0 THEN 1 END)::float / COUNT(*) * 100) as coverage_pct
FROM ai_runs
WHERE created_at > now() - interval '7 days'
  AND prompt_id IN (SELECT id FROM ai_prompt_registry WHERE task_type IN ('client_portal_qa', 'strategy_plan'))
GROUP BY DATE(created_at)
HAVING coverage_pct < 90
ORDER BY day DESC;
```

**Alert Threshold**: Citation coverage <90% for RAG endpoints

---

## Migration Cutover Checklist

### Phase 2 Cutover (Timeouts + Embedding Hardening)

**Pre-Cutover** (Staging validation):
- [ ] Deploy timeout utilities to staging
- [ ] Run integration tests (AI-010) - 100% pass rate required
- [ ] Load test with 2× production traffic - timeout rate <2%
- [ ] Test all kill switches (verify rollback works)
- [ ] Validate zero-vector cleanup query (count affected embeddings)

**Cutover Steps**:
1. [ ] Deploy Phase 2 code to production (feature flags OFF)
2. [ ] Enable `AI_PROVIDER_TIMEOUTS=true` at 25% traffic
3. [ ] Monitor for 24h (timeout rate, retry rate, latency)
4. [ ] Ramp to 50% traffic
5. [ ] Monitor for 24h
6. [ ] Ramp to 100% traffic
7. [ ] Enable `AI_EMBEDDING_FAIL_HARD=true` at 50% traffic
8. [ ] Monitor ingestion failure rate for 24h
9. [ ] Ramp to 100%
10. [ ] Flag zero-vector embeddings (UPDATE query)
11. [ ] Add DB triggers to prevent ai_history/ai_generation_usage writes
12. [ ] Create backward compat views for legacy tables

**Post-Cutover** (Week 1):
- [ ] Daily timeout rate check (<2% threshold)
- [ ] Daily zero-vector count check (0 new embeddings)
- [ ] Daily ingestion failure rate check (<5% threshold)
- [ ] Weekly budget reconciliation (actual vs tracked)

**Post-Cutover** (Week 4):
- [ ] Delete flagged zero-vector embeddings (30 day grace period)
- [ ] Deprecation notice for ai_history/ai_generation_usage (90 day countdown)

---

### Phase 3 Cutover (RAG + Citations)

**Pre-Cutover** (Staging validation):
- [ ] Deploy ragPolicy.ts to staging
- [ ] Validate config parity (getRagConfig matches hardcoded values)
- [ ] Run integration tests (AI-016) - 100% pass rate required
- [ ] A/B test in staging (measure quality metrics)
- [ ] Deploy RAG observability dashboard

**Cutover Steps**:
1. [ ] Deploy Phase 3 code to production (feature flags OFF)
2. [ ] Enable `AI_RAG_CENTRALIZED=true` at 10% traffic (A/B test)
3. [ ] Monitor quality metrics for 48h (escalation rate, unknown rate)
4. [ ] Ramp to 50% traffic
5. [ ] Monitor for 48h
6. [ ] Ramp to 100%
7. [ ] Optional: Enable `AI_ADMIN_CHAT_SCHEMA=true` at 50% traffic
8. [ ] Monitor setup completion rate for 48h
9. [ ] Optional: Ramp to 100%
10. [ ] Add freeformReason to all freeform tasks (SUMMARIZE, admin chat if kept freeform)

**Post-Cutover** (Week 1):
- [ ] Daily citation coverage check (>90% threshold)
- [ ] Daily escalation rate check (<5% threshold)
- [ ] Daily unknown rate check (<10% threshold)
- [ ] RAG observability dashboard review

**Post-Cutover** (Week 4):
- [ ] Remove hardcoded top_k constants from edge functions (cleanup)
- [ ] Audit unused edge functions (ai-retrieve-context, ai-answer-quality-check)
- [ ] Delete unused endpoints if zero invocations for 30 days

---

## Emergency Rollback Procedures

### Budget Overage Emergency
**Trigger**: spent_usd exceeds budget_usd by >$10

**Response**:
1. Set `AI_BUDGET_ENFORCEMENT=false` in env (log-only mode, no blocking)
2. Query high-cost calls:
   ```sql
   SELECT * FROM ai_runs WHERE cost_usd > 1.0 ORDER BY created_at DESC LIMIT 100;
   ```
3. Investigate anomaly (model change, prompt size spike, retry storm)
4. Adjust budget OR fix root cause
5. Re-enable enforcement (`AI_BUDGET_ENFORCEMENT=true`)

**Escalation**: Notify finance team if overage >$100, CTO if >$1000

---

### Provider Outage Emergency
**Trigger**: Circuit breaker opens OR timeout rate >10%

**Response**:
1. Check provider status page (status.openai.com)
2. Communicate to users (banner: "AI features temporarily degraded")
3. Enable graceful degradation (return cached responses or helpful error)
4. Monitor circuit breaker for recovery
5. Post-mortem: review retry budget, adjust thresholds

**Escalation**: Notify AI team immediately, CTO if outage >1 hour

---

### RAG Quality Degradation Emergency
**Trigger**: Escalation rate >10% OR unknown rate >20%

**Response**:
1. Set `AI_RAG_CENTRALIZED=false` (rollback to hardcoded values)
2. Query failing cases:
   ```sql
   SELECT * FROM ai_runs WHERE escalate_to_human = true OR unknown = true
   ORDER BY created_at DESC LIMIT 50;
   ```
3. Investigate root cause (bad config, embedding quality, prompt regression)
4. Hotfix OR rollback offending change
5. A/B test fix before re-deploying

**Escalation**: Notify product team if user complaints spike, CTO if affects >20% of queries

---

**Document Status**: ACTIVE migration guide
**Last Updated**: 2025-12-27
**Phase 1 Completion**: ✅ Confirmed
**Next Phase**: Phase 2 (Provider Timeouts + Embedding Hardening)

---

*This migration map is the authoritative guide for transitioning SMMAHUB AI infrastructure from current state to frozen target architecture. All migrations must follow this plan. Deviations require explicit amendment with justification.*
