# SMMAHUB Agency AI Setup V2 Production Readiness Gap Plan

## Purpose

Define the exact gaps still blocking `Agency AI Setup V2` from production-grade readiness, then turn those gaps into a strict execution order with acceptance criteria.

This document is not a product vision doc. It is a readiness-gap doc for deciding what must be true before `Agency AI Setup V2` can be trusted as the control plane for a premium AI employee product.

Related system docs:
- [SMMAHUB_AGENCY_AI_SETUP_V2_UX_AND_READINESS_BLUEPRINT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_AI_SETUP_V2_UX_AND_READINESS_BLUEPRINT.md)
- [SMMAHUB_AGENCY_AI_SETUP_V2_IMPLEMENTATION_PROGRAM.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_AI_SETUP_V2_IMPLEMENTATION_PROGRAM.md)
- [SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md)
- [SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md)

## Current State

`Agency AI Setup V2` is beyond prototype.

It already includes:
- setup workspace and sectioned UX
- imports, foundations, modules, guardrails, workflow, readiness, activation, control center
- readiness scoring
- unlock logic
- activation modes
- simulation runs
- certifications
- runtime gating across major AI surfaces

It is not yet production-grade.

The main problem is no longer missing setup UI. The main problem is that the setup/control plane is not yet rigorous enough to support launch-grade trust, auditing, invalidation, and premium operating claims.

## Production-Grade Standard

`Agency AI Setup V2` is production-grade only when all of the following are true:

1. Agent readiness is determined by strict evidence requirements, not only heuristic score bands.
2. Certifications are durable, scoped, version-aware, and automatically invalidated when critical setup changes.
3. Simulation packs reflect real agency failure modes, not only generic scenario checks.
4. Operational rollout policy is explicit, enforceable, and reversible by agent class and surface.
5. Setup changes, certification changes, and block reasons are auditable by operators without reading raw DB state.
6. Agency owners can see a single launch-control view that clearly answers `what is ready`, `what is risky`, and `what is blocking launch`.

## Strict Gap List

### Gap 1: Readiness scoring is too heuristic

Current issue:
- readiness exists, but it is still mainly based on app-defined score logic and metadata completeness
- agent classes do not yet have hard mandatory evidence requirements

Why this blocks production:
- a premium AI employee product cannot rely on “high enough score” alone
- readiness must map to explicit requirements per agent class

Must be added:
- mandatory evidence matrix per agent class
- hard-fail requirements that cannot be overridden by score inflation
- separate readiness dimensions:
  - knowledge readiness
  - process readiness
  - governance readiness
  - execution readiness
  - certification readiness

Acceptance criteria:
- every agent class has explicit required evidence
- readiness UI shows exact missing evidence
- unlocks depend on evidence requirements first, score second

### Gap 2: Simulations are not launch-grade

Current issue:
- simulations exist and store structured output
- scenario packs are still not strict enough for real agency-grade failure modes

Why this blocks production:
- weak simulations create false confidence
- agencies will pay premium only if the system behaves reliably in edge conditions

Must be added:
- scenario library by agent class
- scenario difficulty tiers
- edge-case packs:
  - weak or contradictory agency instructions
  - regulated/compliance-sensitive messaging
  - missing approval owners
  - bad or incomplete client brief
  - creator brief ambiguity
  - operator overload and task conflict
  - client-facing tone and escalation failures
- scenario result grading:
  - pass
  - pass with warnings
  - fail
  - fail and invalidate certification eligibility

Acceptance criteria:
- each operational agent class has at least 3 serious scenarios
- certification cannot be promoted from shallow scenarios only
- failed simulations produce explicit remediation guidance

### Gap 3: Certifications are not yet a full policy system

Current issue:
- certifications exist and can gate `operational`
- they do not yet carry strong lifecycle rules

Why this blocks production:
- certifications become meaningless if they do not expire, invalidate, or bind to exact setup state

Must be added:
- certification scope:
  - agent class
  - scenario
  - certified mode
  - certified surfaces
- certification version binding:
  - readiness snapshot id
  - module state version
  - guardrail version
  - workflow policy version
- certification expiry and renewal window
- automatic stale state when critical setup changes
- certification revocation reasons

Acceptance criteria:
- every certification is tied to an exact configuration state
- critical setup changes can invalidate dependent certifications automatically
- certification history is visible and queryable

### Gap 4: Critical setup policies are too `meta_json` heavy

Current issue:
- the V2 setup system moves fast because many policy details are stored in flexible JSON
- this is acceptable for build speed, but weak for long-term auditing and enforcement

Why this blocks production:
- critical policy layers should not depend only on loosely structured metadata

Must be hardened first:
- activation policies
- guardrail policies
- approval workflow rules
- certification records
- simulation result summaries used in gating

Acceptance criteria:
- the most important policy layers are queryable without deep JSON parsing
- changes to those layers can trigger deterministic invalidation logic

### Gap 5: No deterministic change-management / invalidation model

Current issue:
- the system can block and certify, but it still lacks a strong model for what happens after setup changes

Why this blocks production:
- an agency changing core instructions should change trust state automatically
- otherwise the system can remain “green” after meaningful drift

