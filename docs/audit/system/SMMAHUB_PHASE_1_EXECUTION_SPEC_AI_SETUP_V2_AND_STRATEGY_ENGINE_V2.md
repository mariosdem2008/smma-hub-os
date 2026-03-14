# SMMAHUB Phase 1 Execution Spec: Agency AI Setup V2 and Strategy Engine V2

Last updated: 2026-03-13
Owner: Product strategy + AI systems
Status: Phase 1 execution spec
Purpose: Define the exact Phase 1 schema, JSON contracts, and first agent contracts required to start the rebuild of Agency AI Setup V2 and Strategy Engine V2.

## 1. Direct Answer: Keep or Replace `strategy_modules` and `strategy_documents`?

Short answer:

1. keep them
2. do not reinvent them from zero
3. stop treating them as the main reasoning layer

That is the right architectural decision.

### 1.1 Why they should be kept

`strategy_modules` and `strategy_documents` already provide:

1. durable product surfaces
2. working UI integration
3. versioning behavior already tied to the client workspace
4. audit and editing continuity
5. a usable place to land final approved strategy outputs

They are not the main problem.

The problem is that the current system tries to use them as both:

1. the reasoning pipeline
2. the final presentation layer

That is the wrong abstraction.

### 1.2 What they should become in V2

In V2:

1. `strategy_modules` should become derived execution-facing strategy outputs
2. `strategy_documents` should become the readable approved strategy document layer
3. both should be populated from V2 strategy artifacts, not directly from a one-shot prompt

### 1.3 What should be built instead of replacing them

Build new V2 tables for:

1. agency operating modules
2. client operating briefs
3. strategy artifacts
4. artifact approvals
5. agent runs
6. artifact evaluations

Those become the reasoning and orchestration layer.

`strategy_modules` and `strategy_documents` remain the downstream product output layer.

### 1.4 Hard recommendation

Do not:

1. rewrite `strategy_modules` and `strategy_documents` first
2. break current strategy UI before V2 exists
3. force the entire product to migrate to brand new strategy tables before V2 is proven

Do:

1. preserve them as compatibility and delivery surfaces
2. let V2 artifacts feed them
3. replace the logic above them, not the surfaces first

## 2. Phase 1 Scope

Phase 1 should define and ship the foundational V2 contracts only.

This phase includes:

1. exact DB schema for V2 foundation tables
2. exact JSON contracts for agency modules, client brief, and strategy artifacts
3. exact contracts for the first three V2 agents:
   - `strategy_readiness_agent`
   - `diagnosis_agent`
   - `strategy_architect_agent`

This phase does not yet include:

1. creator agents
2. plan-conversion agents
3. full UI rebuild
4. cutover from legacy strategy generation

## 3. Exact DB Schema for V2 Tables

Recommended initial V2 tables:

1. `agency_operating_modules_v2`
2. `client_operating_briefs_v2`
3. `strategy_artifacts_v2`
4. `strategy_artifact_approvals_v2`
5. `agent_runs_v2`
6. `artifact_evaluations_v2`

These tables are intentionally additive.

They should not replace current product tables in Phase 1.

### 3.1 SQL: shared enums

```sql
do $$ begin
  create type public.v2_module_status as enum (
    'draft',
    'review',
    'approved',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_readiness_state as enum (
    'insufficient',
    'diagnosis_ready',
    'strategy_ready_with_caveats',
    'strategy_ready',
    'execution_ready'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_artifact_type as enum (
    'strategy_readiness_audit',
    'strategy_diagnosis',
    'strategy_recommendation',
    'strategy_plan_v2',
    'creator_brief',
    'strategy_reconciliation'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_artifact_status as enum (
    'draft',
    'review',
    'approved',
    'rejected',
    'superseded',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_agent_run_status as enum (
    'started',
    'completed',
    'failed',
    'blocked',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.v2_evaluation_result as enum (
    'pass',
    'warn',
    'fail'
  );
exception
  when duplicate_object then null;
end $$;
```

### 3.2 SQL: `agency_operating_modules_v2`

```sql
create table if not exists public.agency_operating_modules_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  source_document_id uuid references public.brain_documents(id) on delete set null,
  module_key text not null,
  version integer not null default 1,
  status public.v2_module_status not null default 'draft',
  approval_owner_user_id uuid references auth.users(id),
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  content_json jsonb not null default '{}'::jsonb,
  derived_snapshot_json jsonb not null default '{}'::jsonb,
  confidence integer,
  evidence_sources jsonb not null default '[]'::jsonb,
  last_reviewed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, module_key, version)
);

create index if not exists idx_agency_operating_modules_v2_agency_status
  on public.agency_operating_modules_v2 (agency_id, status, updated_at desc);

create index if not exists idx_agency_operating_modules_v2_agency_module
  on public.agency_operating_modules_v2 (agency_id, module_key, version desc);
```

