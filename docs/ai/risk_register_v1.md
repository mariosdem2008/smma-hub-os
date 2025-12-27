# AI Employee Risk Register v1

## Risk Assessment Framework

**Impact Levels**:
- **Critical**: Production outage, data loss, budget overruns >$1000, security breach
- **High**: Feature degradation, budget overruns $100-$1000, compliance issues
- **Medium**: Performance degradation, minor UX issues, budget overruns <$100
- **Low**: Cosmetic issues, log noise, minor monitoring gaps

**Probability Levels**:
- **High**: >50% chance of occurring during implementation
- **Medium**: 20-50% chance of occurring during implementation
- **Low**: <20% chance of occurring during implementation

**Risk Score**: Impact × Probability (1-4 scale each, max 16)

---

## Top 10 Risks (Ordered by Score)

### R1: Budget Double-Counting During Migration
**Impact**: High (budget overruns, billing disputes)
**Probability**: Medium
**Score**: 12
**Phase**: Phase 1

**Description**: During dual-write period, budget increments could be counted twice if both legacy and new code paths execute.

**Root Cause**: Transitional state with both old and new logging active.

**Mitigation**:
1. Only increment budget in new code path (canonical logging)
2. Legacy writes skip budget updates entirely
3. Add integration test that verifies single increment per call
4. Monitor ai_budgets.spent_usd daily against provider invoices
5. Add circuit breaker: if spent_usd > 2× expected, alert and pause AI calls

**Kill Switch**: `AI_BUDGET_ENFORCEMENT_V2=false` reverts to legacy (no increment, read-only budget checks)

**Detection**: Daily reconciliation query:
```sql
SELECT
  month_yyyy_mm,
  spent_usd as tracked,
  (SELECT SUM(cost_usd) FROM ai_runs WHERE date_trunc('month', created_at)::text = month_yyyy_mm) as actual,
  ABS(spent_usd - (SELECT SUM(cost_usd) FROM ai_runs WHERE date_trunc('month', created_at)::text = month_yyyy_mm)) as delta
FROM ai_budgets
WHERE month_yyyy_mm = to_char(now(), 'YYYY-MM')
  AND delta > 1.0; -- alert if off by >$1
```

**Rollback Plan**: Revert budget increment code, continue dual logging with legacy budget tracking

---

### R2: Provider Timeout Breaks User Experience
**Impact**: High (user-facing errors, support tickets)
**Probability**: Medium
**Score**: 12
**Phase**: Phase 2

**Description**: 30s timeout may be too aggressive for complex prompts (e.g., strategy generation with large RAG context), causing user-visible failures.

**Root Cause**: One-size-fits-all timeout doesn't account for task complexity.

**Mitigation**:
1. Make timeout configurable per task type:
   - EMBED_TEXT: 10s (simple, fast)
   - CHAT_GENERAL: 30s (default)
   - STRATEGY_PLAN: 60s (complex, large context)
   - SUMMARIZE: 45s (moderate complexity)
2. Add timeout extension for streaming endpoints (no timeout on stream reads, only initial connection)
3. Return graceful UNKNOWN response on timeout instead of HTTP 500
4. Log timeout events to ai_usage_logs with error_code='TIMEOUT'
5. Monitor timeout rate by task type, alert if >2% for any task

**Kill Switch**: `AI_PROVIDER_TIMEOUTS=false` disables timeout wrapper entirely

**Detection**: Timeout rate dashboard:
```sql
SELECT
  endpoint,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN latency_ms > 30000 THEN 1 END) as timeouts,
  (COUNT(CASE WHEN latency_ms > 30000 THEN 1 END)::float / COUNT(*) * 100) as timeout_pct
FROM ai_usage_logs
WHERE created_at > now() - interval '1 hour'
GROUP BY endpoint
HAVING timeout_pct > 2;
```

**Rollback Plan**: Remove timeout wrapper from provider fetch calls, revert to unbounded requests

---

### R3: Embedding Ingestion Fails on Transient Errors
**Impact**: Medium (ingestion failures, user re-uploads)
**Probability**: High
**Score**: 12
**Phase**: Phase 2

**Description**: Removing zero-vector fallback means any transient API error (rate limit, network blip) fails entire ingestion.

**Root Cause**: Hard failure mode without retry queue.

