# SMMAHUB WF-AGENCY-ONBOARDING Master Migration Plan

Last updated: 2026-03-07  
Status: Strategic Plan (no code changes in this document step)

## Goal
Deliver a premium AI-native agency onboarding that is:
1. Frictionless in UI/UX.
2. Intelligent about user intent (answer vs question vs weak answer).
3. Fast and reliable at runtime.
4. Deterministic in state transitions and completion.

## Product Direction (Locked)
1. User can always submit onboarding data in two first-class ways:
   - click a suggested answer and send immediately
   - type manually in a visible accessible input field
2. AI must interpret each user turn and decide:
   - accepted answer
   - follow-up needed
   - user asked a question and should be answered genuinely
3. Onboarding must feel like living AI chat, not a rigid form wrapper.

## Current State Snapshot (as of 2026-03-07)
1. Core flow is functional and currently green for acceptance scope:
   - full branch-depth run `9/9`
   - adversarial run `4/4`
2. UX quality concerns remain for premium tier positioning:
   - conversation viewport can feel too compressed
   - duplicate/competing suggestion surfaces can create noise
   - accessibility concern when primary input discoverability is reduced in structured states
3. This plan prioritizes UI/UX migration first, then intelligence/speed hardening.

## Question and Suggestion Quality Rewrite Matrix (2026-03-08 E2E)

Source evidence:
1. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/normal_user_flow/logs/summary.json`
2. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/adversarial_user_flow/logs/summary.json`

### Q1 `agency.timezone`
1. Current question: `IANA timezone for agency operations (required).`
2. Better question: `What timezone should we use for deadlines and reports? (e.g., Europe/Athens)`
3. Better suggestions:
   - `Europe/Athens`
   - `Europe/Nicosia`
   - `America/New_York`

### Q2 `agency.primary_client_languages`
1. Current question: `Primary client languages (list with % that sum to 100).`
2. Better question: `What languages do your clients speak most? Add percentages that total 100.`
3. Better suggestions:
   - `English 70%, Greek 30%`
   - `English 100%`
   - `Arabic 60%, English 40%`

### Q3 `agency.team_size_total`
1. Current question: `Total team headcount (including founders).`
2. Better question: `How many people are on your team, including founders?`
3. Better suggestions:
   - `3`
   - `7`
   - `12`

### Q4 `agency.active_paying_clients`
1. Current question: `Active paying clients right now.`
2. Better question: `How many paying clients do you currently manage?`
3. Better suggestions:
   - `3`
   - `12`
   - `48`

### Q5 `agency.top_industries`
1. Current question: `Top up to 5 industries you serve (one-per-line).`
2. Better question: `Which industries are your main focus? (up to 5, one per line)`
3. Better suggestions:
   - `Gyms\nDentists\nSaaS B2B`
   - `Real Estate\nClinics`
   - `Ecommerce\nHospitality\nLegal`

### Q6 `agency.best_client_summary`
1. Current question: `Describe your single best client in 1 sentence...`
2. Better question: `Describe your ideal/best-fit client in one sentence (who they are + main goal + size/budget).`
3. Better suggestions:
   - `B2B SaaS founder at $40k MRR focused on qualified demos.`
   - `Dental clinic owner with 3 dentists seeking predictable bookings.`
   - `Gym owner targeting 10-30 memberships per month.`

### Q7 `agency.key_differentiators`
1. Current question: `Top 3 differentiators (3 bullets, each <=10 words).`
2. Better question: `What are your 3 biggest differentiators? (one short bullet per line)`
3. Better suggestions:
   - `Fast implementation\nWeekly KPI reviews\nClear executive reporting`
   - `Founder-led strategy\nNiche specialization\nReliable delivery cadence`
   - `Performance-first creative\nTransparent reporting\nOffer positioning depth`

