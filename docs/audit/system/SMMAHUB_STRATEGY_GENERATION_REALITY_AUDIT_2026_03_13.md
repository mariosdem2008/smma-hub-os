# SMMAHUB Strategy Generation Reality Audit

Last updated: 2026-03-13  
Owner: Product strategy + AI systems  
Status: Decision-grade audit  
Purpose: Audit the current strategy-generation agent, identify what it actually uses, what it actually produces, how strong the output quality gate really is, and whether this system reflects how real SMMAs build useful client strategy.

## 1) Executive Verdict

The current strategy-generation system is not strong enough to serve as the foundation for the AI employee vision.

That does not mean it is useless.

It does mean:

1. It is better understood as a structured strategy draft generator than a real agency strategist.
2. It is not yet grounded enough in agency SOPs, operating rules, commercial constraints, and channel-specific process to behave like a trusted employee.
3. The current quality system checks structural completeness much more than strategic usefulness.
4. The current AI setup foundation is too generic and too fragmented to support the end goal you want.

Blunt conclusion:

If the goal is a `$300-$999/month` AI employee for SMMAs, the current strategy-generation foundation should not be the long-term base layer.

## 2) What the Current Strategy Generator Actually Does

Current entry point:

- [index.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/ai-strategy-generate/index.ts)

Core sequence today:

1. Validate client and agency access.
2. Load latest `client_brains` row.
3. Run a minimal strategy gate using `evaluateClientBrainForStrategy(...)`.
4. If the client brain is not usable, attempt a fallback hydration from onboarding answers.
5. Check whether the agency has at least one approved `brain_document` ingested into `ai_documents`.
6. Retrieve context by vector search across client docs, agency docs, and exemplar docs.
7. Assemble one large prompt context:
   - sanitized onboarding profile JSON
   - latest structured strategy module JSON
   - retrieved RAG chunks
   - brain-document references
8. Call `ai.run(...)` with task type `STRATEGY_PLAN`.
9. Validate against the `strategy-output` schema.
10. Run up to two repair passes if the local rules engine finds blockers.
11. Persist modules + markdown document + optional decisions/tasks via `create_strategy_snapshot`.
12. Recompute module blockers/status.
13. Refresh enrichment queue and execution tasks.

This is a coherent pipeline.

It is not yet an agency-grade strategy system.

## 3) What Inputs It Actually Uses

### 3.1 Client brain gate is shallow

Current gate:

- [brain-quality.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/brain-quality.ts)

Required fields today are effectively:

1. brand name
2. products/services
3. audience problems
4. pillars
5. goals
6. one constraint group for banned claims or taboo topics

This is enough to block obviously empty strategy generation.

It is not enough to certify that the system has the inputs a real SMMA strategist would rely on.

Missing from the hard gate:

1. offer economics
2. sales process
3. conversion mechanism quality
4. budget/media constraints
5. approval and stakeholder map
6. historical performance
7. proof quality and evidence constraints
8. resource constraints
9. launch timing
10. channel-specific realities

### 3.2 Onboarding fallback can create false readiness

Fallback mapper:

- [client-brain-mapping.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/client-brain-mapping.ts)

Important behavior:

1. Pillars can be inferred from offers and differentiators.
2. Audience problems and demographics are often derived from the same generic audience list.
3. Constraints can default to `"No specific content restrictions"`.
4. Several fields are populated from sparse V3-style responses rather than deep operator context.

Implication:

The system can sometimes make the brain look usable before the client context is truly strategy-ready.

That is useful for draft generation.

It is dangerous if you want employee-grade trust.

### 3.3 Agency brain usage is weaker than intended

Current strategic foundation docs:

- [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md)
- [defaultBrainPackV1.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/defaultBrainPackV1.ts)

Current default agency brain pack has only:

1. `bootstrap`
2. `rep_policy`
3. `quality_bar`

These are generic and useful, but not enough for your end goal.

They do not encode real agency delivery intelligence such as:

