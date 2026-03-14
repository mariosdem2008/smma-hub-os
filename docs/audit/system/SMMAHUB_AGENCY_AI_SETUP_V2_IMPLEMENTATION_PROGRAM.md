# SMMAHUB Agency AI Setup V2 Implementation Program

## Purpose

This document converts [SMMAHUB_AGENCY_AI_SETUP_V2_UX_AND_READINESS_BLUEPRINT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_AI_SETUP_V2_UX_AND_READINESS_BLUEPRINT.md) into an execution-ready implementation program.

It defines:

- information architecture
- route map
- screen responsibilities
- backend/data model additions
- readiness engine requirements
- phased build order

This is the product implementation bridge between:

- strategy and UX direction
- actual UI/backend build work

## Primary Product Goal

Build `Agency AI Setup V2` as a governed operating-system setup flow that:

- teaches the system how the agency works
- measures readiness explicitly
- unlocks agent capabilities progressively
- makes expert-quality activation earned and visible

## Product Structure

The setup should live as a first-class workspace, not a modal or isolated wizard.

Recommended nav label:

- `AI Setup`

Recommended top-level sections:

1. `Overview`
2. `Imports`
3. `Foundations`
4. `Modules`
5. `Guardrails`
6. `Workflow`
7. `Readiness`
8. `Activation`

## Information Architecture

### IA Level 1

- `AI Setup Overview`
- `Imported Context`
- `Agency Foundations`
- `Operating Modules`
- `Quality And Guardrails`
- `Workflow And Approvals`
- `Readiness Review`
- `Activation And Control`

### IA Level 2

#### 1. Overview

- current readiness summary
- missing critical areas
- agent unlock summary
- resume setup CTA

#### 2. Imported Context

- connected sources
- document import review
- extracted rule review
- unresolved extraction issues

#### 3. Agency Foundations

- agency identity
- service catalog
- offer strategy
- ICP and segments

#### 4. Operating Modules

- module index
- module editor
- module approval queue
- module dependency map

#### 5. Quality And Guardrails

- quality bar
- compliance and claims
- brand and creative rules

#### 6. Workflow And Approvals

- lifecycle map
- approval matrix
- delivery SOPs
- escalation rules

#### 7. Readiness Review

- readiness dashboard
- blocked agents
- simulation previews
- remediation recommendations

#### 8. Activation And Control

- staged activation
- agent status
- drift alerts
- module re-review queue

## Route Map

Recommended app routes:

- `/agency/ai-setup`
- `/agency/ai-setup/imports`
- `/agency/ai-setup/imports/review`
- `/agency/ai-setup/foundations`
- `/agency/ai-setup/foundations/identity`
- `/agency/ai-setup/foundations/services`
- `/agency/ai-setup/foundations/offers`
- `/agency/ai-setup/foundations/icp`
- `/agency/ai-setup/modules`
- `/agency/ai-setup/modules/:moduleKey`
- `/agency/ai-setup/guardrails`
- `/agency/ai-setup/guardrails/quality-bar`
- `/agency/ai-setup/guardrails/compliance`
- `/agency/ai-setup/guardrails/creative-rules`
- `/agency/ai-setup/workflow`
- `/agency/ai-setup/workflow/lifecycle`
- `/agency/ai-setup/workflow/approvals`
- `/agency/ai-setup/workflow/delivery-sops`
- `/agency/ai-setup/workflow/escalations`
- `/agency/ai-setup/readiness`
- `/agency/ai-setup/readiness/preview/:agentClass`
- `/agency/ai-setup/activation`
- `/agency/ai-setup/control-center`

## Screen Responsibilities

### `/agency/ai-setup`

Purpose:
- entry point
- current state snapshot
- resume path

Must show:
- overall readiness label
- readiness dimensions
- unlocked/blocked agent classes
- critical missing areas
- last updated modules

Primary CTA:
- `Continue setup`

Secondary CTA:
- `Run readiness review`

### `/agency/ai-setup/imports`

Purpose:
- show importable sources and status

Must show:
- source cards
- import status
- extraction confidence
- unresolved source issues

Primary CTA:
- `Import available context`