### Q8 `agency.service_catalog`
1. Current question: `Which services do you actively sell?...`
2. Better question: `Which services do you sell today? Add one line of scope for each service.`
3. Better suggestions:
   - `Paid Ads | Meta + Google management and optimization`
   - `Social Mgmt | Strategy, posting, and community engagement`
   - `Content Production | Scripts, filming, editing`

### Q9 `agency.top_margin_offers`
1. Current question: strict 4-column pipe format prompt.
2. Better question: `What are your top 1-2 highest-margin offers? Use: Offer | Deliverables | Price Range | Why Margin is High`
3. Better suggestions:
   - `Retainer Growth | Weekly strategy; 12 creatives; reporting | 1500-2500 | Reusable workflow`
   - `UGC Engine | Creator sourcing; 8 videos; usage rights | 1200-2200 | Low production overhead`
   - `LinkedIn Demand | 12 posts; DM script; pipeline review | 1300-2100 | High perceived value`

### Q10 `agency.packaged_offers`
1. Current question: strict 5-column pipe format prompt.
2. Better question: `List 1-5 packaged offers. Use: Offer | KPI Outcome | Deliverables | Duration | Price Range`
3. Better suggestions:
   - `Lead Engine | 40 leads/month | 12 creatives; ad mgmt; reporting | 30 days | 1500-2500`
   - `Content Machine | 20 reels/month | scripting; filming; editing | 30 days | 1200-1800`
   - `LinkedIn Authority | 12 posts + 20 DMs/week | posts; DM scripts; analytics | 30 days | 1100-1700`

### Q11 `agency.pricing_model`
1. Current question: model picker + explanation in one line.
2. Better question: `Which pricing model do you use most? Choose one and add a short reason.`
3. Better suggestions:
   - `Fixed retainer | Predictable monthly scope and planning`
   - `Tiered packages | Different client sizes need different depth`
   - `Hybrid | Base fee plus performance upside`

### Q12 `operations.required_client_assets`
1. Current question: `checkbox + max delay in days` phrasing is form-like.
2. Better question: `Before kickoff, what must clients send you and within how many days? Use: Asset | Max Delay Days`
3. Better suggestions:
   - `Brand guidelines | 5`
   - `Ad account access | 3`
   - `Offer details + pricing | 4`

## Adversarial Intent Handling Rewrite Rules
1. If user asks a question:
   - First line: answer directly in plain language.
   - Second line: request the pending field in one sentence.
   - Suggested replies must include both `answer example` and `continue answering`.
2. If user gives vague answer:
   - Ask targeted follow-up tied to missing tokens (not generic "share more detail").
3. If format invalid:
   - Do not expose `ERR_*`.
   - Show user-safe copy with one tap-to-insert valid template.

## Screenshot Evidence Index (Current Onboarding)

### A) User-provided screenshot in current thread (primary UX complaint reference)
1. Thread image (2026-03-07):
   - concern: chat area too small, suggestions duplicated/competing, manual input accessibility weakened
   - reference tag for team reviews: `THREAD_SCREENSHOT_2026-03-07_AGENCY_ONBOARDING_UI_CONCERN`

### B) Existing onboarding E2E screenshots
1. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-07/screenshots/01_onboarding_entry.png`
2. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-07/screenshots/02_after_send.png`
3. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-07/screenshots/03_after_use_and_send.png`
4. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-07/screenshots/04_after_undo.png`
5. `docs/audit/system/evidence/wf_agency_onboarding_2026-03-07/screenshots/08_after_activate_workspace.png`

