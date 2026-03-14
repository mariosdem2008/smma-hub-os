# SMMAHUB Agency AI Setup V2 UX And Readiness Blueprint

## Purpose

This document defines the product workflow for `Agency AI Setup V2`.

Its job is to answer four things clearly:

1. What the agency setup experience should feel like end to end
2. What screens and stages should exist
3. How readiness should be scored and how agent unlocks should work
4. What "expert-quality ready" means for each agent class

This is the missing product layer between:

- the strategic architecture in [SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENTIC_OPERATING_MODEL_AND_STRATEGY_ENGINE_V2_PLAN.md)
- the implementation structure in [SMMAHUB_AGENCY_AI_SETUP_V2_AND_STRATEGY_ENGINE_V2_IMPLEMENTATION_BLUEPRINT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_AI_SETUP_V2_AND_STRATEGY_ENGINE_V2_IMPLEMENTATION_BLUEPRINT.md)
- the Phase 1 contracts in [SMMAHUB_PHASE_1_EXECUTION_SPEC_AI_SETUP_V2_AND_STRATEGY_ENGINE_V2.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_PHASE_1_EXECUTION_SPEC_AI_SETUP_V2_AND_STRATEGY_ENGINE_V2.md)

Core decision:

- `Agency AI Setup V2` must not be a long settings form.
- It must be a staged operating-system setup flow that collects, structures, evaluates, and approves the exact context agents need to work like trusted specialists.

## Product Position

The setup experience should communicate one message:

`You are not configuring a chatbot. You are teaching your AI team how your agency operates.`

The agency owner should feel that setup is doing four things:

1. Importing what already exists
2. Turning agency knowledge into reusable operating modules
3. Establishing quality, approval, and compliance rules
4. Unlocking agent capabilities progressively as readiness becomes real

This means the setup UX should optimize for:

- speed to first value
- high-confidence configuration
- visible readiness
- explicit approvals
- low ambiguity about what is still missing

It should not optimize for:

- putting everything into one wizard
- forcing owners to write lots of freeform text at once
- pretending agents are ready before process rules are actually defined

## Setup Philosophy

The setup flow should follow this rule:

`Import first, structure second, review third, unlock fourth.`

That means setup should be staged like this:

1. `Connect And Import`
2. `Agency Foundations`
3. `Operating Modules`
4. `Quality And Guardrails`
5. `Workflow And Approvals`
6. `Agent Readiness Review`
7. `Controlled Activation`

## Experience Goals

The UX should make the owner feel:

- "I understand what the AI knows."
- "I understand what the AI is still missing."
- "I know which agents are safe to use."
- "I can approve or tighten the system before it acts."
- "This is becoming an employee that follows our way of working."

The UX should avoid these failure modes:

- hidden assumptions
- generic setup language
- no distinction between draft knowledge and approved knowledge
- no visibility into agent capability boundaries
- agents appearing globally available before readiness is real

## Setup Journey

### Stage 0: Entry And Framing

#### Screen 0.1: AI Setup Landing

Goal:
- explain what AI Setup V2 actually does

Content:
- headline: `Train Your Agency AI Team`
- subtext: `Import your context, define how your agency works, approve guardrails, and unlock specialist agents step by step.`
- three cards:
  - `Import context`
  - `Define playbooks`
  - `Unlock agents`
- CTA: `Start AI Setup`
- secondary CTA: `See what agents need`

#### Screen 0.2: Current Readiness Snapshot

Goal:
- show the owner what already exists in the workspace

Show:
- imported data sources found
- approved brain documents found
- client count
- workflow systems found
- missing critical setup areas

Outputs:
- `starting readiness summary`
- `recommended setup path`

### Stage 1: Connect And Import

#### Screen 1.1: Source Import Hub

Goal:
- pull existing agency knowledge into the system before asking the owner to re-enter it

Sources:
- approved `brain_documents`
- uploaded SOPs and docs
- strategy documents
- approval rules already present in workspace
- existing tasks/checklists/events
- optional external docs or URLs later

UX:
- each source appears as a card with status:
  - `available`
  - `imported`
  - `needs review`
  - `not connected`

Primary action:
- `Import available context`

Secondary actions:
- `Upload documents`
- `Skip for now`

#### Screen 1.2: Imported Context Review

Goal:
- show what the system extracted and where confidence is low

Sections:
- agency identity
- services and offers
- workflow steps
- approvals
- quality and compliance

Each extracted item should show:
- source
- extracted summary
- confidence
- `accept`
- `edit`
- `ignore`

### Stage 2: Agency Foundations