### `/agency/ai-setup/imports/review`

Purpose:
- accept/edit/reject extracted items

Must show:
- source evidence
- extracted suggestion
- confidence
- approval impact

### `/agency/ai-setup/foundations/*`

Purpose:
- create the agency’s operating baseline

Must support:
- imported suggestions
- guided entry
- lightweight examples
- anti-pattern guidance

### `/agency/ai-setup/modules`

Purpose:
- show all operating modules and their readiness

Module card must show:
- completion percent
- confidence
- approval status
- affected agents
- missing required sections

### `/agency/ai-setup/modules/:moduleKey`

Purpose:
- deep module editing

Must support:
- structured module form
- evidence panel
- version history
- preview of downstream agent usage
- submit for approval

### `/agency/ai-setup/guardrails/*`

Purpose:
- define output safety and quality standards

These screens are high-priority because they determine whether creator/client-facing agents can be unlocked.

### `/agency/ai-setup/workflow/*`

Purpose:
- define how the agency actually operates

These screens should behave more like operations configuration than content setup.

Must support:
- stage definitions
- entry/exit conditions
- ownership
- approval requirements
- blocked actions

### `/agency/ai-setup/readiness`

Purpose:
- make readiness legible and actionable

Must show:
- dimension scores
- agent-class readiness
- blockers
- remediation tasks
- preview actions

### `/agency/ai-setup/readiness/preview/:agentClass`

Purpose:
- simulate one agent class before activation

Must show:
- sample input
- output preview
- sources used
- rule influence
- failure notes
- missing context if blocked

### `/agency/ai-setup/activation`

Purpose:
- controlled rollout

Must show:
- available activation modes
- unlocked capabilities
- still-blocked capabilities
- warnings for risky activation

### `/agency/ai-setup/control-center`

Purpose:
- after setup, this becomes the ongoing AI operating panel

Must show:
- active agents
- paused agents
- drift alerts
- re-review queue
- recently changed modules

## UX Flow

Recommended first-run flow:

1. Overview
2. Imports
3. Imports review
4. Foundations
5. Core modules
6. Guardrails
7. Workflow and approvals
8. Readiness review
9. Preview
10. Controlled activation

Recommended resume behavior:

- always send the user to the highest-priority incomplete stage
- show one clear next action on overview

## Required Data Model Additions

The following should be added as V2 product state.

### 1. Setup Session State

Table:
- `agency_ai_setup_status_v2`

Suggested fields:
- `agency_id`
- `current_stage`
- `current_step`
- `setup_state`
- `started_at`
- `last_active_at`
- `completed_foundations_at`
- `completed_readiness_review_at`
- `activated_at`
- `control_center_enabled_at`
- `meta_json`

Purpose:
- persist setup progress and resume state

### 2. Readiness Scores

Table:
- `agency_ai_readiness_scores_v2`

Suggested fields:
- `agency_id`
- `score_version`
- `knowledge_coverage`
- `process_definition`
- `quality_definition`
- `compliance_safety`
- `approval_governance`
- `evidence_strength`
- `overall_label`
- `critical_blockers`
- `warnings`
- `computed_from_json`
- `computed_at`

Purpose:
- persist computed readiness instead of recalculating only in UI

### 3. Agent Unlock State

Table:
- `agency_agent_unlocks_v2`

Suggested fields:
- `agency_id`
- `agent_class`
- `unlock_state`
- `blocked_reasons`
- `required_modules`
- `minimum_scores_json`
- `last_evaluated_at`
- `activated_at`
- `activated_by`

Purpose:
- make agent availability explicit and queryable

### 4. Module Approval Queue

If not covered adequately by the existing V2 approval tables, add:

- `agency_operating_module_reviews_v2`

Suggested fields:
- `agency_id`
- `module_key`
- `module_version`
- `decision`
- `note`
- `actor_user_id`
- `created_at`

Purpose:
- separate module reviews from strategy artifact reviews

### 5. Setup Simulations

Table:
- `agency_ai_setup_simulations_v2`

Suggested fields:
- `agency_id`
- `agent_class`
- `input_snapshot_json`
- `output_snapshot_json`
- `evaluation_json`
- `result`
- `created_by`
- `created_at`