### 3.3 SQL: `client_operating_briefs_v2`

```sql
create table if not exists public.client_operating_briefs_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null default 1,
  readiness_state public.v2_readiness_state not null default 'insufficient',
  status text not null default 'draft' check (status in ('draft', 'review', 'approved', 'superseded')),
  source_onboarding_profile_id uuid references public.client_onboarding_profiles(id) on delete set null,
  source_client_brain_id uuid references public.client_brains(id) on delete set null,
  source_operations_setup_id uuid references public.client_operations_setup(id) on delete set null,
  content_json jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  confidence integer,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, version)
);

create index if not exists idx_client_operating_briefs_v2_client_state
  on public.client_operating_briefs_v2 (client_id, readiness_state, updated_at desc);
```

### 3.4 SQL: `strategy_artifacts_v2`

```sql
create table if not exists public.strategy_artifacts_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  artifact_type public.v2_artifact_type not null,
  version integer not null default 1,
  status public.v2_artifact_status not null default 'draft',
  source_brief_id uuid references public.client_operating_briefs_v2(id) on delete set null,
  source_agency_module_version_map jsonb not null default '{}'::jsonb,
  supersedes_artifact_id uuid references public.strategy_artifacts_v2(id) on delete set null,
  content_json jsonb not null default '{}'::jsonb,
  markdown text,
  citations jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  confidence integer,
  generated_by_run_id uuid,
  approved_by_user_id uuid references auth.users(id),
  approved_at timestamptz,
  published_to_strategy_id uuid references public.strategies(id) on delete set null,
  published_to_document_id uuid references public.strategy_documents(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_strategy_artifacts_v2_client_type_version
  on public.strategy_artifacts_v2 (client_id, artifact_type, version desc);

create index if not exists idx_strategy_artifacts_v2_client_status
  on public.strategy_artifacts_v2 (client_id, status, updated_at desc);
```

### 3.5 SQL: `strategy_artifact_approvals_v2`

```sql
create table if not exists public.strategy_artifact_approvals_v2 (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.strategy_artifacts_v2(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  approval_stage text not null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested')),
  note text,
  actor_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_strategy_artifact_approvals_v2_artifact
  on public.strategy_artifact_approvals_v2 (artifact_id, created_at desc);
```

### 3.6 SQL: `agent_runs_v2`

```sql
create table if not exists public.agent_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  agent_key text not null,
  run_status public.v2_agent_run_status not null default 'started',
  lifecycle_state text,
  input_refs jsonb not null default '{}'::jsonb,
  output_artifact_id uuid references public.strategy_artifacts_v2(id) on delete set null,
  model text,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(12, 6),
  duration_ms integer,
  failure_reason text,
  trace_json jsonb not null default '{}'::jsonb,
  started_by_user_id uuid references auth.users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_agent_runs_v2_client_agent
  on public.agent_runs_v2 (client_id, agent_key, started_at desc);
```

### 3.7 SQL: `artifact_evaluations_v2`

```sql
create table if not exists public.artifact_evaluations_v2 (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.strategy_artifacts_v2(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  evaluator_key text not null,
  result public.v2_evaluation_result not null,
  score integer,
  findings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_artifact_evaluations_v2_artifact
  on public.artifact_evaluations_v2 (artifact_id, created_at desc);
```

## 4. Exact JSON Contract: Agency Operating Module V2

This is the canonical JSON shape for `agency_operating_modules_v2.content_json`.

### 4.1 Contract

```json
{
  "module_key": "channel_playbooks",
  "title": "Channel Playbooks",
  "definition": "Rules and decision logic for choosing, planning, and operating channels by client type and goal.",
  "rules": [
    {
      "id": "rule_1",
      "statement": "Use Instagram Reels + Stories as the default growth/content channel for local aesthetic clinics.",
      "when": [
        "client_type: local_service",
        "offer_type: aesthetic_treatment"
      ],
      "because": "This agency gets the strongest reach-to-inquiry path from short-form proof and urgency-driven story follow-up."
    }
  ],
  "examples": [
    {
      "id": "ex_1",
      "title": "Clinic launch playbook",
      "summary": "Use 3 proof-led reels, 2 authority carousels, and daily story response loops in the first 14 days."
    }
  ],
  "anti_patterns": [
    {
      "id": "ap_1",
      "statement": "Do not recommend LinkedIn thought leadership for low-ticket local aesthetic offers."
    }
  ],
  "edge_cases": [
    {
      "id": "edge_1",
      "condition": "High-end clinic with surgeon-led authority positioning",
      "guidance": "You may layer in YouTube or long-form authority content if internal production capacity exists."
    }
  ],
  "downstream_usage": [
    "strategy_readiness_agent",
    "diagnosis_agent",
    "strategy_architect_agent",
    "channel_plan_agent"
  ],
  "approval": {
    "owner_role": "agency_owner",
    "required": true,
    "status": "approved"
  },
  "evidence_sources": [
    {
      "type": "brain_document",
      "ref_id": "uuid-or-doc-id",
      "label": "Clinic channel SOP"
    }
  ],
  "confidence": 90,
  "last_reviewed_at": "2026-03-13T10:00:00Z"
}
```

