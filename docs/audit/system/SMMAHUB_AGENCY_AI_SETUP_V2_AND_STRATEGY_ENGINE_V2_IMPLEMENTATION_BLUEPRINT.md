# SMMAHUB Agency AI Setup V2 and Strategy Engine V2 Implementation Blueprint

Last updated: 2026-03-13
Owner: Product strategy + AI systems
Status: Implementation blueprint
Purpose: Convert the V2 agentic strategy direction into an executable product and architecture plan grounded in the current SMMAHUB repo.

## 1. Executive Decision

SMMAHUB should rebuild the AI setup and strategy layer from the bottom while preserving the rest of the operating system already built.

This blueprint assumes:

1. the current onboarding, operations, queue, task, and write-back systems remain valuable
2. the current `ai-strategy-generate` flow becomes legacy
3. the replacement system is staged, artifact-driven, and operationally grounded
4. the rebuild should be incremental, not a big-bang rewrite of the full SaaS

## 2. Current Repo Reality

The rebuild must fit these current truths.

### 2.1 Existing durable systems worth keeping

Keep these as foundation:

1. staged client onboarding and client detail workspace
2. `client_operations_setup`
3. `client_enrichment_queue`
4. `client_execution_tasks`
5. event history and task write-back pattern
6. `strategy_documents`
7. `strategy_modules`
8. RAG and memory ingestion infrastructure
9. agency `brain_documents` approval and ingestion model

### 2.2 Existing AI setup and strategy architecture problems

Current problems already proven in repo audits:

1. `agency_brains.brain_json` and `brain_documents` create source-of-truth ambiguity
2. `client_brains.usable` is too weak to represent true strategy readiness
3. `TaskType.STRATEGY_PLAN` does not require agency/client brains at router level
4. `ai-strategy-generate` jumps too quickly from mixed context into final strategy modules
5. quality checks are mostly structural, not strategist-grade

### 2.3 Architectural constraint for V2

The new system should not break:

1. current client workspace routes
2. current strategy UI surfaces
3. current queue/task/write-back layer
4. current approved-brain-doc ingestion behavior

That means V2 should initially produce artifacts that can still feed the existing product surfaces, even if those surfaces evolve later.

## 3. Target Architecture

V2 should be built around five durable layers.

### 3.1 Layer 1: Agency Operating Brain

Primary source of truth:

1. approved modular `brain_documents`

Role of legacy table:

1. `agency_brains.brain_json` becomes derived snapshot or compatibility cache

### 3.2 Layer 2: Client Operating Brief

Primary source of truth:

1. onboarding profile
2. operations setup
3. imported memory/performance context
4. approval and stakeholder context
5. derived brief artifact

Role of legacy table:

1. `client_brains.brain_json` becomes compatibility layer plus minimal canonical summary, not the only readiness contract

### 3.3 Layer 3: Strategy Artifacts

New durable artifacts required:

1. readiness audit
2. diagnosis
3. strategy recommendation
4. approved strategy plan
5. creator briefs
6. reconciliation records

### 3.4 Layer 4: Operational Activation

Existing systems to use:

1. enrichment queue
2. execution tasks
3. operations checklist
4. event history

### 3.5 Layer 5: Agent Orchestration and Evaluation

New V2 logic should define:

1. agent contracts
2. supervisor rules
3. approval gates
4. evaluation gates
5. migration routing between legacy and V2

## 4. Agency AI Setup V2

### 4.1 Product goal

Agency AI Setup V2 should teach the system how this agency works, not just describe the agency.

### 4.2 Authoritative module set

These should be first-class V2 modules:

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

### 4.3 Required schema inside each module

Every module should capture:

1. `definition`
2. `rules`
3. `examples`
4. `anti_patterns`
5. `edge_cases`
6. `confidence`
7. `approval_owner`
8. `status`
9. `evidence_sources`
10. `last_reviewed_at`

### 4.4 V2 module quality standard

A module should not be considered V2-ready unless it includes:

1. clear decision logic
2. at least one example
3. at least one anti-pattern
4. ownership
5. approval state

### 4.5 Storage decision

Recommended:

