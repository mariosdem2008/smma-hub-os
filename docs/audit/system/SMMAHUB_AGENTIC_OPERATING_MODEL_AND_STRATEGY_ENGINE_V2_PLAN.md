# SMMAHUB Agentic Operating Model and Strategy Engine V2 Plan

Last updated: 2026-03-13
Owner: Product strategy + AI systems
Status: Decision-grade planning blueprint
Purpose: Define the end-to-end operating model for SMMAHUB's AI employee system by combining the strongest patterns from ConvertMate, Jasper, Productive.io, and Scoro, then apply that model specifically to strategy generation.

## 1. Executive Decision

SMMAHUB should adopt this combined model:

1. ConvertMate-style specialist agents
2. Jasper-style governed context for creation
3. Productive.io / Scoro-style operational pipeline as the system spine

In plain terms:

1. agents should have narrow jobs
2. each agent should run only when the client lifecycle state makes that work relevant
3. creator agents should never invent context from scratch
4. strategy should be a staged reasoning workflow, not a one-shot generator
5. the platform should behave like an agency operating system with embedded AI employees, not like a set of disconnected AI tools

## 2. Why These Products Matter

### 2.1 ConvertMate: specialist agents, not one general assistant

Official ConvertMate materials position the product around multiple specialized agents, persistent business settings, and an execution workspace where users can monitor and control agent work.

What that means for SMMAHUB:

1. do not build one generic "agency assistant" as the main operating model
2. define agents by job, required inputs, allowed actions, and review rules
3. make orchestration visible
4. tie automation to connected systems and durable context

### 2.2 Jasper: governed creation needs a real context layer

Official Jasper materials show a clear pattern:

1. Jasper IQ acts as a context layer
2. Brand Voice, Style Guide, Knowledge Base, and Audiences are persistent reusable assets
3. campaign agents create downstream assets from one approved brief and governed context

What that means for SMMAHUB:

1. AI setup must become a real operating context layer
2. content and strategy agents must inherit persistent context, not only prompt text
3. creator agents should execute from approved context packs and briefs
4. "brand-safe, audience-aware, rules-aware creation" must be native to the system

### 2.3 Productive.io: operational state controls work

Official Productive materials emphasize pipelines, deal stages, forecasting, budget context, delivery handoff, resourcing, and AI-created work once a deal is won.

What that means for SMMAHUB:

1. AI work should be triggered by pipeline and delivery state
2. strategy outputs must convert into tasks, approvals, blockers, and milestones
3. the system should know whether a client is sold, onboarded, blocked, waiting on client input, in review, at risk, or ready for production

### 2.4 Scoro: one operational spine

Official Scoro materials emphasize quote-to-cash, agency management, and one system of record across CRM, work, finances, delivery, and reporting.

What that means for SMMAHUB:

1. AI should sit on top of a single client operating record
2. agents should write into the operating system, not only generate text
3. the platform should understand commercial and operational reality, not only marketing ideas

## 3. Hard Product Conclusion

The correct design for SMMAHUB is:

1. ConvertMate for agent structure
2. Jasper for context-governed creation
3. Productive.io and Scoro for lifecycle, handoff, delivery, and accountability

This means the end goal is not:

1. "generate a strategy document"
2. "collect onboarding answers"
3. "have an AI chat"

The end goal is:

1. agency setup defines how this agency actually works
2. client setup defines the real client operating brief
3. lifecycle state determines which agent should act
4. specialist agents produce decisions, plans, tasks, and follow-ups
5. outputs write back into the operating system and remain traceable

## 4. The SMMAHUB AI Employee Model

SMMAHUB should have three core layers.

### 4.1 Layer A: Context layer

This is the Jasper-like foundation.

It should include:

1. Agency Operating Brain
2. Client Operating Brief
3. approved knowledge and exemplars
4. quality rules
5. approval rules
6. risk and compliance rules

Without this layer, the system cannot behave like a consistent employee.

### 4.2 Layer B: Workflow layer

This is the Productive.io / Scoro-like operating spine.

It should include:

1. pipeline state
2. onboarding state
3. strategy state
4. production state
5. approvals state
6. reporting state
7. risk and drift state
8. commercial and delivery status

Without this layer, the system cannot know what work is timely, blocked, or valuable.

### 4.3 Layer C: Agent layer

This is the ConvertMate-like specialist system.

Each agent should have:

