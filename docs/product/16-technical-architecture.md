# Technical Architecture

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-ARCH-016`                                           |
| Status           | **Active**                                                   |
| Owner            | Engineering Team                                             |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [17-data-entities](17-data-entities-high-level.md), [18-rag-ocr](18-rag-ocr-grading-architecture.md), [08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md), [15-explicit-non-goals](15-explicit-non-goals.md) |

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS / USERS                                │
│   Agency Staff (React SPA)              Client Contacts (Portal SPA)        │
└──────────┬──────────────────────────────────────┬───────────────────────────┘
           │ HTTPS                                │ HTTPS
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CDN / STATIC HOSTING                               │
│                    Vite build artifacts (JS, CSS, assets)                    │
└──────────┬──────────────────────────────────────┬───────────────────────────┘
           │                                      │
           ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE GATEWAY                                    │
│           Auth (JWT)  │  PostgREST API  │  Realtime  │  Storage             │
└──────────┬────────────┴────────┬────────┴─────┬──────┴──────────────────────┘
           │                     │              │
           ▼                     ▼              ▼
┌────────────────────┐ ┌─────────────────┐ ┌──────────────────────────────────┐
│  EDGE FUNCTIONS    │ │   POSTGRESQL    │ │         FILE STORAGE             │
│  (Deno Runtime)    │ │                 │ │                                  │
│                    │ │  Tables + RLS   │ │  Client assets                   │
│  AI Pipeline       │ │  pgvector       │ │  Uploaded documents              │
│  Webhooks          │ │  Triggers       │ │  Generated reports               │
│  Integrations      │ │  Functions      │ │                                  │
└────────┬───────────┘ └────────┬────────┘ └──────────────────────────────────┘
         │                      │
         ▼                      │
┌────────────────────┐          │
│  EXTERNAL SERVICES │          │
│                    │          │
│  LLM Provider      │          │
│  Meta/Facebook API │          │
│  Stripe            │          │
│  Resend (Email)    │          │
└────────────────────┘          │
                                │
         ┌──────────────────────┘
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROW-LEVEL SECURITY                                  │
│                                                                             │
│  Every table enforced:  agency_id = auth.jwt() -> agency_id                 │
│  Client portal:         client_id = auth.jwt() -> client_id                 │
│  No cross-tenant data access possible at the database layer                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Component           | Technology                                              |
| ------------------- | ------------------------------------------------------- |
| Framework           | React 18 (SPA)                                          |
| Build tool          | Vite 5                                                  |
| Language            | TypeScript (strict mode)                                |
| Styling             | Tailwind CSS 3 + shadcn/ui component library            |
| Routing             | React Router v6 (nested routes, layout routes)          |
| State management    | React Query (server state) + Zustand (client state)     |
| Forms               | React Hook Form + Zod validation                        |
| Auth client         | Supabase JS client (`@supabase/supabase-js`)            |

### 2.2 Routing Model

```
/                                    → Dashboard (agency overview)
/agency/setup/*                      → Agency OS Setup (Layer 1) wizard
/clients                             → Client list
/clients/:clientId                   → Client Operating Record (Layer 2)
/clients/:clientId/strategy          → Strategy Intelligence (Layer 3)
/clients/:clientId/campaigns         → Execution & Delivery (Layer 4)
/clients/:clientId/campaigns/:id     → Campaign detail
/portal/:token                       → Client portal entry (Layer 5)
/portal/:token/dashboard             → Client portal dashboard
/portal/:token/approvals             → Client approval queue
/settings                            → Agency settings, users, billing
```

### 2.3 Auth Flows

**Agency Staff Authentication:**

```
1. User enters email + password (or magic link)
2. Supabase Auth issues JWT with claims:
   - sub: user_id
   - agency_id: uuid
   - role: "owner" | "manager" | "strategist" | "creator"
3. JWT stored in httpOnly cookie (managed by Supabase client)
4. Every API call includes JWT in Authorization header
5. RLS policies extract agency_id from JWT for tenant isolation
6. Token refresh handled automatically by Supabase client (silent refresh)
```

**Client Portal Authentication:**

```
1. Agency generates a portal session link for client contact
2. Link contains a signed token: /portal/:token
3. Token validated by edge function → issues a short-lived JWT with claims:
   - sub: portal_session_id
   - client_id: uuid
   - agency_id: uuid
   - contact_id: uuid
   - role: "client_contact"
4. Portal JWT has restricted permissions (read-only on most entities,
   write on approvals and comments only)
5. Session expires after configurable duration (default: 7 days)
6. Agency can revoke sessions at any time
```

### 2.4 State Management Strategy

```
┌──────────────────────────────────────────────────────┐
│                    React Query                        │
│  (Server state: all Supabase data)                   │
│                                                      │
│  - Query keys follow: [entity, agency_id, params]    │
│  - Stale time: 30s for lists, 60s for details        │
│  - Background refetch on window focus                 │
│  - Optimistic updates for approvals and status changes│
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                     Zustand                           │
│  (Client-only state)                                 │
│                                                      │
│  - UI state: sidebar collapsed, active filters        │
│  - Wizard state: setup wizard progress (unsaved)      │
│  - Notification queue                                 │
└──────────────────────────────────────────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Supabase Edge Functions (Deno Runtime)

Edge functions handle all server-side logic that cannot be expressed as pure
database queries with RLS. They run on Deno Deploy infrastructure (cold start
~50-200ms, warm execution ~10-50ms for non-AI calls).

**Function Categories:**

| Category             | Functions                                           | Trigger            |
| -------------------- | --------------------------------------------------- | ------------------- |
| AI Pipeline          | `ai-agent-execute`, `ai-context-assemble`, `ai-grade-output` | HTTP (from SPA)  |
| Webhooks (inbound)   | `stripe-webhook`, `meta-webhook`                    | HTTP (from external)|
| Integrations         | `meta-fetch-insights`, `resend-send-email`          | HTTP or cron        |
| Auth helpers         | `portal-session-create`, `portal-token-validate`    | HTTP (from SPA)     |
| Background jobs      | `readiness-audit-run`, `report-generate`            | HTTP (cron trigger) |

### 3.2 Database (PostgreSQL)

PostgreSQL serves as the single source of truth for all application state.
Extensions in use:

| Extension     | Purpose                                                   |
| ------------- | --------------------------------------------------------- |
| `pgvector`    | Vector storage and similarity search for RAG              |
| `pg_cron`     | Scheduled jobs (report generation, data refresh)          |
| `pgjwt`       | JWT verification within RLS policies                      |
| `uuid-ossp`   | UUID generation for primary keys                          |

### 3.3 RLS Policy Architecture

Every table containing tenant data enforces row-level security. The pattern:

```sql
-- Standard agency isolation policy (applied to all agency-scoped tables)
CREATE POLICY "agency_isolation" ON [table_name]
  USING (agency_id = (auth.jwt() ->> 'agency_id')::uuid);

-- Client portal policy (applied to portal-accessible tables)
CREATE POLICY "portal_read" ON [table_name]
  FOR SELECT
  USING (
    client_id = (auth.jwt() ->> 'client_id')::uuid
    AND (auth.jwt() ->> 'role') = 'client_contact'
  );

-- Write restriction for portal users
CREATE POLICY "portal_write_approvals" ON approvals
  FOR INSERT
  USING (
    client_id = (auth.jwt() ->> 'client_id')::uuid
    AND (auth.jwt() ->> 'role') = 'client_contact'
  );
```

**Policy layers:**

1. **Tenant isolation**: agency_id match on every row (non-negotiable).
2. **Role-based access**: RBAC within the agency (owner > manager > strategist > creator).
3. **Portal scoping**: client contacts see only their own client's data.
4. **Agent execution**: service role used by edge functions with explicit agency_id/client_id passed and validated.

See [17-data-entities](17-data-entities-high-level.md) for per-entity RLS details.

---

## 4. AI Pipeline Architecture

### 4.1 Pipeline Stages

```
┌─────────┐    ┌────────────┐    ┌──────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│ TRIGGER  │───▶│  CONTEXT   │───▶│  PROMPT  │───▶│  LLM CALL  │───▶│  OUTPUT    │───▶│ GOVERNANCE │
│          │    │  ASSEMBLY  │    │  BUILD   │    │            │    │ VALIDATION │    │   CHECK    │
└─────────┘    └────────────┘    └──────────┘    └────────────┘    └────────────┘    └─────┬──────┘
                                                                                          │
                                                                                          ▼
                                                                                   ┌────────────┐
                                                                                   │ WRITE-BACK │
                                                                                   │ + NOTIFY   │
                                                                                   └────────────┘
```

### 4.2 Stage Details

**Stage 1: Trigger**

An AI agent execution is triggered by:
- User action (e.g., "Run readiness audit for Client X").
- System event (e.g., campaign deadline approaching, new client data ingested).
- Scheduled job (e.g., weekly reporting insight generation).

The trigger creates an `AgentExecution` record with status `pending`.

**Stage 2: Context Assembly**

The context assembler retrieves and merges relevant data:

```
Context = {
  agency_brain:  AgencyBrain fields relevant to agent type
                 (services, playbooks, brand_rules, compliance_rules, approval_matrix)

  client_brain:  ClientBrain fields relevant to agent type
                 (brand, audience, funnel, assets, constraints, performance_history)

  task_context:  Specific input for this execution
                 (current campaign, content draft, approval history, etc.)

  rag_context:   Retrieved document chunks from vector store
                 (agency documents, client documents, past successful outputs)

  agent_rules:   Agent-specific configuration
                 (output schema, temperature, max_tokens, required_fields)
}
```

Context is assembled by the `ai-context-assemble` edge function. RAG retrieval
uses pgvector similarity search with freshness weighting. See
[18-rag-ocr](18-rag-ocr-grading-architecture.md) for RAG pipeline details.

**Stage 3: Prompt Construction**

The prompt builder combines context into a structured prompt:

```
System prompt:
  - Agent identity and role definition
  - Agency-specific rules (from agency_brain)
  - Output format specification (JSON schema)
  - Constraint declarations (what the agent must NOT do)

User prompt:
  - Task description
  - Client context summary
  - RAG-retrieved reference material
  - Specific input data

Response format:
  - Structured JSON matching the agent's output schema
  - Confidence score (0.0-1.0) required
  - Source attribution references
```

**Stage 4: LLM Call**

```
Provider:        Configurable (currently OpenAI-compatible endpoint)
Model:           Varies by agent type and complexity
Temperature:     Agent-specific (strategy: 0.3, content: 0.7, compliance: 0.1)
Max tokens:      Agent-specific
Timeout:         30 seconds (hard limit)
Retry policy:    2 retries with exponential backoff (1s, 3s)
Cost tracking:   Token counts logged per execution for billing
```

**Stage 5: Output Validation**

The output validator checks:
1. **Schema compliance**: Response matches the agent's output JSON schema.
2. **Completeness**: All required fields present and non-empty.
3. **Length bounds**: Output within expected character/word limits.
4. **Confidence threshold**: Agent's self-reported confidence meets minimum (varies by agent).
5. **Sanitization**: No prompt injection artifacts, no PII leakage outside expected fields.

Failed validation → `AgentExecution.status = 'validation_failed'` → retry or escalate.

**Stage 6: Governance Check**

The governance layer applies agency-specific rules:
1. **Approval matrix lookup**: Does this output type require human approval?
2. **Compliance rules check**: Does the output comply with agency's declared compliance rules?
3. **Brand rules check**: Does content match agency's brand voice requirements?
4. **Quality grading**: Secondary LLM pass scores the output (see [18-rag-ocr](18-rag-ocr-grading-architecture.md)).
5. **Risk flag detection**: High-risk claims, sensitive topics, regulatory triggers.

Outcome:
- **Auto-approved**: Output meets all thresholds → write-back immediately.
- **Pending review**: Output requires human approval → create Approval record.
- **Rejected**: Output fails governance → log failure, retry with modified prompt, or escalate.

**Stage 7: Write-back and Notification**

Approved outputs are written to their target entity:
- Strategy agent output → `Strategy.recommendations`
- Content agent output → `Content.draft`
- Reporting agent output → `Report.insights`

Notifications sent via Supabase Realtime (in-app) and Resend (email) to relevant users.

### 4.3 Token Budget Management

```
Per-agent token budgets (context + response):

  Readiness Audit Agent:     8,000 tokens context  + 4,000 response
  Strategy Architect Agent:  12,000 tokens context  + 6,000 response
  Campaign Brief Agent:      6,000 tokens context   + 3,000 response
  Content Agent:             4,000 tokens context   + 2,000 response
  Compliance Reviewer Agent: 6,000 tokens context   + 2,000 response
  Reporting Insight Agent:   10,000 tokens context  + 4,000 response

  Context is trimmed using priority-based truncation:
  1. Agent rules (never trimmed)
  2. Task context (never trimmed)
  3. Client brain (trimmed last)
  4. Agency brain (trimmed if over budget)
  5. RAG context (trimmed first)
```

---

## 5. Agent Architecture

### 5.1 Agent Registry

Each governed specialist agent is registered with a fixed configuration:

```typescript
interface AgentDefinition {
  agent_type: string;              // e.g., "readiness_audit"
  display_name: string;            // e.g., "Readiness Audit Agent"
  description: string;
  context_requirements: {
    agency_brain_fields: string[];  // which AgencyBrain fields are needed
    client_brain_fields: string[];  // which ClientBrain fields are needed
    additional_entities: string[];  // e.g., ["strategies", "campaigns"]
    rag_enabled: boolean;
  };
  execution_config: {
    model: string;
    temperature: number;
    max_context_tokens: number;
    max_response_tokens: number;
    timeout_ms: number;
  };
  output_schema: JSONSchema;       // strict schema for output validation
  approval_rules: {
    auto_approve_threshold: number; // confidence above this → auto-approve
    requires_human_review: boolean; // override: always require human review
    reviewer_roles: string[];       // which roles can approve
  };
  output_target: {
    entity_type: string;            // e.g., "strategy", "content", "report"
    field: string;                  // e.g., "recommendations", "draft"
  };
}
```

### 5.2 Registered Agents

| Agent Type               | Trigger              | Output Target              | Auto-Approve |
| ------------------------ | -------------------- | -------------------------- | ------------ |
| `setup_assistant`        | Agency setup wizard  | AgencyBrain fields         | Yes          |
| `readiness_audit`        | User action          | Strategy.readiness_report  | No           |
| `diagnosis`              | User action          | Strategy.diagnosis         | No           |
| `strategy_architect`     | User action          | Strategy.recommendations   | No           |
| `campaign_brief`         | Strategy approved    | Campaign.brief             | No           |
| `content_generator`      | Brief approved       | Content.draft              | Configurable |
| `compliance_reviewer`    | Content generated    | Content.compliance_report  | Yes          |
| `approvals_followup`     | Approval stale >48h  | Notification               | Yes          |
| `blocker_detection`      | Scheduled (daily)    | Task.blocker_flags         | Yes          |
| `reporting_insight`      | Scheduled (weekly)   | Report.insights            | No           |
| `renewal_risk_signal`    | Scheduled (monthly)  | Client.risk_flags          | No           |

### 5.3 Agent Execution Model

```
1. Edge function receives execution request
2. Validate: Does the requesting user have permission to trigger this agent?
3. Validate: Are all context requirements satisfiable? (e.g., does the client have a brain?)
4. Create AgentExecution record (status: "running")
5. Assemble context (Stage 2)
6. Build prompt (Stage 3)
7. Call LLM (Stage 4)
8. Validate output (Stage 5)
9. Governance check (Stage 6)
10. Write-back or queue for approval (Stage 7)
11. Update AgentExecution record (status: "completed" | "pending_approval" | "failed")
12. Emit Realtime event for UI update
```

---

## 6. Data Flow Through Platform Layers

```
Layer 1: AGENCY OS SETUP
  Agency configures: services, playbooks, brand rules, compliance, approval matrix
  Writes to: AgencyBrain
  ──────────────────────────────────────────────────────────────
       │
       ▼
Layer 2: CLIENT OPERATING RECORD
  Agency creates client, configures: brand, audience, funnel, constraints
  AI assists: ingests documents (OCR), extracts entities, enriches brain
  Writes to: Client, ClientBrain
  ──────────────────────────────────────────────────────────────
       │
       ▼
Layer 3: STRATEGY INTELLIGENCE
  AI reads: AgencyBrain + ClientBrain
  Produces: readiness audit → diagnosis → strategy recommendations
  Writes to: Strategy (with approval gates)
  ──────────────────────────────────────────────────────────────
       │
       ▼
Layer 4: EXECUTION & DELIVERY SPINE
  Strategy approved → AI generates campaign briefs → tasks created
  Content generated → compliance reviewed → approved → delivered
  Writes to: Campaign, Content, Task, Approval
  ──────────────────────────────────────────────────────────────
       │
       ▼
Layer 5: CLIENT COLLABORATION SURFACE
  Client portal displays: active campaigns, content for approval, reports
  Client actions: approve/reject content, leave comments
  Writes to: Approval (client decisions), Comments
  ──────────────────────────────────────────────────────────────
       │
       ▼
Layer 6: GOVERNED SPECIALIST AGENTS
  Agents operate across all layers:
  - Setup agent assists Layer 1
  - Readiness/diagnosis/strategy agents power Layer 3
  - Brief/content/compliance agents power Layer 4
  - Blocker/followup agents monitor Layer 4
  - Reporting/renewal agents feed Layers 2 and 5
  All writes are governed: validated, graded, approval-gated
```

---

## 7. Security Architecture

### 7.1 Tenant Isolation

```
PRIMARY ISOLATION: PostgreSQL Row-Level Security (RLS)
  - Every table with tenant data has agency_id column
  - RLS policy enforces agency_id = JWT claim at the database level
  - Even if application code has bugs, data cannot leak across tenants
  - Service role (used by edge functions) explicitly sets agency_id per call

SECONDARY ISOLATION: Application-level checks
  - Edge functions validate agency_id from JWT before any operation
  - React Query keys include agency_id to prevent cache pollution
  - File storage paths namespaced: /{agency_id}/{client_id}/
```

### 7.2 Authentication and Authorization

```
AUTHENTICATION:
  - Supabase Auth (email/password + magic link)
  - JWT tokens with 1-hour expiry, automatic silent refresh
  - Portal tokens: signed, short-lived, revocable

AUTHORIZATION (RBAC):
  Owner      → full access, billing, user management, agency setup
  Manager    → client management, strategy approval, campaign oversight
  Strategist → strategy creation, campaign management, content review
  Creator    → content creation, task execution

  Client Contact → portal-scoped: view campaigns, approve content, view reports
```

### 7.3 API Security

| Measure              | Implementation                                          |
| -------------------- | ------------------------------------------------------- |
| CORS                 | Allowlist: app domain + portal domain only              |
| Rate limiting        | Supabase built-in: 100 req/s per JWT, 10 req/s for AI  |
| Input validation     | Zod schemas on all edge function inputs                 |
| Output sanitization  | HTML escaping on all user-generated content             |
| Secrets management   | Supabase Vault for API keys (Meta, Stripe, LLM, Resend)|
| SQL injection        | Parameterized queries only (Supabase client enforces)   |
| File upload          | Type validation, size limits (10MB), virus scanning     |

### 7.4 Data Encryption

```
At rest:   Supabase-managed encryption (AES-256) for database and file storage
In transit: TLS 1.3 for all connections (CDN, API, database, external services)
Secrets:   Stored in Supabase Vault, never in environment variables directly
Backups:   Supabase-managed daily backups with point-in-time recovery
```

---

## 8. Infrastructure

### 8.1 Hosting Model

```
FRONTEND:       Vite build → static files → CDN (Vercel / Netlify / Supabase hosting)
BACKEND:        Supabase Cloud (managed PostgreSQL + Edge Functions + Auth + Storage)
AI INFERENCE:   External LLM provider (API calls from edge functions)
EMAIL:          Resend API
PAYMENTS:       Stripe API
SOCIAL DATA:    Meta/Facebook API
```

### 8.2 Edge Function Performance

```
Cold start:     50-200ms (Deno Deploy infrastructure)
Warm execution: 10-50ms for non-AI calls
AI calls:       1-15 seconds depending on agent complexity
Memory limit:   150MB per invocation
Timeout:        30 seconds (configurable up to 60s)
Concurrency:    Managed by Supabase (auto-scaling)
```

### 8.3 Database Performance

```
Connection pooling:  Supabase PgBouncer (transaction mode)
Indexes:             B-tree on all foreign keys, GIN on JSONB fields, IVFFlat on vectors
Query timeout:       15 seconds
Max connections:     Tier-dependent (Pro: 60 direct, 200 pooled)
```

---

## 9. Integration Patterns

### 9.1 Meta/Facebook API

```
Direction:    Read-only (inbound data)
Data:         Ad account insights, page insights, campaign performance
Auth:         Facebook App → User access token → long-lived token → stored in Vault
Refresh:      Token refresh via scheduled edge function (every 30 days)
Rate limits:  Respected via queued fetch with exponential backoff
Storage:      Performance data written to ClientBrain.performance_history
```

### 9.2 Stripe

```
Direction:    Bidirectional
Outbound:     Create checkout sessions, manage subscriptions, update payment methods
Inbound:      Webhooks for subscription.created, invoice.paid, subscription.cancelled
Auth:         API key in Supabase Vault
Webhook:      Signature verification via stripe-webhook edge function
Idempotency:  Webhook events deduplicated by event ID
```

### 9.3 Resend (Email)

```
Direction:    Outbound only
Use cases:    Portal invitations, approval notifications, weekly digests, alerts
Auth:         API key in Supabase Vault
Templates:    Server-side rendered in edge functions (no client-side email)
Rate limit:   Batched sends for bulk notifications
```

### 9.4 Future Integration Architecture

```
All future integrations follow the same pattern:
1. Edge function handles the integration logic
2. API keys stored in Supabase Vault
3. Inbound webhooks verified by signature
4. Outbound calls rate-limited and retried
5. Integration state stored in database (last_sync, error_count)
6. Integration errors surfaced in agency dashboard
```

---

## 10. Error Handling and Observability

### 10.1 Error Categories

| Category        | Handling                                               | User Impact         |
| --------------- | ------------------------------------------------------ | ------------------- |
| Validation      | 400 response with field-level errors                   | Inline form errors  |
| Auth failure    | 401 → redirect to login                                | Re-authentication   |
| Permission      | 403 → error toast with explanation                     | Access denied UI    |
| Not found       | 404 → fallback UI                                      | "Not found" page    |
| AI failure      | AgentExecution.status = 'failed', retry or escalate    | "AI unavailable"    |
| External API    | Logged, retried with backoff, degraded feature flagged | Partial data shown  |
| Database        | 500 → generic error, logged with full context          | "Something went wrong" |

### 10.2 Observability Stack

```
Logging:        Supabase Dashboard logs (edge function logs, database logs)
Error tracking: Sentry (frontend) with Supabase edge function integration
Metrics:        Custom counters in database (AgentExecution success/failure rates)
Uptime:         External monitoring (e.g., BetterUptime) on health check endpoint
Alerts:         Email alerts via Resend for critical failures (AI pipeline down,
                Stripe webhook failures, auth anomalies)
```

---

## 11. Scalability Considerations

### 11.1 Current Capacity (Supabase Pro)

```
Database:       8 GB RAM, 50 GB storage, 200 pooled connections
Edge Functions: Auto-scaled, ~1000 concurrent invocations
File Storage:   100 GB included
Realtime:       500 concurrent connections
```

### 11.2 Scaling Triggers

| Metric                              | Threshold          | Action                          |
| ----------------------------------- | ------------------ | ------------------------------- |
| Database CPU sustained > 80%        | 24 hours           | Upgrade Supabase tier           |
| Edge function cold starts > 500ms   | p95 over 1 hour    | Optimize function size, warm    |
| AI pipeline latency > 20s           | p95 over 1 hour    | Reduce context, parallelize     |
| Database storage > 80% capacity     | Any                 | Upgrade storage, archive old data|
| Realtime connections > 400          | Sustained           | Upgrade Supabase tier           |

### 11.3 Future Scaling Path

```
Phase 1 (current):    Single Supabase project, all tenants co-located
Phase 2 (100+ agencies): Read replicas for reporting queries
Phase 3 (500+ agencies): Dedicated database instances for enterprise tenants
Phase 4 (1000+):     Multi-region deployment with Supabase branching
```

---

*For the complete data model, see [17-data-entities](17-data-entities-high-level.md).
For RAG and quality grading details, see [18-rag-ocr](18-rag-ocr-grading-architecture.md).
For AI governance and safety policies, see [08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md).*
