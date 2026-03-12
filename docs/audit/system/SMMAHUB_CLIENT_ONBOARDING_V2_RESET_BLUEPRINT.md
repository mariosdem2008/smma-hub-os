# SMMAHUB Client Onboarding V2 Reset Blueprint

Date: 2026-03-08  
Owner: Product + Engineering  
Status: Approved for implementation (reset path)

## 1. Why reset instead of patching
- Current client onboarding has improved reliability, but UX quality is still below premium launch standard.
- Existing flow remains section/form-first and does not feel truly AI-native.
- Conversion risk remains high because users are forced into structured inputs too early.

Decision: rebuild onboarding from top to bottom as a chat-first AI system while preserving the backend readiness contract.

## 2. V2 product direction
- Primary interaction: conversational DM-style chat.
- User actions supported in every step:
  - answer directly
  - ask a question
  - request help/example
  - pick suggested replies
  - edit/undo applied AI drafts
- AI behavior target:
  - detect intent (answer/question/help/vague)
  - produce structured field updates with confidence
  - ask minimal clarifying follow-up only when confidence is low
  - remain concise, non-repetitive, contextual to prior answers

## 3. UX/UI principles (launch bar)
- Chat is the visual center of gravity.
- Minimal surrounding noise and compact utility chrome.
- Suggestions appear inline with the active AI message, not in disconnected panels.
- Input composer is always visible and mobile-safe.
- Loading/thinking states are explicit and fast.
- Desktop and mobile both preserve readable message width and clear hierarchy.

## 4. Contract constraints (must not break)
- Keep existing typed profile schema (`client_onboarding_profiles`) compatible.
- Keep deterministic readiness gates before strategy generation.
- Keep current strategy-generation RPC contract (`complete_onboarding_profile`) intact.
- All V2 AI writes must be auditable (`source`, `confidence`, `updated_fields`).

## 5. V2 architecture slices
1. `V2 Shell`
- Chat timeline + composer + suggestion chips + message actions.
- Feature-flagged route switch.

2. `Intent + Extraction`
- Input classifier (answer/question/help/vague).
- Model extraction to structured fields + confidence + follow-up.
- Local fallback parser when extraction function unavailable.

3. `Draft Safety`
- Low-confidence apply guard.
- Apply/undo with visible field impact summary.

4. `Progress + Blockers`
- Live readiness bar.
- Section/field blockers with direct jump-to-fix.

5. `Completion Gate`
- Generate strategy only when readiness rules pass.
- Explicit missing requirements otherwise.

## 6. Implementation phases
## Phase A (foundation, now)
- Add `ONBOARDING_V2` feature flag default OFF.
- Add V2 shell scaffold and route-gated rendering.
- Keep V5 as default fallback.

## Phase B (AI core)
- Introduce V2 edge extraction contract:
  - `intent`
  - `updates`
  - `confidence`
  - `follow_up`
  - `suggestions`
- Add intent-specific reply policy and tone controls.

## Phase C (quality + launch hardening)
- Full E2E matrix for happy + adversarial paths.
- Mobile compaction pass.
- Observability dashboards for drop-off, clarification loops, and apply success rate.

## 7. Acceptance criteria to mark V2 green
- Functional:
  - End-to-end onboarding completion works from first message to strategy generation.
  - Deterministic behavior for invalid client/missing access/partial profile.
- AI quality:
  - Intent classification accuracy validated on test set.
  - Question/help responses are contextual and not repetitive.
  - Low-confidence writes require confirmation.
- UX quality:
  - Chat-first layout passes desktop/mobile screenshot review.
  - No dead ends, no hidden required actions.
- Reliability:
  - Deep workflow E2E passes with `console_errors=0`, `request_failures=0`.

## 8. Rollout strategy
- Stage 1: internal QA only (`?onboarding_v2=1`).
- Stage 2: selected agencies via env flag.
- Stage 3: default ON, V5 kept as rollback path for one release cycle.
- Stage 4: remove V5 after stable production metrics.

## 9. Evidence links
- Current deep audit baseline:
  - `docs/audit/system/SMMAHUB_WF_CLIENT_ONBOARDING_DEEP_AUDIT.md`
- Current deep-run evidence:
  - `docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/notes/wf_client_onboarding_deep_summary.md`
  - `docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/logs/wf_client_onboarding_deep_summary.json`