1. a job definition
2. entry conditions
3. required context pack
4. allowed tools
5. output contract
6. write-back targets
7. approval policy
8. evaluation rules
9. audit trail

## 5. The Agency Operating Brain V2

This should replace the weak "generic AI setup" model.

Recommended authoritative modules:

1. `agency_identity`
2. `service_catalog`
3. `offer_strategy`
4. `icp_segments`
5. `channel_playbooks`
6. `content_frameworks`
7. `creative_rules`
8. `claims_compliance`
9. `quality_bar`
10. `approval_matrix`
11. `delivery_sops`
12. `reporting_kpis`
13. `retention_expansion_playbooks`
14. `escalation_rules`

For every module, capture:

1. rules
2. examples
3. anti-patterns
4. confidence
5. approval owner
6. evidence source

This is what will make the system behave like that agency's employee rather than a generic AI writer.

## 6. The Client Operating Brief V2

This should replace the shallow "strategy-ready enough" model.

Recommended sections:

1. business model and offer priority
2. target market and audience segments
3. sales process and conversion path
4. pricing and commercial constraints
5. proof, differentiators, and claims limits
6. goals, baselines, and success thresholds
7. active channels and performance context
8. stakeholder and approval map
9. launch windows and deadlines
10. access and asset readiness
11. internal dependencies and client capacity
12. legal or brand constraints
13. known blockers and open questions

This brief should be the durable operating record for client-specific strategic work.

## 7. The Pipeline and State Machine

The Productive.io / Scoro lesson is that work should be state-driven.

Recommended lifecycle states:

1. `lead`
2. `qualified`
3. `scoped`
4. `proposal_sent`
5. `won`
6. `onboarding_essential`
7. `onboarding_operations`
8. `setup_ready`
9. `strategy_readiness_review`
10. `strategy_diagnosis`
11. `strategy_in_review`
12. `strategy_approved`
13. `production_active`
14. `approvals_pending`
15. `reporting_due`
16. `at_risk`
17. `renewal_window`
18. `paused_or_offboarded`

Agent behavior should depend on state.

Examples:

1. before `won`, only qualification and scoping agents should run
2. during `onboarding_essential`, only intake and setup agents should run
3. during `strategy_diagnosis`, creator agents should not run yet
4. after `strategy_approved`, creator and delivery agents can activate
5. in `approvals_pending`, reminder and blocker agents should activate
6. in `at_risk`, diagnosis, reporting, and escalation agents should activate

## 8. The Specialist Agent Map

### 8.1 Revenue and commercial agents

1. `lead_qualification_agent`
2. `scoping_agent`
3. `proposal_alignment_agent`
4. `handoff_agent`
5. `renewal_signal_agent`

### 8.2 Onboarding and setup agents

1. `essential_intake_agent`
2. `operations_setup_agent`
3. `access_assets_agent`
4. `stakeholder_approval_agent`
5. `setup_gap_agent`

### 8.3 Strategy agents

1. `strategy_readiness_agent`
2. `diagnosis_agent`
3. `strategy_architect_agent`
4. `channel_plan_agent`
5. `offer_funnel_agent`
6. `risk_compliance_agent`

### 8.4 Creator agents

These should act like Jasper-style creators.

1. `campaign_brief_agent`
2. `content_system_agent`
3. `social_campaign_creator`
4. `ad_copy_agent`
5. `script_writer_agent`
6. `brand_compliance_reviewer`

### 8.5 Delivery and operations agents

1. `task_breakdown_agent`
2. `timeline_scheduler_agent`
3. `approval_followup_agent`
4. `blocker_detection_agent`
5. `reporting_insight_agent`

### 8.6 Memory and drift agents

1. `context_sync_agent`
2. `drift_detection_agent`
3. `knowledge_gap_agent`
4. `strategy_reconciliation_agent`

## 9. The Strategy Engine Must Be Rebuilt

This is the most important product decision in this document.

The current generator is a useful legacy draft engine, but it is not the right long-term base for the AI employee system.

The strategy engine should be rebuilt around a staged workflow.

### 9.1 What is wrong with the current model

Based on the current repo audit:

1. the strategy task does not require agency or client brains at router level
2. the strategy gate is too shallow
3. onboarding fallback can create false readiness
4. retrieval is broad rather than job-specific
5. quality checks are mostly structural
6. the system jumps too quickly from context to final modules

That is acceptable for a draft generator.

It is not acceptable for an AI employee positioned as a premium agency operator.

## 10. The New Strategy Workflow

Strategy should be a pipeline, not a single prompt.