#### Screen 2.1: Agency Identity

Capture:
- who the agency serves
- what type of outcomes it sells
- what its positioning is
- what it does not do

Fields:
- agency summary
- niche focus
- service model
- market position
- non-negotiable positioning boundaries

#### Screen 2.2: Service Catalog And Offer Strategy

Capture:
- primary services
- primary and secondary offers
- offer priorities
- typical client fit
- commercial constraints

This screen should not be a blank form.
It should use:
- imported suggestions
- examples
- anti-pattern prompts

#### Screen 2.3: ICP And Segment Model

Capture:
- client types the agency is actually built to serve
- per-segment pain points
- per-segment jobs to be done
- typical objections
- what segments should be deprioritized

### Stage 3: Operating Modules

This is the core of `AI Setup V2`.

Each module should be authored and reviewed in the same structure:

- definition
- rules
- examples
- anti-patterns
- edge cases
- downstream usage
- evidence sources
- confidence
- approval state

#### Screen 3.1: Module Workspace

List modules:
- `agency_identity`
- `service_catalog`
- `offer_strategy`
- `icp_segments`
- `channel_playbooks`
- `content_frameworks`
- `creative_rules`
- `claims_compliance`
- `quality_bar`
- `approval_matrix`
- `delivery_sops`
- `reporting_kpis`
- `retention_expansion_playbooks`
- `escalation_rules`

Each module card shows:
- completion percent
- confidence level
- approval status
- which agents depend on it

#### Screen 3.2: Module Editor

Purpose:
- edit one operating module deeply

Layout:
- left rail: module structure sections
- main panel: fields + examples + review notes
- right panel:
  - source evidence
  - affected agents
  - readiness impact

Each module should support:
- AI-assisted extraction from imports
- manual editing
- side-by-side source comparison
- preview of downstream usage

### Stage 4: Quality And Guardrails

#### Screen 4.1: Quality Bar

Define:
- what high-quality output means for this agency
- what generic output looks like
- what should always fail review

Fields:
- must-have quality traits
- unacceptable traits
- evidence standards
- tone constraints
- specificity requirements

#### Screen 4.2: Compliance And Claims

Define:
- risky claims
- forbidden phrasing
- required disclaimers
- regulated-market rules

This is where the agency sets:
- what agents may say
- what always needs approval
- what is blocked entirely

#### Screen 4.3: Brand And Creative Rules

Define:
- messaging style
- approved phrasing
- banned phrasing
- content style rules
- creative constraints

### Stage 5: Workflow And Approvals

#### Screen 5.1: Workflow Lifecycle Map

Map the actual operating pipeline:

- `lead`
- `qualified`
- `scoped`
- `proposal_sent`
- `won`
- `onboarding_essential`
- `onboarding_operations`
- `setup_ready`
- `strategy_readiness_review`
- `strategy_diagnosis`
- `strategy_in_review`
- `strategy_approved`
- `production_active`
- `approvals_pending`
- `reporting_due`
- `at_risk`
- `renewal_window`
- `paused_or_offboarded`

The owner should define:
- entry conditions
- exit conditions
- owner role
- required approvals
- blocked actions

#### Screen 5.2: Approval Matrix

Configure:
- who can approve what
- what must always be reviewed
- which agent actions are auto-allowed
- which require explicit signoff

Approval classes:
- strategy recommendation
- strategy plan
- creator brief
- content output
- client-facing messages
- workflow changes

#### Screen 5.3: Delivery SOPs And Escalation

Capture:
- production handoffs
- revision rules
- escalation conditions
- risk escalation owners

### Stage 6: Readiness Review

#### Screen 6.1: AI Readiness Dashboard

This is the critical screen.

It should answer:

- what is complete
- what is approved
- what is still weak
- which agents are unlocked
- which agents are blocked
- why

The dashboard should show readiness by domain:

- context completeness
- process completeness
- approval completeness
- quality rules completeness
- compliance completeness
- evidence completeness

It should also show readiness by agent class:

- strategist
- creator
- operator
- analyst
- client-facing assistant

#### Screen 6.2: Simulation And Preview

Before activation, let the owner test:

- strategy diagnosis preview
- strategy recommendation preview
- creator brief preview
- content output preview

Each preview should show:
- what sources were used
- what modules influenced the output
- missing context
- whether the output passes quality checks

### Stage 7: Controlled Activation

#### Screen 7.1: Activation Settings

Owner chooses:
- activate only strategist agents
- activate strategist + creator
- activate internal-only actions first
- activate client-facing actions later

#### Screen 7.2: Post-Activation Control Center