Purpose:
- persist preview runs and readiness evidence

## Readiness Engine Logic

The readiness engine should run whenever:

- a module is created or edited
- a module is approved/rejected
- foundations change
- workflow settings change
- guardrails change
- activation settings change

### Readiness Engine Inputs

- approved module inventory
- module completeness
- module confidence
- source evidence coverage
- approval status
- workflow map state
- quality/compliance settings
- simulation results

### Readiness Engine Outputs

- dimension scores
- overall readiness label
- agent-class readiness states
- blockers
- recommended next actions

### Blocker Types

- `missing_required_module`
- `module_not_approved`
- `quality_bar_incomplete`
- `approval_matrix_incomplete`
- `compliance_rules_incomplete`
- `workflow_ownership_missing`
- `simulation_failure`

## Unlock Logic Implementation

### Agent Classes

Canonical classes:

- `strategy`
- `creator`
- `operator`
- `analyst`
- `client_facing`

### Unlock States

- `blocked`
- `preview_only`
- `internal_assist_only`
- `operational`

### Unlock Evaluation Rule

For each agent class:

1. verify required modules exist
2. verify required modules are approved
3. verify dimension thresholds
4. verify no class-specific critical blockers
5. verify required simulation passes if applicable

### Activation Rule

No class can move to `operational` unless:

- readiness state is at least `Operational With Review`
- activation is explicitly enabled
- required approvals are configured

## First-Screen Wireframe Spec

### AI Setup Overview

Top section:
- title
- overall readiness badge
- short explanation

Middle section:
- six readiness score cards
- five agent class cards with unlock state

Bottom section:
- critical blockers list
- recommended next steps list
- resume button

Right rail:
- recent changes
- latest approvals
- drift or re-review alerts

## Build Order

### Phase 1: Shell And State

Build:
- routes
- layout shell
- `agency_ai_setup_status_v2`
- overview page
- empty readiness placeholders

Success criteria:
- setup exists as a first-class workspace
- progress can persist and resume

### Phase 2: Foundations And Imports

Build:
- import hub
- import review
- foundations screens

Success criteria:
- agency can import existing context
- agency can complete baseline business setup

### Phase 3: Module System

Build:
- module index
- module editor
- module review flow
- module dependency display

Success criteria:
- required modules can be created, reviewed, and approved

### Phase 4: Guardrails And Workflow

Build:
- quality bar
- compliance
- creative rules
- lifecycle map
- approval matrix
- delivery SOPs

Success criteria:
- creator and operator readiness can be evaluated meaningfully

### Phase 5: Readiness Engine

Build:
- readiness scoring service
- readiness dashboard
- blockers and next-step engine
- unlock-state persistence

Success criteria:
- agent-class availability is computed and visible

### Phase 6: Simulation And Activation

Build:
- preview routes
- test-run surfaces
- activation controls
- control center

Success criteria:
- agency can test before activation
- activation is staged and reversible

## Recommended Repo Mapping

Likely frontend areas:

- `src/pages/agency/AgencyAiSetupV2.tsx`
- `src/components/agency-ai-setup-v2/*`
- `src/hooks/useAgencyAiSetupV2.ts`
- `src/lib/agency-ai-setup-v2/*`

Likely backend areas:

- new Supabase migrations for setup status, readiness scores, unlocks, simulations
- readiness evaluation helpers
- optional edge function for readiness recompute and simulation runs

## Acceptance Criteria

The first acceptable version of `Agency AI Setup V2` must allow an agency owner to:

- understand what setup is for
- import existing context
- author and approve core modules
- define quality and approval rules
- see blocked vs available agent classes
- run at least one preview
- activate at least one class in a governed way

## Final Recommendation

Do not treat this as a secondary settings project.

This should be treated as a core product surface because it determines:

- whether agents are trusted
- whether outputs feel generic or expert
- whether activation is safe
- whether agencies believe the product actually learned how they operate

If built well, this becomes the mechanism that turns SMMAHUB from:

- `AI features inside agency software`

into:

- `an agency operating system with a trainable AI employee layer`