### Phase 1: Strategy Readiness Audit

Agent: `strategy_readiness_agent`

Inputs:

1. client operating brief
2. agency operating brain
3. current lifecycle state
4. operations setup record
5. imported performance context if available

Outputs:

1. readiness score
2. missing critical inputs
3. risky assumptions
4. blocked work categories
5. recommended next actions
6. allowed strategy scope

Decision outcomes:

1. `blocked`
2. `proceed_with_caveats`
3. `proceed`

Hard rule:

No full strategy generation should run before this audit passes.

### Phase 2: Strategic Diagnosis

Agent: `diagnosis_agent`

Goal:

Understand the actual client situation before recommending a plan.

Inputs:

1. approved brief
2. agency playbooks
3. channel history
4. offer and funnel context
5. constraints and risks

Outputs:

1. current-state summary
2. business objective tree
3. offer diagnosis
4. funnel diagnosis
5. audience clarity assessment
6. channel fit assessment
7. risk summary
8. unresolved questions

This becomes the first true strategic artifact.

### Phase 3: Strategy Recommendation

Agent: `strategy_architect_agent`

Goal:

Make strategic choices and justify them.

Inputs:

1. diagnosis artifact
2. agency playbooks
3. client operating constraints
4. commercial realities

Outputs:

1. strategic direction
2. chosen offer priority
3. chosen funnel and conversion path
4. chosen channel priorities
5. recommended content pillars
6. messaging direction
7. risks and tradeoffs
8. rationale for major decisions

This phase should be explicitly reviewable before downstream generation.

### Phase 4: Strategy Plan Conversion

Agents:

1. `channel_plan_agent`
2. `campaign_brief_agent`
3. `content_system_agent`
4. `rules_and_approvals_agent`

Goal:

Convert approved strategy choices into operational artifacts.

Outputs:

1. positioning artifact
2. pillar system
3. campaign plan
4. weekly or monthly execution plan
5. channel adaptation rules
6. rules and approval triggers

Important:

These outputs are derived artifacts, not the first strategic reasoning step.

### Phase 5: Delivery Conversion

Agents:

1. `task_breakdown_agent`
2. `timeline_scheduler_agent`
3. `client_input_request_agent`
4. `approval_workflow_agent`

Goal:

Turn strategy into work.

Outputs:

1. execution tasks
2. owners or assignees
3. due dates
4. dependencies
5. client requests
6. approval checkpoints
7. reporting milestones

### Phase 6: Drift and Reconciliation

Agents:

1. `drift_detection_agent`
2. `strategy_reconciliation_agent`

Triggers:

1. onboarding changes
2. memory updates
3. new performance signals
4. scope changes
5. approval changes
6. strategy objections

Outputs:

1. impacted strategy layers
2. stale artifacts
3. follow-up tasks
4. selective regeneration requests

Hard rule:

Do not regenerate the whole strategy unless the whole strategy is actually stale.

## 11. Jasper-Style Creator Behavior Inside SMMAHUB

Creator agents should work like Jasper creators, not like freeform chatbots.

Every creator agent should inherit:

1. agency voice rules
2. style rules
3. audience pack
4. approved knowledge pack
5. visual and compliance rules
6. approved campaign brief
7. channel-specific requirements

Every creator agent should receive:

1. one approved brief
2. one context pack
3. one rules pack
4. one explicit output contract

What creator agents should not do:

1. redefine strategy
2. guess approval policy
3. operate without approved context
4. ignore brand and compliance rules

## 12. Supervisor Model

SMMAHUB should not only have worker agents.

It should have supervisor roles.

### 12.1 Orchestration supervisor

Responsible for:

1. selecting the right agent
2. passing the correct context pack
3. enforcing sequence
4. respecting lifecycle state
5. ensuring required approvals exist

### 12.2 Quality supervisor

Responsible for:

1. evaluating output quality
2. checking missing context
3. deciding whether to retry, clarify, escalate, or approve
4. enforcing task-specific acceptance criteria

### 12.3 Operations supervisor

Responsible for:

1. translating outputs into tasks, approvals, and timelines
2. checking for dependency conflicts
3. detecting blockers
4. ensuring work lands in the operating system

## 13. Hard Product Rules

To stay aligned with the AI employee promise, enforce these rules:

1. no strategy generation without readiness audit
2. no creator generation without approved brief and rules pack
3. no write action without explicit policy check
4. no "done" state without source-of-truth write-back
5. no agent action without lifecycle relevance
6. no premium claim without human-grade quality gates

