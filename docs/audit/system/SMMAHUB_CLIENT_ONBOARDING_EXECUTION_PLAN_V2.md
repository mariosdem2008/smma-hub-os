# SMMAHUB Client Onboarding Execution Plan V2

Last updated: 2026-03-12  
Owner: Product + AI systems + client workflow  
Status: Execution plan  
Purpose: Convert the onboarding reality-check into a concrete build plan that redesigns the question architecture, separates essential intake from progressive enrichment, and defines the end-to-end implementation path.

## 1) Decision

SMMAHUB should stop treating client onboarding as one long up-front questionnaire.

The new direction is:

1. Use a short essential intake to get the client operationally usable.
2. Separate strategy discovery from operations setup.
3. Collect enrichment data later through guided follow-up, imports, uploads, and live workflow events.
4. Make onboarding the entry point to the client operating system, not the whole value proposition.

## 2) Target Architecture

The onboarding system should have four layers.

### 2.1 Layer A: Auto-draft

Before asking the client much, build a draft profile from:

1. website
2. social links
3. uploaded docs
4. CRM/import data
5. prior notes or call summaries

System behavior:

1. prefill what can be inferred safely
2. mark confidence per field
3. ask for confirmation where confidence is low

### 2.2 Layer B: Essential Intake

This is the minimum information needed to make the client operationally usable for setup, initial strategy, and first execution planning.

This must be short enough to complete in roughly 5-8 minutes.

### 2.3 Layer C: Operations Setup

This is not strategy discovery. It is execution readiness.

It covers:

1. contacts
2. approvals
3. access
4. assets
5. timelines
6. communication expectations

### 2.4 Layer D: Progressive Enrichment

This captures deeper intelligence later through:

1. AI follow-up prompts
2. strategist-led edits
3. monthly review prompts
4. performance-based updates
5. client portal actions

## 3) New Question Architecture

### 3.1 Essential Intake: must-have now

These are the only questions that should block first completion.

#### Section 1: Identity

1. Business name
2. Industry/niche
3. Website or primary social profile
4. Market scope
5. Country/city when locally relevant

#### Section 2: Commercial direction

1. Main offer to prioritize
2. Primary business goal
3. Desired conversion action
4. Main audience
5. Biggest current constraint

#### Section 3: Operating ownership

1. Primary client contact
2. Main approver
3. Preferred communication channel
4. Target launch window or urgency

#### Section 4: Initial execution reality

1. Active channels/platforms
2. Available assets right now
3. Known missing access or missing assets

### 3.2 Operations Setup: required before real execution, but not first-screen blocking

These should be completed immediately after essential intake, inside a dedicated setup workflow.

#### Contacts and approvals

1. Secondary contact
2. Approval SLA
3. Escalation contact
4. Who can approve ads/content/offers

#### Access readiness

1. Website/CMS access
2. Ad account access
3. Analytics access
4. Social account access
5. Asset repository/source-of-truth

#### Delivery constraints

1. Launch deadline
2. seasonal windows
3. compliance or claim restrictions
4. internal team bandwidth on client side
5. meeting cadence expectation

### 3.3 Progressive Enrichment: collect later

These are valuable, but should not all be asked in first-session intake.

#### Strategy depth

1. detailed brand voice
2. detailed content style
3. nuanced objections
4. differentiators
5. competitor set
6. proof level and proof points
7. business model details
8. sales cycle details

#### Commercial depth

1. budget range
2. CAC expectations
3. revenue target
4. lead quality threshold
5. offer hierarchy

#### Historical intelligence

1. what has already been tried
2. what failed
3. best-performing channels
4. worst-performing channels
5. prior agency frustrations

## 4) Recommended Split of Current Fields

### 4.1 Keep in essential intake

From the current system, keep these up front:

1. `q1_business_name`
2. `industry_niche`
3. `q2_website`
4. `q2_social_links`
5. `q3_market_scope`
6. `q3_country`
7. `q3_city`
8. `primary_goal`
9. `conversion_path`
10. `conversion_link`
11. `dm_keyword`
12. `q6_offer_name` or top offer from `offers`
13. `primary_customer`
14. `platforms`
15. `available_assets`

