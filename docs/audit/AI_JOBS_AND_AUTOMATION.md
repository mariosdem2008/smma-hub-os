# AI Jobs and Automation Audit

## Audit Date: 2026-01-10

---

## 1. Job Queue Schema

### Table: `ai_jobs`

**Location:** [20260108152000_ai_jobs_queue.sql:3-17](supabase/migrations/20260108152000_ai_jobs_queue.sql#L3-L17)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `agency_id` | uuid | Tenant FK |
| `client_id` | uuid | Client FK |
| `job_type` | text | Job classification |
| `payload_json` | jsonb | Job-specific data |
| `dedupe_key` | text | Deduplication key |
| `status` | text | pending/running/succeeded/failed |
| `attempts` | integer | Retry count |
| `run_after` | timestamptz | Backoff delay |
| `last_error` | text | Last error message |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last update |

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Waiting to be claimed |
| `running` | Currently being processed |
| `succeeded` | Completed successfully |
| `failed` | Exceeded max attempts |

### Indexes

**Location:** [20260108152000_ai_jobs_queue.sql:19-27](supabase/migrations/20260108152000_ai_jobs_queue.sql#L19-L27)

```sql
-- Status + run_after for claiming
create index ai_jobs_status_run_after_idx on public.ai_jobs (status, run_after, created_at);

-- Agency + created for listing
create index ai_jobs_agency_created_idx on public.ai_jobs (agency_id, created_at desc);

-- Deduplication uniqueness
create unique index ai_jobs_dedupe_unique
  on public.ai_jobs (job_type, client_id, dedupe_key)
  where dedupe_key is not null;
```

---

## 2. Job Claiming (Deduplication)

### claim_ai_jobs RPC

**Location:** [20260108152000_ai_jobs_queue.sql:71-95](supabase/migrations/20260108152000_ai_jobs_queue.sql#L71-L95)

```sql
create or replace function public.claim_ai_jobs(p_limit integer default 5)
returns setof public.ai_jobs
language plpgsql
security definer
as $$
begin
  return query
  with claim as (
    select id
    from public.ai_jobs
    where status = 'pending'
      and run_after <= now()
    order by run_after asc, created_at asc
    limit p_limit
    for update skip locked  -- Optimistic locking
  )
  update public.ai_jobs
  set status = 'running',
      attempts = attempts + 1,
      updated_at = now()
  where id in (select id from claim)
  returning *;
end;
$$;
```

### Key Features

| Feature | Implementation | Line |
|---------|----------------|------|
| Optimistic locking | `FOR UPDATE SKIP LOCKED` | 86 |
| FIFO order | `ORDER BY run_after ASC, created_at ASC` | 85 |
| Batch size limit | `LIMIT p_limit` | 86 |
| Atomic claim | Single transaction | Implicit |

### Deduplication at Insertion

**Location:** [20260108152000_ai_jobs_queue.sql:130-145](supabase/migrations/20260108152000_ai_jobs_queue.sql#L130-L145)

```sql
insert into public.ai_jobs (...)
on conflict (job_type, client_id, dedupe_key)
do update set
  status = 'pending',
  run_after = now(),
  last_error = null,
  updated_at = now();
```

**Behavior:** If job with same `(job_type, client_id, dedupe_key)` exists, reset to pending.

---

## 3. Job Worker

### Edge Function: `ai-job-worker`

**Location:** [ai-job-worker/index.ts](supabase/functions/ai-job-worker/index.ts)

### Authentication

**Location:** [ai-job-worker/index.ts:60-61](supabase/functions/ai-job-worker/index.ts#L60-L61)

```typescript
const cronAuth = verifyCronSecret(req, corsHeaders(req));
if (cronAuth) return cronAuth;
```

**Required:** `CRON_SECRET` header must match environment variable.

### Processing Loop

**Location:** [ai-job-worker/index.ts:83-141](supabase/functions/ai-job-worker/index.ts#L83-L141)

```typescript
for (const job of jobs ?? []) {
  try {
    // Dedupe check for already-succeeded jobs
    if (dedupeKey) {
      const { data: existing } = await supabase
        .from("ai_jobs")
        .select("id")
        .eq("dedupe_key", dedupeKey)
        .eq("status", "succeeded")
        .limit(1);

      if ((existing ?? []).length > 0) {
        // Skip if duplicate already succeeded
        continue;
      }
    }

    if (jobType === "seed_strategy") {
      await invokeStrategyGenerate(SUPABASE_URL, cronSecret, clientId);
    }

    // Mark succeeded
    await supabase.from("ai_jobs").update({ status: "succeeded" }).eq("id", jobId);
  } catch (err) {
    // Handle failure with retry
  }
}
```

### Supported Job Types

| Job Type | Handler | Edge Function Called |
|----------|---------|---------------------|
| `seed_strategy` | `invokeStrategyGenerate()` | `ai-strategy-generate` |

---

## 4. Retry and Backoff

### Max Attempts

**Location:** [ai-job-worker/index.ts:8](supabase/functions/ai-job-worker/index.ts#L8)

```typescript
const MAX_ATTEMPTS = 5;
```

### Backoff Formula

**Location:** [ai-job-worker/index.ts:18-23](supabase/functions/ai-job-worker/index.ts#L18-L23)

```typescript
function backoffDelayMs(attempts: number) {
  const base = 1000;                              // 1 second
  const max = 15 * 60 * 1000;                     // 15 minutes
  const delay = Math.min(max, base * Math.pow(2, Math.max(0, attempts - 1)));
  return delay;
}
```

### Backoff Schedule

| Attempt | Delay |
|---------|-------|
| 1 | 1 second |
| 2 | 2 seconds |
| 3 | 4 seconds |
| 4 | 8 seconds |
| 5 | 16 seconds |
| >5 | Capped at 15 minutes |

### Failure Handling

**Location:** [ai-job-worker/index.ts:128-140](supabase/functions/ai-job-worker/index.ts#L128-L140)

```typescript
const exceeded = attempts >= MAX_ATTEMPTS;
const nextRun = new Date(Date.now() + backoffDelayMs(attempts));

await supabase.from("ai_jobs").update({
  status: exceeded ? "failed" : "pending",
  run_after: exceeded ? new Date().toISOString() : nextRun.toISOString(),
  last_error: err?.message ?? "Unknown error",
}).eq("id", jobId);
```

---

## 5. Job Triggers

### Onboarding Completion

**Location:** [20260108152000_ai_jobs_queue.sql:101-150](supabase/migrations/20260108152000_ai_jobs_queue.sql#L101-L150)

```sql
create or replace function public.complete_onboarding_profile(p_client_id uuid)
returns public.client_onboarding_profiles
```

**Trigger:** Called when onboarding is marked complete

**Job Created:**
- `job_type: 'seed_strategy'`
- `dedupe_key: 'seed_strategy:' || p_client_id`

### Manual Trigger (API)

Can be triggered via direct API call with `CRON_SECRET` header:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/ai-job-worker \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## 6. Security

### RLS Policies

**Location:** [20260108152000_ai_jobs_queue.sql:31-54](supabase/migrations/20260108152000_ai_jobs_queue.sql#L31-L54)

```sql
create policy "ai_jobs_admin_select"
on public.ai_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.agency_members am
    where am.agency_id = ai_jobs.agency_id
      and am.user_id = auth.uid()
      and am.role = 'admin'
  )
);
```

**Permissions:**
- Only agency admins can SELECT jobs
- INSERT/UPDATE/DELETE requires service_role

### Worker Function Security

| Check | Enforcement | Location |
|-------|-------------|----------|
| CRON_SECRET required | `verifyCronSecret()` | [ai-job-worker/index.ts:60-61](supabase/functions/ai-job-worker/index.ts#L60-L61) |
| Endpoint guard | `getEndpointGuardResponse()` | [ai-job-worker/index.ts:57-58](supabase/functions/ai-job-worker/index.ts#L57-L58) |
| Service role for RPC | `security definer` on claim_ai_jobs | [migration:74](supabase/migrations/20260108152000_ai_jobs_queue.sql#L74) |

---

## 7. Monitoring

### Job Status Query

```sql
SELECT
  job_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM ai_jobs
GROUP BY job_type, status;
```

### Failed Jobs Query

```sql
SELECT *
FROM ai_jobs
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;
```

### Stuck Jobs Query

```sql
SELECT *
FROM ai_jobs
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '30 minutes';
```

---

## 8. Idempotency Verification

| Scenario | Behavior | Evidence |
|----------|----------|----------|
| Same job enqueued twice | Second insert becomes UPDATE | ON CONFLICT DO UPDATE |
| Worker claims same job | SKIP LOCKED prevents double-claim | FOR UPDATE SKIP LOCKED |
| Job already succeeded | Skip processing | Dedupe check in worker |
| Worker crashes mid-job | Job stays "running" (needs cleanup) | Manual intervention needed |

### Gap: Stuck "Running" Jobs

**Issue:** If worker crashes after claiming but before completing, job remains "running" indefinitely.

**Recommendation:** Add stale job cleanup cron:
```sql
UPDATE ai_jobs
SET status = 'pending'
WHERE status = 'running'
  AND updated_at < NOW() - INTERVAL '30 minutes';
```

---

## 9. Audit Findings

### Verified

| Feature | Status | Evidence |
|---------|--------|----------|
| Deduplication at insert | PASS | Unique index + ON CONFLICT |
| Optimistic locking | PASS | FOR UPDATE SKIP LOCKED |
| Exponential backoff | PASS | backoffDelayMs() |
| Max attempts cap | PASS | MAX_ATTEMPTS = 5 |
| CRON auth required | PASS | verifyCronSecret() |
| Service role for claims | PASS | security definer |

### Risks

| Risk | Severity | Recommendation |
|------|----------|----------------|
| Stuck running jobs | Medium | Add stale job cleanup |
| No job timeout | Low | Consider per-job timeout |
| Single worker | Low | Scale with multiple workers |
