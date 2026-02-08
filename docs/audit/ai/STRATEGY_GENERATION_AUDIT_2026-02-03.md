# Strategy Generation Audit (SMMAHUB) — 2026-02-03

This audit evaluates a single generated strategy snapshot created on **2026-02-03 14:03:13+00** for:
- **Agency** `115dc619-1867-4275-83ec-4d5a0d47f94b`
- **Client** `89eecacc-1805-4b09-8cf0-6fd8ae089276`
- **Strategy** `195fd38a-d8e0-48ef-ab0b-5cb47b72c6c8` (version_int=1)
- **Strategy document** `a8d8b9bf-19b7-42ec-8b18-c2f109518138` (source=`ai`, model=`gemini-flash-latest`)

## 0) Evidence & Limitations

**Evidence used for this audit**
- The provided row snapshots for:
  - `strategies`
  - `strategy_documents`
  - `strategy_modules`
  - `strategy_tasks`
  - `client_onboarding_profiles`
- The repository’s strategy generation implementation:
  - `supabase/functions/ai-strategy-generate/index.ts`
  - `src/ai/prompts/strategyPlan.ts`
  - `supabase/functions/_shared/strategy-output.ts`
  - `src/lib/strategy/rulesEngine.ts`
  - `supabase/migrations/*strategy*`

**Limitations**
- No direct DB access was used; only the records you pasted were inspected.
- The RAG match list, chunk texts, and `ai_runs` metadata for this run were not provided, so provenance of *non-onboarding* claims cannot be fully verified.
- Only **one** generated strategy/version was reviewed; this is a spot-audit, not a longitudinal quality report.

## 1) What the System Persisted (Table-by-table)

### 1.1 `strategies`
Observed:
- A single active strategy row created (versioned container).
- This establishes the “Strategy OS” versioning boundary (strategy_id) for modules + documents + tasks.

Quality note:
- Good: versioning is in place and will support iterative refinement without overwriting history.

### 1.2 `strategy_documents`
Observed:
- One active `ai` document with both `content_markdown` and `content_html`.
- `derived_from_hash` exists (`2f6235...c89`), indicating deterministic “inputs fingerprinting”.

Quality note:
- Good: document is readable and includes a `## References` section that lists brain documents.
- Gap: no *claim-level* grounding/citations in markdown (only a module-level “References” list).

### 1.3 `strategy_modules` (6 modules)
Observed:
- All 6 modules were written with `ai_generated=true`, `version=1`, and `ai_confidence` populated.
- Status distribution:
  - `review`: `pillars`, `campaign_plan`, `weekly_plan`, `channel_adaptations`
  - `draft`: `positioning`, `rules_constraints`
- Blockers are present (from `src/lib/strategy/rulesEngine.ts`) and persisted into `blockers`:
  - `positioning`: missing proof points + differentiators
  - `rules_constraints`: missing proof links + banned terms

Quality note:
- Good: the rules engine correctly flags missing completeness elements and prevents “false confidence”.
- Gap: the system currently *stops after first-pass generation* rather than running an automatic “repair pass” to clear blockers.

### 1.4 `strategy_tasks`
Observed:
- Tasks exist and are aligned to “missing inputs / verification work”:
  - `Confirm Legal Disclaimers` (rules)
  - `Source Proof Assets (P3)` (pillars)

Quality note:
- Good: tasks convert uncertainty into executable next steps (agentic behavior).
- Gap: tasks cover only a subset of missing items (e.g., positioning differentiators/proof points, KPI baselines).

### 1.5 `client_onboarding_profiles`
Observed (high-signal fields):
- Business: `Horizon Creative Studio`
- Niche: `gym_fitness_studio`
- Market: `local`, City: `Lakatays`, Country: `Greecee` (typo), Languages: `greek`, `english`
- Offers: `Starter Package (25–100)`, plus `Premium Transformation (65–225)`
- Goal: `more_foot_traffic`; conversion_path: `visit_store`
- Channels: `instagram`, `tiktok`
- Cadence: 5/week each
- Voice: `friendly`, `educational`
- Content style: `educational_tips`, `before_after`
- Proof types: `reviews`, `before_after`
- Pain points: “Don’t stand out locally”, “Not enough customers/leads”, “Bad reviews / not enough reviews”