### 4.2 Move to guided recommendation or enrichment

Do not force these as first-session client questions unless context is missing:

1. `brand_voice`
2. `content_style`
3. `main_objection`
4. `q9_pain_points`
5. `proof_types`
6. `q13_differentiators`
7. `formats`
8. `cadence_preset`
9. `cadence_per_platform`
10. `response_handling`

### 4.3 Add missing operating fields

New fields or equivalent structures should be added for:

1. `primary_contact_name`
2. `primary_contact_role`
3. `primary_contact_email`
4. `main_approver_name`
5. `main_approver_role`
6. `approval_sla`
7. `preferred_comms_channel`
8. `launch_window`
9. `escalation_contact`
10. `required_access_status`
11. `missing_assets`
12. `compliance_notes`
13. `client_capacity_notes`

## 5) Product Flow Redesign

### Stage 0: Draft build

Entry routes:

1. agency creates client
2. system asks for website/social/docs
3. system drafts a profile before full intake starts

Exit condition:

1. draft profile exists
2. confidence markers exist

### Stage 1: Essential intake

Experience:

1. short guided chat or compact wizard
2. confirm/correct drafted facts
3. capture only what is needed now

Exit condition:

1. client becomes "setup-usable"
2. strategy can begin in draft mode

### Stage 2: Operations setup

Experience:

1. checklist-style workflow
2. owners, due states, missing items
3. separate from discovery language

Exit condition:

1. client becomes "execution-ready"

### Stage 3: Strategy enrichment

Experience:

1. AI asks targeted follow-ups only where gaps matter
2. strategist can refine outputs from within client detail

Exit condition:

1. strategy quality is materially improved without first-session overload

### Stage 4: Ongoing memory updates

Experience:

1. monthly prompts
2. drift detection
3. context updates after launches, new offers, or changing goals

Exit condition:

1. the client brain stays current instead of decaying after onboarding

## 6) Execution Plan

### Phase 1: Architecture and contract design

Goal:

1. define the new information model before changing UI

Tasks:

1. classify all current fields as `essential`, `operations_setup`, or `enrichment`
2. define new operating-context fields
3. define new readiness states:
   - `draft_started`
   - `setup_usable`
   - `execution_ready`
   - `strategy_enriched`
4. define confidence metadata for auto-drafted fields
5. update audit docs and storage map

Deliverables:

1. revised field map
2. readiness-state contract
3. gap list for schema additions

### Phase 2: Data model and backend readiness

Goal:

1. support the new staged model without breaking current onboarding

Tasks:

1. extend profile/storage for operating-context fields
2. add separate readiness computation for:
   - essential intake
   - operations setup
   - enrichment completeness
3. add metadata for source and confidence:
   - `manual`
   - `imported`
   - `inferred`
   - `recommended`
4. ensure strategy generation only depends on the correct minimum set
5. ensure execution workflows depend on operations readiness

Deliverables:

1. schema/migrations
2. updated progress logic
3. backend validators

### Phase 3: Essential intake experience

Goal:

1. replace the current long flow with a short first-session intake

Tasks:

1. redesign the chat/wizard sequence around essentials only
2. ask confirm-or-correct questions for draftable fields
3. reduce strategic jargon in client-facing questions
4. provide AI recommendations for ambiguous concepts instead of forcing expert answers
5. add a visible promise:
   - "This first step gets your workspace ready"

Deliverables:

1. new essential intake UI
2. revised assistant copy
3. revised blocking rules

### Phase 4: Operations setup workflow

Goal:

1. separate execution readiness from discovery

Tasks:

1. create a dedicated setup checklist surface
2. track missing access, missing assets, and approval roles
3. allow owner/team/client assignment per item
4. surface setup readiness inside client detail
5. add reminders and status badges

Deliverables:

1. operations setup UI
2. setup checklist state machine
3. client detail readiness panel

