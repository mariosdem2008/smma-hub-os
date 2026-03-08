# WF-AGENCY-ONBOARDING Quality E2E Summary (2026-03-08)

## Run Scope
1. Normal user walkthrough (real UI, regular answers).
2. Adversarial walkthrough (vague answers, invalid format, user asks question instead of answering).
3. Environment: `http://localhost:8080` with real Supabase staging credentials from env.

## Result Snapshot
1. Normal flow:
   - Steps: `17`
   - Pass: `17`
   - Fail: `0`
   - Log: `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/normal_user_flow/logs/summary.json`
2. Adversarial flow:
   - Steps: `20`
   - Pass: `20`
   - Fail: `0`
   - Log: `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/adversarial_user_flow/logs/summary.json`
3. Index:
   - `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/quality_e2e_index.json`

## Post-Fix Rerun (after `ai-onboarding` deploy on 2026-03-08)
1. Normal flow:
   - Steps: `11`
   - Pass: `11`
   - Fail: `0`
2. Adversarial flow:
   - Steps: `19`
   - Pass: `19`
   - Fail: `0`
3. Key deltas verified:
   - Internal error token leakage removed from user-visible follow-up copy.
   - User-question intent now receives a genuine "why this matters" answer before reprompt.
   - `expects` now matches typed contract (`tz_lang`, `percent`, `numeric`, `list`, `text`) instead of always `text`.
   - Strict offer-format questions no longer loop due semicolon parsing bug in pipe rows.

## Screenshot Packs
1. Normal flow screenshots:
   - `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/normal_user_flow/screenshots/`
2. Adversarial flow screenshots:
   - `docs/audit/system/evidence/wf_agency_onboarding_2026-03-08/adversarial_user_flow/screenshots/`

## Key Behavioral Findings
1. Validation catches malformed inputs for timezone and percentage split.
2. User-question turn now gets a direct explanation + request for best-effort answer.
3. Error messaging is cleaner and user-facing.
4. Offer schema progression improved (no repeat-loop from delimiter bug).
5. Updated guardrail: after repeated invalid attempts on required structured fields, flow now requires explicit `continue` before advancing.
6. Residual gap: question-intent rationale copy still needs brevity polishing and more contextual personalization.

## Context-Aware Suggestions Delta (2026-03-08, latest rerun)
1. Deterministic onboarding suggestions now blend:
   - context-derived suggestions from current snapshot
   - field examples
   - normalized fallback
2. Verified live examples from normal run:
   - `agency.timezone`: `Europe/Athens`
   - `agency.primary_client_languages`: `English 70%, Greek 30%`
   - `agency.service_catalog`: `Paid Ads | Weekly optimization and transparent reporting`
   - `agency.top_margin_offers`: contextual `Paid Ads Growth | ...`
   - `operations.required_client_assets`: `Paid Ads account access | 3`
3. Quality impact:
   - less generic/off-topic suggestions at early steps
   - stronger continuity between already-captured answers and next-step suggestions

## Copy Polish Delta (2026-03-08, latest deploy)
1. Question-intent reply copy shortened and made more conversational.
2. Repeated-invalid follow-up copy simplified:
   - `If you're unsure, reply "continue" to move on, or share a best-effort answer now.`
3. Result:
   - Same E2E stability (`normal 11/11`, `adversarial 20/20`)
   - Cleaner first-impression tone in clarification turns.

## Strict-Field Template Suggestions Delta (2026-03-08)
1. Follow-up turns for structured fields now keep one-tap valid templates in suggestions.
2. Verified timezone follow-up suggestions are now focused and clean:
   - `Europe/Athens`
   - `Europe/Nicosia`
   - `Asia/Dubai`
3. Removed off-topic generic fallback chips from these follow-up states.

## Personalized "Why This Matters" Delta (2026-03-08)
1. Question-intent responses now use field-aware rationale copy.
2. Example observed in live adversarial run (`agency.timezone`):
   - `Good question. We ask this because timezone controls deadlines and reporting windows. This improves SLA timing and schedule accuracy...`
3. Quality impact:
   - clearer business reason per field
   - less generic assistant behavior during question-intent turns
   - maintains concise reprompt + valid suggestion chips

## Expert Assist Drafting Delta (2026-03-08)
1. When users ask for help instead of answering, assistant now returns:
   - field-specific rationale
   - a concrete draft answer based on known context and field template
2. Verified example:
   - `agency.timezone` question-intent response includes `Quick draft: Europe/Athens`
3. General behavior:
   - drafting logic now covers structured and text fields via per-field templates + contextual defaults.

## Expert Assist Personalization Delta (2026-03-08, latest rerun)
1. Adversarial help-check for `agency.best_client_summary` now passes in live flow.
2. Verified response behavior:
   - assistant explains why the field matters
   - assistant returns a context-aware quick draft using prior answers (industries, team size, budget context)
3. Result:
   - user question turns are now materially useful instead of generic re-prompts
   - adversarial run remains green (`20/20`) while preserving progression rules