Quality note:
- Onboarding is “complete” (readiness_score=100), but it is still missing critical differentiators/competitors/ICP details. The system correctly asks open questions later, but it should also downgrade certainty and avoid invented specifics.

## 2) Is the Strategy Based on Gathered Data?

### 2.1 Strong alignment (grounded)
The strategy is clearly using onboarding fields for:
- Brand name, local market, and location (though with the `Greecee` typo).
- Channels and cadence (IG/TikTok 5x/week).
- Primary goal (foot traffic) and conversion path (`visit_store`).
- Offers/pricing range (Starter Package $25–$100; mentions Premium Transformation as secondary).
- Voice and content style (friendly + educational; before/after; education tips).
- Pain points (review concerns appear in the “Proof” pillar reasoning).

### 2.2 Weak alignment / generic fill
Areas that look generic or under-grounded:
- “KPI Targets: 50 Foot Traffic visits; 20 Starter Package Sign-ups” appear as concrete numbers without a baseline source.
- Some channel rules are generic (“keep under 15 seconds”, “trending audio”) and not tailored to the brand’s actual creative constraints/assets.
- “Guaranteed accountability” phrasing is risky in a fitness context (and conflicts with the “no absolute guarantees” spirit, even if it’s not a numeric guarantee).

### 2.3 Data-quality propagation issues
The output repeats onboarding typos / placeholders:
- Country stored as `Greecee` leaks into strategy language (“Lakatays/Greecee”).
- Website `example.com` is likely a placeholder and should be flagged as “unverified / placeholder” in downstream content.

## 3) Strategy Content Quality (Professional Review)

### 3.1 Readability & structure (good)
- The strategy document is coherent, well-formatted, and matches the “Strategy OS” module layout:
  1) Positioning
  2) Pillars
  3) Monthly campaign
  4) Weekly execution plan
  5) Channel adaptations
  6) Rules/constraints

### 3.2 Precision & credibility (mixed)
High quality:
- Correct ISO week usage: `2026-W06` is used consistently.
- Dates are realistic and formatted correctly.
- Constraints section is sensible for a fitness business (disclaimers, proof-required claims, approval triggers).

Quality risks:
- Numerical KPI targets are asserted without evidence.
- Several claims are not clearly tied to a specific source (e.g., “local standing and review concerns” is plausible, but should be explicitly attributed to onboarding pain points).
- Positioning module is incomplete (no proof points, no differentiators), but the document reads as if it’s finalized.

### 3.3 “Quality bar” compliance (as implemented)
Based on stored module blockers:
- The system’s internal evaluator is correctly identifying that **Positioning** and **Rules** are below “review-ready”.
- However, the overall document is still generated and saved as an active strategy document, which can create a mismatch between:
  - the Strategy OS “module readiness”
  - what the user sees as a “final strategy”

## 4) Key Findings (What Matters Most)

1) **Grounding is strong for core facts** (goal, offers, channels, cadence, voice) because onboarding provides them clearly.
2) **The system still produces “confident-looking” specifics** (KPI numbers, “guaranteed accountability”, “store” language) that are either:
   - not sourced, or
   - semantically mismatched (fitness studio ≠ store).
3) **Quality controls exist** (schema + rulesEngine blockers) but are not yet used to drive an automatic improvement loop.
4) **Input data normalization is missing** (typos like `Greecee`, placeholders like `example.com`) and the strategy inherits them.

## 5) “Ultimate” Quality + Performance Improvement Plan (Compatible with Next‑Gen Agentic Infrastructure)