**Mitigation**:
1. Provider retry logic (3 attempts with exponential backoff) mitigates most transient errors
2. Add ingestion retry queue (Phase 3 enhancement):
   - Failed chunks saved to `ai_ingestion_queue` table
   - Background worker retries every 5min (max 10 attempts over 1 hour)
   - Alert if queue length > 100
3. Return partial success to user: "Ingested 90/100 chunks, 10 retrying in background"
4. Add manual retry button in UI for failed ingestions
5. Monitor ingestion failure rate, alert if >5%

**Kill Switch**: `AI_EMBEDDING_FAIL_HARD=false` restores zero-vector fallback with warning logs

**Detection**: Ingestion failure dashboard:
```sql
SELECT
  doc_type,
  COUNT(*) as total_ingestions,
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as failures,
  (COUNT(CASE WHEN error IS NOT NULL THEN 1 END)::float / COUNT(*) * 100) as failure_pct
FROM ai_documents
WHERE created_at > now() - interval '24 hours'
GROUP BY doc_type
HAVING failure_pct > 5;
```

**Rollback Plan**: Restore zero-vector fallback, mark fallback embeddings in metadata

---

### R4: RAG Quality Degrades After Config Changes
**Impact**: Medium (worse answer quality, increased escalations)
**Probability**: Medium
**Score**: 9
**Phase**: Phase 3

**Description**: Centralizing RAG config may inadvertently change top_k allocation or doc_type filters, degrading answer quality.

**Root Cause**: Bugs in ragPolicy.ts or misaligned config vs current hardcoded values.

**Mitigation**:
1. Start with exact parity: ragPolicy config matches current hardcoded values
2. A/B test any config changes (50/50 split, monitor quality metrics):
   - Escalation rate (target: <5%)
   - Unknown response rate (target: <10%)
   - Average confidence score (target: >0.7)
   - User feedback thumbs up/down ratio (target: >80% positive)
3. Add integration tests that verify RAG retrieval count matches expected
4. Gradual rollout with feature flag: `AI_RAG_CENTRALIZED=true` (start at 10%, ramp to 100% over 3 days)
5. Monitor retrieval metrics in real-time dashboard

**Kill Switch**: `AI_RAG_CENTRALIZED=false` reverts to hardcoded top_k values in edge functions

**Detection**: Quality degradation query:
```sql
-- Monitor escalation rate
SELECT
  DATE(created_at) as day,
  COUNT(*) as total_runs,
  COUNT(CASE WHEN escalate_to_human THEN 1 END) as escalations,
  (COUNT(CASE WHEN escalate_to_human THEN 1 END)::float / COUNT(*) * 100) as escalation_pct
FROM ai_runs
WHERE created_at > now() - interval '7 days'
  AND prompt_id IN (SELECT id FROM ai_prompt_registry WHERE task_type = 'rag_ask')
GROUP BY DATE(created_at)
HAVING escalation_pct > 5;
```

**Rollback Plan**: Revert ragPolicy config to previous values, or disable centralized config entirely

---

### R5: Race Condition on Budget Enforcement
**Impact**: Critical (budget exceeded, unexpected costs)
**Probability**: Low
**Score**: 8
**Phase**: Phase 1

**Description**: Concurrent AI calls could bypass budget check if two calls read budget simultaneously before either increments.

**Root Cause**: Non-atomic read-check-increment operation.

**Mitigation**:
1. Use `SELECT FOR UPDATE` lock on budget row during check:
   ```sql
   SELECT * FROM ai_budgets
   WHERE agency_id = $1 AND month_yyyy_mm = $2
   FOR UPDATE; -- locks row
   ```
2. Perform check and increment in single transaction:
   ```sql
   BEGIN;
   -- Lock budget row
   SELECT spent_usd, budget_usd, hard_stop FROM ai_budgets WHERE ... FOR UPDATE;
   -- Check if budget exceeded
   IF spent_usd >= budget_usd AND hard_stop THEN ROLLBACK; END IF;
   -- Increment atomically
   UPDATE ai_budgets SET spent_usd = spent_usd + $cost WHERE ... ;
   COMMIT;
   ```
3. Add pessimistic concurrency test: 100 parallel AI calls, verify budget never exceeded
4. Monitor budget overage alerts: if spent_usd > budget_usd + $10, page on-call

**Kill Switch**: `AI_BUDGET_ENFORCEMENT=false` disables budget checks entirely (log-only mode)

