# NEXT TASKS - SMMAHUB Priority Queue
*Generated: 2025-12-25*
*Based on: feat/onboarding-v3-ai-guided-2025-12-24 branch*

---

## Priority Levels
- **P0 (Critical)** - Blocks core functionality or causes data loss
- **P1 (High)** - Security risk, significant UX degradation, or technical debt
- **P2 (Medium)** - Feature enhancement, optimization, or nice-to-have

## Scope Estimates
- **S (Small)** - <4 hours, single file/function
- **M (Medium)** - 4-8 hours, multiple files, some testing
- **L (Large)** - >8 hours, cross-cutting changes, extensive testing

---

## Top 10 Tasks

### 1. [P0] Commit & Merge V3 Onboarding Work
**Priority:** P0 - Blocks collaboration, risk of conflicts
**Scope:** S

**Outcome:**
- V3 onboarding changes committed to `feat/onboarding-v3-ai-guided-2025-12-24`
- Branch merged to `main` with passing CI
- Deployed to production

**Files to Touch:**
```
git add:
  src/App.tsx
  src/components/ai/AiOnboardingV3Guided.tsx
  src/integrations/supabase/types.ts
  supabase/functions/ai-brain-ingest/index.ts
  supabase/functions/ai-onboarding-guide/index.ts
git rm:
  src/components/ai/AiOnboardingChat.tsx
  src/components/ai/AiOnboardingV2Chat.tsx
  src/pages/ai/AiOnboardingAgency.tsx
```

**Acceptance Criteria:**
- [ ] All uncommitted changes committed with clear message
- [ ] Git status shows clean working tree
- [ ] CI passes (tests, lint, build)
- [ ] PR merged to main
- [ ] Supabase migrations applied to production
- [ ] Edge functions deployed (ai-onboarding-guide, ai-brain-ingest)

**Commands:**
```bash
git add .
git commit -m "feat: complete V3 onboarding - delete V1/V2, simplify ingest

- Remove V1/V2 onboarding components (AiOnboardingChat, AiOnboardingV2Chat)
- Remove agency AI onboarding route
- Simplify ai-brain-ingest to V3-only mapping
- Add index signatures to Answers interface
- Restrict skip button to optional steps only
- Add re-ask logic for skipped questions

Tests: 14/14 passing
TypeScript: Clean"

git push origin feat/onboarding-v3-ai-guided-2025-12-24
# Create PR, merge to main
npx supabase db push
npx supabase functions deploy ai-onboarding-guide
npx supabase functions deploy ai-brain-ingest
```

---

### 2. [P1] Add AI Safety Filters to Production Endpoints
**Priority:** P1 - Security & brand risk
**Scope:** M

**Outcome:**
- Content moderation layer added to `ai-ask` and `ai-strategy-generate`
- Harmful, toxic, or policy-violating content blocked
- Safe requests allowed, unsafe requests logged + rejected

**Files to Touch:**
```
Create:
  supabase/functions/_shared/safety-filter.ts
Modify:
  supabase/functions/ai-ask/index.ts
  supabase/functions/ai-strategy-generate/index.ts
  supabase/functions/ai-answer-quality-check/index.ts
Schema:
  - Add ai_usage_logs.safety_check_result jsonb column
  - Add ai_safety_violations table (id, agency_id, endpoint, violation_type, content_hash, blocked_at)
```

**Implementation Plan:**
1. Create `_shared/safety-filter.ts`:
   ```typescript
   export async function checkSafety(
     content: string,
     context: { agency_id: string, endpoint: string }
   ): Promise<{ safe: boolean, reason?: string, flags?: string[] }> {
     // Option 1: OpenAI Moderation API
     const response = await fetch('https://api.openai.com/v1/moderations', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
       body: JSON.stringify({ input: content })
     });
     const data = await response.json();
     if (data.results[0].flagged) {
       return {
         safe: false,
         reason: 'Content violates policy',
         flags: Object.keys(data.results[0].categories).filter(
           k => data.results[0].categories[k]
         )
       };
     }
     return { safe: true };
   }
   ```

2. Integrate in `ai-ask/index.ts`:
   ```typescript
   // Before calling OpenAI chat
   const safetyCheck = await checkSafety(query, { agency_id, endpoint: 'ai-ask' });
   if (!safetyCheck.safe) {
     await supabase.from('ai_safety_violations').insert({
       agency_id,
       endpoint: 'ai-ask',
       violation_type: safetyCheck.flags?.join(','),
       content_hash: crypto.createHash('sha256').update(query).digest('hex')
     });
     return jsonResponse({ error: 'Content policy violation', reason: safetyCheck.reason }, 400);
   }
   ```