1. keep `brain_documents` as authoritative editable store
2. add typed V2 module metadata and classification around those documents
3. derive `agency_brains.brain_json` from approved V2 modules

Do not:

1. continue treating `agency_brains.brain_json` as the main authored knowledge source

## 5. Client Operating Brief V2

### 5.1 Product goal

The Client Operating Brief V2 should represent the real client context required for strategy and delivery.

### 5.2 Required sections

The brief should contain these sections:

1. `business_model`
2. `offer_priority`
3. `audience_segments`
4. `conversion_path`
5. `sales_process`
6. `pricing_and_budget`
7. `proof_and_differentiators`
8. `goals_baselines_success_thresholds`
9. `channel_state_and_history`
10. `stakeholder_and_approval_map`
11. `launch_windows_and_deadlines`
12. `access_and_asset_readiness`
13. `constraints_and_compliance`
14. `internal_capacity_and_dependencies`
15. `known_blockers`
16. `open_questions`

### 5.3 Brief assembly inputs

V2 should assemble the brief from:

1. essential onboarding intake
2. operations setup
3. client brain summary
4. approved client memory
5. imported documents or performance context
6. strategy-related open questions and blockers

### 5.4 Readiness model

Replace the current binary mindset with a layered model:

1. `insufficient`
2. `diagnosis_ready`
3. `strategy_ready_with_caveats`
4. `strategy_ready`
5. `execution_ready`

### 5.5 Storage decision

Recommended:

1. keep `client_onboarding_profiles`, `client_operations_setup`, and `client_brains` as raw/derived inputs
2. add a new durable V2 brief artifact as the strategic operating record

Do not:

1. rely on `client_brains.usable` alone as the production readiness signal

## 6. Strategy Engine V2 Artifact Model

The rebuild should be artifact-first.

### 6.1 Required artifact types

Add these durable artifact types:

1. `strategy_readiness_audit`
2. `strategy_diagnosis`
3. `strategy_recommendation`
4. `strategy_plan_v2`
5. `creator_brief`
6. `strategy_reconciliation`

### 6.2 Artifact minimum contract

Every artifact should have:

1. `artifact_type`
2. `agency_id`
3. `client_id`
4. `version`
5. `status`
6. `source_inputs`
7. `content_json`
8. `markdown`
9. `citations`
10. `assumptions`
11. `open_questions`
12. `confidence`
13. `approved_by`
14. `approved_at`
15. `supersedes_artifact_id`

### 6.3 Relationship to existing strategy tables

Initial migration rule:

1. `strategy_plan_v2` should populate existing `strategy_modules` and `strategy_documents`

This allows:

1. existing UI surfaces to continue functioning
2. V2 to coexist with legacy strategy rendering

## 7. Strategy Engine V2 Workflow

### 7.1 Phase A: Readiness Audit

Agent:

1. `strategy_readiness_agent`

Consumes:

1. client brief draft
2. agency operating brain
3. operations setup
4. lifecycle state

Produces:

1. readiness artifact
2. explicit blockers
3. next required actions
4. scope limit

Writes to:

1. readiness artifact table
2. enrichment queue
3. execution tasks if gaps need human action

### 7.2 Phase B: Diagnosis

Agent:

1. `diagnosis_agent`

Consumes:

1. approved readiness artifact
2. client brief
3. agency playbooks
4. historical and current context

Produces:

1. diagnosis artifact
2. objective tree
3. channel fit
4. funnel diagnosis
5. risks
6. unresolved questions

Writes to:

1. diagnosis artifact
2. execution tasks if clarification is needed

### 7.3 Phase C: Strategy Recommendation

Agent:

1. `strategy_architect_agent`

Consumes:

1. diagnosis
2. agency playbooks
3. client constraints
4. operational and commercial realities

Produces:

1. recommendation artifact
2. chosen offer and funnel direction
3. selected channel priorities
4. pillar direction
5. rationale and tradeoffs

Writes to:

1. recommendation artifact
2. review request state

### 7.4 Phase D: Plan Conversion

Agents:

1. `channel_plan_agent`
2. `campaign_brief_agent`
3. `content_system_agent`
4. `rules_and_approvals_agent`