1. offer positioning playbooks
2. channel playbooks
3. ICP segmentation rules
4. content ideation SOPs
5. hooks/angles framework by niche
6. approval and escalation matrix
7. reporting definitions
8. account strategy review SOPs
9. retention playbooks
10. QA by workstream

### 3.4 Major architecture issue: the strategy task does not require brains

Current task registry:

- [taskRegistry.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/taskRegistry.ts)

`TaskType.STRATEGY_PLAN` is configured with:

1. `requires: { agency: false, client: false }`

Its prompt builder expects:

1. `agencyBrain`
2. `clientBrain`
3. `context`

from:

- [strategyPlan.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/prompts/strategyPlan.ts)

But because the router does not require those brains for this task, the router does not automatically resolve them.

That means the strategy prompt is not operating from a guaranteed, first-class agency brain context.

This is one of the most important findings in this audit.

Even if RAG provides some agency material, that is not the same as a guaranteed, structured operating brain being injected into strategy reasoning.

### 3.5 Retrieval is broad, not sharply purposeful

The generator retrieves from:

1. client memory-like doc types
2. agency doc types
3. exemplar doc types

It also uses a fixed query embedding seed:

1. `"strategy_draft"`

from:

- [index.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/ai-strategy-generate/index.ts)

Implication:

This is retrieval for general strategy drafting, not retrieval targeted to:

1. the client’s actual offer
2. the current account objective
3. the channel mix
4. the agency’s playbook for that client type
5. the specific strategy job being performed

This lowers precision.

## 4) What the Current Generator Returns

Output schema:

- [strategy-output.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/strategy-output.ts)

It returns:

1. six modules:
   - positioning
   - pillars
   - campaign plan
   - weekly plan
   - channel adaptations
   - rules constraints
2. a markdown strategy document
3. optional decisions
4. optional tasks
5. per-module evidence fields:
   - `facts_used`
   - `assumptions`
   - `open_questions`
   - `confidence_0_100`

This is well-structured.

It is also very product-shaped.

The output is designed to fill SMMAHUB’s current strategy UI and module model, not to mirror how elite agencies necessarily think or operate.

## 5) What Quality Checks Exist Today

Current quality repair and scoring relies heavily on:

- [rulesEngine.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/lib/strategy/rulesEngine.ts)

What it checks well:

1. required fields exist
2. counts and ranges are valid
3. dates and selected periods are present
4. some minimum examples/assets exist
5. some proof links or banned-term rules exist

What it does not really check:

1. whether the strategy is commercially smart
2. whether the channel choices are justified
3. whether the plan fits the client’s operational capacity
4. whether KPI targets are realistic
5. whether campaign logic matches the client’s funnel
6. whether the output reflects agency-specific process
7. whether the plan would actually be useful to an operator tomorrow morning

So the current repair loop improves structural validity.

It does not reliably improve strategic seniority.

## 6) Does This Match What Real SMMAs Actually Build?

Short answer: partially.

### 6.1 What it gets right

External strategy references consistently include:

1. goals and KPIs
2. audience understanding
3. platform selection
4. content strategy
5. competitor awareness
6. workflow and measurement

Examples:

1. Hootsuite says a strong social strategy should set clear goals, define platforms/content, track key metrics, and establish workflow for planning, publishing, and reporting.
2. Sprout Social defines social strategy as a comprehensive plan tied to broader business objectives and emphasizes goals, KPIs, audience research, network selection, content strategy, and competitive analysis.

Compared to that, SMMAHUB’s modules do cover:

1. positioning
2. pillars
3. channel adaptations
4. campaigns
5. weekly plan
6. rules and constraints

So this is not random.

### 6.2 Where it diverges from real agency work

Real agencies do not stop at a clean six-module output.

They usually need:

1. diagnosis before prescription
2. decision rights and approval reality
3. resource and production constraints
4. client-side bottlenecks
5. channel prioritization based on budget, proof, speed, and market conditions
6. explicit success definition
7. delivery feasibility
8. revision logic over time

Teamwork and Asana both reinforce this operational reality:

