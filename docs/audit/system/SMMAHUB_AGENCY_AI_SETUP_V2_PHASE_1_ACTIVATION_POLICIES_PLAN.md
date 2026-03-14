# SMMAHUB Agency AI Setup V2 Phase 1 Activation Policies Plan

Last updated: 2026-03-14
Owner: Product systems + AI platform
Status: In implementation

## Goal

Turn `Agency AI Setup V2` from a simple unlock-and-activate surface into a governed rollout system that can control how each agent class is allowed to operate across the app.

## Why This Is Next

The current system already does:

1. readiness scoring
2. unlock-state derivation
3. blocked-case enforcement for strategy and creator flows

But it still treats activation too simply:

1. agent classes are either activated or not
2. there is no first-class distinction between preview, assist-only, and operational rollout
3. the app cannot yet express "this agent may assist internally, but may not operate at full authority"

That gap weakens the product promise of governed AI employees.

## Phase 1 Scope

Phase 1 should deliver four concrete outcomes:

1. store activation mode and policy on each agent unlock record
2. define the canonical capability model for each activation mode
3. let agencies activate an agent class into an allowed mode, not just on/off
4. enforce minimum required activation mode in the first critical AI workflows

## Activation Modes

### `preview_only`

Purpose:

1. agencies can inspect simulations, previews, and dry runs
2. no production-grade or write-heavy workflow should run

Allowed behavior:

1. simulation
2. draft previews
3. internal inspection

Blocked behavior:

1. strategy publication
2. creator output generation used in live workflow
3. task or workflow mutations
4. client-facing actions

### `internal_assist_only`

Purpose:

1. agencies can use the agent to assist the team internally
2. agent can generate drafts used by humans, but not act with external autonomy

Allowed behavior:

1. strategy generation for internal team review
2. creator draft generation
3. internal planning assistance
4. analyst commentary for team use

Blocked behavior:

1. client-facing responses
2. autonomous approval or publish steps
3. externalized workflow actions without human review

### `operational`

Purpose:

1. the agent class is fully activated for governed production use

Allowed behavior:

1. all behavior allowed by lower modes
2. governed live workflow participation
3. production-side assistance where approvals and policies permit

## Capability Model

Capabilities should be defined as policy names rather than inferred ad hoc:

1. `run_simulations`
2. `render_previews`
3. `generate_internal_drafts`
4. `write_internal_artifacts`
5. `generate_production_outputs`
6. `participate_in_live_workflow`
7. `client_visible_actions`

Mode mapping:

1. `preview_only`
   - `run_simulations`
   - `render_previews`
2. `internal_assist_only`
   - all preview capabilities
   - `generate_internal_drafts`
   - `write_internal_artifacts`
3. `operational`
   - all internal-assist capabilities
   - `generate_production_outputs`
   - `participate_in_live_workflow`
   - `client_visible_actions` only where a specific workflow allows it

## Phase 1 Product Changes

### Activation UI

The activation page must:

1. show the maximum allowed mode derived from readiness
2. let the agency choose a current activation mode up to that maximum
3. show what each mode allows
4. persist mode-specific rollout notes or restrictions

### Readiness Review

The readiness page must:

1. explain why an agent class only qualifies for preview or assist mode
2. show what blocks the next mode

### Control Center

The control center must:

1. show current activation mode
2. show allowed capabilities
3. use that mode in simulations

## Phase 1 Backend Changes

### Persistence

Extend `agency_agent_unlocks_v2` with:

1. `activation_mode`
2. `activation_policy_json`

### Enforcement

The shared agency setup edge helper must:

1. accept `requiredMode`
2. compare required mode against current activated mode
3. return `AGENT_ACTIVATION_REQUIRED` when the mode is insufficient
4. point the user to readiness preview when the unlock state itself is too weak
5. point the user to activation when the unlock state is sufficient but the current activated mode is too low

## Phase 1 Workflow Enforcement

Initial minimum-mode enforcement:

1. `ai-strategy-generate`
   - requires `internal_assist_only`
2. `generate-ai-content`
   - requires `internal_assist_only`

This is intentional:

1. both are internal team workflows today
2. neither should run under `preview_only`
3. neither should require full `operational` mode yet

## Phase 1 Acceptance Criteria

1. agencies can activate each agent class into a specific mode
2. UI clearly shows max mode and current mode
3. strategy generation is blocked in `preview_only`
4. content generation is blocked in `preview_only`
5. strategy generation succeeds gating when the class is at least `internal_assist_only`
6. content generation succeeds gating when the class is at least `internal_assist_only`
7. simulations include current activation mode in their snapshots

## Phase 1 Test Plan

1. readiness derivation still returns valid unlock states
2. activation policy helper enforces mode ordering correctly
3. strategy/content edge integration tests assert `requiredMode` use
4. activation UI renders mode controls and capability copy

## Phase 2 After This

1. richer simulation scoring and scenario packs
2. governance rollout across more AI surfaces
3. stronger activation-policy schema and audit history
