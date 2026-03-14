# SMMAHUB AI Setup and Strategy Foundation Rebuild Decision

Last updated: 2026-03-13  
Owner: Product strategy + AI systems  
Status: Decision memo  
Purpose: Decide whether SMMAHUB should keep iterating on the current strategy-generation foundation or rebuild the AI setup and strategy layer from the bottom to support the real AI employee vision.

## 1) Decision

Recommended decision:

1. Rebuild the AI setup and strategy foundation from the bottom.
2. Do not rewrite the whole SaaS.
3. Keep the current system only as a temporary legacy draft engine until the replacement is ready.

This is the hard decision.

It is also the best decision.

## 2) Why This Decision Is Necessary

The product you want is not:

1. a strategy generator
2. a nice onboarding flow
3. a bundle of AI helpers

The product you want is:

1. an agency operating system
2. trained on the agency’s real SOPs, constraints, quality bar, and playbooks
3. able to do the work the way that agency would do it

That goal requires a different foundation than the current one.

The current base is too weak in four ways:

1. agency knowledge is too generic
2. client readiness is too shallow
3. strategy logic is too generation-centric
4. quality enforcement is too structural

## 3) What Should Be Kept

Do not throw away what is already valuable.

Keep:

1. onboarding workspace and staged onboarding direction
2. client detail workspace
3. strategy module storage/editor surfaces
4. enrichment queue and execution-task architecture
5. event history and write-back patterns
6. RAG and memory infrastructure
7. approval/client-portal direction
8. audit discipline and quality-gate mindset

These are real assets.

They are not the problem.

## 4) What Should Be Treated as Legacy

Treat the following as transitional:

1. current default agency brain pack as the main AI setup foundation
2. current strategy generation prompt/process as the main planning engine
3. current client-brain gate as the definition of strategy readiness
4. current six-module-first generation flow as the primary strategic reasoning path

Keep them alive short-term if needed.

But stop treating them as the future architecture.

## 5) What the New Foundation Must Be

### 5.1 AI setup must become agency operating-system setup

The new AI setup should not mostly ask for generic agency profile information.

It should capture the real operating brain:

1. agency positioning and offer architecture
2. ICP definitions and exclusions
3. channel playbooks by service type
4. content ideation and scripting SOPs
5. approval rules
6. escalation rules
7. claims/compliance guardrails
8. quality review criteria
9. reporting definitions
10. client communication norms
11. handoff and delivery SOPs
12. account triage and prioritization rules

This is what makes an AI behave like a team member instead of a generator.

### 5.2 Strategy must become a multi-stage reasoning process

The new system should not jump directly from context into final strategy modules.

It should work in stages:

1. gather and verify inputs
2. diagnose client situation
3. identify strategic constraints and risks
4. propose strategic choices
5. convert approved choices into execution artifacts
6. feed those artifacts into delivery workflows

The current system skips too much reasoning in the middle.

### 5.3 Quality must be judged like agency usefulness, not just schema validity

New quality gates should test:

1. does the strategy fit the client’s actual business model
2. does it fit the agency’s process
3. is it operationally feasible
4. is it commercially sensible
5. would a strategist or account manager actually use it
6. would it reduce owner review burden

## 6) The New Target Architecture

### Layer 1: Agency Operating Brain

Authoritative modules should include:

1. core offer and pricing logic
2. ICP map and disqualifiers
3. niche playbooks
4. channel selection logic
5. content strategy framework
6. creative and scripting SOPs
7. approval and stakeholder handling
8. compliance and claims policy
9. reporting and success-score definitions
10. escalation and exception handling

This should become the real source of truth for all downstream agents.

### Layer 2: Client Operating Brief

This should merge:

1. essential intake
2. operations setup
3. imported signals
4. historical performance
5. stakeholder map
6. timing and launch windows
7. access and asset readiness
8. constraints and risks

This is not the same as the current lightweight client-brain gate.

### Layer 3: Strategic Diagnosis

Before creating a plan, the system should output:

1. business objective summary
2. offer and funnel diagnosis
3. target audience clarity level
4. key assumptions
5. risks and blockers
6. missing critical inputs
7. recommended strategic direction

Only then should it proceed to formal planning.