1. Teamwork frames onboarding and delivery around expectations, contacts, milestones, approvals, deadlines, communication frequency, and workflow adoption.
2. Asana’s creative-request and approval templates emphasize standardized intake, missing-information collection, ownership, statuses, due dates, approvals, dashboards, and bottleneck visibility.

That is much closer to agency life than a static one-shot strategy object.

## 7) Why the Current Strategy Is Weak for Your End Goal

### 7.1 It is still a generation-centric system

The current system is optimized for:

1. generate a strategy object
2. validate it
3. persist it
4. derive tasks and follow-ups

Your end goal is different:

1. fit the agency’s SOPs
2. reason from those SOPs
3. act like an employee within those SOPs
4. continuously update work from changing client reality

That requires a process-centric system, not just a generation-centric one.

### 7.2 Agency AI setup is too generic

Current AI setup does not yet capture enough of how an agency actually works.

Without that, the model cannot reliably answer:

1. how this agency prioritizes channels
2. what quality means for them
3. what they never do
4. when they escalate
5. how they evaluate strategy quality
6. how they turn strategy into content and delivery

### 7.3 The generator is overfitted to current UI modules

The six-module structure is fine as a product artifact.

It should not be mistaken for the real planning process.

The current system effectively asks the model to jump too quickly from partial context into finished module output.

That is why it can look complete while still feeling weak.

## 8) Hard Decision: Patch or Rebuild?

My recommendation:

1. Do not keep the current strategy-generation process as the long-term foundation.
2. Do not fully rewrite the whole SaaS.
3. Do rebuild this layer from the bottom as a new foundation.

That means:

1. keep the current UI surfaces and operational stack
2. keep the storage and orchestration pieces that are already useful
3. replace the underlying AI setup and strategy-generation assumptions

This is not a cosmetic refactor.

It is a foundational redesign of:

1. what agency AI setup captures
2. what the strategy agent is asked to do
3. how quality is judged
4. how strategy feeds ongoing operational behavior

## 9) Recommended Judgment

If you want the shortest path to shipping something decent, you could patch this system.

If you want the best path to building the product you actually described, you should treat the current strategy-generation foundation as transitional and rebuild it.

My honest judgment:

1. The current layer is too weak for the final promise.
2. The right move is a bottom-up rebuild of the strategy foundation.
3. The old flow should be kept only as a temporary legacy draft engine until the new system is ready.

## 10) Final Bottom Line

The current strategy generator is not worthless.

It is a useful intermediate system that proved:

1. schema-first generation can work
2. strategy modules can be stored and edited
3. queue/task workflows can be derived from strategy gaps
4. retrieval and persistence pipelines are viable

But it is not the right base for the AI employee you want.

The gap is not just output quality.

The deeper gap is that the current system does not begin from agency process truth strongly enough, and therefore cannot consistently behave like agency labor.

## 11) Source Notes

### Internal sources

1. [index.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/ai-strategy-generate/index.ts)
2. [strategyPlan.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/prompts/strategyPlan.ts)
3. [taskRegistry.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/taskRegistry.ts)
4. [router.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/router.ts)
5. [strategy-output.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/strategy-output.ts)
6. [brain-quality.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/brain-quality.ts)
7. [client-brain-mapping.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/client-brain-mapping.ts)
8. [defaultBrainPackV1.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/_shared/defaultBrainPackV1.ts)
9. [rulesEngine.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/lib/strategy/rulesEngine.ts)
10. [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md)
11. [11_CLIENT_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/11_CLIENT_BRAIN_CURRENT_AND_TARGET.md)
12. [SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md)
13. [SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md)

### External sources

1. Hootsuite social media strategy guide: https://blog.hootsuite.com/social-media-marketing-strategy/
2. Sprout Social strategy guide: https://sproutsocial.com/insights/social-media-marketing-strategy/
3. Teamwork client onboarding process: https://www.teamwork.com/blog/client-onboarding/
4. Asana creative requests template: https://asana.com/templates/creative-requests
5. Asana creative asset approval template: https://asana.com/templates/creative-asset-feedback-and-approval
