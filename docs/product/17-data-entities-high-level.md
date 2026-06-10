# Data Entities (High-Level)

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-DATA-017`                                           |
| Status           | **Active**                                                   |
| Owner            | Engineering Team                                             |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [16-technical-architecture](16-technical-architecture.md), [18-rag-ocr](18-rag-ocr-grading-architecture.md), [08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md) |

---

## 1. Purpose

This document defines the high-level data model for SMMAHUB. It describes each
entity with its key fields, relationships, and RLS (Row-Level Security) patterns.
This is not a migration file or full database schema. It is a reference for engineers
and product managers to understand what data the system stores, how it relates, and
how it is secured.

For the technical architecture that uses these entities, see
[16-technical-architecture](16-technical-architecture.md).

---

## 2. Entity Definitions

### 2.1 Agency

The top-level tenant. Every other entity ultimately belongs to an agency.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique agency identifier                            |
| `name`             | text         | Agency display name                                 |
| `slug`             | text (unique)| URL-safe identifier                                |
| `settings`         | jsonb        | UI preferences, notification config, locale         |
| `operating_model`  | jsonb        | Business model (retainer, project, hybrid), team size, specialization |
| `subscription_tier`| enum         | `operate`, `scale`, `agency`, `custom`              |
| `subscription_status` | enum      | `active`, `trial`, `past_due`, `cancelled`          |
| `stripe_customer_id` | text       | Stripe customer reference                           |
| `onboarding_completed` | boolean  | Whether Agency OS Setup (Layer 1) is complete       |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency owners and members can read/write their own agency record.
No cross-agency access.

---

### 2.2 AgencyBrain

The agency's encoded expertise. Populated during Agency OS Setup (Layer 1) and
continuously refined. This is the primary context source for all AI agents when
they need to understand "how this agency operates."

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `agency_id`        | uuid (FK)   | References Agency                                   |
| `services`         | jsonb        | Array of service offerings with descriptions, deliverables, pricing ranges |
| `playbooks`        | jsonb        | Operational playbooks: onboarding steps, campaign launch checklist, review process |
| `brand_rules`      | jsonb        | Agency's own brand voice, tone, visual guidelines   |
| `compliance_rules` | jsonb        | Industry compliance: platform policies, legal disclaimers, prohibited claims |
| `approval_matrix`  | jsonb        | Who approves what: { entity_type → required_roles, escalation_path } |
| `target_industries`| jsonb        | Industries the agency specializes in                |
| `tools_and_integrations` | jsonb  | External tools the agency uses (schedulers, design tools, analytics) |
| `knowledge_base_summary` | text   | LLM-generated summary of the agency's full knowledge base for quick context |
| `last_enriched_at` | timestamptz  | Last time the brain was updated (manually or via AI) |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Same as Agency. Only agency members can read/write.

---

### 2.3 User

A person who belongs to an agency and uses the staff-facing application.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Matches Supabase Auth user ID                       |
| `agency_id`        | uuid (FK)   | References Agency                                   |
| `email`            | text         | Login email (unique within Supabase Auth)           |
| `full_name`        | text         | Display name                                        |
| `role`             | enum         | `owner`, `manager`, `strategist`, `creator`         |
| `permissions`      | jsonb        | Granular overrides beyond role defaults             |
| `avatar_url`       | text         | Profile image URL                                   |
| `last_active_at`   | timestamptz  | Last activity timestamp (for session tracking)      |
| `status`           | enum         | `active`, `invited`, `disabled`                     |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Users can read all users within their agency (for assignment UIs).
Users can write only their own profile. Owners can manage all users.

---

### 2.4 Client

A client account managed by the agency. Central entity for Layer 2 (Client
Operating Record).

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique client identifier                            |
| `agency_id`        | uuid (FK)   | References Agency                                   |
| `name`             | text         | Client business name                                |
| `business_context` | jsonb        | Industry, size, location, competitive landscape, goals |
| `status`           | enum         | `onboarding`, `active`, `paused`, `churned`         |
| `lifecycle_stage`  | enum         | `setup`, `strategy`, `execution`, `optimization`, `renewal` |
| `primary_contact`  | jsonb        | Name, email, phone of main client contact           |
| `assigned_users`   | uuid[]       | Agency team members assigned to this client         |
| `risk_flags`       | jsonb        | AI-detected risk signals (churn risk, satisfaction drop) |
| `meta_account_id`  | text         | Linked Meta/Facebook ad account ID                  |
| `tags`             | text[]       | Agency-defined tags for filtering                   |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. All agency members can read. Managers and above can write.
Client contacts can read their own client record via portal JWT.

---

### 2.5 ClientBrain

The client-specific knowledge base. Enriched over time by human input, document
ingestion (OCR), and AI analysis. This is the primary context source when AI agents
need to understand "what this client needs."

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `client_id`        | uuid (FK)   | References Client                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `brand`            | jsonb        | Brand voice, visual identity, logo usage rules, taglines, messaging pillars |
| `audience`         | jsonb        | Target audience segments: demographics, psychographics, pain points, platforms |
| `funnel`           | jsonb        | Current funnel state: awareness, consideration, conversion metrics and goals |
| `assets`           | jsonb        | Inventory of approved assets: images, videos, brand guides, templates |
| `constraints`      | jsonb        | Budget limits, prohibited topics, legal requirements, platform restrictions |
| `performance_history` | jsonb     | Historical campaign metrics (pulled from Meta API + manual entry) |
| `competitor_notes` | jsonb        | Key competitors, their positioning, differentiation notes |
| `approved_claims`  | jsonb        | List of claims the client has approved for marketing use |
| `document_summaries` | jsonb      | Summaries of ingested documents (from OCR pipeline) |
| `last_enriched_at` | timestamptz  | Last enrichment timestamp                           |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Client contacts can read their own ClientBrain via portal JWT
(so they see what the agency knows about them, building transparency).

See [18-rag-ocr](18-rag-ocr-grading-architecture.md) for how documents are processed
into ClientBrain fields.

---

### 2.6 Strategy

An AI-generated (human-approved) strategic recommendation for a client. Produced
by the Strategy Intelligence pipeline (Layer 3).

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `client_id`        | uuid (FK)   | References Client                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `type`             | enum         | `readiness_audit`, `diagnosis`, `full_strategy`, `quarterly_review` |
| `status`           | enum         | `draft`, `pending_review`, `approved`, `rejected`, `superseded` |
| `readiness_report` | jsonb        | Output from readiness audit agent (if type = readiness_audit) |
| `diagnosis`        | jsonb        | Output from diagnosis agent: problems, opportunities, gaps |
| `recommendations`  | jsonb        | Strategic recommendations: goals, channels, content themes, budget allocation |
| `assumptions`      | jsonb        | Explicit assumptions the strategy is built on (for invalidation tracking) |
| `risk_flags`       | jsonb        | Identified risks: market, execution, budget, compliance |
| `confidence_score` | numeric(3,2)| AI confidence in the strategy (0.00-1.00)           |
| `approved_by`      | uuid (FK)   | User who approved (null if pending)                 |
| `approved_at`      | timestamptz  | Approval timestamp                                  |
| `version`          | integer      | Monotonic version number (new version supersedes old) |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Strategists and above can create/edit. Client contacts
can read approved strategies via portal.

---

### 2.7 Campaign

A time-bound execution plan derived from an approved strategy. Managed in
the Execution & Delivery Spine (Layer 4).

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `strategy_id`      | uuid (FK)   | References Strategy (the strategic basis)           |
| `client_id`        | uuid (FK)   | References Client                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `name`             | text         | Campaign display name                               |
| `channels`         | text[]       | Target channels: `instagram`, `facebook`, `tiktok`, `linkedin`, etc. |
| `timeline`         | jsonb        | { start_date, end_date, milestones: [{date, description}] } |
| `brief`            | jsonb        | Campaign brief: objective, audience, messaging, creative direction, KPIs |
| `status`           | enum         | `draft`, `brief_pending`, `active`, `paused`, `completed`, `cancelled` |
| `budget`           | jsonb        | { total, spent, currency, breakdown_by_channel }    |
| `kpis`             | jsonb        | Target KPIs: { metric_name, target_value, actual_value } |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Client contacts can read their own campaigns via portal.

---

### 2.8 Content

An individual content piece within a campaign. This is the atomic unit of
creative output.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `campaign_id`      | uuid (FK)   | References Campaign                                 |
| `client_id`        | uuid (FK)   | References Client (denormalized for portal RLS)     |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `type`             | enum         | `post`, `story`, `reel`, `carousel`, `ad_copy`, `blog_draft`, `email` |
| `channel`          | text         | Target channel for this piece                       |
| `draft`            | jsonb        | { caption, hashtags, visual_description, cta, alt_text } |
| `attachments`      | jsonb        | Array of { file_url, file_type, file_size } for uploaded media |
| `status`           | enum         | `draft`, `in_review`, `revision_requested`, `approved`, `delivered` |
| `approval_state`   | jsonb        | Current approval status, reviewer, comments         |
| `compliance_report`| jsonb        | Output from compliance reviewer agent               |
| `quality_grade`    | jsonb        | { overall_score, dimensions: { relevance, brand_compliance, ... } } |
| `target_publish_date` | date      | When this content should be published               |
| `version`          | integer      | Content revision number                             |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Client contacts can read and update approval_state for
their own content via portal.

---

### 2.9 Approval

A generic approval record that tracks sign-off on any entity (strategy, campaign
brief, content). Supports both internal (agency team) and external (client) approval.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `entity_type`      | enum         | `strategy`, `campaign_brief`, `content`             |
| `entity_id`        | uuid         | References the entity being approved                |
| `client_id`        | uuid (FK)   | References Client (for portal-scoped approvals)     |
| `requested_by`     | uuid (FK)   | User or agent who requested approval                |
| `requested_at`     | timestamptz  | When approval was requested                         |
| `assigned_to`      | uuid         | User or client contact who should approve           |
| `approved_by`      | uuid         | Who actually approved/rejected (null if pending)    |
| `status`           | enum         | `pending`, `approved`, `rejected`, `expired`        |
| `decision_at`      | timestamptz  | When the decision was made                          |
| `comments`         | text         | Reviewer comments (especially for rejections)       |
| `revision_notes`   | text         | Specific revision requests                          |
| `is_client_facing` | boolean      | Whether this approval appears in the client portal  |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Client contacts can read and respond to approvals
where `is_client_facing = true` and `client_id` matches their portal JWT.

---

### 2.10 Task

An operational work item within a campaign. Tasks track what needs to be done,
by whom, and when. Tasks support dependencies (task B cannot start until task A
is complete).

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `campaign_id`      | uuid (FK)   | References Campaign                                 |
| `client_id`        | uuid (FK)   | References Client (denormalized for RLS)            |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `title`            | text         | Task description                                    |
| `assignee`         | uuid (FK)   | References User (who is responsible)                |
| `type`             | enum         | `content_creation`, `review`, `client_approval`, `publish`, `reporting`, `other` |
| `status`           | enum         | `todo`, `in_progress`, `blocked`, `done`, `cancelled` |
| `dependencies`     | uuid[]       | Array of Task IDs this task depends on              |
| `blocker_flags`    | jsonb        | AI-detected blockers: { reason, detected_at, resolved_at } |
| `due_date`         | date         | When this task is due                               |
| `priority`         | enum         | `low`, `medium`, `high`, `urgent`                   |
| `notes`            | text         | Additional context                                  |
| `completed_at`     | timestamptz  | When the task was marked done                       |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. All agency members can read. Assignee and managers
can update status. Client contacts cannot see tasks.

---

### 2.11 PortalSession

A session granting a client contact access to the Client Collaboration Surface
(Layer 5).

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `client_id`        | uuid (FK)   | References Client                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `contact_id`       | uuid         | Identifies the specific client contact              |
| `contact_email`    | text         | Email of the client contact                         |
| `contact_name`     | text         | Name of the client contact                          |
| `token`            | text (unique)| Signed session token (used in portal URL)           |
| `token_expires_at` | timestamptz  | When the token expires                              |
| `permissions`      | jsonb        | What this contact can see/do: { can_approve, can_comment, visible_sections } |
| `last_accessed_at` | timestamptz  | Last portal access                                  |
| `revoked`          | boolean      | Whether the session has been manually revoked       |
| `created_at`       | timestamptz  | Creation timestamp                                  |

**RLS**: Agency members can read/create/revoke. Portal token validation uses
service role (the token itself is the auth mechanism before JWT issuance).

---

### 2.12 AgentExecution

A record of every AI agent invocation. This is the audit trail for all AI activity
in the system.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `agency_id`        | uuid (FK)   | References Agency                                   |
| `client_id`        | uuid (FK)   | References Client (null for agency-level agents)    |
| `agent_type`       | text         | Agent identifier: `readiness_audit`, `content_generator`, etc. |
| `triggered_by`     | uuid         | User who triggered (null for scheduled executions)  |
| `context_snapshot` | jsonb        | Frozen copy of the context used for this execution  |
| `input`            | jsonb        | Specific input data provided to the agent           |
| `output`           | jsonb        | Raw agent output (before governance)                |
| `governed_output`  | jsonb        | Output after governance processing (may differ from raw) |
| `confidence`       | numeric(3,2)| Agent's self-reported confidence (0.00-1.00)        |
| `quality_grade`    | jsonb        | Quality grading results (from secondary LLM pass)   |
| `status`           | enum         | `pending`, `running`, `completed`, `pending_approval`, `approved`, `rejected`, `failed`, `validation_failed` |
| `approval_required`| boolean      | Whether this execution requires human approval      |
| `approval_id`      | uuid (FK)   | References Approval (if approval_required = true)   |
| `error`            | jsonb        | Error details if status = failed                    |
| `token_usage`      | jsonb        | { prompt_tokens, completion_tokens, total_tokens, estimated_cost } |
| `duration_ms`      | integer      | Wall-clock execution time in milliseconds           |
| `model`            | text         | LLM model used for this execution                   |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `completed_at`     | timestamptz  | When execution finished                             |

**RLS**: Agency-scoped. Managers and above can read all executions. Other roles
can read executions they triggered. Client contacts cannot see agent executions.

---

### 2.13 Report

A generated report for a client covering a specific period. Produced by the
Reporting Insight agent and optionally enriched by human editors.

| Field              | Type        | Description                                         |
| ------------------ | ----------- | --------------------------------------------------- |
| `id`               | uuid (PK)   | Unique identifier                                   |
| `client_id`        | uuid (FK)   | References Client                                   |
| `agency_id`        | uuid (FK)   | References Agency (denormalized for RLS)            |
| `period`           | jsonb        | { start_date, end_date, period_type: "weekly"|"monthly"|"quarterly" } |
| `metrics`          | jsonb        | { reach, engagement, conversions, spend, roas, cpa, ... } by channel |
| `insights`         | jsonb        | AI-generated insights: trends, anomalies, explanations |
| `recommendations`  | jsonb        | AI-generated next-period recommendations            |
| `executive_summary`| text         | One-paragraph summary for client portal display     |
| `status`           | enum         | `draft`, `pending_review`, `approved`, `published`  |
| `published_to_portal` | boolean   | Whether the client can see this report              |
| `created_at`       | timestamptz  | Creation timestamp                                  |
| `updated_at`       | timestamptz  | Last modification timestamp                         |

**RLS**: Agency-scoped. Client contacts can read reports where
`published_to_portal = true`.

---

## 3. Entity Relationship Map

```
Agency (tenant root)
  │
  ├── AgencyBrain (1:1)
  │     Used by AI agents as "how this agency operates" context
  │
  ├── User (1:many)
  │     Agency team members
  │
  ├── Client (1:many)
  │     │
  │     ├── ClientBrain (1:1)
  │     │     Used by AI agents as "what this client needs" context
  │     │     Enriched by OCR pipeline (see 18-rag-ocr)
  │     │
  │     ├── Strategy (1:many)
  │     │     │  Versioned; new strategy supersedes previous
  │     │     │
  │     │     └── Campaign (1:many)
  │     │           │  Derived from approved strategy
  │     │           │
  │     │           ├── Content (1:many)
  │     │           │     Atomic content pieces within campaign
  │     │           │
  │     │           └── Task (1:many)
  │     │                 Operational work items with dependencies
  │     │
  │     ├── Report (1:many)
  │     │     Period-based performance reports
  │     │
  │     ├── Approval (1:many)
  │     │     Cross-entity approval records
  │     │     References: Strategy | Campaign | Content
  │     │
  │     ├── PortalSession (1:many)
  │     │     Client contact access sessions
  │     │
  │     └── AgentExecution (1:many)
  │           AI agent invocation audit trail
  │
  └── AgentExecution (1:many, agency-level)
        Agency-level agent executions (e.g., setup assistant)
