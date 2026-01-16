# Strategy Builder End-to-End Audit

## Audit Date: 2026-01-10

---

## 1. Strategy Generation Triggers

### UI Trigger

**Location:** [StrategyHubTab.tsx](src/components/client-tabs/StrategyHubTab.tsx)

| Button | Action | Edge Function |
|--------|--------|---------------|
| "Generate Strategy" | `generateDocument()` | `ai-strategy-generate` |
| "Regenerate" | `generateDocument()` | `ai-strategy-generate` |

**Hook:** [useStrategyDocuments.ts:67](src/hooks/useStrategyDocuments.ts#L67)

```typescript
const response = await supabase.functions.invoke("ai-strategy-generate", {
  body: { client_id: clientId, instruction },
});
```

### Job Worker Trigger

**Location:** [ai-job-worker/index.ts:112-117](supabase/functions/ai-job-worker/index.ts#L112-L117)

```typescript
if (jobType === "seed_strategy") {
  const response = await invokeStrategyGenerate(SUPABASE_URL, cronSecret, clientId);
  if (!response.ok) {
    throw new Error(response.error ?? "Strategy generation failed");
  }
}
```

### Onboarding Completion Trigger

**Location:** [20260108152000_ai_jobs_queue.sql:101-150](supabase/migrations/20260108152000_ai_jobs_queue.sql#L101-L150)

```sql
-- Triggered by complete_onboarding_profile RPC
insert into public.ai_jobs (
  job_type,
  dedupe_key
) values (
  'seed_strategy',
  'seed_strategy:' || p_client_id::text
);
```

---

## 2. Generation Flow

### Preconditions

1. **Authentication:**
   - Bearer token (user) OR CRON_SECRET (job worker)
   - [ai-strategy-generate/index.ts:143-167](supabase/functions/ai-strategy-generate/index.ts#L143-L167)

2. **Agency Membership:**
   - User must be member of client's agency
   - [ai-strategy-generate/index.ts:156-165](supabase/functions/ai-strategy-generate/index.ts#L156-L165)

3. **Brain Usability:**
   - Client brain must pass `evaluateClientBrainForStrategy()`
   - [ai-strategy-generate/index.ts:182-196](supabase/functions/ai-strategy-generate/index.ts#L182-L196)

### Data Fetching

| Data | Table | Purpose |
|------|-------|---------|
| Client | `clients` | Get agency_id |
| Client Brain | `client_brains` | Brain JSON for context |
| Agency Brain | `agency_brains` | Agency context |
| Onboarding | `client_onboarding_profiles` | Full profile data |
| Existing Strategy | `strategies`, `strategy_modules` | Prior version for context |

### RAG Retrieval

**Location:** [ai-strategy-generate/index.ts:273-307](supabase/functions/ai-strategy-generate/index.ts#L273-L307)

Three parallel retrieval calls:
1. **Client docs:** client_guidelines, client_notes, approved_posts, ai_artifact, strategy_draft
2. **Agency docs:** agency_sop, brain_document (approved only)
3. **Exemplars:** agency_exemplar_strategy

### LLM Call

**Location:** [ai-strategy-generate/index.ts:352-370](supabase/functions/ai-strategy-generate/index.ts#L352-L370)

```typescript
aiResult = await ai.run({
  taskType: TaskType.STRATEGY_PLAN,
  input: "",
  context: { agencyId, clientId, userId: actingUserId, environment: "prod", supabase },
  metadata: { context: promptContext, instruction },
  outputSchema,
});
```

---

## 3. Atomicity Verification

### Strategy Snapshot RPC

**Location:** [20260108143000_strategy_snapshot_rpc.sql:3-176](supabase/migrations/20260108143000_strategy_snapshot_rpc.sql#L3-L176)

**Function:** `create_strategy_snapshot`

**Atomic Operations (single transaction):**

1. **Create/Select Strategy:**
   ```sql
   insert into public.strategies (...)
   values (...) returning id into v_strategy_id;
   ```

2. **Deactivate Old Documents:**
   ```sql
   update public.strategy_documents
   set is_active = false
   where client_id = p_client_id;
   ```

3. **Insert New Document:**
   ```sql
   insert into public.strategy_documents (...)
   values (...) returning id into v_document_id;
   ```

4. **Upsert Modules (loop):**
   ```sql
   insert into public.strategy_modules (...)
   on conflict (strategy_id, module) do update set ...;
   ```

5. **Upsert Decisions (if provided):**
   ```sql
   insert into public.strategy_decisions (...)
   on conflict (strategy_id, module, decision_key) do update set ...;
   ```

6. **Insert Tasks (if provided):**
   ```sql
   insert into public.strategy_tasks (...) values (...);
   ```

### Failure Mode

**If any step fails:** Entire transaction rolls back. No partial state.

**Evidence:** Function uses `language plpgsql` with implicit transaction block. All inserts/updates within single function call.

### Verification

| Scenario | Expected Behavior | Verified |
|----------|-------------------|----------|
| LLM fails | No RPC call, no DB changes | PASS |
| RPC fails | Transaction rollback, no partial writes | PASS |
| Schema validation fails | Early return, no RPC call | PASS |

---

## 4. Freshness Hash (`derived_from_hash`)

### Computation

**Location:** [ai-strategy-generate/index.ts:437-447](supabase/functions/ai-strategy-generate/index.ts#L437-L447)

```typescript
const derivedFromHash = await sha256Hex(
  stableStringify({
    onboardingProfile,
    scan: {
      ai_scan_result: onboardingProfile?.ai_scan_result ?? null,
      ai_scan_at: onboardingProfile?.ai_scan_at ?? null,
      ai_scan_accepted: onboardingProfile?.ai_scan_accepted ?? null,
    },
    brain_documents: brainDocVersions,
  }),
);
```

### Inputs Included

| Input | Source | Notes |
|-------|--------|-------|
| Onboarding profile | `client_onboarding_profiles` | Full profile |
| AI scan result | Onboarding profile | Scan output |
| AI scan timestamp | Onboarding profile | When scanned |
| AI scan accepted | Onboarding profile | User accepted |
| Brain documents | RAG citations | id, module, version, status, approved_at |

### Hash Algorithm

**Function:** [ai-strategy-generate/index.ts:70-76](supabase/functions/ai-strategy-generate/index.ts#L70-L76)

```typescript
async function sha256Hex(input: string) {
  const buffer = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
```

### Stable Stringification

**Location:** [ai-strategy-generate/index.ts:58-68](supabase/functions/ai-strategy-generate/index.ts#L58-L68)

Object keys sorted alphabetically to ensure deterministic output.

### UI Staleness Detection

To detect stale strategy:
1. Compute current hash from latest onboarding + brain docs
2. Compare with `derived_from_hash` on strategy_documents
3. If different, strategy is stale

---

## 5. Schema Validation

### Output Schema

**Location:** [strategy-output.ts:230-283](supabase/functions/_shared/strategy-output.ts#L230-L283)

**Required Modules:**
1. `positioning` - Target, differentiator, benefit
2. `pillars` - Content pillars with coverage
3. `campaign_plan` - Monthly campaigns
4. `weekly_plan` - Week-by-week focus
5. `channel_adaptations` - Platform rules
6. `rules_constraints` - Claims policy, banned words

**Per-Module Evidence Fields:**
- `facts_used: string[]`
- `assumptions: string[]`
- `open_questions: string[]` (max 5)
- `confidence_0_100: number`

### Validation Flow

**Location:** [ai-strategy-generate/index.ts:372-400](supabase/functions/ai-strategy-generate/index.ts#L372-L400)

```typescript
if (!aiResult?.schemaOk || !output) {
  return jsonResponse({ error: "Strategy JSON invalid", code: "STRATEGY_SCHEMA_INVALID" }, 500);
}
```

### Test Coverage

**Test File:** [strategy-output.test.ts](supabase/functions/_shared/__tests__/strategy-output.test.ts)

- Validates open_questions limit (max 5)
- Validates module structure
- Validates confidence range

---

## 6. Task Auto-Generation

### Validation Tasks

**Location:** [ai-strategy-generate/index.ts:455-469](supabase/functions/ai-strategy-generate/index.ts#L455-L469)

```typescript
const autoValidationTasks = Object.entries(output.modules)
  .filter(([, content]) => (content as any).confidence_0_100 < 70)
  .map(([module, content]) => ({
    module,
    title: `Validate ${MODULE_LABELS[module] ?? module} module`,
    description: `Open questions: ${questions.slice(0, 5).join("; ")}`,
    priority: "high",
    dedupe_key: `validation:${module}`,
  }));
```

### Deduplication

**Location:** [ai-strategy-generate/index.ts:472-480](supabase/functions/ai-strategy-generate/index.ts#L472-L480)

```typescript
const tasksPayload = Array.from(
  taskRows.reduce((map, task) => {
    const key = task.dedupe_key ?? `${task.module ?? "general"}:${task.title}`;
    if (!map.has(key)) {
      map.set(key, task);
    }
    return map;
  }, new Map<string, any>())
).map(([, task]) => task);
```

---

## 7. Tables Written

| Table | Operation | Location |
|-------|-----------|----------|
| `strategies` | INSERT (if new) | RPC line 36-38 |
| `strategy_documents` | UPDATE (deactivate old) + INSERT | RPC lines 41-69 |
| `strategy_modules` | UPSERT (per module) | RPC lines 71-102 |
| `strategy_decisions` | UPSERT (if provided) | RPC lines 104-127 |
| `strategy_tasks` | INSERT (per task) | RPC lines 129-168 |
| `ai_runs` | INSERT | edge function |
| `ai_usage_logs` | INSERT | edge function |

---

## 8. Verified Invariants

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Atomic writes | PASS | Single RPC transaction |
| No partial states | PASS | Transaction rollback on failure |
| Brain usability gate | PASS | evaluateClientBrainForStrategy check |
| Auth required | PASS | Bearer token or CRON_SECRET |
| Freshness hash computed | PASS | SHA-256 of stable inputs |
| Schema validated | PASS | strategyOutputSchema.safeParse |
| Tasks deduplicated | PASS | Map-based deduplication |
| Low confidence tasks created | PASS | confidence < 70 check |