3. Add migration:
   ```sql
   alter table ai_usage_logs add column if not exists safety_check_result jsonb;

   create table if not exists ai_safety_violations (
     id uuid primary key default gen_random_uuid(),
     agency_id uuid not null references agencies(id),
     endpoint text not null,
     violation_type text,
     content_hash text not null,
     blocked_at timestamptz not null default now()
   );
   create index idx_safety_violations_agency on ai_safety_violations(agency_id, blocked_at);
   ```

**Acceptance Criteria:**
- [ ] OpenAI Moderation API integrated
- [ ] Harmful prompts rejected with 400 error
- [ ] Safe prompts pass through unchanged
- [ ] Violations logged to `ai_safety_violations`
- [ ] Tests cover: hate speech, self-harm, sexual content, violence
- [ ] Documentation updated (`docs/ai/safety_unknown_policy.md`)

**Testing:**
```typescript
describe('AI Safety Filter', () => {
  it('blocks hate speech', async () => {
    const result = await checkSafety('I hate [protected group]', { agency_id: 'test', endpoint: 'ai-ask' });
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('hate');
  });

  it('allows benign queries', async () => {
    const result = await checkSafety('What is our brand voice?', { agency_id: 'test', endpoint: 'ai-ask' });
    expect(result.safe).toBe(true);
  });
});
```

---

### 3. [P1] Implement Usage Tier Enforcement
**Priority:** P1 - Cost control & revenue protection
**Scope:** M

**Outcome:**
- Free tier: 100 AI calls/month, Pro: 1000, Enterprise: unlimited
- Quota exceeded → 429 error with upgrade prompt
- Dashboard shows usage % per tier

**Files to Touch:**
```
Create:
  supabase/functions/_shared/tier-enforcement.ts
Modify:
  supabase/functions/ai-ask/index.ts
  supabase/functions/ai-strategy-generate/index.ts
  supabase/functions/ai-brain-ingest/index.ts
  supabase/functions/ai-onboarding-guide/index.ts
Schema:
  - Add subscription_tiers.ai_quota_monthly integer column
  - Add agencies.ai_quota_override integer column (nullable, for custom deals)
```

**Implementation Plan:**
1. Migration:
   ```sql
   alter table subscription_tiers
     add column if not exists ai_quota_monthly integer not null default 100;

   update subscription_tiers set ai_quota_monthly = 100 where tier_name = 'free';
   update subscription_tiers set ai_quota_monthly = 1000 where tier_name = 'pro';
   update subscription_tiers set ai_quota_monthly = 999999 where tier_name = 'enterprise';

   alter table agencies
     add column if not exists ai_quota_override integer;

   create or replace function check_ai_quota(p_agency_id uuid)
   returns table (allowed boolean, used integer, limit integer)
   language sql
   stable
   as $$
     select
       coalesce(count(*), 0)::integer < coalesce(
         (select ai_quota_override from agencies where id = p_agency_id),
         (select st.ai_quota_monthly from subscriptions s
          join subscription_tiers st on st.id = s.tier_id
          where s.agency_id = p_agency_id
          order by s.created_at desc limit 1),
         100
       ) as allowed,
       coalesce(count(*), 0)::integer as used,
       coalesce(
         (select ai_quota_override from agencies where id = p_agency_id),
         (select st.ai_quota_monthly from subscriptions s
          join subscription_tiers st on st.id = s.tier_id
          where s.agency_id = p_agency_id
          order by s.created_at desc limit 1),
         100
       )::integer as limit
     from ai_usage_logs
     where agency_id = p_agency_id
       and created_at >= date_trunc('month', now());
   $$;
   ```

2. Shared enforcement:
   ```typescript
   // _shared/tier-enforcement.ts
   export async function enforceTierLimits(
     supabase: SupabaseClient,
     agency_id: string
   ): Promise<{ allowed: boolean, used: number, limit: number }> {
     const { data, error } = await supabase.rpc('check_ai_quota', { p_agency_id: agency_id });
     if (error) throw error;
     return data[0];
   }
   ```

