# SMMAHUB Client Onboarding Premium UX Gap and Rebuild Plan

Date: 2026-03-09  
Last updated: 2026-03-10  
Status: Implemented and certified for current V3 scope  
Decision target: maintain premium onboarding quality via executable gate enforcement.

## 1) Executive Verdict (Current State)
- Current onboarding is functionally reliable but not premium-grade UX.
- Current premium gate status: `GREEN` (certified 2026-03-10).
- Keep client onboarding `GREEN` only while section-9 acceptance gate remains passing.

## 2) Observed Gaps (From live UI + current implementation)
1. Chat reading area is too short:
- Conversation viewport is compressed, reducing readability and continuity.
- User cannot comfortably scan prior turns without excessive scrolling.

2. Message language is unclear/non-human:
- Phrases like `Captured. We are building a complete profile.` feel robotic and ambiguous.
- User must interpret system state instead of being guided clearly.

3. UI hierarchy is noisy around core action:
- Readiness bars, tags, metadata, and technical context compete with the conversation.
- Main user intent (answer the question) is visually de-prioritized.

4. Suggestion and draft model is cognitively heavy:
- “Fill missing”, “Apply mapped draft”, “Show why”, structured payload previews can feel internal/operator-centric.
- Feels like QA tooling, not a premium agency onboarding experience.

5. Trust/clarity gap in flow:
- User is not always told clearly:
- what was understood
- what was saved
- what exact one next step is needed

6. Professional tone inconsistency:
- Some responses remain template-like and repetitive.
- Premium expectation requires concise, context-rich, plain language.

## 3) Root Causes
1. Technical-state-first UX:
- Internal states and mapping outputs are over-exposed in primary UI.

2. Mixed interaction models:
- Chat-first and form-ops behavior are blended without clear boundaries.

3. No strict “single next action” conversation contract:
- Assistant replies can include multiple ideas at once, increasing user effort.

4. Utility-first shell sizing:
- Layout allocates too much vertical space to chrome and too little to transcript.

## 4) Target Experience (High-End Vision)
1. DM-first and readable:
- Chat is dominant and comfortably tall.
- One screen = clear context + active question + direct response path.

2. Plain-language assistant:
- No internal wording (`captured`, `resolver`, `mapped`, etc.) in user-visible chat.
- Every AI turn follows:
- what I understood (one sentence)
- why it matters (one short clause)
- one next ask (single clear question)

3. Frictionless response model:
- User can:
- type naturally
- tap suggestion
- ask for help
- ask a question
- all without leaving the chat rhythm.

4. Progressive disclosure:
- Advanced metadata, mapping details, and “why/debug” are hidden behind optional controls.

5. Deterministic trust signals:
- Explicit “Saved” and “Next” confirmation in plain language.
- No ambiguous state text in primary surface.

## 5) Rebuild Strategy (Recommended)
Recommended path: `UX shell migration + conversation contract hardening`, keeping current backend contracts and data model compatibility.

Why:
- Avoids full backend rewrite risk.
- Delivers the biggest perceived quality improvement fastest.
- Preserves existing readiness and integration reliability.

## 6) Planned Scope (What changes)
1. Layout migration:
- Increase transcript viewport height significantly.
- Reduce top/bottom chrome footprint.
- Keep page itself non-scrollable; only transcript scrolls.

2. Conversation copy contract:
- Replace robotic lead phrases.
- Enforce concise, premium response templates.

3. Interaction simplification:
- Keep one primary composer.
- Move advanced actions to secondary affordances.
- Show one clear next task at a time.

4. Suggestion redesign:
- Suggestions appear as assistant-proposed quick replies in flow.
- No “internal task phrasing” for end users.

5. Confidence + save communication:
- Keep confidence logic internally.
- Surface only human-readable confirmation and next action.

## 7) Delivery Plan (Implementation-ready)
Day 1: UX contract freeze
- Finalize copy style guide and response template rules.
- Freeze “single next action” behavior contract.

Day 2: Layout rebuild
- Resize shell for larger transcript and cleaner focus.
- Reduce non-essential chrome and spacing overhead.

Day 3: Conversation copy migration
- Remove ambiguous/robotic phrases.
- Apply premium concise language across intent branches.

Day 4: Suggestion and composer simplification
- Convert suggestions to user-facing quick replies.
- Keep advanced controls secondary, not primary.

Day 5: Stateful clarity pass
- Add explicit plain-language saved/next-step feedback.
- Remove technical jargon from visible UI.

Day 6: Edge-case behavior pass
- Test vague/question/help/off-topic flows for clarity and low friction.

Day 7: Mobile premium pass
- Ensure readable transcript, compact controls, and stable composer behavior.

Day 8: Full E2E + screenshot certification
- Run full deep onboarding matrix and capture before/after evidence pack.

## 8) Risks and Mitigation
1. Risk: losing deterministic behavior while simplifying UI
- Mitigation: keep existing mapping/readiness contracts unchanged; UI refactor only first.

2. Risk: over-minimizing and hiding needed controls
- Mitigation: progressive disclosure with explicit secondary actions.

3. Risk: tone regressions over time
- Mitigation: add copy lint checklist + golden-set phrase constraints.

## 9) Green-Flag Acceptance Gate (Must all pass)
1. UX readability:
- Transcript area is clearly dominant and readable on desktop + mobile.
- User can follow last 4-6 turns without strain.

2. Conversation clarity:
- No ambiguous robotic phrases in primary assistant responses.
- Each turn has one clear next action.

3. Friction:
- User can complete onboarding without reading internal/meta language.
- Suggestion taps and typed answers feel equivalent and obvious.

4. Reliability:
- Deep onboarding E2E pass (`100%`), `console_errors=0`, `request_failures=0`.

5. Quality:
- Golden-set quality gate remains pass after UX migration.

## 10) Immediate Next Step
- Enforce recurring certification:
1. Run `npm run quality:client-onboarding:premium:gate` on staging promotion.
2. Keep evidence artifacts updated in `wf_client_onboarding_deep_2026-03-10`.
3. Treat any premium gate failure as release-blocking until resolved.

## 11) Certification Update (2026-03-10)
1. Premium acceptance gate is now executable and passing.
2. Certification result: `6/6` checks pass.
3. Evidence:
- [wf_client_onboarding_premium_gate_summary.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/notes/wf_client_onboarding_premium_gate_summary.md)
- [wf_client_onboarding_full_setup_batch_summary.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/notes/wf_client_onboarding_full_setup_batch_summary.md)
- [wf_client_onboarding_full_setup_persona_matrix_summary.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-10/notes/wf_client_onboarding_full_setup_persona_matrix_summary.md)