Consumes:

1. approved recommendation

Produces:

1. `strategy_plan_v2`
2. creator briefs
3. policy and approval triggers

Writes to:

1. V2 plan artifacts
2. existing `strategy_modules`
3. existing `strategy_documents`

### 7.5 Phase E: Delivery Conversion

Agents:

1. `task_breakdown_agent`
2. `timeline_scheduler_agent`
3. `client_input_request_agent`
4. `approval_workflow_agent`

Consumes:

1. approved plan
2. ops setup
3. approval matrix

Produces:

1. execution tasks
2. client requests
3. approval tasks
4. milestone map

Writes to:

1. `client_execution_tasks`
2. `client_enrichment_queue`
3. operation events

### 7.6 Phase F: Drift and Reconciliation

Agents:

1. `drift_detection_agent`
2. `strategy_reconciliation_agent`

Consumes:

1. current artifacts
2. onboarding and memory changes
3. performance changes
4. approval changes

Produces:

1. reconciliation artifact
2. impacted layers
3. suggested partial regeneration

Writes to:

1. reconciliation artifacts
2. queue items
3. execution tasks
4. operation events

## 8. Agent Contract Specification

Every V2 agent must have a formal contract.

### 8.1 Contract fields

Required fields per agent:

1. `agent_key`
2. `job`
3. `entry_conditions`
4. `required_context`
5. `optional_context`
6. `allowed_tools`
7. `output_artifact_type`
8. `write_back_targets`
9. `approval_policy`
10. `evaluation_gate`
11. `failure_modes`

### 8.2 First-wave agent list to formalize

This is the minimum V2 set:

1. `strategy_readiness_agent`
2. `diagnosis_agent`
3. `strategy_architect_agent`
4. `channel_plan_agent`
5. `campaign_brief_agent`
6. `content_system_agent`
7. `drift_detection_agent`
8. `strategy_reconciliation_agent`

### 8.3 Supervisor contracts

Also define:

1. `orchestration_supervisor`
2. `quality_supervisor`
3. `operations_supervisor`

## 9. New Persistence Model

### 9.1 Recommended new tables

Add these new V2 tables:

1. `agency_operating_modules_v2`
2. `client_operating_briefs_v2`
3. `strategy_artifacts_v2`
4. `strategy_artifact_approvals_v2`
5. `agent_runs_v2`
6. `artifact_evaluations_v2`

### 9.2 Table purpose

`agency_operating_modules_v2`

1. typed authoritative metadata around approved agency modules

`client_operating_briefs_v2`

1. durable client operating brief snapshots with readiness states

`strategy_artifacts_v2`

1. stores readiness, diagnosis, recommendation, plan, creator briefs, reconciliation

`strategy_artifact_approvals_v2`

1. review and sign-off records for recommendation and plan stages

`agent_runs_v2`

1. one row per agent invocation with context version references and evaluation outcome

`artifact_evaluations_v2`

1. stores quality checks, evaluator scores, and failure reasons

### 9.3 Why not overload current tables

Do not overload:

1. `strategy_modules`
2. `strategy_documents`
3. `client_brains`

with all new V2 logic.

Reason:

1. those tables are product outputs or compatibility layers, not the right place for the full reasoning pipeline

## 10. UI and Product Surface Plan

### 10.1 Agency setup UI

Replace generic setup with:

1. module-by-module operating brain setup
2. approval state per module
3. examples and anti-pattern capture
4. downstream usage visibility

### 10.2 Client onboarding and brief UI

The client flow should surface:

1. essential intake
2. operations setup
3. brief readiness
4. missing critical context
5. next actions to reach diagnosis-ready or strategy-ready

### 10.3 Strategy workspace UI

Strategy should show:

1. readiness artifact
2. diagnosis artifact
3. recommendation artifact
4. approved strategy plan
5. open questions and caveats
6. downstream execution tasks

### 10.4 Creator workflow UI

Creator surfaces should operate from approved briefs, not from generic chat prompts.

## 11. Evaluation and Acceptance Gates

### 11.1 Readiness gate

Pass only if:

1. blockers are explicit
2. assumptions are explicit
3. readiness scope is justified