3. Integrate in endpoints:
   ```typescript
   // ai-ask/index.ts
   const quota = await enforceTierLimits(supabase, agency_id);
   if (!quota.allowed) {
     return jsonResponse({
       error: 'Quota exceeded',
       message: `You've used ${quota.used}/${quota.limit} AI calls this month. Upgrade to continue.`,
       upgrade_url: `${PUBLIC_URL}/billing`
     }, 429, corsHeaders(req));
   }
   ```

**Acceptance Criteria:**
- [ ] RPC function `check_ai_quota` works correctly
- [ ] Free tier blocked after 100 calls/month
- [ ] Pro tier blocked after 1000 calls/month
- [ ] Enterprise tier never blocked
- [ ] 429 error includes upgrade URL
- [ ] Dashboard shows usage bar (used/limit)
- [ ] Tests cover quota enforcement

---

### 4. [P1] Add Embedding Model Fallback
**Priority:** P1 - Resilience
**Scope:** S

**Outcome:**
- If text-embedding-3-small fails → graceful degradation
- Fallback: log warning + skip embedding (or use cached)
- No hard crashes on OpenAI outages

**Files to Touch:**
```
Modify:
  supabase/functions/_shared/embeddings.ts
  supabase/functions/ai-brain-ingest/index.ts
  supabase/functions/ai-documents-ingest/index.ts
```

**Implementation Plan:**
```typescript
// _shared/embeddings.ts
export async function embedText(
  text: string,
  apiKey: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: text, model })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[embedText] OpenAI error:', error);

      // Fallback: return zero vector (still searchable, but poor quality)
      console.warn('[embedText] Falling back to zero vector');
      return Array(DEFAULT_EMBEDDING_DIM).fill(0);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[embedText] Fatal error:', error);
    // Fallback: return zero vector
    return Array(DEFAULT_EMBEDDING_DIM).fill(0);
  }
}
```

**Acceptance Criteria:**
- [ ] OpenAI timeout → returns zero vector + warning log
- [ ] OpenAI 5xx error → returns zero vector + warning log
- [ ] Network failure → returns zero vector + warning log
- [ ] Success → returns normal embedding
- [ ] Zero vectors don't crash search (cosine similarity still computes)
- [ ] Tests mock OpenAI failures

---

### 5. [P2] Build Agency Brain Onboarding UI
**Priority:** P2 - Currently no way to create agency brains via UI
**Scope:** L

**Outcome:**
- New page: `/ai/onboarding/agency`
- Similar to client onboarding but agency-scoped
- Captures: identity, niches, offers, ICP, tone, pillars, etc.

**Files to Create:**
```
src/components/ai/AiOnboardingAgencyGuided.tsx
src/pages/ai/AiOnboardingAgency.tsx
supabase/functions/ai-onboarding-agency-guide/index.ts (or extend existing)
```

**Implementation Plan:**
1. Clone `AiOnboardingV3Guided.tsx` → `AiOnboardingAgencyGuided.tsx`
2. Modify steps for agency context:
   ```typescript
   AGENCY_STEPS = [
     "identity",       // Agency name, niches, geo
     "offers",         // Core services
     "icp",            // Target industries, company sizes
     "personas",       // Buyer personas
     "tone",           // Voice & style
     "pillars",        // Strategy pillars
     "process",        // Approvals, revisions
     "examples"        // Gold standard examples
   ];
   ```
3. Create edge function or extend `ai-onboarding-guide`:
   - Add `scope: "agency" | "client"` parameter
   - Route to appropriate step definitions
4. Add route to App.tsx:
   ```tsx
   <Route path="/ai/onboarding/agency" element={<AiOnboardingAgency />} />
   ```
5. Create session table (if needed):
   ```sql
   create table agency_onboarding_sessions (
     id uuid primary key default gen_random_uuid(),
     agency_id uuid not null references agencies(id),
     user_id uuid not null references auth.users(id),
     brain_id uuid not null,
     step_id text not null,
     answers_json jsonb not null default '{}',
     completed boolean not null default false,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     constraint unique_session_per_agency unique (agency_id)
   );
   ```

**Acceptance Criteria:**
- [ ] Agency owner can navigate to `/ai/onboarding/agency`
- [ ] All 8 agency steps functional
- [ ] Answers saved to `agency_onboarding_sessions`
- [ ] Lock & Finish creates/updates `agency_brains`
- [ ] Brain ingested with correct schema
- [ ] Tests cover agency onboarding flow

---

### 6. [P2] Verify & Document Approval Workflow
**Priority:** P2 - Critical feature but unclear if complete
**Scope:** M

**Outcome:**
- Full approval workflow documented
- End-to-end test confirms: create → notify → approve → schedule → publish

**Files to Investigate:**
```
src/pages/client-portal/PortalApprovals.tsx
supabase/functions/send-approval-notification/index.ts
supabase/functions/generate-approval-reminders/index.ts
supabase/functions/publish-scheduled-posts/index.ts
Tables: content_items (or similar), approvals, notifications
```

**Investigation Tasks:**
1. **Find content table:**
   ```bash
   rg "approval" supabase/migrations -n
   rg "content.*status" supabase/migrations -n
   ```

2. **Trace approval state machine:**
   - Draft → Pending → Approved/Rejected → Scheduled → Published
   - What triggers each transition?
   - Where is approval_status stored?

3. **Test end-to-end:**
   - Create test content item with status = 'pending_approval'
   - Load PortalApprovals.tsx as client user
   - Click approve → verify notification sent
   - Check if content moved to 'approved' status
   - Verify scheduled_at can be set
   - Trigger `publish-scheduled-posts` cron
   - Verify content published to Meta/IG

4. **Document in:**
   ```
   docs/workflows/APPROVAL_WORKFLOW.md
   ```

**Acceptance Criteria:**
- [ ] Approval workflow fully traced and documented
- [ ] State transitions mapped
- [ ] Edge cases identified (e.g., what if client never responds?)
- [ ] Reminders confirmed working (cron schedule, email sent)
- [ ] End-to-end test passes
- [ ] Missing pieces identified (if any) and logged as tasks

---

### 7. [P2] Enable React Router v7 Future Flags
**Priority:** P2 - Remove deprecation warnings
**Scope:** S

**Outcome:**
- No more v7 warnings in test output
- App ready for React Router v7 upgrade

**Files to Touch:**
```
Modify:
  src/App.tsx