```

---

## 4. RLS Pattern Summary

| Entity          | Isolation Key   | Agency Staff Access       | Client Portal Access          |
| --------------- | --------------- | ------------------------- | ----------------------------- |
| Agency          | `id`            | Own agency only            | None                          |
| AgencyBrain     | `agency_id`     | Own agency only            | None                          |
| User            | `agency_id`     | Read: all in agency. Write: self + owner | None               |
| Client          | `agency_id`     | Own agency only            | Read: own client record       |
| ClientBrain     | `agency_id`     | Own agency only            | Read: own client brain        |
| Strategy        | `agency_id`     | Own agency only            | Read: approved only           |
| Campaign        | `agency_id`     | Own agency only            | Read: own campaigns           |
| Content         | `agency_id`     | Own agency only            | Read + approve: own content   |
| Approval        | `agency_id`     | Own agency only            | Read + respond: client-facing |
| Task            | `agency_id`     | Own agency only            | None                          |
| PortalSession   | `agency_id`     | Own agency only            | None (token-based auth)       |
| AgentExecution  | `agency_id`     | Role-based within agency   | None                          |
| Report          | `agency_id`     | Own agency only            | Read: published only          |

---

## 5. JSONB Field Conventions

All `jsonb` fields follow these conventions:

1. **Top-level keys are snake_case** (matching PostgreSQL column naming).
2. **Arrays use plural keys** (e.g., `services`, `milestones`, `segments`).
3. **Nested objects have documented schemas** in code via Zod types.
4. **No deeply nested structures beyond 3 levels** to keep queries performant.
5. **GIN indexes on frequently queried jsonb fields** (e.g., `business_context`, `brand`).
6. **Version field in jsonb objects** when the structure may evolve
   (e.g., `{ "v": 2, "data": {...} }`).

---

## 6. Soft Deletes and Data Retention

Entities are not hard-deleted. The pattern:

```sql
-- All tenant-data tables include:
deleted_at  timestamptz  DEFAULT NULL