## 14. Keep, Replace, Delete

### 14.1 Keep

1. the broader SMMAHUB workspace and operating-system direction
2. client detail and strategy workspace surfaces
3. staged onboarding direction
4. enrichment queue, execution task, and write-back architecture
5. RAG, memory, and audit infrastructure

### 14.2 Replace

1. current AI setup information architecture
2. current strategy-readiness contract
3. current one-shot strategy generation process
4. current quality model for strategy usefulness

### 14.3 Delete as a future assumption

1. the idea that a shallow client brain is enough for strategy
2. the idea that one strategy prompt should do the full reasoning job
3. the idea that structural completeness means strategic quality

## 15. End-to-End Plan Before Code

The correct planning sequence is:

### Step 1: Freeze the current system as legacy

1. keep current generator available only as fallback
2. stop treating it as target architecture
3. label it internally as legacy strategy draft flow

### Step 2: Redesign Agency AI Setup V2

1. define authoritative agency brain modules
2. define required evidence and examples for each module
3. define who can approve each module
4. define which downstream agents consume each module

### Step 3: Redesign Client Operating Brief V2

1. define durable brief sections
2. define what is mandatory for readiness
3. define what can be collected progressively
4. define confidence and missing-data semantics

### Step 4: Define strategy artifacts

1. readiness audit artifact
2. diagnosis artifact
3. strategy recommendation artifact
4. execution plan artifacts
5. creator brief artifacts
6. drift and reconciliation artifacts

### Step 5: Define agent contracts

For each agent:

1. inputs
2. outputs
3. tools
4. write-back target
5. approval rule
6. evaluation rule

### Step 6: Define evaluation gates

1. readiness quality
2. diagnosis usefulness
3. strategic reasoning quality
4. operational feasibility
5. creator compliance
6. write-back correctness

### Step 7: Build the migration plan

1. current strategy UI continues to display modules
2. new strategy engine populates those modules from staged artifacts
3. old generator remains fallback until new gates pass
4. cut over only after real pilot validation

## 16. Final Recommendation

The strongest direction for SMMAHUB is:

1. ConvertMate-style specialized agents
2. Productive.io / Scoro-style pipeline and delivery spine
3. Jasper-style context-governed creators

For strategy generation specifically:

1. rebuild it as a multi-agent strategy workflow
2. stop treating one-shot generation as the main planning model
3. make strategy a staged reasoning and operations process
4. treat creator agents as downstream executors of approved strategy

This is the harder path.

It is also the right path if the goal is a real AI employee for SMMAs that agencies will trust and pay premium pricing for.

## 17. Evidence and Sources

Official product sources reviewed on 2026-03-13:

1. ConvertMate homepage: https://www.convertmate.io/
2. ConvertMate features: https://www.convertmate.io/features
3. ConvertMate agent help: https://app.convertmate.io/help/ai-agents/what-are-agents
4. Jasper IQ: https://www.jasper.ai/jasper-iq
5. Jasper Brand Voice: https://help.jasper.ai/hc/en-us/articles/18618693085339-Brand-Voice
6. Jasper Style Guide: https://help.jasper.ai/hc/en-us/articles/25925092890011-Style-Guide
7. Jasper Knowledge Base: https://help.jasper.ai/hc/en-us/articles/18618707176347-Knowledge-Base
8. Jasper Audiences: https://help.jasper.ai/hc/en-us/articles/36829917506203-Audiences
9. Jasper multi-channel campaign agent: https://www.jasper.ai/agents/multi-channel-campaign
10. Productive homepage: https://productive.io/
11. Productive pipeline help: https://help.productive.io/en/articles/2179572-setting-up-your-sales-pipelines
12. Productive end-to-end agency management: https://productive.io/resources/end-to-end-agency-management/
13. Scoro homepage: https://www.scoro.com/
14. Scoro agency management software: https://www.scoro.com/industries/agency-management-software/

Repo evidence reviewed:

1. `supabase/functions/ai-strategy-generate/index.ts`
2. `src/ai/taskRegistry.ts`
3. `src/ai/prompts/strategyPlan.ts`
4. `docs/audit/system/SMMAHUB_STRATEGY_GENERATION_REALITY_AUDIT_2026_03_13.md`
5. `docs/audit/system/SMMAHUB_AI_SETUP_AND_STRATEGY_FOUNDATION_REBUILD_DECISION.md`
