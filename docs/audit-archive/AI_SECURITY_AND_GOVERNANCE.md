# AI Security and Governance Audit

## Audit Date: 2026-01-10

---

## 1. Row Level Security (RLS)

### AI Tables with RLS

| Table | RLS Enabled | Key Policy |
|-------|-------------|------------|
| `ai_documents` | Yes | Agency member access |
| `ai_document_chunks` | Yes | Via ai_documents join |
| `ai_embeddings` | Yes | Via ai_documents join |
| `ai_runs` | Yes | Agency member read |
| `ai_usage_logs` | Yes | Agency admin read |
| `ai_budgets` | Yes | Agency access |
| `ai_rate_limits` | Yes | Agency + user access |
| `ai_jobs` | Yes | Admin select only |
| `agency_brains` | Yes | Agency member access |
| `client_brains` | Yes | Agency member access |
| `brain_documents` | Yes | Agency member access |
| `strategies` | Yes | Agency member access |
| `strategy_modules` | Yes | Via strategies join |
| `strategy_documents` | Yes | Agency member access |
| `strategy_tasks` | Yes | Via strategies join |
| `strategy_decisions` | Yes | Via strategies join |

### Common RLS Pattern

```sql
create policy "table_agency_access"
on public.table_name
for select
to authenticated
using (
  exists (
    select 1 from public.agency_members am
    where am.agency_id = table_name.agency_id
      and am.user_id = auth.uid()
  )
);
```

---

## 2. Edge Function Auth Checks

### Authentication Patterns

| Pattern | Implementation | Functions Using |
|---------|----------------|-----------------|
| Bearer Token | `supabase.auth.getUser(token)` | Most AI functions |
| CRON Secret | `verifyCronSecret()` | ai-job-worker |
| Portal Auth | Portal session validation | ai-rep-chat |

### Example: Strategy Generate Auth

