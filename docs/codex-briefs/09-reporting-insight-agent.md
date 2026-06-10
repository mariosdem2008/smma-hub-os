# Codex Build Brief: Reporting-Insight Agent (governed, grounded, client-ready)

Upgrade `supabase/functions/generate-monthly-report/index.ts` from a shallow generic-AI summary into a **governed, grounded reporting-insight agent**. Reports are a core client-facing Tier-2 deliverable — they must read like an expert account manager wrote them, be anchored in the client's actual strategy and delivery state, and pass governance before reaching the client. The technical founder reviews and tests with a local model.

## Current state (verified)
The function pulls real metrics (`social_profile_stats`, `social_post_metrics`) and computes KPIs, then calls `ai.run(TaskType.SUMMARIZE)` with a generic "social media analytics expert" prompt and **splits the string on "recommendations:"**. It is NOT grounded in the agency brain, the client's strategy, or the blocker/delivery state, the output is unstructured/fragile, and the client-facing narrative is never graded.

## Absolute rules
- **No paid AI providers / production keys.** All AI via `ai.run` (router) so it runs on local Ollama (`qwen2.5:7b-instruct`). Must degrade gracefully (deterministic/template insight) if no provider is configured — never hard-fail report generation.
- Agency-scoped isolation preserved. Match existing code style. `npm run build` + `npx vitest run` green. Keep the existing report response shape/columns so `ReportDetail`/`ReportsTab` still render; ENRICH, don't break.
- Reuse, don't duplicate: governance loading + grading from `supabase/functions/_shared/answer-grading.ts`; blocker/delivery state from `supabase/functions/_shared/blocker-detection.ts` (or its scan/snapshot); strategy context from the client's strategy modules/brief.

## What to build

### 1. Ground the insight generation
Before generating, assemble context from:
- **Agency brain governance** (`loadGovernanceForGrading` / `summarizeGovernanceForJudge`): tone rules, quality bar, banned claims — so the report sounds on-brand and avoids forbidden claims.
- **Client strategy direction**: positioning, pillars, primary goal/funnel from the latest approved strategy modules / client brief (read existing tables; don't invent).
- **Delivery + blocker state**: the latest `client_blockers` snapshot (or run the detector) so the report can honestly speak to what's on track vs blocked and what the agency is doing about it.
- **The metrics/KPIs** already computed.

### 2. Structured, grounded output (replace string-splitting)
Add `TaskType.REPORT_INSIGHT` (or reuse an existing structured task) + a prompt builder `src/ai/prompts/reportInsight.ts` returning strict JSON:
```
{
  headline: string,                 // one-line performance story, on-brand
  performance_summary: string,      // grounded in the actual KPIs
  insights: [{ point: string, evidence: string }],   // each tied to a real metric
  recommendations: [{ action: string, why: string, owner: "agency"|"client" }],  // tied to strategy/blockers
  risks_or_blockers: string[]
}
```
Register in `taskRegistry.ts` with a schema. Rules in the prompt: anchor every insight to a real number from the KPIs; tie recommendations to the strategy pillars/goal and the current blockers; respect agency tone; never fabricate metrics; no banned claims.

### 3. Govern the client-facing narrative
Run the generated narrative (headline + performance_summary + insights/recommendations text) through `gradeAgainstGovernance` (deterministic layer at minimum). If a hard violation is found (banned claim, missing required disclaimer), strip/neutralize the offending text or fall back to the deterministic template, and persist an `ai_gradings` row (surface `generate-monthly-report`). The report that reaches the client must be governance-clean.

### 4. Persist enriched, keep compatibility
Store the structured insight (in the existing report row's JSON/insights/recommendations columns — inspect the schema; reuse columns, add a `report_insight_json` only if needed via a new migration AFTER 20260610131500 with agency-scoped RLS). The existing UI must still render; richer detail is a bonus.

## Acceptance criteria
- Insights are grounded: every insight references a real KPI; recommendations reference the strategy and/or current blockers; tone matches the agency brain.
- Output is structured JSON (no fragile string-splitting). Degrades to a deterministic template with no provider configured (prove in a unit test).
- The client-facing narrative is graded; a banned-claim insight is neutralized/blocked and a grading row persisted.
- `npm run build` + `npx vitest run` green; new migration (if any) applies via `--dry-run` (do NOT push; founder pushes).

## Deliverables
Print `CODEX REPORT SUMMARY` with files changed, the new task/schema, how grounding + grading are wired, test results, and a founder review checklist (incl. a local-model command to generate a sample insight and confirm grounding + governance).

Build it now. Grounded, governed, structured — no paid keys.
