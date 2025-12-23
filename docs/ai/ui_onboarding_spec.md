# AI Onboarding UI Spec (Agency + Client)

## Global UI Principles
- Minimalistic, 1 primary column layout, max width 720px
- Typography-first, 1 active focus at a time
- Chat feel: GPT-style conversation
- Save/resume, back, skip (if optional), progress indicator
- Response time targets:
  - UI interaction < 150ms perceived
  - AI evaluation step shows "Analyzing..." within 300ms
- Accessibility: keyboard-first, clear focus states

## Message Types
1) AI Question
   - One core question at a time
   - Follow-up questions (max 3 per core question)
2) User Answer
   - Input types: chips/radios, textarea, file upload, URL input
3) System Status
   - "Analyzing...", "Saved", "Upload failed", "Rate limit reached"
4) Review & Confirm
   - Structured field summary + confidence

## Input Types
- Single-select chips/radios
- Multi-select chips
- Free-text textarea (min 1 sentence or 20 chars for required questions)
- File upload (PDF/DOC/URL)
- URL list (one per line)

## Answer Quality Check (server-side)
- After each user answer, run validation
- Outcomes:
  1) Accept + move to next core question
  2) Ask 1–3 follow-ups
  3) Mark as optional if skipped

## Progress + Completion
- Show: "X / Y core questions completed"
- Y is dynamic but bounded:
  - Agency: 20–40 core questions
  - Client: 25–50 core questions
- Completion thresholds:
  - Complete: >= 90% required fields filled
  - Usable: >= 70% required fields filled
  - Agency completion also requires >= 5 exemplar strategies ingested

## Review & Confirm
- AI displays extracted fields + confidence (0–100)
- Show missing required fields (if any)
- Actions: Edit (return to question), Lock v1, Save Draft

## Save/Resume + Back + Skip
- Save after each answer (auto-save)
- Resume returns to last unanswered core question
- Back allows last 3 questions only (to keep state simple)
- Skip only if optional; skipped items are flagged in Review & Confirm

## Agency Onboarding Conversation Flow (Core Questions)
1) Agency identity (name, niches, offers, geo, languages)
2) ICP definition (industries, size, personas, pains, objections)
3) Voice/tone (5 adjectives, banned words, preferred vocab, rules)
4) Strategy defaults (pillars, hook styles, CTA styles, platform formats)
5) Safety/claims policy (allowed/avoid/compliance notes)
6) Process rules (revisions, approvals, escalation)
7) Sales/Support FAQ (10–30 Q/A)
8) Gold examples (5–20 examples + why good)
9) Exemplar strategy ingestion (>= 5 docs required)

## Client Onboarding Conversation Flow (Core Questions)
1) Brand basics (name, website, socials, tone, differentiators)
2) Offer details (products/services, pricing optional, USPs)
3) Audience (demographics, location, intent, problems, objections)
4) Competitors (3–10 + notes)
5) Constraints (banned claims, legal, taboo topics)
6) Pillars (3–7 + examples)
7) FAQ (10–30 Q/A)
8) Assets/links (key URLs, guidelines)

## Follow-up Logic
- Max 3 follow-ups per core question
- Follow-ups triggered when:
  - Required fields missing
  - Answer conflicts with prior data
  - Answer lacks specificity (below minimum length/structure)

## Edge Cases
1) Skipped required question
   - Flag in review and prevent "Lock" until resolved
2) Conflicting answers
   - Ask clarifying follow-up, keep both versions in audit trail
3) Doc upload failures
   - Show error + retry; log failure; allow proceed if optional
4) Rate limits
   - Show "Rate limit reached"; allow retry after reset
5) Budget exceeded
   - Force UNKNOWN behavior; allow only review or exit
6) Partial completion
   - Save draft with status "usable" if >= 70% required fields filled

## Data Outputs
- On each step: save answer + quality check result
- On review: snapshot of brain JSON + confidence + missing fields
- On lock: create version v1 and mark status "complete"

## Cross-References
- Onboarding State Schema: docs/ai/ui_onboarding_state.schema.json
- Agency Brain Schema: docs/ai/agency_brain.schema.json
- Client Brain Schema: docs/ai/client_brain.schema.json
