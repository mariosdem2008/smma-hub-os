# SMMAHUB Agency AI Setup V2 Adoption Implementation Order

## Purpose

Convert [SMMAHUB_AGENCY_AI_SETUP_V2_ADOPTION_AND_COMPLETION_DESIGN_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_AI_SETUP_V2_ADOPTION_AND_COMPLETION_DESIGN_PLAN.md) into a strict build order.

This plan is focused on the highest-leverage UX changes that will reduce freeze, reduce weak input, and improve successful setup completion quality.

## Build Order

### Phase 1: Reframe The Entry Flow

Goal:
- stop presenting AI Setup as a broad admin system
- present it as enabling one specialist capability first

Implement:
1. Overview page becomes capability-first
2. highlight one recommended first goal:
   - `Enable Strategy AI first`
3. de-emphasize later agent classes as follow-up paths
4. replace generic completion framing with:
   - what already works
   - what is blocked
   - best next step

Acceptance:
- a first-time agency immediately understands where to start
- the overview no longer implies “complete everything now”

### Phase 2: Import-Review-First UX

Goal:
- reduce blank setup work

Implement:
1. imports page emphasizes draft + review, not raw import only
2. imported sources show:
   - why they matter
   - what they will help draft
   - what still needs review
3. foundations and modules should prefer imported suggestions where possible

Acceptance:
- the UI clearly communicates “review our draft” instead of “fill this from zero”

### Phase 3: Guided Foundations

Goal:
- reduce ambiguity in critical inputs

Implement:
1. add “why this matters” guidance to foundations
2. add “good example” and “weak example” support text
3. rewrite key sections into more operator-like prompts
4. emphasize what Strategy AI needs first

Acceptance:
- agencies can tell what high-quality input looks like without guessing

### Phase 4: Proof Requirements

Goal:
- stop relying on vague declarative setup

Implement:
1. add proof requirements to critical modules:
   - quality bar
   - creative rules
   - client-facing behavior
   - claims/compliance
2. require examples, anti-patterns, and edge cases before higher trust states

Acceptance:
- important setup areas cannot be “complete” from vague text alone

### Phase 5: Capability-Based Progress

Goal:
- progress should reflect agent usefulness, not just section completion

Implement:
1. show per-agent trust state
2. show exact next action by capability
3. shift language from `% complete` to:
   - `ready to preview`
   - `ready for internal assist`
   - `ready for operational use`

Acceptance:
- agencies always know what is usable now and what to do next

## Highest-Leverage First Slice

Start with:
1. Phase 1
2. Phase 2
3. Phase 3

Reason:
- this gives the biggest adoption gain before deeper schema or certification work

## Files To Change First

- [AgencyAiSetupV2Overview.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/pages/agency/AgencyAiSetupV2Overview.tsx)
- [AgencyAiSetupV2Shell.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/components/agency-ai-setup-v2/AgencyAiSetupV2Shell.tsx)
- [AgencyAiSetupV2Imports.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/pages/agency/AgencyAiSetupV2Imports.tsx)
- [AgencyAiSetupV2Foundations.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/pages/agency/AgencyAiSetupV2Foundations.tsx)

## Recommended Next Step After This Slice

After the first UX slice ships:
1. implement proof requirements in core modules
2. convert readiness from score-heavy to evidence-heavy
3. add setup coaching from simulations earlier in the flow