```

**Implementation:**
```tsx
// src/App.tsx
const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});
```

**Acceptance Criteria:**
- [ ] No deprecation warnings in `npm test` output
- [ ] App functions identically (no regressions)
- [ ] Tests still pass

---

### 8. [P2] Add Brain Edit UI
**Priority:** P2 - Locked brains can't be fixed if onboarding missed something
**Scope:** M

**Outcome:**
- New page: `/clients/:clientId/brain/edit`
- Loads latest brain, allows editing fields
- Saves as new version (increments brain.version)
- Triggers re-ingest

**Files to Create:**
```
src/pages/ClientBrainEdit.tsx
```

**Implementation Plan:**
1. Add route:
   ```tsx
   <Route path="/clients/:clientId/brain/edit" element={<ClientBrainEdit />} />
   ```

2. Load current brain:
   ```typescript
   const { data: brain } = await supabase
     .from('client_brains')
     .select('*')
     .eq('client_id', clientId)
     .order('version', { ascending: false })
     .limit(1)
     .single();

   const answers = brain.brain_json.raw_responses;
   ```

3. Render form with pre-filled values (similar to onboarding)

4. On save:
   ```typescript
   // Create new version
   POST /ai-brains-client { action: "update", brain_json: { raw_responses: updatedAnswers } }
   // Re-ingest
   POST /ai-brain-ingest { raw_responses: updatedAnswers }
   ```

**Acceptance Criteria:**
- [ ] Edit page shows current brain values
- [ ] All fields editable
- [ ] Save creates new version (version++, status='draft')
- [ ] Re-ingest updates brain_json
- [ ] Brain status re-validated (usable flag updated)
- [ ] Audit trail preserved (old versions kept)

---

### 9. [P2] Add Onboarding Analytics
**Priority:** P2 - Optimize conversion rates
**Scope:** M

**Outcome:**
- Dashboard shows: started, completed, drop-off by step
- Identify problem steps where users abandon

**Files to Touch:**
```
Create:
  src/pages/OnboardingAnalytics.tsx
  supabase/functions/onboarding-analytics/index.ts (or use direct query)
Schema:
  - Add client_onboarding_sessions.step_history jsonb column
  - Track: { step_id, entered_at, exited_at, skipped }