**Detection**: Budget overage query:
```sql
SELECT * FROM ai_budgets
WHERE hard_stop = true
  AND spent_usd > budget_usd + 10
  AND month_yyyy_mm = to_char(now(), 'YYYY-MM');
```

**Rollback Plan**: Disable budget enforcement via kill switch, investigate overage, refund or adjust budget

---

### R6: Cost Calculation Inaccuracy
**Impact**: Medium (budget tracking drift, billing reconciliation)
**Probability**: Medium
**Score**: 6
**Phase**: Phase 1

**Description**: Estimated cost may diverge from actual provider cost due to pricing changes, model updates, or token counting differences.

**Root Cause**: Hardcoded cost-per-token rates in code vs actual provider pricing.

**Mitigation**:
1. Use actual token counts from provider response (OpenAI includes usage.prompt_tokens, usage.completion_tokens)
2. Fallback cost estimation formula if provider doesn't return tokens:
   ```typescript
   // Conservative estimate (over-estimate to avoid budget surprise)
   const estimatedTokensIn = Math.ceil(inputText.length / 3) // chars/3 more conservative than chars/4
   const estimatedTokensOut = Math.ceil(outputText.length / 3)
   ```
3. Pull cost-per-token rates from config (not hardcoded):
   ```typescript
   // src/ai/pricing.ts
   export const PRICING = {
     'gpt-5-nano': { input: 0.0000015, output: 0.000006 }, // per token
     'gpt-5-mini': { input: 0.0000025, output: 0.00001 },
     'text-embedding-3-small': { input: 0.00000002, output: 0 }
   }
   ```
4. Monthly reconciliation: compare ai_budgets.spent_usd with actual provider invoice, adjust if >5% drift
5. Alert if cost estimation error >10% on any call (log actual vs estimated)

**Kill Switch**: N/A (cost tracking is observability, not enforcement)

**Detection**: Cost drift query:
```sql
-- Compare estimated vs actual cost (if provider returns cost in metadata)
SELECT
  model,
  COUNT(*) as calls,
  SUM(cost_usd) as total_cost,
  AVG(cost_usd) as avg_cost,
  STDDEV(cost_usd) as cost_stddev
FROM ai_runs
WHERE created_at > now() - interval '7 days'
GROUP BY model;
```

**Rollback Plan**: Adjust pricing config, backfill cost_usd in ai_runs if needed

---

### R7: Admin Chat Schema Migration Breaks UX
**Impact**: High (admin productivity loss, setup flow broken)
**Probability**: Low
**Score**: 8
**Phase**: Phase 3

**Description**: Migrating admin chat from freeform to schema output may change response format, breaking UI parsing or degrading conversational quality.

**Root Cause**: Schema constrains LLM output, may reduce flexibility.

**Mitigation**:
1. A/B test schema vs freeform (50/50 split):
   - Group A: New schema output
   - Group B: Legacy freeform parsing
2. Monitor user feedback and completion rate:
   - Setup completion rate (target: >90%)
   - Average setup time (target: <10min)
   - User satisfaction score (target: >4/5)
3. Gradual rollout: 10% → 25% → 50% → 100% over 7 days
4. Keep freeform parser as fallback if schema fails validation
5. Add manual override button for admins to switch to freeform mode

**Kill Switch**: `AI_ADMIN_CHAT_SCHEMA=false` reverts to freeform output

**Detection**: Setup completion rate query:
```sql
SELECT
  DATE(created_at) as day,
  COUNT(*) as total_sessions,
  COUNT(CASE WHEN completed THEN 1 END) as completed,
  (COUNT(CASE WHEN completed THEN 1 END)::float / COUNT(*) * 100) as completion_pct
FROM agency_onboarding_sessions
WHERE created_at > now() - interval '7 days'
GROUP BY DATE(created_at)
HAVING completion_pct < 90;
```

**Rollback Plan**: Revert to freeform parsing, keep schema output as opt-in feature

---

### R8: Legacy Table Deprecation Breaks Reporting
**Impact**: Medium (historical reports broken, analytics gaps)
**Probability**: Low
**Score**: 6
**Phase**: Phase 1

**Description**: Deprecating ai_history and ai_generation_usage tables may break existing reports, dashboards, or admin queries.

**Root Cause**: Unknown dependencies on legacy tables.