### Layer 4: Strategy Plan

The plan can still populate product modules, but those modules should become derived outputs from diagnosis and approved decisions.

### Layer 5: Execution Conversion

After strategy, the system should directly create:

1. execution tasks
2. approval tasks
3. asset requests
4. content planning prompts
5. reporting checkpoints
6. drift monitors

That is how strategy becomes operational labor.

## 7) What to Delete, What to Keep, What to Replace

### Delete as a long-term product assumption

1. the assumption that one generic agency brain pack is enough
2. the assumption that a usable strategy can be produced from shallow gate fields
3. the assumption that structural blocker repair equals strategy quality

### Keep temporarily

1. current `ai-strategy-generate` as legacy fallback
2. current strategy UI and persistence model
3. current queue/task/write-back systems

### Replace

1. AI setup information architecture
2. strategy-generation reasoning flow
3. strategy readiness contract
4. quality scoring framework

## 8) Why a Full Bottom-Up Rebuild Is Better Than Endless Iteration

If you keep iterating on the current model only:

1. you will improve outputs a bit
2. you will still inherit weak agency-process grounding
3. you will still fight the wrong abstractions
4. you will spend time polishing a foundation that does not match the end goal

If you rebuild this layer properly:

1. every future agent can reason from the same real agency operating truth
2. strategy, scripting, approvals, reporting, and client comms can all align
3. the product becomes more defensible
4. premium pricing becomes more believable

## 9) Product Recommendation

My recommendation is not to start from zero across the whole repo.

My recommendation is:

1. freeze the current strategy layer as legacy
2. design the new AI setup and strategy contracts first
3. build the new foundation in parallel
4. cut over only when the new path proves better on quality and usefulness

This is the safest and strongest path.

## 10) Proposed Rebuild Program

### Phase 0: Freeze and classify legacy

1. mark current strategy generation as legacy v1
2. stop adding major new intelligence to it
3. allow only maintenance and safety fixes

### Phase 1: Redesign AI setup

1. define agency operating-brain modules
2. define required vs optional modules
3. define module owners and evidence expectations
4. define how modules feed agents

### Phase 2: Redesign client strategic brief

1. define essential client operating brief contract
2. define imported-data contract
3. define strategy-readiness criteria that are stronger than the current brain gate

### Phase 3: Build diagnosis-first strategy flow

1. input audit
2. diagnosis artifact
3. strategy recommendation artifact
4. approved plan artifact
5. execution artifact generation

### Phase 4: Create employee-grade quality system

1. strategist usefulness evals
2. account-manager usefulness evals
3. ops-feasibility evals
4. agency-SOP compliance evals

### Phase 5: Controlled cutover

1. run legacy and new systems in parallel
2. compare quality and operator usefulness
3. cut over only when the new system clearly wins

## 11) Final Recommendation in Plain Language

If you ask me for the best hard decision:

1. Yes, you should rebuild this foundation from the bottom.
2. No, you should not rewrite the entire SaaS.
3. Yes, you should stop treating the current strategy-generation system as the future.
4. Yes, you should redesign AI setup first, because that is the real root of downstream intelligence quality.

The current layer helped prove the product direction.

It should not be the final base layer for the business you want to build.

## 12) Source Notes

### Internal sources

1. [SMMAHUB_STRATEGY_GENERATION_REALITY_AUDIT_2026_03_13.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_STRATEGY_GENERATION_REALITY_AUDIT_2026_03_13.md)
2. [SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md)
3. [SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md)
4. [SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md)
5. [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md)
6. [11_CLIENT_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/11_CLIENT_BRAIN_CURRENT_AND_TARGET.md)

### External sources

1. Hootsuite social media strategy guide: https://blog.hootsuite.com/social-media-marketing-strategy/
2. Sprout Social strategy guide: https://sproutsocial.com/insights/social-media-marketing-strategy/
3. HubSpot progressive fields: https://knowledge.hubspot.com/forms/use-progressive-fields-in-forms
4. Teamwork client onboarding process: https://www.teamwork.com/blog/client-onboarding/
5. Asana creative requests template: https://asana.com/templates/creative-requests
6. Asana creative asset approval template: https://asana.com/templates/creative-asset-feedback-and-approval
