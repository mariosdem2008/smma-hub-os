# SMMAHUB Client Onboarding AI Chat Migration Blueprint

Last updated: 2026-03-12  
Owner: Product + AI Systems + Frontend  
Status: Planning approved draft (no code execution in this doc)  
Scope: Replace current section-based client onboarding UI with AI-guided chat onboarding that still captures **all current client onboarding fields**.

## 1) Purpose and Promise Alignment

This migration is designed to align onboarding with the product promise from [SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md):

1. AI behaves like an expert operator, not just a form parser.
2. Onboarding feels premium, consultative, and low-friction.
3. Data capture remains complete and production-safe.
4. Completion quality remains measurable and gate-enforced.

## 2) Product Decision

Decision: Build a **new AI-guided chat onboarding UI for clients** that:

1. Looks/feels like agency onboarding chat.
2. Sends structured “input components” as assistant chat messages.
3. Lets users ask free-form questions at any time.
4. Preserves exact field contract currently used by V5 onboarding and completion pipeline.

No schema rewrite is required for phase 1; use existing `client_onboarding_profiles` as source of truth.

## 3) Non-Negotiable Requirements

1. Capture all fields in [SMMAHUB_CLIENT_ONBOARDING_QUESTIONS_AND_STORAGE_MAP.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_CLIENT_ONBOARDING_QUESTIONS_AND_STORAGE_MAP.md) that are currently collected.
2. Keep existing completion RPC flow:
- `complete_onboarding_profile(p_client_id)` remains finalization point.
3. Keep existing readiness semantics:
- Required field set and blocker logic remain deterministic.
4. Do not regress current reliability gates (workflow, premium UX, stability).

## 4) Target UX (Chat + Component Messages)

### 4.1 Interaction model
1. Assistant sends a message introducing a block (example: `Business essentials`).
2. Assistant immediately sends a structured component card in chat.
3. User fills/selects values inside the card and clicks `Submit section`.
4. System validates, saves, acknowledges, and sends next card.
5. User can interrupt with free text at any time (`help`, `what does this mean?`, off-topic); assistant answers briefly and returns to current step.

### 4.2 Component message pattern
Each assistant “form message” contains:
1. Title
2. Why it matters (short business rationale)
3. The fields to fill
4. Quick suggestions (chips)
5. `Submit` action
6. Optional `Save and continue later`

### 4.3 Example first sequence
1. Assistant text: `Business essentials`
2. Assistant component card with:
- `Business name` -> `q1_business_name`
- `Industry / niche` -> `industry_niche`
- `Website URL (optional)` -> `q2_website`
- `Main social profile (required if no website)` -> `q2_social_links[0]`
- `Additional social profiles (optional)` -> `q2_social_links[n]`
3. Submit -> persist -> next card.

## 5) End-to-End Data Contract (No Field Loss)

### 5.1 Required storage compatibility
All current fields remain in `client_onboarding_profiles` and are written exactly as today:
1. Basics: `q1_*`, `q2_*`, `q3_*`, `q4_*`, `industry_niche`
2. Goal: `primary_goal`, `conversion_path`, `conversion_link`, `dm_keyword`
3. Offers: `offers`, `q6_offer_name`, `q6_price_min`, `q6_price_max`
4. Audience: `audience_type`, `primary_customer`, `main_objection`, `q9_pain_points`
5. Brand: `brand_voice`, `content_style`, `on_camera_availability`, `available_assets`
6. Proof: `proof_types`, `competitor_link`, `q13_differentiators`
7. Channels: `platforms`, `formats`, `cadence_preset`, `cadence_per_platform`, `response_handling`, mirrors `q16_enabled_channels`, `q18_cadence`
8. Metadata/autosave: `v5_meta.progress.*`, `readiness_score`, `blockers`, `current_step`, `updated_at`
9. Completion: `completed_at` via RPC

### 5.2 Validation rules
Reuse deterministic rules from current progress/readiness logic:
1. Website-or-social requirement
2. Local geo requirement
3. Conditional conversion link / DM keyword
4. Pain points count
5. Brand/content minimums
6. Cadence requirement

No AI-only validation allowed for required completion.

## 6) Technical Architecture

### 6.1 Frontend
Build new page shell: `ClientOnboardingChatShell` (new), route-compatible with `/onboarding/client/:clientId`.

Core UI blocks:
1. `ChatMessageList`
2. `ChatComponentCardRenderer`
3. `Card types`:
- `business_essentials_card`
- `market_scope_card`
- `goal_conversion_card`
- `offers_card`
- `audience_card`
- `brand_card`
- `proof_card`
- `channels_card`
- `review_card`
4. `FreeformComposer` for “ask AI anything” turns.

### 6.2 Orchestration API
Introduce a dedicated endpoint: `ai-onboarding-client-chat` (recommended), rather than overloading agency endpoint.