**Mitigation**:
1. Audit all queries against legacy tables before deprecation:
   ```bash
   rg "ai_history|ai_generation_usage" src/ --type ts
   rg "ai_history|ai_generation_usage" supabase/migrations/ --type sql
   ```
2. Create migration views for backwards compatibility:
   ```sql
   CREATE VIEW ai_history AS
   SELECT
     id,
     agency_id,
     client_id,
     project_id,
     'content_generation' as mode,
     metadata->>'input' as input,
     metadata->>'output' as output,
     created_at
   FROM ai_runs
   WHERE prompt_id IN (SELECT id FROM ai_prompt_registry WHERE task_type = 'content_ideas');
   ```
3. Add DB triggers to prevent new writes (raise exception with migration guide)
4. Keep legacy tables readable for 90 days post-migration
5. Add deprecation warnings in UI for any features that read legacy tables

**Kill Switch**: N/A (read-only deprecation, no enforcement)

**Detection**: Legacy table read queries:
```sql
-- Monitor reads against legacy tables
SELECT
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch
FROM pg_stat_user_tables
WHERE relname IN ('ai_history', 'ai_generation_usage')
  AND (seq_scan > 0 OR idx_scan > 0);
```

**Rollback Plan**: Re-enable writes to legacy tables if critical dependency found

---

### R9: Provider Retry Storm on Outage
**Impact**: High (cascading failures, increased costs)
**Probability**: Low
**Score**: 8
**Phase**: Phase 2

**Description**: If OpenAI has an outage, retry logic could amplify load and costs (3× retries on every call).

**Root Cause**: No circuit breaker to detect systemic failures.

**Mitigation**:
1. Implement circuit breaker pattern:
   - Track error rate over 5min rolling window
   - If error rate >50%, open circuit (fail fast without retries)
   - Half-open state: allow 1 test call every 30s to check recovery
   - Close circuit when test calls succeed
2. Exponential backoff with jitter to avoid thundering herd
3. Max retry budget per minute (e.g., 1000 retries/min across all calls)
4. Alert if circuit breaker opens (provider outage detected)
5. Graceful degradation: return cached responses or UNKNOWN when circuit open

**Kill Switch**: `AI_PROVIDER_RETRIES=false` disables retry logic (single attempt only)

**Detection**: Circuit breaker state monitoring:
```typescript
// In src/ai/providers/utils.ts
export const circuitBreakerState = {
  openai: 'closed', // closed | open | half-open
  lastError: null,
  errorRate: 0.0
}

// Monitor endpoint
app.get('/api/health/circuit-breakers', (req, res) => {
  res.json(circuitBreakerState)
})
```

**Rollback Plan**: Disable retries via kill switch, rely on provider recovery

---

### R10: Observability Dashboard Incomplete
**Impact**: Medium (blind spots, delayed incident detection)
**Probability**: Medium
**Score**: 6
**Phase**: All Phases

**Description**: Observability dashboards may not capture all critical metrics, leading to undetected issues.

**Root Cause**: Incomplete metric coverage or misconfigured alerts.

**Mitigation**:
1. Define minimum required metrics (see plan_v1.md):
   - Router compliance %
   - Budget accuracy delta
   - Provider timeout rate
   - Zero-vector embedding rate
   - RAG retrieval count avg
   - Citation coverage rate
2. Add health check endpoint that validates all metrics are reporting:
   ```typescript
   GET /api/health/ai-metrics
   {
     "router_compliance": { "value": 95.2, "healthy": true },
     "budget_accuracy": { "value": 0.02, "healthy": true },
     "timeout_rate": { "value": 1.3, "healthy": true },
     ...
   }
   ```
3. Daily metric validation job: alert if any metric missing data >1 hour
4. Staged dashboard rollout: validate in staging before production deployment
5. Runbook for each alert with investigation steps and escalation path