### 4.2 Required keys

Required keys for every agency module:

1. `module_key`
2. `title`
3. `definition`
4. `rules`
5. `examples`
6. `anti_patterns`
7. `edge_cases`
8. `downstream_usage`
9. `approval`
10. `evidence_sources`
11. `confidence`

## 5. Exact JSON Contract: Client Operating Brief V2

This is the canonical JSON shape for `client_operating_briefs_v2.content_json`.

### 5.1 Contract

```json
{
  "client_id": "uuid",
  "agency_id": "uuid",
  "business_model": {
    "category": "local_service",
    "subtype": "aesthetic_clinic",
    "summary": "Premium local clinic offering injectable and skin treatments."
  },
  "offer_priority": {
    "primary_offer": "Lip filler consultations",
    "secondary_offers": ["Skin boosters", "Anti-wrinkle consultations"],
    "offer_constraints": ["Avoid discount-led positioning"]
  },
  "audience_segments": [
    {
      "id": "aud_1",
      "name": "Women 25-40 seeking subtle enhancements",
      "jobs_to_be_done": ["Look fresher", "Feel more confident in social settings"],
      "pain_points": ["Fear of unnatural results", "Confusion about provider quality"]
    }
  ],
  "conversion_path": {
    "primary_path": "dm_to_consultation",
    "secondary_paths": ["website_form"],
    "handoff_notes": ["Front desk confirms booking within 24 hours"]
  },
  "sales_process": {
    "summary": "Lead comes via DM or form, then front desk books consultation.",
    "response_time_expectation_hours": 24,
    "known_drop_off_points": ["Unclear pricing expectations before consultation"]
  },
  "pricing_and_budget": {
    "price_positioning": "premium",
    "media_budget_monthly": null,
    "commercial_constraints": ["Do not rely on heavy offer discounting"]
  },
  "proof_and_differentiators": {
    "proof_assets": ["Before/after gallery", "Doctor credentials", "Patient testimonials"],
    "differentiators": ["Natural-looking outcomes", "Medical credibility", "Luxury experience"],
    "claims_limits": ["No guaranteed results language"]
  },
  "goals_baselines_success_thresholds": {
    "primary_goal": "Increase qualified consultations",
    "baselines": [],
    "success_thresholds": ["20 qualified consultations per month"]
  },
  "channel_state_and_history": {
    "active_channels": ["instagram"],
    "historical_notes": ["Posting inconsistent in previous 60 days"],
    "performance_context": []
  },
  "stakeholder_and_approval_map": {
    "primary_contact": "Practice manager",
    "final_approver": "Clinic owner",
    "approval_turnaround_hours": 48
  },
  "launch_windows_and_deadlines": {
    "next_launch_window": "2026-04-01",
    "hard_deadlines": ["Spring promotion by 2026-04-15"]
  },
  "access_and_asset_readiness": {
    "platform_access_ready": false,
    "missing_assets": ["Updated before/after images", "Brand-approved disclaimers"]
  },
  "constraints_and_compliance": {
    "regulated_industry": true,
    "restricted_claims": ["Guaranteed results", "Pain-free promise"],
    "required_disclaimers": []
  },
  "internal_capacity_and_dependencies": {
    "client_capacity_notes": ["Owner is slow to approve long-form content"],
    "dependencies": ["Need clinic photography refresh"]
  },
  "known_blockers": [
    "Instagram admin access missing"
  ],
  "open_questions": [
    "What is the current monthly consultation baseline?",
    "Which treatment has the strongest margin?"
  ]
}
```

### 5.2 Required top-level keys

Required keys:

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

## 6. Exact JSON Contract: Strategy Artifact V2

This is the canonical shape for `strategy_artifacts_v2.content_json`.

### 6.1 Shared envelope