After launch, the owner should see:

- current agent status
- blocked agents
- newly detected gaps
- drift alerts
- modules needing refresh
- most recent approvals

## Readiness Model

Readiness must be explicit and multi-dimensional.

Do not use one vague score.

Use six readiness dimensions:

1. `Knowledge Coverage`
2. `Process Definition`
3. `Quality Definition`
4. `Compliance Safety`
5. `Approval Governance`
6. `Evidence Strength`

Each dimension is scored `0-100`.

Also maintain:

- `module readiness`
- `stage readiness`
- `agent-class readiness`

## Readiness Scoring

### 1. Knowledge Coverage

Measures whether the agency has actually defined its business and playbooks.

Inputs:
- approved module count
- required field coverage inside modules
- example coverage
- edge case coverage

Interpretation:
- below `50`: weak foundation
- `50-74`: partially usable
- `75-89`: strong
- `90+`: expert-grounded

### 2. Process Definition

Measures whether workflow stages, owners, and SOPs are real.

Inputs:
- lifecycle map completeness
- delivery SOP completeness
- escalation rules
- ownership mapping

### 3. Quality Definition

Measures whether the system knows what “good” means.

Inputs:
- quality bar module completeness
- examples of good vs bad outputs
- evaluation rules present
- role-specific quality standards

### 4. Compliance Safety

Measures whether risky output is controlled.

Inputs:
- claims compliance module
- banned phrasing
- required disclaimers
- regulated-industry flags
- approval rules for risky outputs

### 5. Approval Governance

Measures whether agent outputs and actions are governed.

Inputs:
- approval matrix coverage
- artifact approval stages defined
- role ownership
- blocked action rules

### 6. Evidence Strength

Measures whether the modules are grounded in real source material.

Inputs:
- source-linked module records
- approved evidence documents
- example density
- proof-backed rules

## Unlock Logic

Agent availability must be capability-gated, not globally enabled.

### Global Rules

No agent should be fully unlocked unless:

- required modules exist
- required modules are approved
- required dimension thresholds are met
- any critical blockers are zero

### Unlock States

Each agent class should have one of four states:

- `blocked`
- `preview_only`
- `internal_assist_only`
- `operational`

### Blocking Rules

Blocked if any are true:

- missing critical required modules
- approval matrix incomplete
- compliance safety below threshold for that agent class
- quality definition below threshold

### Preview Only

Allowed when:

- setup is partially complete
- output can be shown but not acted on
- owner can review examples but not deploy them

### Internal Assist Only

Allowed when:

- outputs are good enough for team assistance
- system may draft but not publish or message externally

### Operational

Allowed when:

- all required thresholds are met
- no critical blockers remain
- approvals are in place

## Expert-Quality Ready By Agent Class

### 1. Strategy Agents

Includes:
- `strategy_readiness_agent`
- `diagnosis_agent`
- `strategy_architect_agent`

Required modules:
- agency_identity
- service_catalog
- offer_strategy
- icp_segments
- channel_playbooks
- quality_bar
- approval_matrix

Minimum readiness:
- Knowledge Coverage `>= 75`
- Process Definition `>= 60`
- Quality Definition `>= 75`
- Compliance Safety `>= 60`
- Approval Governance `>= 75`
- Evidence Strength `>= 65`

Expert-quality ready means:
- strategy recommendations are clearly grounded in the agency’s actual offer model
- strategy does not sound generic
- tradeoffs are explicit
- missing context is surfaced rather than hallucinated
- output would help a strategist work faster without redoing everything

### 2. Creator Agents

Includes:
- creator brief generation
- captions
- scripts
- hooks
- content ideation

Required modules:
- content_frameworks
- creative_rules
- quality_bar
- claims_compliance
- approval_matrix
- channel_playbooks

Minimum readiness:
- Knowledge Coverage `>= 70`
- Process Definition `>= 55`
- Quality Definition `>= 80`
- Compliance Safety `>= 80`
- Approval Governance `>= 75`
- Evidence Strength `>= 60`

Expert-quality ready means:
- content sounds brand-true and offer-aware
- messaging follows approved phrasing and avoids banned claims
- output respects platform/channel purpose
- content uses strategic direction, not random brand context
- drafts are usable with light editing rather than full rewrites

### 3. Operator Agents

Includes:
- task breakdown
- workflow routing
- approval orchestration
- client input requests
- timeline scheduling

Required modules:
- delivery_sops
- approval_matrix
- escalation_rules
- reporting_kpis
- quality_bar

