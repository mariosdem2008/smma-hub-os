# Codex Build Brief: Grade Strategy Output Against the Brain (deterministic enforcement on the wedge)

Close the last governance-enforcement gap. The deterministic grader (`supabase/functions/_shared/answer-grading.ts`) already enforces the agency brain on rep-chat and content generation, but the **strategy output** — the agency's highest-value, most claim-heavy artifact — is not graded. Wire deterministic grading into the strategy generation path so every published strategy's client-facing text is checked against the brain (banned claims, required disclaimers, restricted topics), flagged, and audited. The founder reviews and validates with the local model / E2E harness.

## Absolute rules
- **No paid AI providers / extra model calls.** Use ONLY the **deterministic** layer: `deterministicGradeAgainstGovernance` + `loadGovernanceForGrading` + `persistAiGrading` from `_shared/answer-grading.ts`. Do NOT add an LLM-judge call to the strategy path (latency/cost). The grading must run with no provider configured.
- Do NOT change strategy generation logic, the V2 pipeline, or the bridge. This is an additive enforcement/audit pass on the already-generated output.
- **Do NOT block strategy generation.** Strategy modules are human-reviewed before reaching clients, so grading here FLAGS and AUDITS — it must not throw or drop modules. Hard violations are recorded and surfaced for the reviewer, not silently removed.
- Agency-scoped. `npm run build` + `npx vitest run` green. Match existing style.

## What to build (in `supabase/functions/ai-strategy-generate/index.ts`)
After the strategy output is built/persisted (the deterministic V2 publisher or LLM path — find where `output.modules` / the published modules are finalized, near `finalizePublishedStrategySideEffects`), add a governance grading pass:
1. Load governance once via `loadGovernanceForGrading({ supabase, agencyId, clientId, clientBrainJson: effectiveBrain })`.
2. Extract the client-facing text from the strategy modules — at minimum: `positioning.finalSentence` + proof/differentiator claims, `pillars` core messages, `campaign_plan` names/CTAs/angles, `channel_adaptations` translation table + dos, `rules_constraints` claims, and the composed `document.markdown`. Concatenate per logical surface (or grade the document markdown as one client-facing surface plus the messaging fields).
3. Run `deterministicGradeAgainstGovernance({ text, governance, contentType: "strategy" })`.
4. Persist one `ai_gradings` row (surface `ai-strategy-generate`) with the result.
5. If there are hard violations, attach a non-blocking flag to the response metadata and (if a natural field exists) to the strategy/module record so the reviewer sees "N governance flags to review" — do NOT remove modules or fail the request. Wrap the whole pass in try/catch so a grading failure never breaks strategy generation.

## Acceptance criteria
- A strategy whose generated messaging contains a brain-banned claim produces an `ai_gradings` row with `accepted=false` + a `hard_violations` entry and a non-blocking flag in the response — generation still succeeds and returns the strategy.
- Grading runs deterministically with NO AI provider configured (no extra model call added).
- No change to generation/bridge behavior; existing strategy tests still pass. `npm run build` + `npx vitest run` green.
- Add a unit test for the strategy-text extraction + deterministic grading (pure: modules with a banned claim → hard violation; clean modules → accepted).

## Deliverables
Print `CODEX STRATEGY-GRADING SUMMARY` with the exact insertion point, what client-facing text you extract, how flags surface (non-blocking), test results, and a founder review checklist (incl. how to verify with a banned-claim brain via the local harness).

Build it now. Deterministic, additive, non-blocking — enforce the brain on the wedge.