Reason:
1. Keeps agency and client concerns isolated.
2. Allows strict client card contracts/versioning.
3. Avoids regression risk in agency onboarding endpoint.

### 6.3 Turn contract (proposed)
Request:
1. `agency_id`
2. `client_id`
3. `turn_id`
4. `mode`: `card_submit | freeform | start | resume | navigate`
5. `card_id` (if submit)
6. `payload` (field map from card)
7. `conversation_context`

Response:
1. `assistant_text`
2. `ui_message` (optional component card)
3. `ui_card_type`
4. `ui_card_schema`
5. `save_result`
6. `progress` (required complete, index, total)
7. `next_expected_card`
8. `blockers`

### 6.4 Persistence strategy
1. Continue direct updates to `client_onboarding_profiles` for submitted card payloads.
2. Save chat state metadata in `v5_meta.chat_onboarding`:
- `session_id`
- `current_card_id`
- `card_history`
- `last_turn_at`
- `ui_contract_version`
3. Optional (recommended) add `client_onboarding_chat_turn_logs` table for auditability and replay.

## 7) Component Card Mapping

Each card maps to explicit field set:

1. `business_essentials_card`
- `q1_business_name`, `industry_niche`, `q2_website`, `q2_social_links`

2. `market_scope_card`
- `q3_market_scope`, `q3_country`, `q3_city`, `q4_languages`

3. `goal_conversion_card`
- `primary_goal`, `conversion_path`, `conversion_link`, `dm_keyword`

4. `offers_card`
- `offers`, `q6_offer_name`, `q6_price_min`, `q6_price_max`

5. `audience_card`
- `audience_type`, `primary_customer`, `main_objection`, `q9_pain_points`

6. `brand_card`
- `brand_voice`, `content_style`, `on_camera_availability`, `available_assets`

7. `proof_card`
- `proof_types`, `competitor_link`, `q13_differentiators`

8. `channels_card`
- `platforms`, `q16_enabled_channels`, `formats`, `cadence_preset`, `cadence_per_platform`, `q18_cadence`, `response_handling`

9. `review_card`
- no new fields; drives completion checks and triggers `complete_onboarding_profile`.

## 8) Migration Strategy (Phased)

### Phase 0: Contracts and Gates (2-3 days)
1. Freeze chat card schema (`ui_contract_version=v1`).
2. Define required card payload validators.
3. Define no-regression gates against current onboarding.

Exit gate:
1. Mapping completeness matrix: 100% field coverage.

### Phase 1: Backend endpoint + deterministic validators (4-6 days)
1. Implement `ai-onboarding-client-chat` endpoint.
2. Implement card submit handlers and per-card validation.
3. Implement freeform intent handling (`answer/help/question/off-topic`) with return-to-card behavior.

Exit gate:
1. Contract tests green.
2. Invalid payloads never corrupt stored data.

### Phase 2: Frontend chat shell + cards (5-7 days)
1. Build chat layout and card renderer.
2. Build all card components with existing section controls reused where possible.
3. Wire autosave and progress indicators.

Exit gate:
1. User can complete full onboarding using cards only.
2. Resume works after refresh.

### Phase 3: Completion and downstream compatibility (2-3 days)
1. Trigger existing completion RPC.
2. Verify client detail handoff remains unchanged.
3. Verify no regression in ingest job enqueue.

Exit gate:
1. `completed_at` + ingest job behavior same as current flow.

### Phase 4: Quality hardening + rollout (4-6 days)
1. Add deep E2E suite for new chat onboarding.
2. Run stability batches + persona matrix.
3. Run premium UX gate.
4. Canary rollout then full rollout.

Exit gate:
1. All gates green for 7-day window.

## 9) Rollout and Safety

### 9.1 Feature flag strategy
Routing:
1. Chat onboarding is now the active default route for `/onboarding/client/:clientId`.
2. Legacy V5 runtime fallback path has been removed from route selection.

### 9.2 Rollback
1. Rollback requires restoring legacy route logic in code (no runtime feature switch remains).
2. No schema-breaking changes required for rollback.
3. Keep writes compatible with existing fields at all times.

## 10) Testing Plan

### 10.1 Unit
1. Card payload validation per card
2. Field mapping serializers
3. Conditional validation rules

### 10.2 Integration
1. Freeform interruption + return to active card
2. Resume/reload with pending card
3. Required blockers computation parity with current logic

### 10.3 E2E
1. Happy path full completion
2. Adversarial/vague/off-topic turns
3. Mobile viewport completion
4. Persona matrix
5. DB contract verification (all required fields)

### 10.4 Acceptance gates
1. Workflow pass rate >= 95% pre-prod batch (`n>=20`)
2. Request failures = 0 in certification batch
3. Required field coverage = 100% on completed runs
4. Premium UX gate pass
5. No P0/P1 regressions in client detail handoff