Minimum readiness:
- Knowledge Coverage `>= 60`
- Process Definition `>= 85`
- Quality Definition `>= 65`
- Compliance Safety `>= 60`
- Approval Governance `>= 85`
- Evidence Strength `>= 55`

Expert-quality ready means:
- agents route work in a way the team recognizes as correct
- tasks, dependencies, and approvals reflect real operating practice
- system reduces PM overhead rather than creating cleanup work

### 4. Analyst Agents

Includes:
- report synthesis
- trend interpretation
- KPI commentary
- drift detection

Required modules:
- reporting_kpis
- quality_bar
- claims_compliance
- retention_expansion_playbooks

Minimum readiness:
- Knowledge Coverage `>= 60`
- Process Definition `>= 55`
- Quality Definition `>= 75`
- Compliance Safety `>= 70`
- Approval Governance `>= 65`
- Evidence Strength `>= 70`

Expert-quality ready means:
- analysis uses the agency’s own KPI lens
- commentary is specific and commercially useful
- the system distinguishes signal from noise
- recommendations are realistic and action-oriented

### 5. Client-Facing Assistant Agents

Includes:
- client portal Q&A
- client-facing status explanations
- client information requests

Required modules:
- agency_identity
- approval_matrix
- claims_compliance
- escalation_rules
- quality_bar

Minimum readiness:
- Knowledge Coverage `>= 65`
- Process Definition `>= 70`
- Quality Definition `>= 80`
- Compliance Safety `>= 85`
- Approval Governance `>= 90`
- Evidence Strength `>= 60`

Expert-quality ready means:
- communication is safe, clear, and aligned to policy
- assistant never over-promises
- assistant knows when to answer, when to ask, and when to escalate
- the agency trusts it with real client-facing interactions

## Readiness Labels

For user experience, avoid only showing numbers.

Use visible labels:

- `Not Ready`
- `Needs Definition`
- `Draft Usable`
- `Operational With Review`
- `Expert-Quality Ready`

Definition:

- `Not Ready`: major required modules missing
- `Needs Definition`: structure exists but critical gaps remain
- `Draft Usable`: preview or internal assist only
- `Operational With Review`: usable with approval gates
- `Expert-Quality Ready`: safe and strong enough for routine trusted use

## Critical UX Components

### 1. Source Confidence

Every imported rule or module item should show:
- where it came from
- how confident the system is
- whether it is approved

### 2. Readiness Explanations

Every blocked agent should explain:
- what is missing
- why it matters
- what to do next

### 3. Progressive Completion

Do not require all modules before any value exists.

Allow:
- strategist preview earlier
- creator preview after brand/quality/claims are defined
- operator activation only after workflow/approval rules are mature

### 4. Approval Visibility

The owner should always know:
- what is draft
- what is approved
- what changed
- what needs re-review after edits

### 5. Simulation Before Activation

Every agent class should have a preview test before being activated.

## Recommended Product Metrics

Track:

- time to first usable setup
- time to strategist preview readiness
- time to creator readiness
- number of approved modules
- average module confidence
- percent of imported vs manually authored rules
- number of blocked actions prevented by readiness gates
- agent usage after activation
- human revision rate by agent class

## Hard Product Decisions

### Keep

- modular V2 architecture
- explicit approval layers
- staged readiness
- strategy artifacts and downstream publication pattern

### Replace

- generic AI setup flow
- one-pass setup assumptions
- vague “brain usable” logic as the main readiness truth
- hidden agent availability

### Do Not Build

- one giant wizard with dozens of freeform questions
- global AI toggle with no capability gating
- agent activation without explicit module approval

## Recommended Implementation Order

### Phase A: Blueprint To Product Structure

Build:
- AI Setup landing
- readiness snapshot
- module workspace shell
- readiness dashboard shell

### Phase B: Core Setup Flow

Build:
- import hub
- imported context review
- agency foundations screens
- module editor for first critical modules

Critical first modules:
- agency_identity
- service_catalog
- offer_strategy
- quality_bar
- claims_compliance
- approval_matrix

### Phase C: Readiness And Unlocking

Build:
- readiness scoring engine
- agent-class unlock states
- blocked-state explanations
- preview-only mode

### Phase D: Simulation And Activation

Build:
- strategy preview
- creator preview
- activation controls
- post-activation control center

## Final Recommendation

This setup experience should become one of the product’s defining advantages.

If done correctly, agencies will feel:

- the system understands how they work
- the AI is not generic
- the product respects operational reality
- activation is earned, not faked

That is the correct foundation for the broader vision:

`SMMAHUB becomes an agency operating system with an AI employee layer that is governed, specialist, and actually trusted.`
