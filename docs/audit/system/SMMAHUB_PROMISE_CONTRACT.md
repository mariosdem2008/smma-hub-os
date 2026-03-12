# SMMAHUB Promise Contract (Phase 1)

Last updated: 2026-03-09
Owner: Product + AI Systems
Scope: Define measurable product promises and observable behaviors for agency and client onboarding quality.

## Purpose
This contract defines what SMMAHUB promises agencies, what must be true in-product for that promise to be valid, and what evidence is required before claiming launch-grade quality.

## Promise Statements
1. SMMAHUB behaves like an AI operating partner for agencies, not just a form-filler.
2. SMMAHUB understands each agency and each client with persistent, actionable context.
3. Onboarding is frictionless, consultative, and produces strategy-ready data.
4. Recommendations are grounded, realistic, and operationally safe.
5. Reliability is high enough for daily agency operations.

## Observable Behaviors (Must-Have)

### A) Agency-value behaviors
1. AI explains why each question matters in business terms when user asks.
2. AI can draft concrete answers based on known context without generic filler.
3. AI surfaces targeted follow-up questions when data is ambiguous.
4. AI stores and reuses prior agency context in later turns.
5. AI avoids contradictory recommendations against known constraints.

### B) Client-value behaviors
1. Client onboarding captures business identity, offer economics, ICP, conversion path, channels, cadence, and brand constraints.
2. AI can convert vague user input into actionable draft options.
3. AI suggestions are contextual to current client profile, not static templates.
4. AI asks clarification only when required confidence is not met.
5. Collected data is sufficient for professional strategy generation.

### C) Reliability and trust behaviors
1. Critical journeys pass E2E with deterministic outcomes.
2. User-facing errors are human-safe and non-technical.
3. No cross-tenant data leakage in retrieval or AI responses.
4. Latency remains within onboarding SLO target.
5. Low-confidence write-guards are always enforced.

## Acceptance Metrics

### Product quality metrics
1. Onboarding completion (required fields): >= 95%
2. Clarification helpfulness (internal review): >= 90%
3. Strategy readiness after onboarding (no manual patching): >= 90%
4. Suggestion relevance score (golden set): >= 85%
5. Question-intent handling pass rate (golden set): >= 90%

### Reliability metrics
1. E2E critical flow pass rate: 100%
2. Console errors in deep runs: 0
3. Request failures in deep runs: 0
4. Onboarding turn latency p95: <= 2500ms

## Evidence Requirements Before "Launch Ready" Claim
1. Latest E2E summaries + screenshots for agency and client onboarding.
2. Golden-set scoring report meeting thresholds.
3. Security/tenant boundary check evidence.
4. Risk register with no open P0/P1 in onboarding and AI core flows.

## Failure Policy
If any metric is below threshold:
1. Mark status as Yellow/Red (not Green).
2. Add root-cause + fix owner + date in audit docs.
3. Re-run same evidence pack after fix before status upgrade.
