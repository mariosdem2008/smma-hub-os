# AI-Guided Onboarding V3

**Created:** 2025-12-24
**Status:** Active
**Version:** 3.0.0

---

## Overview

AI-Guided Onboarding V3 replaces the static 25-question onboarding with a dynamic, conversational flow that:
- Feels like a live assistant (proposes options, confirms, summarizes)
- Uses mostly selection-based inputs (chips/multi-select) for faster completion
- Completes required onboarding in ≤ 9 steps
- Collects strategy-critical inputs for high-end agency strategy generation
- Enforces validation (nonsense does NOT pass silently)
- Preserves all existing AI spine security constraints

---

## Target UX Metrics

**Hard Requirements:**
- Required steps: 9 (max)
- Optional deep-dive: 6 (only if user opts in OR missing_fields remains high)
- Inputs: ≥ 70% selection-first (chips/select), ≤ 30% free typing
- Follow-ups: ≤ 2 per step
- Time-to-usable (normal client): ≤ 6 minutes
- Validation: No auto-accept on error. If guide/quality call fails → block + retry UI

---

## 9 Required Steps

### 1. Brand Basics
**Goal:** Capture brand name + website URL
**Input Type:** short_text (2 fields)
**Validation:**
- Brand name: min 2 characters
- Website: valid URL format (https://example.com)

**Data Captured:**
- `answers.brand` (string)
- `answers.website` (string)

---

### 2. Niche/Category
**Goal:** Classify client's industry
**Input Type:** single_select
**Options:** E-commerce, SaaS, Coaching, Healthcare, Real Estate, Fitness, Restaurant, Finance, Legal, Home Services, Beauty, Other

**Data Captured:**
- `answers.niche` (string: option ID)

---

### 3. Offers
**Goal:** Identify 1-3 core offerings to focus on
**Input Type:** multi_select
**AI Behavior:** Proposes up to 8 offers based on website + niche using GPT-4o-mini
**Constraints:** min: 1, max: 3
**Fallback:** If OpenAI unavailable, uses static defaults

**Data Captured:**
- `answers.offers` (string[]: option IDs)

---

### 4. Audience
**Goal:** Select 1-2 primary target personas
**Input Type:** multi_select
**AI Behavior:** Proposes 5 personas based on niche + offers using GPT-4o-mini
**Constraints:** min: 1, max: 2
**Fallback:** Static defaults (small business owners, marketing managers, etc.)

**Data Captured:**
- `answers.audience` (string[]: option IDs)

---

### 5. Differentiators
**Goal:** Capture 2-4 key competitive advantages
**Input Type:** chips
**AI Behavior:** Proposes 6 differentiators based on brand + niche using GPT-4o-mini
**Constraints:** min: 2, max: 4
**Fallback:** Static defaults (premium quality, customer service, pricing, etc.)

**Data Captured:**
- `answers.differentiators` (string[]: option IDs)

---

### 6. Tone/Voice
**Goal:** Define brand voice with traits + style example
**Input Type:** chips (2 parts)
**Part 1:** Select exactly 3 tone traits (Professional, Friendly, Authoritative, Playful, Empathetic, Bold, Educational, Inspirational)
**Part 2:** Select 1 style example (Apple, Nike, Mailchimp, HubSpot)
**Constraints:** tone: exactly 3, tone_example: exactly 1

**Data Captured:**
- `answers.tone` (string[]: 3 trait IDs)
- `answers.tone_example` (string: example ID)

---

### 7. Platforms
**Goal:** Choose social platforms + primary platform
**Input Type:** chips (2 parts)
**Part 1:** Select all platforms (Instagram, Facebook, LinkedIn, TikTok, YouTube, Twitter/X)
**Part 2:** Choose primary platform (from selected)
**Constraints:** min: 1 platform, primary required

**Data Captured:**
- `answers.platforms` (string[]: platform IDs)
- `answers.primary_platform` (string: platform ID)

---

### 8. Goals & KPIs (90 days)
**Goal:** Define objectives + 1-3 measurable KPIs
**Input Type:** multi_select (2 parts)
**Part 1:** Goals (brand awareness, leads, engagement, sales, authority, retention)
**Part 2:** KPIs (follower growth %, engagement rate %, reach, lead count, conversion rate %, revenue from social)
**Constraints:** goals: min 1, kpis: min 1, max 3

**Data Captured:**
- `answers.goals` (string[]: goal IDs)
- `answers.kpis` (string[]: KPI IDs)

---

### 9. Constraints & Approvals
**Goal:** Set content guardrails + approval cadence
**Input Type:** chips + contact_card
**Part 1:** Constraints chips (No political, No religious, No competitors, No pricing, Compliance, None)
**Part 2:** Approval cadence (Every post, Weekly batches, Monthly batches, Autonomous)
**Part 3:** Approver contact (optional text)

**Data Captured:**
- `answers.constraints` (string[]: constraint IDs)
- `answers.approval_cadence` (string: cadence ID)
- `answers.approver_contact` (string: name/email)

---

## 6 Optional Steps (Deep Dive)

Only shown if:
1. User chooses "Enhance Strategy Depth" at review_required step, OR
2. `missing_fields_count > 0` after step 9

### A. Competitors
- **Input:** Multi-select from AI-suggested competitors
- **Data:** `answers.competitors` (string[])

### B. Content Pillars
- **Input:** Multi-select 3-5 from AI-suggested pillars
- **Data:** `answers.pillars` (string[])

### C. CTA Styles
- **Input:** Multi-select 2 CTA styles
- **Data:** `answers.cta_styles` (string[])

### D. Assets
- **Input:** Upload/link list
- **Data:** `answers.assets` (string[])

### E. Pricing/Packages
- **Input:** Textarea (optional)
- **Data:** `answers.pricing` (string)

### F. Seasonality/Timeline
- **Input:** Textarea (optional)
- **Data:** `answers.timeline` (string)

---

## Architecture

### New Table: client_onboarding_sessions

**Purpose:** Store SAFE normalized answers for cross-device resume (NOT brain_json)

**Schema:**
```sql
create table public.client_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id),
  client_id uuid not null references clients(id),
  user_id uuid not null references auth.users(id),
  brain_id uuid not null,
  step_id text not null,
  answers_json jsonb not null default '{}',
  completed_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_session_per_client unique (client_id)
);
```

**RLS:** Only agency_members of agency_id can select/insert/update their rows

**Security:**
- Does NOT store brain_json
- Only stores normalized, safe answers (brand, website, niche, offers, etc.)
- No sensitive brain internals (raw_responses, confidence, etc.)

---

### New Edge Function: ai-onboarding-guide

**Endpoint:** POST /functions/v1/ai-onboarding-guide

**Auth:** Bearer JWT (authenticated user, agency membership validated)

**Request Body:**
```typescript
{
  agency_id: string,
  client_id: string,
  brain_id: string,
  step_id: string | null,       // current step, null for first step
  answers: Answers,              // current normalized answers
  user_input?: any,              // user's input for validation
  website_url?: string           // optional for context
}
```

**Response (StepSpec):**
```typescript
{
  step_id: string,
  assistant_message: string,     // 1-3 lines conversational prompt
  input_type: "single_select" | "multi_select" | "chips" | "short_text" | "url" | "contact_card" | "textarea",
  options?: Array<{
    id: string,
    label: string,
    hint?: string
  }>,
  constraints?: {
    required: boolean,
    min?: number,
    max?: number,
    pattern?: string
  },
  validation_errors?: string[],  // if user_input failed validation
  recap_so_far?: string,         // optional progress summary
  progress_percent: number,      // 0-100
  can_lock: boolean              // true if all required fields present
}
```

**Behavior Rules:**
1. **Choice-first:** Propose options whenever possible (AI-generated or static)
2. **Validation:** If user_input is nonsense/too short → return validation_errors, do NOT advance
3. **Deterministic:** Prompts are stable, JSON-only output
4. **Error Handling:** If OPENAI_API_KEY missing → return HTTP 503 with clear message (no silent degrade)
5. **AI Options:** For offers, audience, differentiators → call OpenAI GPT-4o-mini to generate context-specific options
6. **Fallback:** If OpenAI fails → use static default options

**Example StepSpec for Step 3 (Offers):**
```json
{
  "step_id": "offers",
  "assistant_message": "Perfect. I've analyzed their business. Which of these offerings should we focus on? (Select 1-3)",
  "input_type": "multi_select",
  "options": [
    { "id": "service1", "label": "Social media management" },
    { "id": "service2", "label": "Content creation" },
    { "id": "service3", "label": "Paid advertising campaigns" },
    { "id": "service4", "label": "Strategy consulting" },
    { "id": "service5", "label": "Community management" },
    { "id": "service6", "label": "Influencer partnerships" },
    { "id": "service7", "label": "Analytics & reporting" },
    { "id": "service8", "label": "Brand development" }
  ],
  "constraints": {
    "required": true,
    "min": 1,
    "max": 3
  },
  "progress_percent": 33,
  "can_lock": false
}
```

---

### UI Component: AiOnboardingV3Guided.tsx

**Location:** src/components/ai/AiOnboardingV3Guided.tsx

**Props:**
```typescript
{
  agencyId: string,
  clientId: string,
  onboardingType: "client"
}
```

**Flow:**
1. Ensure brain_id exists via ai-brains-client create/reuse
2. Load session from client_onboarding_sessions (if exists) to resume
3. Request StepSpec from ai-onboarding-guide
4. Render input control based on input_type (chips/select/contact/url)
5. Validate locally BEFORE calling "next"
6. Save answers to client_onboarding_sessions + update brain via ai-brains-client update
7. After step 9, call lock+ingest path (same as v2), but only if can_lock=true

**Key Features:**
- **No auto-accept on error:** If ai-onboarding-guide fails OR validation fails → show retry, do NOT advance
- **Resume support:** Loads from client_onboarding_sessions and continues from step_id
- **Progress bar:** Shows progress_percent from StepSpec
- **Dynamic rendering:** Renders chips, multi-select, single-select, short_text, etc. based on input_type
- **Validation feedback:** Shows validation_errors from StepSpec in red alert box

---

## Why This Improves Strategy Generation

### 1. Context-Specific Options (AI-Generated)
**Old:** Static questions with free-text answers → generic, often incomplete
**New:** AI analyzes website + niche → proposes relevant offers, audiences, differentiators → user confirms/refines

**Strategy Impact:**
- Offers are aligned with actual business focus → campaigns target the right products/services
- Audience personas are realistic → messaging matches actual customer problems/demographics
- Differentiators are concrete → content highlights true competitive advantages

### 2. Forced Completeness with Constraints
**Old:** Users skip fields or write "N/A" → brain has missing_fields → strategy returns UNKNOWN
**New:** Min/max constraints enforce required selections → can_lock flag only allows lock when all fields present

**Strategy Impact:**
- Brains are always usable after lock → 100% of onboarding completions result in functional strategy generation
- No silent failures or "come back later" UX

### 3. Selection-First UX Reduces Noise
**Old:** Free-text typing → spelling errors, vague answers, inconsistent formatting
**New:** 70% selection-based → normalized IDs, consistent labels, no typos

**Strategy Impact:**
- Ingestion mapping is deterministic (no "small business" vs "small biz" vs "SMB" confusion)
- RAG retrieval matches are more accurate (consistent terminology)

### 4. Tone/Voice Clarity
**Old:** "Describe your tone" → generic answers like "professional and friendly"
**New:** Pick 3 traits + 1 style example → concrete, comparable reference points

**Strategy Impact:**
- AI can generate content in the exact tone requested (e.g., "Nike-style motivational")
- Voice consistency across posts improves brand recognition

### 5. Goals + KPIs Traceability
**Old:** Goals buried in long-form text → hard to extract for strategy metrics
**New:** Explicit goals + 1-3 KPIs selected → machine-readable, trackable

**Strategy Impact:**
- Strategy drafts can reference specific KPIs (e.g., "to achieve 20% follower growth...")
- Performance review can align with declared goals

---

## Security Notes (Non-Negotiable Constraints)

### 1. Never Expose brain_json to Client
**Guarantee:** AiOnboardingV3Guided only reads/writes to client_onboarding_sessions.answers_json and calls edge functions
**Proof:** No `.from("client_brains").select(...)` calls in UI code

### 2. UI Must NOT Read client_brains/agency_brains Directly
**Guarantee:** All brain reads go through edge functions (ai-brains-client) with service_role access
**Proof:** Component uses `supabase.functions.invoke("ai-brains-client", {...})`, NOT direct table access

### 3. UI Can Read Derived Status Only via RPC
**Guarantee:** Gating still uses get_client_brain_status RPC (unchanged)
**Proof:** ClientDetail.tsx gate logic unmodified, calls `db.rpc("get_client_brain_status", ...)`

### 4. Brains Created/Updated/Locked ONLY via Edge Functions
**Guarantee:** Component calls ai-brains-client for create/update/lock, ai-brain-ingest for canonical mapping
**Proof:** No direct `.from("client_brains").insert/update(...)` in UI code

### 5. usable/missing_fields Computed Server-Side
**Guarantee:** ai-brain-ingest still computes usable flag using brain-quality.ts logic
**Proof:** Lock flow → ai-brains-client lock → ai-brain-ingest (same as v2)

### 6. ClientDetail Gating Behavior Preserved
**Guarantee:** usable=false blocks, usable=true passes, 403 shows no-access
**Proof:** Gating logic unchanged in ClientDetail.tsx, only onboarding UI replaced

---

## Migration Path (V2 → V3)

**Backward Compatibility:**
- Existing v2 onboarding sessions (if any) are NOT migrated to client_onboarding_sessions
- V3 creates new sessions starting from brand_basics
- Old brain data (raw_responses in brain_json) is preserved but NOT resumed

**Coexistence:**
- V2 component (AiOnboardingV2Chat) remains in codebase but unused
- Routing updated to use V3 by default
- If rollback needed, revert src/pages/ai/AiOnboardingClient.tsx import

**Testing Rollback:**
```typescript
// Revert to V2 (emergency)
import { AiOnboardingV2Chat } from "@/components/ai/AiOnboardingV2Chat";
// ... render AiOnboardingV2Chat instead of AiOnboardingV3Guided
```

---

## Testing Strategy

### UI Tests (Vitest)
**File:** src/components/ai/__tests__/AiOnboardingV3Guided.test.tsx

**Coverage:**
1. StepSpec render per input_type (single_select, multi_select, chips, short_text)
2. Validation blocks nonsense and does not advance
3. Retry behavior on edge function failure
4. Selection state management (chips toggle, multi-select add/remove)
5. Progress bar updates
6. Can proceed logic (disabled next button when constraints not met)

### Resume Tests
**Coverage:**
1. Loads from client_onboarding_sessions and continues from saved step_id
2. Pre-populates answers from answers_json
3. Handles missing session (creates new one)

### Gating Regression Tests
**Coverage:**
1. Still uses get_client_brain_status RPC
2. Handles 403 forbidden correctly
3. usable=false blocks, usable=true passes

### Edge Function Schema Test
**Coverage:**
1. ai-onboarding-guide returns valid StepSpec JSON shape
2. Validation errors returned correctly
3. HTTP 503 on missing OPENAI_API_KEY

---

## Commands to Run (Must Pass)

```bash
# Run all tests
npm test

# Type check
npx tsc -p tsconfig.json --noEmit

# Verify no brain_json exposure
rg "from\(\"client_brains\"\)" src/ --glob "!**/__tests__/**"
rg "from\(\"agency_brains\"\)" src/ --glob "!**/__tests__/**"
# Expected: 0 matches (all reads via edge functions)
```

---

## Acceptance Criteria

### Functional
- ✅ Required onboarding completes in ≤ 9 steps
- ✅ Optional deep-dive is 6 steps (only if chosen)
- ✅ ≥ 70% inputs are selection-based (chips/multi-select)
- ✅ Validation blocks nonsense (no silent auto-accept)
- ✅ Resume works across devices (session table)
- ✅ Lock flow triggers ai-brain-ingest and sets usable flag
- ✅ Client detail gating still works (usable=false blocks)

### Security
- ✅ No brain_json exposure to client
- ✅ No direct client_brains/agency_brains reads in UI
- ✅ All brain mutations via edge functions
- ✅ RLS enforced on client_onboarding_sessions
- ✅ get_client_brain_status RPC still used for gating

### Performance
- ✅ Time-to-usable ≤ 6 minutes (normal client)
- ✅ AI option generation < 3 seconds per step
- ✅ Fallback to static options if OpenAI fails
- ✅ No silent degradation on missing OPENAI_API_KEY

### UX
- ✅ Conversational assistant messages (1-3 lines)
- ✅ Progress bar shows completion %
- ✅ Validation errors are clear and actionable
- ✅ Retry button on edge function failure
- ✅ Disabled next button when constraints not met

---

## Open Questions (Resolved)

1. **Should V2 sessions migrate to V3?**
   → No. V3 starts fresh. Old brain_json preserved but not resumed.

2. **What if OpenAI is down during onboarding?**
   → Fallback to static default options. No silent failure.

3. **Can user go back to previous steps?**
   → Not in V1. Forward-only flow. Future: add "Back" button.

4. **How to handle "Other" option in niche/offers?**
   → Future: add custom text input for "Other". V1: user selects closest match.

---

## Future Enhancements (Out of Scope for V3)

1. Back button to edit previous steps
2. AI-generated recap/summary at end
3. Voice input for answers
4. Multi-language support
5. Agency onboarding v3 (currently still v2)
6. Real-time collaboration (multiple users editing same session)
7. Auto-save on every input change (currently saves on "Next")
8. Onboarding analytics (time per step, drop-off rates)

---

**Last Updated:** 2025-12-24
**Maintained By:** AI Employee Team
**Status:** Production-Ready