### 11.2 Diagnosis gate

Pass only if:

1. objective tree is coherent
2. offer and funnel analysis are useful
3. risks and open questions are actionable

### 11.3 Recommendation gate

Pass only if:

1. strategic decisions are justified
2. channel choices fit the client
3. tradeoffs are explicit
4. commercial and operational constraints are respected

### 11.4 Plan gate

Pass only if:

1. outputs are operationally usable
2. downstream creator briefs are clear
3. plan writes cleanly into `strategy_modules` and `strategy_documents`

### 11.5 Delivery gate

Pass only if:

1. execution tasks are actionable
2. owners and dependencies are coherent
3. approval and client-input work is captured

## 12. Migration Plan

### Phase 0: Freeze legacy

1. keep current `ai-strategy-generate` alive as fallback
2. label it legacy internally
3. stop treating it as target architecture

### Phase 1: Agency AI Setup V2

1. define V2 module contracts
2. add V2 module persistence
3. build setup UI around module rules, examples, anti-patterns, approvals
4. derive compatibility snapshot for legacy consumers

### Phase 2: Client Operating Brief V2

1. add brief persistence
2. build brief assembler from onboarding, ops setup, brain, and memory
3. replace binary readiness with staged readiness states

### Phase 3: Strategy Artifacts V2

1. add artifact tables
2. implement readiness and diagnosis artifacts first
3. keep existing strategy UI while feeding it derived outputs

### Phase 4: Recommendation and Plan Conversion

1. implement recommendation artifact
2. implement conversion agents
3. populate current strategy modules/documents from V2 plan

### Phase 5: Delivery and Reconciliation

1. fully connect V2 outputs into queue/tasks/events
2. implement drift-driven reconciliation
3. add partial regeneration behavior

### Phase 6: Cutover

1. route default strategy creation through V2
2. keep legacy flow behind fallback flag
3. remove default dependency on legacy prompt-first generation

## 13. Keep, Replace, Delete

### Keep

1. workspace and client-detail product
2. staged onboarding direction
3. queue, tasks, events, write-back architecture
4. RAG and memory infrastructure
5. strategy module and strategy document UI as temporary output surfaces

### Replace

1. agency AI setup architecture
2. client strategy readiness contract
3. one-shot strategy generation workflow
4. strategy quality model

### Delete as future assumption

1. `client_brains.usable` as the main readiness truth
2. single-prompt strategy generation as the core architecture
3. generic agency setup as sufficient for employee-grade AI behavior

## 14. First Build Order

If execution starts immediately, this is the correct order:

1. define V2 schemas and tables
2. define agency module contracts
3. define client brief contract
4. implement readiness artifact
5. implement diagnosis artifact
6. implement recommendation artifact
7. implement plan conversion into current strategy surfaces
8. cut creator flows over to approved briefs

Do not start with:

1. prompt tweaking the current strategy generator
2. more one-shot strategy repair logic
3. cosmetic AI setup changes without changing the underlying contracts

## 15. Final Recommendation

The strongest implementation path is:

1. rebuild `Agency AI Setup` as an operating-brain system
2. rebuild `Strategy Generation` as an artifact and agent workflow
3. preserve current workspace surfaces while V2 feeds them
4. cut over only after V2 quality gates are proven

That is the highest-effort path.

It is also the only path in this repo that credibly supports the product promise of an AI employee for SMMAs rather than a strategy drafting tool.

## 16. Evidence and Repo References

Current repo references reviewed for this blueprint:

1. [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md)
2. [11_CLIENT_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/11_CLIENT_BRAIN_CURRENT_AND_TARGET.md)
3. [07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/07_CLIENT_ONBOARDING_STRATEGY_GENERATION_PIPELINE.md)
4. [SMMAHUB_STRATEGY_GENERATION_REALITY_AUDIT_2026_03_13.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_STRATEGY_GENERATION_REALITY_AUDIT_2026_03_13.md)
5. [SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md)
6. [ai-strategy-generate/index.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/supabase/functions/ai-strategy-generate/index.ts)
7. [taskRegistry.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/taskRegistry.ts)