Must be added:
- dependency map between:
  - foundations
  - operating modules
  - guardrails
  - workflow policies
  - readiness scores
  - unlocks
  - certifications
- invalidation rules:
  - soft stale
  - hard stale
  - certification revoked
  - operational mode downgraded

Acceptance criteria:
- critical edits produce deterministic impact
- operator can see exactly what changed and what was downgraded

### Gap 6: Operational observability is not strong enough

Current issue:
- block reasons exist, but not yet as a first-class operator view across the full setup system

Why this blocks production:
- agencies need to understand system trust and failure reasons without inspecting raw records

Must be added:
- readiness diff view
- certification dependency view
- activation policy view
- recent invalidations view
- blocked-surface inventory
- last successful certification runs by agent class

Acceptance criteria:
- an owner or ops lead can answer:
  - why is this agent blocked?
  - what changed?
  - what must be fixed?
  - what was last certified?

### Gap 7: Rollout policy is still too simple

Current issue:
- current modes are useful:
  - `preview_only`
  - `internal_assist_only`
  - `operational`
- but launch-grade rollout needs more policy precision

Why this blocks production:
- not every agent class should activate the same way across the same surfaces

Must be added:
- optional per-surface activation rules
- optional per-client exceptions
- emergency disable behavior
- downgrade behavior on invalidation
- mode escalation rules tied to certification state

Acceptance criteria:
- rollout policy can express more than a single global mode
- emergency disable is operator-visible and immediate

### Gap 8: No launch-control dashboard

Current issue:
- setup sections and control center exist, but there is no decisive launch-control view

Why this blocks production:
- agencies and internal teams need one clear page to decide whether AI is safe to use live

Must be added:
- launch-control summary
- blockers by severity
- certified agent classes
- stale certifications
- pending renewals
- blocked surfaces
- last high-risk setup changes
- recommended next action

Acceptance criteria:
- one page can support `go / no-go / limited rollout` decisions

### Gap 9: Human approval ownership is still too light

Current issue:
- setup can be changed and reviewed, but approval ownership is not rigorous enough yet

Why this blocks production:
- a premium AI employee product needs traceable human accountability

Must be added:
- explicit approval owners for:
  - modules
  - guardrails
  - workflow rules
  - certifications
- approval timestamps
- review notes
- reviewer identity

Acceptance criteria:
- important setup state changes have attributable approvers
- certification and policy decisions have clear ownership

### Gap 10: No pricing-tier readiness gate

Current issue:
- setup may become “usable” long before it is ready for a premium commercial promise

Why this blocks production:
- the business needs explicit standards for:
  - paid pilots
  - lower-tier production usage
  - premium production usage

Must be defined:
- minimum gate for paid pilots
- minimum gate for `$300`
- minimum gate for `$500`
- minimum gate for `$999`

Acceptance criteria:
- tier readiness is defined and enforced through documented go/no-go rules

## Strict Implementation Order

### Phase A: Trust Model Hardening

Build first:
1. evidence-based readiness requirements per agent class
2. certification scope/version binding
3. invalidation rules for critical setup changes

Reason:
- this is the minimum trust backbone

### Phase B: Simulation Hardening

Build next:
1. real scenario library
2. severity/difficulty tiers
3. fail-state remediation outputs
4. certification eligibility rules from scenario results

Reason:
- without hard simulations, readiness and certification remain weak signals

### Phase C: Policy Hardening

Build next:
1. stronger rollout policy model
2. emergency disable / downgrade rules
3. first-class persistence for the most critical policy layers

Reason:
- this moves setup from “configuration system” to “operational control plane”

### Phase D: Observability and Launch Control

Build next:
1. launch-control dashboard
2. invalidation timeline
3. certification and block reason inventory
4. operator remediation guidance

Reason:
- a launch-grade control plane must be understandable by humans

### Phase E: Commercial Gate Definition

Build next:
1. pilot readiness standard
2. premium-tier readiness standard
3. explicit go/no-go checklist

Reason:
- the product needs business-grade launch discipline, not only technical completion

## Required Acceptance Gate Before Calling This Production-Grade

Do not call `Agency AI Setup V2` production-grade until all are true:

1. Every operational agent class has mandatory evidence requirements.
2. Every operational agent class has serious simulation scenarios and passing certifications.
3. Critical setup changes automatically invalidate or downgrade affected certifications and modes.
4. Operational mode is impossible without the required certification scope.
5. A launch-control dashboard clearly shows blockers, certification state, and recent invalidations.
6. Human approval ownership exists for critical setup and certification decisions.
7. Pricing-tier readiness standards are documented and used.

## Out of Scope

This plan does not directly cover:
- V2 strategy quality hardening
- creator-output evaluation
- drift reconciliation beyond setup-state invalidation
- cross-client commercial packaging

Those are separate next-layer plans once `Agency AI Setup V2` is a trustworthy control plane.

## Recommended Immediate Next Task

Start with `Phase A`.

The first exact implementation package should be:
1. agent-class evidence requirement matrix
2. certification scope/version schema changes
3. setup-change invalidation engine

That is the highest-leverage path to turning the current setup system into something production-grade instead of merely impressive.