## 11) Risks and Mitigations

1. Risk: Chat complexity reduces completion speed.
- Mitigation: card-level one-tap suggestions + concise copy + progress cues.

2. Risk: AI over-personalization creates inconsistent UX.
- Mitigation: deterministic card order and strict card schema.

3. Risk: Field mapping drift between card payloads and DB.
- Mitigation: central mapping layer + contract tests + DB assertions in E2E.

4. Risk: Agency-like chat style feels less structured for clients.
- Mitigation: enforce component-card-first responses for required data capture.

## 12) Definition of Done

This migration is complete only when:
1. New chat onboarding collects all current required fields.
2. Completion and ingest pipeline stay compatible.
3. Reliability and premium UX gates are green.
4. Staged rollout completes without P0/P1 incidents.
5. Business promise alignment improves measurably:
- lower friction
- better perceived consultative quality
- unchanged or improved data completeness.

## 13) Immediate Execution Backlog (after plan approval)

P0
1. Finalize card contract JSON schema and mapping matrix.
2. Implement backend endpoint skeleton + deterministic validators.
3. Implement chat shell route behind feature flag.

P1
1. Implement freeform intent adapter with return-to-card behavior.
2. Add chat turn logging and replay metadata.
3. Add full E2E certification suite for chat onboarding.

P2
1. Add guided confidence capture per card.
2. Add advanced review/edit loop inside chat.
3. Add per-card latency + drop-off telemetry dashboard.

## 14) Implementation Start Log (2026-03-12)

Executed scaffold start (Phase 0/1 baseline):
1. Added contract + card validator layer in app code.
2. Added new edge endpoint skeleton `ai-onboarding-client-chat` with:
- auth + agency membership checks
- profile bootstrap via `upsert_onboarding_profile`
- deterministic card-submit validation
- progress/blocker update writes
- completion handoff hook via `complete_onboarding_profile`
3. Added feature flag `CLIENT_ONBOARDING_CHAT_V1` (initial rollout scaffold).
4. Added new frontend chat shell scaffold and routed it behind the feature flag.
5. Updated unit tests for route selection/feature flag behavior.

Initial verification:
1. focused tests pass.
2. web build pass.

Continuation update (same day):
1. Added deterministic chat turn log migration (`client_onboarding_chat_turn_logs`) with RLS.
2. Hardened endpoint flow with:
- strict card submit sequencing
- `resume` message behavior
- freeform intent classification (`help/question/continue/off-topic`)
- non-blocking turn log writes
3. Added contract-level unit tests for card validators/mapping.

Execution continuation (same day, production pass):
1. Made AI chat onboarding the default path.
2. Fixed endpoint assistant confirmation semantics so submit acknowledgements reference the card actually submitted, then introduce the next card.
3. Upgraded business essentials card UX to collect additional social profiles (not just the primary), preserving full field contract for `q2_social_links`.
4. Hardened chat shell usability:
- default boot mode now `resume` for safe refresh continuation
- progress text refreshes on freeform turns
- container uses viewport-safe vertical scrolling to prevent non-scrollable onboarding states.
5. Re-ran focused tests + production build (green).

Execution continuation (runtime cutover):
1. Removed runtime fallback from `AiOnboardingClient` so old V5 onboarding is no longer selected in-app.
2. Removed onboarding-specific feature flag logic from `featureFlags` and aligned tests.
3. Removed `OnboardingV5Wizard` implementation and its direct unit tests; active route now uses chat shell exclusively.
4. Updated phase-1 integration guard test to assert active onboarding surfaces avoid legacy direct brain endpoint calls.

Execution continuation (legacy decoupling hardening):
1. Migrated shared progress + field-label helpers to neutral paths:
- `src/lib/onboarding/progress.ts`
- `src/lib/onboarding/labels.ts`
2. Updated active edge functions (`ai-onboarding`, `ai-onboarding-client-chat`) to import from neutral onboarding libs, removing active dependency on `components/onboarding-v5/lib`.
3. Verified `onboarding-v5` references are now isolated to legacy folder internals only (no active runtime route or edge-function dependency).

Execution continuation (legacy removal completion):
1. Removed the remaining legacy folder `src/components/onboarding-v5` (layout, sections, components, and tests).
2. Confirmed no remaining `onboarding-v5` references in `src`, `supabase`, or `tests`.
3. Re-ran full test suite and production build after removal (green).

Execution continuation (coverage restoration):
1. Added onboarding shared-lib tests for migrated neutral modules:
- `src/lib/onboarding/__tests__/progress.test.ts`
- `src/lib/onboarding/__tests__/labels.test.ts`
2. Re-ran targeted onboarding tests and production build (green).