All artifact content should live inside this shared shape:

```json
{
  "artifact_meta": {
    "artifact_type": "strategy_diagnosis",
    "version": 1,
    "brief_version": 2,
    "agency_module_versions": {
      "offer_strategy": 3,
      "channel_playbooks": 4,
      "quality_bar": 2
    }
  },
  "summary": "High-level artifact summary.",
  "body": {},
  "assumptions": [],
  "open_questions": [],
  "citations": [],
  "confidence": 82
}
```

### 6.2 `strategy_readiness_audit` body contract

```json
{
  "readiness_state": "diagnosis_ready",
  "overall_score_0_100": 71,
  "blocking_gaps": [
    {
      "key": "missing_consultation_baseline",
      "severity": "medium",
      "message": "Consultation baseline is unknown."
    }
  ],
  "critical_inputs_present": [
    "primary_offer",
    "audience_segments",
    "conversion_path"
  ],
  "critical_inputs_missing": [
    "baseline_metrics",
    "platform_access_state"
  ],
  "risky_assumptions": [
    "Instagram is the primary viable acquisition channel"
  ],
  "allowed_scope": [
    "diagnosis",
    "recommendation_with_caveats"
  ],
  "recommended_next_actions": [
    {
      "action_type": "client_input",
      "title": "Request current consultation baseline"
    }
  ]
}
```

### 6.3 `strategy_diagnosis` body contract

```json
{
  "current_state_summary": "The client has strong visual proof but weak operational consistency and missing baseline data.",
  "business_objective_tree": [
    {
      "objective": "Increase qualified consultations",
      "drivers": ["Proof-led content", "Fast lead follow-up", "Clear trust messaging"]
    }
  ],
  "offer_diagnosis": {
    "primary_offer_fit": "strong",
    "issues": ["Pricing expectations may be unclear before consultation"],
    "notes": ["Offer is emotionally driven and proof-sensitive"]
  },
  "funnel_diagnosis": {
    "current_path": "dm_to_consultation",
    "strengths": ["Low-friction lead path"],
    "weaknesses": ["Manual follow-up quality unclear"]
  },
  "audience_clarity": {
    "score_0_100": 78,
    "strengths": ["Clear emotional intent"],
    "gaps": ["Need segmentation by treatment priority"]
  },
  "channel_fit": [
    {
      "channel": "instagram",
      "fit": "high",
      "why": "Visual proof and local trust-building fit the offer well."
    }
  ],
  "risk_summary": [
    "Regulated claims environment",
    "Slow approval turnaround"
  ],
  "top_opportunities": [
    "Use proof-led short-form to reduce trust friction",
    "Clarify premium positioning without discounting"
  ]
}
```

### 6.4 `strategy_recommendation` body contract

```json
{
  "strategic_direction": "Own premium natural-results positioning and convert proof-driven short-form attention into consultation requests.",
  "chosen_offer_priority": {
    "primary_offer": "Lip filler consultations",
    "why": "Strong proof availability and clear emotional outcome."
  },
  "chosen_funnel": {
    "path": "instagram_dm_to_consultation",
    "why": "Fastest route with lowest current operational friction."
  },
  "channel_priorities": [
    {
      "channel": "instagram",
      "priority": 1,
      "role": "Primary acquisition and trust channel"
    }
  ],
  "pillar_recommendations": [
    {
      "name": "Natural result proof",
      "purpose": "Trust and conversion"
    },
    {
      "name": "Medical authority",
      "purpose": "Risk reduction and differentiation"
    }
  ],
  "messaging_direction": {
    "core_message": "Premium aesthetic outcomes that look subtle, safe, and expert-led.",
    "dos": ["Lead with proof", "Use medical credibility"],
    "donts": ["Do not push discount-first hooks"]
  },
  "risks_and_tradeoffs": [
    "DM-led funnel increases dependency on front-desk responsiveness",
    "High proof reliance requires stronger asset pipeline"
  ],
  "decision_rationale": [
    {
      "decision": "Make Instagram the lead channel",
      "why": "Best match for proof-driven local service demand generation."
    }
  ]
}
```

## 7. First Agent Contracts

These are the first three V2 agents to implement.

## 7.1 `strategy_readiness_agent`

### Job

Determine whether the client context is strong enough to begin diagnosis or strategy work, and define what work is allowed.

### Entry conditions

1. client exists
2. agency membership valid
3. client onboarding and ops setup data can be assembled into a brief draft

### Required context

1. latest client brief draft
2. approved agency modules:
   - `offer_strategy`
   - `icp_segments`
   - `channel_playbooks`
   - `claims_compliance`
   - `quality_bar`
