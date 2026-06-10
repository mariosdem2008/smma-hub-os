# Codex Build Brief: Governed Grading Agent (enforce the brain on client-facing AI output)

You are building the governance-enforcement layer for SMMAHUB — the piece that makes "governed AI" real. Today the agency brain is *injected* into generation prompts but never *enforced*: `supabase/functions/ai-answer-quality-check/index.ts` is a stub that returns `accepted: true` for any non-empty text. Replace it with a real governed grader and wire it into the client-facing output paths. The technical founder reviews and tests with a local model.

## Vision anchor (do not violate)
- Generated outputs are NOT source of truth; client-facing material must pass grading and review.
- Bad or weak output must be **stoppable, revisable, and explainable** — a hard banned-claim violation must block; a weak output must come back with specific, actionable issues.
- Governance is composed from the agency brain (see `docs/06-subject-pack-model.md` ordering: compliance > client > agency > offer > channel > workflow). Compliance/banned-claim rules are the highest priority and cannot be overridden.

## Absolute rules
- **No paid AI providers / production keys.** The LLM-judge layer MUST go through the existing router `ai.run` (`src/ai/router.ts`) so it runs against the local Ollama model in tests. The provider honors `OPENAI_BASE_URL` (local harness: `.env.local-ai`, model `qwen2.5:7b-instruct` if present else `qwen2.5-coder:1.5b`).
- Multi-tenant isolation preserved; agency-scoped. New migration timestamp AFTER 20260610124500. Idempotent. Match existing code style. `npm run build` + `npx vitest run` green.
- Do not regress the shipped design system or ErrorBoundary if you touch any UI.

## What to build

### 1. Shared grading core (pure, unit-testable) — `supabase/functions/_shared/answer-grading.ts`
A function `gradeAgainstGovernance({ text, governance, contentType })` returning:
```
{
  accepted: boolean,
  score: number (0-100),
  hard_violations: [{ code, message, evidence }],   // banned claim, missing required disclaimer, restricted topic
  soft_issues: [{ code, message, severity }],        // weak/generic, off-tone, unsupported claim, too vague
  requires_human_approval: boolean,
  suggested_revision?: string
}
```
- **Deterministic layer (no model, always runs first):** banned-claim match (case-insensitive, word-boundary aware), required-disclaimer presence, restricted-topic detection, forbidden-words. Any hard violation ⇒ `accepted: false` regardless of score. This layer must work with NO AI provider configured at all.
- **LLM-judge layer (via `ai.run`):** scores tone adherence to the agency voice, specificity vs generic filler (the quality bar — an expert operator must not find it shallow), unsupported performance claims, and groundedness in the provided client context. Returns score + soft_issues + an optional concrete `suggested_revision`. On model failure, degrade to the deterministic result (never hard-fail the caller).
- Compose governance deterministically per the pack ordering; compliance/banned rules win.

### 2. Add a `TaskType.ANSWER_QUALITY_CHECK` (or reuse if present) + a prompt builder
`src/ai/prompts/answerQuality.ts` — a strict-JSON grader prompt that takes the candidate text + governance summary + client context and returns the judge fields. Register it in `src/ai/taskRegistry.ts` with a JSON schema. Keep it provider-agnostic.

### 3. Rebuild the edge function `ai-answer-quality-check/index.ts`
- Auth + agency membership (keep existing).
- Load real governance: agency guardrails/quality bar/offer stack/tone from `agency_operating_modules_v2` + `agency_ai_setup_status_v2.meta_json` (foundations/guardrails/workflow), and client constraints from the client brain if `client_id` is passed.
- Call the shared grading core. Persist a grading record (new table `ai_gradings`: agency_id, client_id, content_type, surface, score, accepted, hard_violations jsonb, soft_issues jsonb, created_by, created_at — agency-scoped RLS, anon denied).
- Return the grading result.

### 4. Wire enforcement into client-facing output (governed gate)
- In `supabase/functions/ai-rep-chat/index.ts`: after the LLM reply is generated, run it through the shared grading core (deterministic layer at minimum; LLM-judge optional/flagged for latency). If a **hard violation** is found, do NOT return the raw reply — return a safe, governed fallback (or the suggested revision) and record the grading. Do not break the existing response contract.
- Expose the shared core so `generate-ai-content` and future surfaces can call it. (You may wire `generate-ai-content` too if low-risk; otherwise leave a clear integration point + TODO.)
- Keep latency sane: the deterministic layer is cheap and always-on; the LLM judge can be behind a flag or applied only to client-facing publish actions.

## Acceptance criteria
- `ai-answer-quality-check` performs real grading: a text containing a banned claim returns `accepted: false` with a `hard_violations` entry; a generic/shallow text returns `accepted: true|false` with `soft_issues`; a strong on-brand text scores high.
- Deterministic layer works with NO AI provider configured (prove in a unit test).
- New `ai_gradings` table: agency-scoped RLS, anon denied. New migration applies via `--dry-run` (do NOT push; founder pushes).
- rep-chat blocks hard-violation replies and still returns a valid response shape.
- Unit tests: deterministic banned-claim/disclaimer detection (incl. edge cases: word boundaries, casing), governance composition ordering, and the grader prompt builder. `npx vitest run` green. `npm run build` passes.

## Deliverables
Print `CODEX GRADER SUMMARY` with files changed/created, the new schema, how enforcement is wired into rep-chat, test results, and a founder review checklist (incl. exact local-model commands to validate banned-claim blocking).

Build it now. This is the core of the governed-AI promise — make it real, specific, and enforced.