### C) Existing onboarding UI/UX before/after batch screenshots
1. Before:
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/before/01_onboarding_entry.png`
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/before/02_after_send.png`
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/before/03_after_use_and_send.png`
2. After:
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/after/01_onboarding_entry.png`
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/after/02_after_send.png`
   - `docs/audit/system/evidence/wf_agency_onboarding_uiux_2026-03-07/after/03_after_use_and_send.png`

## Migration Plan (Phase-first)

## Phase 1: Advanced UI/UX Migration (First Priority)

### Objective
Make onboarding visually clean, conversion-safe, and operationally obvious on desktop/mobile.

### UX Requirements
1. Chat transcript must be large and readable:
   - minimum visible transcript height target (desktop) and sticky composer region.
2. Composer is always present:
   - manual input field never disappears.
3. Suggestions are singular and non-duplicative:
   - one suggestion system per turn, not stacked multiple systems.
4. Suggested answer interaction modes:
   - `Use & send` (one-click)
   - `Use & edit` (fills input without auto-send)
5. Structured-answer helper stays contextual:
   - helper chips shown near composer, not as competing high-level panel.
6. Progress/status kept lightweight:
   - no heavy metadata blocks that push chat off screen.
7. Mobile-first usability:
   - keyboard-safe layout, no hidden send action, no clipped transcript.

### Phase 1 Deliverables
1. UI blueprint for onboarding screen anatomy.
2. Component contract for:
   - transcript
   - suggestion rail
   - composer/input/send controls
   - lightweight progress header
3. State matrix for loading/empty/error/success per component.
4. Screenshot acceptance matrix (desktop + mobile for each major state).

### Phase 1 Acceptance Gates
1. `UX-ONB-001`: input field visible and usable at all times.
2. `UX-ONB-002`: user can complete step using suggestion-only path.
3. `UX-ONB-003`: user can complete same step using manual-input path.
4. `UX-ONB-004`: no duplicate suggestion modules on same turn.
5. `UX-ONB-005`: transcript remains readable while composing.
6. `UX-ONB-006`: all above pass on mobile.

## Phase 2: AI Conversation Intelligence

### Objective
Detect user intent per turn and respond intelligently without breaking step progression.

### Intent Contract
1. `intent_type`: `answer | question | mixed | unclear`
2. `answer_quality`: `strong | weak | invalid`
3. `action_decision`: `accept | follow_up | answer_user_question | reject_retry`
4. `confidence`: numeric band for observability and tuning.

### Behavior Rules
1. If user asks a question:
   - answer it genuinely
   - do not mark field answered unless valid answer exists
   - then resume same onboarding step.
2. If answer is weak/incomplete:
   - ask a targeted follow-up.
3. If answer is strong:
   - commit + advance exactly one step.
4. If mixed (answer + question):
   - save validated answer fields
   - answer user question
   - only advance if required data is complete.

### Phase 2 Acceptance Gates
1. `AI-ONB-001`: question-only input does not incorrectly advance step.
2. `AI-ONB-002`: weak answer triggers precise follow-up.
3. `AI-ONB-003`: mixed intent handled without data loss.
4. `AI-ONB-004`: contradictory answer handled with clarification prompt.
5. `AI-ONB-005`: turn decision is observable in logs.

## Implementation Delta (2026-03-08)
1. Completed now:
   - user-facing validation copy sanitization (no internal `ERR_*` leakage)
   - user-question intent reply with explicit rationale and guided reprompt
   - robust language-percent parsing for natural inputs
   - pipe-row delimiter parsing fix for offer fields
   - deterministic typed `expects` response contract
   - clearer question phrasing for core onboarding prompts
2. Verified by live rerun:
   - normal: `11/11`
   - adversarial: `19/19`
3. Still pending from this plan:
   - deeper context-aware suggestion personalization
   - shorter, more natural question-intent reply style

## Phase 3: Backend Speed and Reliability

### Objective
Make AI onboarding feel instant and robust under real user behavior.

### Performance Contract
1. Fast-first response target for every user turn (p50/p95 budget to be tracked).
2. Streaming-first assistant responses where applicable.
3. Idempotent submit/retry behavior:
   - no duplicate commits on retries.
4. Guaranteed turn log persistence:
   - every request writes decision metadata.

### Reliability Contract
1. Deterministic route ownership:
   - `/ai/onboarding/agency` remains stable during saves/retries.
2. Strict state machine:
   - transition only through allowed actions.
3. Safe fallback paths:
   - timeout, provider degradation, temporary backend errors.

### Phase 3 Acceptance Gates
1. `BE-ONB-001`: retry never corrupts step state.
2. `BE-ONB-002`: undo/edit preserves consistency.
3. `BE-ONB-003`: resume after refresh rehydrates exact state.
4. `BE-ONB-004`: no silent failures; user sees actionable message.

## Phase 4: Certification and Rollout

### Test Matrix
1. Happy path:
   - owner completes all required fields and activates workspace.
2. Adversarial path:
   - user asks questions repeatedly instead of answering.
   - user submits low-signal/garbage answers.
3. Recovery path:
   - network disruption + retry.
   - undo + resume.
4. Device path:
   - desktop + mobile portrait.

### Certification Gates
1. All `UX-ONB-*` pass.
2. All `AI-ONB-*` pass.
3. All `BE-ONB-*` pass.
4. Fresh screenshot pack and logs added to evidence folder.

## Workstreams in Parallel
1. `WS-UX`: chat layout/composer/suggestion migration.
2. `WS-AI`: turn classification, follow-up policy, question-answer switchback.
3. `WS-BE`: orchestration latency, idempotency, state-machine integrity.
4. `WS-QA`: E2E matrix and screenshot evidence gatekeeping.

## Execution Order (Recommended)
1. Week 1:
   - finalize Phase 1 UX blueprint and component contracts.
2. Week 2:
   - ship UI migration and certify `UX-ONB-*`.
3. Week 3:
   - implement intent/quality policy layer and certify `AI-ONB-*`.
4. Week 4:
   - speed/reliability hardening and certify `BE-ONB-*`.
5. Week 5:
   - final E2E recertification + freeze.

## Risk Register (Onboarding-only)
1. UX regression risk:
   - new structured helpers can reduce chat readability if not constrained.
2. Intent misclassification risk:
   - question vs answer false positives can block progression.
3. Latency risk:
   - intelligent routing may increase response time without caching/streaming.
4. Scope creep risk:
   - mixing full strategy logic into onboarding before UX migration finishes.

## Non-Negotiable Definition of Done
1. The onboarding always has:
   - one visible composer/input
   - one coherent suggestion system
   - one readable chat transcript
2. AI correctly handles:
   - answers
   - questions
   - low-quality responses
3. Workflow reliability:
   - no dead ends, no silent data corruption, deterministic activation.

## Screen-by-Screen Wireframe Spec (Pre-Implementation)

## Screen 1: Onboarding Entry (Default State)

### Layout Zones
1. `Z1 Header Strip`:
   - left: `AI Onboarding` label + short subtitle
   - right: compact progress (`required X/Y`) + autosave indicator
2. `Z2 Transcript Panel`:
   - full-width primary panel for assistant + user turns
   - scrollable, dominant vertical space on page
3. `Z3 Context Row`:
   - single line: current question summary + optional helper text
4. `Z4 Suggestion Rail`:
   - one set of suggestion chips for the active turn only
5. `Z5 Composer`:
   - multiline input (always visible)
   - primary `Send` button
   - secondary actions (`Undo`, `I don't know`, `Use & edit` when relevant)