**Kill Switch**: N/A (observability doesn't affect user-facing functionality)

**Detection**: Metric freshness query:
```sql
-- Check if metrics are updating
SELECT
  endpoint,
  MAX(created_at) as last_logged,
  now() - MAX(created_at) as staleness
FROM ai_usage_logs
GROUP BY endpoint
HAVING now() - MAX(created_at) > interval '1 hour';
```

**Rollback Plan**: N/A (observability is additive, no rollback needed)

---

## Risk Monitoring Cadence

### Pre-Deployment (Staging)
- [ ] Run full integration test suite (100% pass rate required)
- [ ] Load test with 2× production traffic (no errors, p99 latency <10s)
- [ ] Budget accuracy validation with test provider (delta <1%)
- [ ] Test all kill switches (verify rollback works)
- [ ] Validate observability dashboards (all metrics reporting)

### Phase 1 Deployment (Days 1-3)
- [ ] Daily budget reconciliation (spent_usd vs ai_runs.cost_usd, alert if delta >$1)
- [ ] Monitor dual logging coverage (both legacy and canonical tables, 100% coverage)
- [ ] Track runtime model attribution (logged model matches provider, 100% accuracy)
- [ ] Watch for budget double-counting (no anomalous spikes)

### Phase 2 Deployment (Days 3-7)
- [ ] Hourly timeout rate monitoring (alert if >2% for any endpoint)
- [ ] Daily zero-vector embedding check (alert if any new zero-vectors created)
- [ ] Provider retry rate tracking (alert if >5%)
- [ ] Circuit breaker state monitoring (alert if circuit opens)

### Phase 3 Deployment (Days 7-14)
- [ ] Daily RAG quality metrics (escalation rate <5%, unknown rate <10%)
- [ ] A/B test results review (compare schema vs freeform admin chat)
- [ ] Citation coverage monitoring (>90% of answers include citations)
- [ ] Observability dashboard validation (all metrics healthy)

### Post-Deployment (Ongoing)
- [ ] Weekly budget reconciliation with provider invoices (delta <5%)
- [ ] Monthly compliance audit (router compliance >95%, schema enforcement >85%)
- [ ] Quarterly risk register review (update mitigation effectiveness, retire resolved risks)

---

## Incident Response Runbook

### Budget Overage Incident
**Trigger**: spent_usd exceeds budget_usd + $10

**Response**:
1. Activate kill switch: `AI_BUDGET_ENFORCEMENT=false` (log-only mode)
2. Query recent high-cost calls:
   ```sql
   SELECT * FROM ai_runs
   WHERE cost_usd > 1.0
   ORDER BY created_at DESC LIMIT 100;
   ```
3. Investigate anomaly: model change, prompt size spike, retry storm?
4. Adjust budget or fix root cause
5. Re-enable enforcement with increased budget or fix deployed

**Escalation**: Notify finance team if overage >$100, CTO if overage >$1000

---

### Provider Outage Incident
**Trigger**: Circuit breaker opens OR timeout rate >10%

**Response**:
1. Check provider status page (status.openai.com)
2. If confirmed outage, communicate to users (banner: "AI features temporarily degraded")
3. Enable graceful degradation: return cached responses or helpful error messages
4. Monitor circuit breaker for recovery (half-open → closed transition)
5. Post-mortem: review retry budget, adjust circuit breaker thresholds if needed

**Escalation**: Notify AI team immediately, CTO if outage >1 hour

---

### RAG Quality Degradation Incident
**Trigger**: Escalation rate >10% OR unknown rate >20%

**Response**:
1. Activate kill switch for recent change (e.g., `AI_RAG_CENTRALIZED=false`)
2. Query failing cases:
   ```sql
   SELECT * FROM ai_runs
   WHERE escalate_to_human = true OR unknown = true
   ORDER BY created_at DESC LIMIT 50;
   ```
3. Investigate root cause: bad RAG config, embedding quality, prompt regression?
4. Rollback offending change or hotfix
5. A/B test fix before re-deploying

**Escalation**: Notify product team if user complaints spike, CTO if affects >20% of queries

---

## Post-Mortem Template

**Incident**: [Brief description]
**Date**: [YYYY-MM-DD]
**Duration**: [X hours]
**Impact**: [Users affected, $ cost, features degraded]

**Timeline**:
- [HH:MM] Incident detected via [alert/metric]
- [HH:MM] Investigation started
- [HH:MM] Root cause identified: [description]
- [HH:MM] Mitigation deployed: [kill switch/rollback/hotfix]
- [HH:MM] Incident resolved

**Root Cause**: [Technical explanation]

**Action Items**:
1. [ ] [Preventative measure]
2. [ ] [Monitoring improvement]
3. [ ] [Documentation update]

**Lessons Learned**: [What went well, what to improve]

---

*Generated: 2025-12-26*
*Risk register for AI Employee v1 Sprint 2*