```

**Implementation Plan:**
1. Migration:
   ```sql
   alter table client_onboarding_sessions
     add column if not exists step_history jsonb default '[]'::jsonb;
   ```

2. Track step transitions in AiOnboardingV3Guided.tsx:
   ```typescript
   useEffect(() => {
     if (!currentStep) return;
     const entry = {
       step_id: currentStep.step_id,
       entered_at: new Date().toISOString()
     };
     // Append to step_history
   }, [currentStep.step_id]);
   ```

3. Analytics query:
   ```sql
   create or replace function get_onboarding_funnel()
   returns table (
     step_id text,
     entered_count bigint,
     completed_count bigint,
     drop_rate numeric
   )
   language sql
   as $$
     with step_events as (
       select
         jsonb_array_elements(step_history) ->> 'step_id' as step_id,
         jsonb_array_elements(step_history) ->> 'entered_at' as entered_at,
         jsonb_array_elements(step_history) ->> 'exited_at' as exited_at
       from client_onboarding_sessions
     )
     select
       step_id,
       count(*) as entered_count,
       count(exited_at) as completed_count,
       round((1 - count(exited_at)::numeric / count(*)) * 100, 2) as drop_rate
     from step_events
     group by step_id
     order by entered_count desc;
   $$;
   ```

4. Dashboard UI:
   ```tsx
   <OnboardingFunnel
     steps={[
       { name: 'Brand Basics', entered: 100, completed: 95, dropRate: 5 },
       { name: 'Niche', entered: 95, completed: 90, dropRate: 5.3 },
       // ...
     ]}
   />
   ```

**Acceptance Criteria:**
- [ ] Step history tracked in database
- [ ] RPC function returns funnel metrics
- [ ] Dashboard page shows funnel visualization
- [ ] Identify top 3 drop-off steps
- [ ] Export CSV for further analysis

---

### 10. [P2] Optimize Vector Search Performance
**Priority:** P2 - Improve AI response latency
**Scope:** M

**Outcome:**
- Vector search <100ms (currently UNKNOWN, needs profiling)
- Index tuning for `ai_embeddings` table
- Consider caching common queries

**Files to Touch:**
```
Modify:
  supabase/migrations/NEW_optimize_embeddings_index.sql
  supabase/functions/_shared/cache.ts (create)
  supabase/functions/ai-retrieve-context/index.ts
```

**Investigation Plan:**
1. **Profile current performance:**
   ```sql
   EXPLAIN ANALYZE
   select
     e.document_id,
     e.chunk_id,
     e.doc_type,
     c.chunk_text,
     1 - (e.embedding <=> '[0.1, 0.2, ...]'::vector) as score
   from ai_embeddings e
   join ai_document_chunks c on c.id = e.chunk_id
   where e.agency_id = 'test-agency-id'
   order by e.embedding <=> '[0.1, 0.2, ...]'::vector
   limit 8;
   ```

2. **Optimize index:**
   ```sql
   -- Current index (check existing)
   create index idx_embeddings_agency_vector on ai_embeddings
     using ivfflat (embedding vector_cosine_ops)
     with (lists = 100);

   -- Tune lists parameter based on row count
   -- Rule of thumb: lists = sqrt(row_count)
   -- For 10k embeddings: lists = 100
   -- For 100k embeddings: lists = 316
   ```

3. **Add Redis cache (if needed):**
   ```typescript
   // _shared/cache.ts
   const CACHE_TTL = 300; // 5 minutes

   export async function getCachedEmbedding(
     text: string,
     apiKey: string
   ): Promise<number[]> {
     const cacheKey = `embedding:${hashText(text)}`;
     const cached = await redis.get(cacheKey);
     if (cached) return JSON.parse(cached);

     const embedding = await embedText(text, apiKey);
     await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(embedding));
     return embedding;
   }
   ```

**Acceptance Criteria:**
- [ ] Vector search profiled with EXPLAIN ANALYZE
- [ ] Index tuned for row count
- [ ] Search latency <100ms (p95)
- [ ] Common queries cached (if Redis available)
- [ ] Before/after benchmarks documented

---

## Backlog (P3 - Future)

### 11. Add Multi-Language Support
- i18n for UI strings
- Translate onboarding questions to Spanish, French, etc.
- Store user language preference

### 12. Add Bulk Client Import
- CSV upload for agencies with many clients
- Map columns: name, website, logo_url, etc.
- Trigger onboarding for each

### 13. Add Brain Export/Import
- Export brain_json as JSON file
- Import to duplicate across clients
- Use case: template brains for common industries

### 14. Add Content Calendar Drag-and-Drop
- Reschedule posts by dragging
- Batch actions: approve multiple, reschedule multiple
- Visual timeline view

### 15. Add Webhook Notifications
- Allow agencies to subscribe to events: approval_needed, content_published, brain_locked
- POST to agency-provided URL
- Signature verification for security

### 16. Add AI Model Selection
- Let user choose: GPT-4, GPT-3.5, Claude, Gemini
- Store preference in agency settings
- Route requests to selected provider

### 17. Add Prompt Template Library
- Pre-built prompts for common use cases
- Editable by agency
- Versioned (track changes)

### 18. Add Usage Cost Dashboard
- Show: OpenAI spend per month, per client
- Forecast: projected spend based on current rate
- Alerts: budget exceeded

### 19. Add Brain Quality Score
- Analyze completeness, coherence, examples
- Show score: 0-100
- Suggest improvements: "Add more examples to pillars"

### 20. Add A/B Testing for Onboarding
- Test different question phrasings
- Measure completion rate, time to complete
- Auto-select winning variant

---

*End of NEXT_TASKS.md*