### Behavior Rules
1. Transcript must keep latest assistant prompt visible after send.
2. Suggestions never render in two different UI blocks for the same turn.
3. Composer remains enabled even when suggestions are present.
4. `Enter` sends, `Shift+Enter` newline.

## Screen 2: Suggestion-First Answering

### Layout Zones
1. `Z4 Suggestion Rail` shows ranked chips:
   - `Use & send` (one click submit)
   - `Use & edit` (prefill composer without submit)
2. `Z5 Composer` stays visible below suggestions.

### Behavior Rules
1. Clicking `Use & send` appends user message immediately and triggers submit.
2. Clicking `Use & edit` copies text into composer and places cursor at end.
3. Suggestion usage logs source metadata (`suggested=true`, `suggestion_id`).

## Screen 3: Manual Input-First Answering

### Layout Zones
1. `Z5 Composer` visually prioritized when user starts typing.
2. `Z4 Suggestion Rail` remains available but de-emphasized.

### Behavior Rules
1. Manual input always overrides chip-selected draft if user edits text.
2. Validation feedback appears inline under composer.
3. Invalid submission does not advance step; shows precise repair hint.

## Screen 4: User Asked a Question Instead of Answer

### Layout Zones
1. `Z2 Transcript Panel` shows:
   - user question turn
   - assistant answer turn
   - resumed onboarding prompt turn