This plan is designed to be compatible with `docs/report/Next-Generation_Agentic_Infrastructure.md` by emphasizing: durable execution, schema validity, RAG precision, observability, and a multi-step agentic workflow.

### Phase 0 (1–2 days): Safety + credibility quick wins
- **Normalize onboarding fields before prompting** (country/city spelling, placeholder detection for website/links).
- **Lexical constraints**: ban “guaranteed/guarantee” variants in fitness positioning unless explicitly allowed.
- **KPI target policy**: if baseline is missing, force KPI targets to either:
  - “TBD” + create a task to fetch baseline, or
  - be placed under “assumptions” with a confidence penalty.

### Phase 1 (2–5 days): Close the “blocker loop” automatically
- Add a **post-generation repair step**:
  1) run generation
  2) run `evaluateStrategyModule` for each module
  3) for modules with blockers, run a targeted “repair prompt” that only fills missing fields (e.g., generate 3 proof points + 2 differentiators, add banned terms list, add proof links placeholders)
  4) re-evaluate; stop when blockers cleared or max-iterations reached
- Persist each iteration as a module version increment (keeps auditability).

### Phase 2 (1–2 weeks): Better RAG + provenance
- Build the retrieval query embedding from **client brain + onboarding**, not the constant `"strategy_draft"`.
  - This should increase relevance and reduce generic filler.
- Add “provenance surfaces”:
  - Store `selectedMatches` doc IDs/chunk IDs in strategy snapshot metadata (or a companion table).
  - Optionally add inline citations in markdown for high-risk claims (pricing, results, comparisons).

### Phase 3 (2–4 weeks): Agentic “Ask → Retrieve → Decide → Generate → Verify” workflow
Implement a durable multi-step strategy workflow aligned with the Next‑Gen document:
- Step A: Validate readiness (what you do today with gates) + compute “missing critical inputs”.
- Step B: Retrieve context (RAG) with strict scoping + provenance.
- Step C: Draft strategy (schema-validated).
- Step D: Verify/critic pass (separate model call) that checks:
  - unsourced numbers
  - forbidden language
  - mismatch between module readiness and document tone
  - internal consistency across modules
- Step E: Persist snapshot + tasks + “verification findings”.

### Phase 4 (ongoing): Quality KPIs and dashboards
- Track, per strategy generation:
  - blocker counts by module
  - percentage of strategies with unsourced KPI numbers
  - citation coverage for claims (where applicable)
  - user edits after generation (delta as a quality signal)

## 6) Concrete Recommendations for This Specific Client (Horizon Creative Studio)

Immediate fixes to raise quality:
- Replace “store” phrasing with “studio/location” while keeping `visit_store` as an internal conversion_path code.
- Remove “guaranteed accountability” and replace with a non-absolute claim (e.g., “structured accountability”).
- Move KPI targets to “assumptions” and add a task: “Collect baseline foot traffic + conversion rate”.
- Positioning: create 3 proof points based on available proof types (reviews, before/after) and add 2 differentiators (even if provisional, clearly marked as assumptions).
- Rules: add banned terms relevant to fitness claims + add proof link placeholders for proof-required claims (then task to collect the links).

## 7) Implementation Status (Applied)

The following improvements have been implemented in-repo to operationalize the plan above:
- Prompt constraints tightened (avoid “store” for service businesses; avoid “guaranteed”; KPI target provenance rule): `src/ai/prompts/strategyPlan.ts:1`
- Onboarding “sanitization + warnings” injected into prompt context (reduces typo/placeholder propagation): `supabase/functions/ai-strategy-generate/index.ts:1`
- Automatic blocker repair loop (up to 2 passes) using the existing schema + module evaluations: `supabase/functions/ai-strategy-generate/index.ts:1`
- Blocker-derived tasks are generated and persisted (turns evaluator blockers into actionable work): `supabase/functions/ai-strategy-generate/index.ts:1`