-- RLS policies exclude soft-deleted rows:
AND deleted_at IS NULL

-- Background job hard-deletes rows where:
deleted_at < NOW() - INTERVAL '90 days'

-- Exceptions:
-- AgentExecution: retained for 1 year (audit requirement)
-- Approval: retained for 1 year (audit requirement)
-- PortalSession: hard-deleted after token expiry + 30 days
```

---

## 7. Indexing Strategy

| Index Type     | Applied To                                                |
| -------------- | --------------------------------------------------------- |
| B-tree (PK)    | All `id` columns                                          |
| B-tree (FK)    | All `agency_id`, `client_id`, `campaign_id`, `strategy_id` foreign keys |
| B-tree         | `status` columns (filtered queries), `created_at` (sorting) |
| GIN            | `jsonb` fields queried with `@>` operator                 |
| IVFFlat        | Vector embeddings in RAG tables (see [18-rag-ocr](18-rag-ocr-grading-architecture.md)) |
| Unique         | `Agency.slug`, `PortalSession.token`, `User.email` (via Supabase Auth) |
| Partial        | `WHERE deleted_at IS NULL` on frequently queried tables   |

---

## 8. Denormalization Decisions

Several fields are denormalized (duplicated) for performance and RLS simplicity:

| Field          | Canonical Source | Denormalized To                      | Reason                          |
| -------------- | ---------------- | ------------------------------------ | ------------------------------- |
| `agency_id`    | Agency.id        | Every entity                         | RLS cannot join; needs direct column |
| `client_id`    | Client.id        | Content, Task, Approval, Report      | Portal RLS needs direct client_id without joins |

Denormalized fields are kept consistent via:
1. **Application-level enforcement**: Set on insert, never updated.
2. **Database triggers**: Validation trigger ensures denormalized values match parent.

---

*For the full technical architecture, see [16-technical-architecture](16-technical-architecture.md).
For RAG vector storage and document processing, see [18-rag-ocr](18-rag-ocr-grading-architecture.md).*