**Location:** [ai-strategy-generate/index.ts:143-167](supabase/functions/ai-strategy-generate/index.ts#L143-L167)

```typescript
// CRON path
const isCron = cronSecret.length > 0 && cronHeader === cronSecret;
if (isCron) {
  // Lookup admin user for job execution
}

// User path
const token = authHeader.replace("Bearer ", "");
const { data: userData } = await supabase.auth.getUser(token);

// Agency membership check
const { data: membership } = await supabase
  .from("agency_members")
  .select("agency_id")
  .eq("user_id", user.id)
  .eq("agency_id", agencyId)
  .maybeSingle();

if (!membership) {
  return jsonResponse({ error: "Forbidden" }, 403);
}
```

---

## 3. Endpoint Quarantine

### Implementation

**Location:** [endpoint-guard.ts](supabase/functions/_shared/endpoint-guard.ts)

### Allowlist

```typescript
const UI_ENDPOINT_ALLOWLIST = new Set([
  "ai-agency-admin-chat",
  "ai-brain-analyze",
  "ai-brain-document-approve",
  "ai-brain-ingest",
  "ai-brains-agency",
  "ai-brains-client",
  "ai-job-worker",
  "ai-onboarding-scan",
  "ai-onboarding-suggest",
  "ai-rep-chat",
  "ai-strategy-generate",
  "generate-ai-content",
]);
```

### Guard Logic

```typescript
export function getEndpointGuardResponse(endpoint: string, headers: Record<string, string> = {}) {
  const allowUnused = getEnvFlag("ENABLE_UNUSED_AI_ENDPOINTS") === "true";
  if (allowUnused) return null;
  if (UI_ENDPOINT_ALLOWLIST.has(endpoint)) return null;

  return new Response(
    JSON.stringify({ error: "Endpoint disabled by default", code: "ENDPOINT_DISABLED" }),
    { status: 403 },
  );
}
```

### Quarantined Endpoints

| Endpoint | Status | Notes |
|----------|--------|-------|
| `ai-ask` | Quarantined | Not in allowlist |
| `ai-retrieve-context` | Quarantined | Not in allowlist |
| `ai-answer-quality-check` | Quarantined | Not in allowlist |
| `ai-documents-ingest` | Quarantined | Not in allowlist |
| `ai-onboarding-guide` | Quarantined | Not in allowlist |

### Enabling Quarantined Endpoints

Set environment variable:
```
ENABLE_UNUSED_AI_ENDPOINTS=true
```

---

## 4. Secrets Handling

### API Keys

| Secret | Storage | Access |
|--------|---------|--------|
| `OPENAI_API_KEY` | Edge secrets | Edge functions only |
| `GEMINI_API_KEY` | Edge secrets | Edge functions only |
| `ANTHROPIC_API_KEY` | Edge secrets | Edge functions only |
| `CRON_SECRET` | Edge secrets | ai-job-worker only |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge secrets | Edge functions |

### Client-Side Safety

- API keys never exposed to client
- All LLM calls go through edge functions
- Service role key never in client bundle

---

## 5. Logging and Redaction

### AI Runs Table

**Location:** [_shared/ai.ts:183-209](supabase/functions/_shared/ai.ts#L183-L209)

| Field | Logged | Notes |
|-------|--------|-------|
| `model` | Yes | Model identifier |
| `tokens_in` | Yes | Input token count |
| `tokens_out` | Yes | Output token count |
| `cost_usd` | Yes | Calculated cost |
| `latency_ms` | Yes | Request duration |
| `success` | Yes | Boolean |
| `unknown` | Yes | UNKNOWN response flag |
| `error_code` | Yes | Error classification |
| `prompt` | NO | Not stored |
| `response` | NO | Not stored |

### AI Usage Logs

| Field | Logged | Notes |
|-------|--------|-------|
| `endpoint` | Yes | Function name |
| `model` | Yes | Model used |
| `tokens_estimate` | Yes | Estimated tokens |
| `latency_ms` | Yes | Duration |
| `unknown` | Yes | UNKNOWN flag |
| `user_message` | NO | Not stored |

### Redaction

**Key Finding:** No raw prompts or responses are logged. Only metadata and token counts.

---

## 6. Rate Limiting

### Implementation

**Location:** [_shared/ai.ts:71-114](supabase/functions/_shared/ai.ts#L71-L114)

### Limits

| Scope | Default | Enforcement |
|-------|---------|-------------|
| Daily per user | 20 | `ai_rate_limits` table |
| Reset time | 00:00 UTC | Configurable |

### Check Flow

```typescript
async function enforceRateLimit(opts) {
  const { data: rateRow } = await supabase
    .from("ai_rate_limits")
    .select("used_count, limit_per_day")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .eq("day_yyyy_mm_dd", dayKey)
    .maybeSingle();

  if (rateRow.used_count >= rateRow.limit_per_day) {
    return { code: "AI_RATE_LIMIT", message: "Daily rate limit reached." };
  }
  // Increment count...
}
```

---

## 7. Budget Enforcement

### Implementation

**Location:** [_shared/ai.ts:116-145](supabase/functions/_shared/ai.ts#L116-L145)

### Limits

| Scope | Default | Enforcement |
|-------|---------|-------------|
| Monthly per agency | $50 | `ai_budgets` table |
| Hard stop | Yes | Blocks when exceeded |
| Reset day | 1st of month | Configurable |

### Check Flow

```typescript
async function enforceBudget(opts) {
  const budgetSnapshot = await checkBudget(supabase, agencyId, monthKey);

  if (!budgetSnapshot.allowed && budgetSnapshot.hardStop) {
    return { code: "AI_BUDGET_EXCEEDED", message: "Monthly AI budget exceeded." };
  }
  // Increment spent...
}
```

---

## 8. Security Definer Functions

### RPC Functions with SECURITY DEFINER

| Function | Purpose | Risk Level |
|----------|---------|------------|
| `match_ai_embeddings` | Vector search | Low (read-only) |
| `create_strategy_snapshot` | Atomic strategy write | Medium |
| `claim_ai_jobs` | Job queue claims | Low |
| `complete_onboarding_profile` | Onboarding completion | Low |
| `get_client_brain_status` | Brain status check | Low |

### Mitigations

- All use `set search_path = public`
- Limited to service_role grant where needed
- No user input in dynamic SQL

---

## 9. Test Coverage

| Test File | Focus |
|-----------|-------|
| [endpoint-guard.test.ts](supabase/functions/_shared/__tests__/endpoint-guard.test.ts) | Quarantine logic |
| [ai-guards.test.ts](supabase/functions/_shared/__tests__/ai-guards.test.ts) | Rate/budget guards |
| [unusedEndpointLockdown.test.ts](src/data/__tests__/unusedEndpointLockdown.test.ts) | Unused endpoint detection |
| [edge-llm-bypass.test.ts](tests/guards/edge-llm-bypass.test.ts) | Provider bypass prevention |

---

## 10. Audit Findings

### Verified Controls

| Control | Status | Evidence |
|---------|--------|----------|
| RLS on all AI tables | PASS | Migration files |
| Bearer token auth | PASS | Edge function code |
| CRON secret for workers | PASS | ai-job-worker |
| Endpoint quarantine | PASS | endpoint-guard.ts |
| API keys server-side only | PASS | Edge secrets |
| No prompt logging | PASS | ai.ts inspection |
| Rate limiting | PASS | enforceRateLimit() |
| Budget enforcement | PASS | enforceBudget() |
| Bypass guard tests | PASS | Test file |

### Recommendations

1. **Add audit logging** for admin actions (brain approvals, strategy generation)
2. **Consider IP-based rate limiting** for additional protection
3. **Document quarantined endpoints** for future cleanup decision
4. **Add alerting** for budget threshold warnings (80%, 90%)