3. current lifecycle state

### Optional context

1. client brain summary
2. approved client memory
3. imported performance context

### Allowed tools

1. brief assembler
2. agency module resolver
3. queue/task writer
4. artifact writer

### Output artifact

1. `strategy_readiness_audit`

### Write-back targets

1. `client_operating_briefs_v2`
2. `strategy_artifacts_v2`
3. `client_enrichment_queue`
4. `client_execution_tasks`

### Approval policy

1. no human approval required to create audit artifact
2. human review recommended if readiness is `blocked` for a high-value client

### Evaluation gate

Must pass if:

1. blockers are explicit
2. assumptions are explicit
3. allowed scope is coherent
4. next actions are actionable

### Failure modes

1. incomplete brief assembly
2. missing required agency modules
3. contradictory inputs

## 7.2 `diagnosis_agent`

### Job

Diagnose the client situation, opportunity, and risk before strategic choices are made.

### Entry conditions

1. latest readiness artifact is `diagnosis_ready`, `strategy_ready_with_caveats`, or `strategy_ready`
2. required agency modules resolved

### Required context

1. approved client brief
2. latest readiness audit
3. approved agency modules:
   - `offer_strategy`
   - `icp_segments`
   - `channel_playbooks`
   - `claims_compliance`
   - `quality_bar`

### Optional context

1. performance summaries
2. prior strategy artifacts
3. approved exemplar memory

### Allowed tools

1. artifact reader
2. memory retrieval
3. artifact writer
4. queue/task writer for missing context

### Output artifact

1. `strategy_diagnosis`

### Write-back targets

1. `strategy_artifacts_v2`
2. `client_enrichment_queue`
3. `client_execution_tasks` when unresolved questions need collection

### Approval policy

1. diagnosis artifact does not require approval to exist
2. recommendation phase should not run unless diagnosis passes evaluation

### Evaluation gate

Must pass if:

1. current-state summary is coherent
2. objective tree is useful
3. offer and funnel diagnosis are explicit
4. risks and opportunities are actionable

### Failure modes

1. diagnosis repeats brief instead of analyzing it
2. recommendations leak into diagnosis prematurely
3. no real tradeoff or risk reasoning

## 7.3 `strategy_architect_agent`

### Job

Choose and justify the strategic direction based on diagnosis, agency playbooks, and client constraints.

### Entry conditions

1. latest diagnosis artifact passed evaluation
2. brief readiness is at least `strategy_ready_with_caveats`

### Required context

1. approved client brief
2. approved readiness audit
3. approved diagnosis artifact
4. approved agency modules:
   - `offer_strategy`
   - `icp_segments`
   - `channel_playbooks`
   - `content_frameworks`
   - `claims_compliance`
   - `quality_bar`
   - `approval_matrix`

### Optional context

1. performance context
2. historical strategy artifacts
3. current ops blockers

### Allowed tools

1. artifact reader
2. module resolver
3. artifact writer
4. review-request writer

### Output artifact

1. `strategy_recommendation`

### Write-back targets

1. `strategy_artifacts_v2`
2. `strategy_artifact_approvals_v2`
3. review state in workflow layer

### Approval policy

1. recommendation must be reviewable
2. no plan conversion should happen until recommendation is approved or explicitly accepted

### Evaluation gate

Must pass if:

1. strategic direction is clear
2. offer and funnel choice are justified
3. channel priorities fit the diagnosis
4. tradeoffs are explicit
5. messaging direction respects agency rules and client constraints

### Failure modes

1. generic strategy not tied to diagnosis
2. channel choices without rationale
3. unrealistic recommendations given operations or compliance constraints

## 8. Phase 1 Build Order

The exact order for implementation should be:

1. add V2 enums and tables
2. add typed JSON validation for the three core contracts
3. implement brief assembly into `client_operating_briefs_v2`
4. implement `strategy_readiness_agent`
5. implement artifact evaluation for readiness
6. implement `diagnosis_agent`
7. implement artifact evaluation for diagnosis
8. implement `strategy_architect_agent`
9. implement recommendation approval flow

Only after this should the team build:

1. V2 plan conversion
2. creator briefs
3. creator agents
4. V2 write-through into `strategy_modules` and `strategy_documents`

## 9. Final Recommendation

The right move is not to delete the current strategy surfaces.

The right move is:

1. keep `strategy_modules` and `strategy_documents`
2. build V2 reasoning tables above them
3. use Phase 1 to establish the new source-of-truth contracts
4. move the product over only when those contracts are real and tested

That preserves your current product value while fixing the weak architectural foundation underneath it.