### Phase 5: Progressive enrichment system

Goal:

1. capture deeper intelligence without first-session friction

Tasks:

1. build AI follow-up prompts triggered by missing strategic depth
2. add "improve client profile" prompts inside strategy and client detail
3. collect enrichment from portal interactions, uploads, and reviews
4. add drift flags when context becomes stale

Deliverables:

1. enrichment queue
2. follow-up prompt engine
3. drift detection rules

### Phase 6: Rollout and proof

Goal:

1. validate that the redesign improves real-world usability

Tasks:

1. measure completion rate
2. measure time to first usable state
3. measure time to execution-ready state
4. compare drop-off before/after redesign
5. capture agency feedback on usefulness of added operating fields

Deliverables:

1. canary rollout report
2. onboarding KPI dashboard
3. go/no-go launch decision

## 7) Detailed Build Order

Build in this order:

1. field classification and readiness-state spec
2. profile/storage updates
3. progress logic updates
4. essential-intake copy and question rewrite
5. essential-intake UI flow
6. operations setup workflow
7. client detail readiness surfaces
8. progressive enrichment queue
9. telemetry and audit scoring

## 8) Concrete Essential Intake Questions

These are the recommended first-session questions in plain language.

1. What is the business name?
2. What does the business sell or help people with?
3. What is the website or main social page?
4. Which market are you targeting right now?
5. What is the main offer we should prioritize first?
6. What is the main result you want from marketing right now?
7. What should people do when they are ready: book, message, call, buy, or something else?
8. Who is the main type of customer you want more of?
9. What is the biggest thing slowing growth right now?
10. Who will be our main contact?
11. Who should approve content or campaign decisions?
12. Is there a launch date or urgent deadline we should plan around?
13. Which channels are already active?
14. What assets do you already have ready to use?
15. What access or assets are still missing?

## 9) Concrete Enrichment Questions

These should be asked later, only if relevant.

1. How should the brand feel in writing and visuals?
2. What objections stop good-fit buyers from moving forward?
3. What proof matters most to your buyers?
4. What makes you meaningfully different from competitors?
5. What competitors do prospects compare you against?
6. What has already been tested that you do not want repeated?
7. What claims or messages need extra approval?
8. What revenue or lead-quality outcome would make this engagement a success?

## 10) Acceptance Criteria

The redesign is successful only if all of this becomes true:

1. first-session intake is materially shorter than the current flow
2. clients can complete essential intake without needing marketing expertise
3. the profile becomes usable before the full strategic profile is complete
4. operations readiness is tracked separately and clearly
5. strategy quality improves through follow-up enrichment, not first-session overload
6. agencies feel the system captures more real operating context, not just nicer branding language

## 11) Success Metrics

Track these metrics before full rollout:

1. essential-intake completion rate
2. median time to essential completion
3. median time to execution-ready status
4. drop-off rate per step
5. percent of fields auto-drafted vs manually entered
6. percent of strategy sessions needing manual clarification
7. agency satisfaction with operating-context capture

## 12) Immediate Next Implementation Backlog

### P0

1. create a new field classification matrix from the current contract
2. define and add missing operating-context fields
3. redesign readiness logic into staged states
4. rewrite the client-facing intake questions in plain business language

### P1

1. ship essential-intake-only v2 flow
2. move strategy-heavy prompts into enrichment
3. create operations setup checklist UI

### P2

1. add auto-draft/import pipeline
2. add enrichment prompt engine
3. add telemetry and KPI dashboards

## 13) Bottom Line

The redesign should not aim to make the current long onboarding prettier.

It should aim to make onboarding:

1. shorter at the start
2. more operationally useful
3. easier for real clients to answer
4. better connected to ongoing delivery

That is the path that best aligns onboarding with the product vision in [SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_CLIENT_ONBOARDING_DIRECTION_REALITY_CHECK.md) and [SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_AGENCY_OS_MASTER_STRATEGY_AND_PRODUCTION_READINESS.md).
