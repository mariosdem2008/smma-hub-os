# Admin Guided Setup Engine

## Overview
The admin guided setup is a deterministic, question-based flow. The server drives the sequence, enforces one question per turn, and stores structured answers in the agency brain JSON.

## Question Map (max 12)
Each step is defined in `supabase/functions/_shared/agency-admin-setup-questions.ts` with:
- `key`
- `question_text`
- `expects`
- `target_path`
- `examples` (for clarifications)
- `suggestions` (quick answers)

## State Machine
On every turn:
1) Determine pending question (from `meta_json.state` or next unanswered).
2) Classify intent: READY_CONFIRMATION, ANSWER, CLARIFICATION, OFFTOPIC, STOP_OR_PAUSE.
3) Respond deterministically based on intent:
   - READY: ask Q1.
   - ANSWER: extract JSON, advance to next question.
   - CLARIFICATION: define + examples, re-ask pending question.
   - OFFTOPIC: answer briefly, re-ask pending question.
   - PAUSE: set status paused, offer resume.

## Progress Tracking
Stored in `agency_brains.brain_json.setup_progress_v1`:
- `status`: not_started | in_progress | paused | completed
- `progress_percent`
- `missing_fields` (remaining question keys)
- `current_step_key`
- `completed_keys`
- timestamps

## Storage Targets
Answers are stored in:
- `agency_brains.brain_json.setup_profile_v1` (structured profile)
- `agency_brains.brain_json.faq_v1` (for FAQ collection)
- `agency_brains.brain_json.ai_context_v1` (stable summary)

## Failure Handling
If extraction JSON is invalid or empty:
- Respond: "I couldn't parse that. Let's continue: <pending_question_text>"
- Do NOT write to the brain.
- Re-ask the pending question with suggestions.