2. `Z5 Composer` remains active for next response.

### Behavior Rules
1. System classifies turn as `question` or `mixed`.
2. Assistant answers genuinely, then resumes same onboarding step.
3. Step progress does not advance unless required answer criteria are met.

## Screen 5: Weak or Incomplete Answer Follow-Up

### Layout Zones
1. `Z2 Transcript Panel` includes targeted follow-up from assistant.
2. `Z4 Suggestion Rail` refreshed with follow-up-aware examples.
3. `Z3 Context Row` indicates what is still missing.

### Behavior Rules
1. Turn decision shown internally as `follow_up` (telemetry).
2. Follow-up asks one concrete missing dimension at a time.
3. No hidden state advance before completion criteria pass.

## Screen 6: Recovery and Safety (Undo/Retry/Resume)

### Layout Zones
1. `Z5 Composer` includes compact safety actions:
   - `Undo last`
   - `Retry send` (only when previous call failed)
2. `Z1 Header Strip` shows autosave and reconnect state.

### Behavior Rules
1. Retry is idempotent: same payload does not create duplicate accepted turns.
2. Undo reopens previous step and restores prior prompt context.
3. Refresh/resume restores transcript + active step + draft text (if unsent).

## Screen 7: Completion and Activation

### Layout Zones
1. `Z1 Header Strip` shows completion summary for required fields.
2. `Z2 Transcript Panel` shows final assistant recap.
3. `Z5 Composer` replaced by activation CTA block only when truly complete.

### Behavior Rules
1. Activation CTA appears only after deterministic completion checks.
2. User can still edit previous answers before activation.
3. Post-activation route transition is explicit and traceable.

## Mobile Wireframe Constraints
1. Sticky composer with safe-area padding; never hidden behind keyboard.
2. Transcript occupies majority of viewport; header condensed to one line.
3. Suggestion rail horizontal scroll; max two rows before collapse.
4. Primary send action always visible without extra tap.

## Component Hierarchy (Target)
1. `AgencyOnboardingPage`
2. `OnboardingHeaderStrip`
3. `OnboardingTranscript`
4. `OnboardingContextRow`
5. `OnboardingSuggestionRail`
6. `OnboardingComposer`
7. `OnboardingRecoveryActions`
8. `OnboardingCompletionGate`

## UI State Contract by Component
1. `OnboardingTranscript`: `loading | ready | error`
2. `OnboardingSuggestionRail`: `hidden | loading | ready | disabled(reason)`
3. `OnboardingComposer`: `idle | typing | submitting | validation_error | network_error`
4. `OnboardingCompletionGate`: `locked | ready_to_activate | activating | activated`

## Telemetry Hooks for UX/AI Quality
1. `onboarding.turn.classified`:
   - intent, quality, decision, latency_ms
2. `onboarding.suggestion.used`:
   - suggestion_id, mode (`use_send` or `use_edit`)
3. `onboarding.followup.triggered`:
   - reason code (`missing_detail`, `invalid_format`, `contradiction`)
4. `onboarding.ui.friction`:
   - retries, undo count, validation errors per step
