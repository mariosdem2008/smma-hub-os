# SMMAHUB MVP Scope Definition

> Version 1.0 | March 2026
> Cross-references: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [13-feature-matrix-mvp-v1-v2.md](./13-feature-matrix-mvp-v1-v2.md), [10-information-architecture.md](./10-information-architecture.md), [11-ui-ux-design-system.md](./11-ui-ux-design-system.md), [12-bilingual-localization-strategy.md](./12-bilingual-localization-strategy.md)

## 1. MVP Definition

**One sentence**: An agency can onboard a client, generate a governed strategy, get it approved, produce content briefs, and deliver through a client portal.

**Core promise validated**: "Configure your agency's expertise once. Run it across every client with governed AI."

The MVP proves this promise by enabling a single agency to configure its AI operating model, onboard at least one client through that model, and deliver a governed AI output (strategy + content briefs) through a portal the client can access.

---

## 2. What is IN

### 2.1 Agency OS Setup (Layer 1)

| Feature | Description | Routes |
|---------|-------------|--------|
| Agency creation | Name, logo, timezone, niche, services | `/create-agency`, `/settings` |
| AI welcome experience | Guided first-run that introduces governed AI | `/agency/welcome-ai` |
| AI Setup wizard | Step-by-step configuration of the agency's AI | `/agency/ai-setup/*` |
| Data imports | Manual import of existing agency knowledge | `/agency/ai-setup/imports` |
| Foundations config | Core operating model (services, niches, tone) | `/agency/ai-setup/foundations` |
| Single knowledge module | Configure at least one knowledge module (e.g., tone of voice) | `/agency/ai-setup/modules/:moduleKey` |
| Guardrails config | Basic AI governance rules | `/agency/ai-setup/guardrails` |
| Workflow config | Basic approval workflow definition | `/agency/ai-setup/workflow` |
| AI activation | Go-live controls for the AI system | `/agency/ai-setup/activate` |
| Multi-agency support | Users can belong to multiple agencies | `/select-agency` |

### 2.2 Client Operating Record (Layer 2)

| Feature | Description | Routes |
|---------|-------------|--------|
| Client creation | Manual client creation with basic fields | `/clients` (create dialog) |
| AI-assisted client onboarding | Chat-based intake that populates the client record | `/onboarding/client/:clientId` |
| Client workspace | Tabbed detail view (overview, strategy, content, approvals, files, settings) | `/clients/:clientId` |
| Client list | Searchable, filterable list of all clients | `/clients` |
| Client archiving | Soft-delete / archive clients | `/clients/:clientId` (settings tab) |
| Brand asset storage | Upload and manage client brand assets (logo, colors, fonts) | `/clients/:clientId` (files tab) |
| Social profile linking | Connect client social profiles (display only, no API) | `/clients/:clientId` (overview tab) |

### 2.3 Strategy Intelligence (Layer 3)

| Feature | Description | Routes |
|---------|-------------|--------|
| Readiness scoring | Per-agent-class readiness score based on module completion | `/agency/ai-setup/readiness` |
| Readiness preview | Detail view of what each agent needs to function | `/agency/ai-setup/readiness/preview/:agentClass` |
| Single-channel strategy generation | Generate a strategy for one social channel using agency knowledge + client data | `/clients/:clientId` (strategy tab) |

Strategy generation is readiness-gated: the system will not generate a strategy until the relevant agent has sufficient readiness score (>= 70%).

### 2.4 Execution & Delivery Spine (Layer 4)

| Feature | Description | Routes |
|---------|-------------|--------|
| Content brief generation | AI generates content briefs based on the approved strategy | `/clients/:clientId` (content tab) |
| Content status tracking | Track briefs through statuses: draft, review, approved, published | `/clients/:clientId` (content tab) |
| Basic approval workflow | Approve / reject with comments | `/clients/:clientId` (approvals tab) |
| In-app approval notifications | Badge count on approvals, toast on action | Sidebar badge, toasts |
| Basic report generation | Single-client report with key metrics | `/clients/:clientId/reports/:reportId` |

### 2.5 Client Collaboration Surface (Layer 5)

| Feature | Description | Routes |
|---------|-------------|--------|
| Client authentication | Separate auth domain for portal users | `/client/login`, `/client/login/:portalSlug` |
| Client invitation | Invite client stakeholders via email | Agency-side client settings |
| Portal overview | Dashboard showing client status summary | `/client/portal` |
| View-only content calendar | Client can see upcoming content (no editing) | `/client/portal/content-calendar` |
| Portal approvals | Client can approve/reject content from portal | `/client/portal/approvals` |
| File sharing | Client can access shared brand assets | `/client/portal/assets` |

Portal is view-only in MVP. Clients can view content, approve/reject, and access shared files. No messaging, idea submission, or AI assistant.

### 2.6 Governed Specialist Agents (Layer 6)

| Feature | Description |
|---------|-------------|
| Trust level 1 only | All AI outputs are suggestions requiring human approval |
| AI guardrails | Configurable rules that constrain AI behavior |
| Agent readiness system | Agents only activate when knowledge modules meet threshold |
| Knowledge modules | Agency expertise encoded in structured modules |
| Rate limiting | AI endpoint rate limiting to prevent abuse/cost overrun |
| Edge Functions | Supabase Edge Functions for AI inference endpoints |

### 2.7 Billing

| Feature | Description | Routes |
|---------|-------------|--------|
| Stripe subscription | Subscribe to a plan via Stripe Checkout | `/billing` |
| Plan selection | Paid tiers only: Operate EUR199, Scale EUR349, Agency EUR499, plus custom | `/billing`, `/pricing` |
| Billing overview | Current plan, usage, next invoice | `/billing/overview` |
| Upgrade prompts | In-app prompts when hitting plan limits | `GlobalUpgradeModal`, `UpgradeAssistantCard` |

### 2.8 Team Management

| Feature | Description | Routes |
|---------|-------------|--------|
| Team invitations | Invite team members via email with token | `/team`, `/invite/:token` |
| Role assignment | Assign owner, manager, or creator role | `/team` |
| Team list | View and manage team members | `/team` |

### 2.9 Infrastructure

| Feature | Description |
|---------|-------------|
| Row-level security | All Supabase tables use RLS policies scoped to agency_id |
| Database migrations | Supabase migration system for schema changes |
| Auth (agency) | Supabase Auth with email/password |
| Auth (portal) | Separate Supabase Auth scope for client portal users |
| Rate limiting | Edge Function rate limiting on AI endpoints |

---

## 3. What is OUT (Deferred)

### 3.1 Deferred to V1

| Feature | Reason for Deferral |
|---------|-------------------|
| Multi-channel strategy generation | MVP proves single-channel; multi-channel adds complexity |
| Content calendar (month/week views) | MVP uses a simple list view for content |
| Rich text draft editor | MVP generates briefs; editing happens outside the platform |
| Multi-step approval chains | MVP uses single-step approve/reject |
| Email notifications | MVP uses in-app only; email requires transactional email setup |
| Portal messaging | MVP portal is view-only |
| Portal idea submission | Not needed for core value proof |
| Strategy versioning | MVP has one active strategy per client |
| Client health score | Requires enough data history to be meaningful |
| Client tags and segmentation | List + search is sufficient for MVP client counts |
| Report templates | MVP has basic report generation |
| AI audit log | Important for V1 compliance, not MVP launch blocker |
| AI control center | Post-activation management; MVP covers activation only |
| RBAC (fine-grained) | MVP uses basic role assignment without granular permissions |
| Meta Business Suite read integration | Requires OAuth flow and API approval |
| Slack notifications | Nice to have, not core |
| Real-time subscriptions | MVP uses polling/refresh for data updates |
| Error tracking (Sentry) | Should be added before V1 launch |
| Analytics (PostHog) | Should be added before V1 launch |

### 3.2 Deferred to V2

| Feature | Reason for Deferral |
|---------|-------------------|
| Agent marketplace | Requires agent ecosystem maturity |
| Custom agent builder | Requires stable agent API |
| White-label portal (custom domain, full branding) | Enterprise feature |
| Public REST API | Requires API design, documentation, rate limiting |
| Trust level 2 (draft with approval) | Requires proven trust in AI outputs |
| Trust level 3 (auto-execute) | Requires proven trust + advanced guardrails |
| Integrations (Google Analytics, Zapier, Canva) | Third-party dependency |
| Direct publishing (Meta API write) | Requires Meta API approval process |
| Content batch generation | Optimization feature for scale |
| Usage-based billing | Requires token metering infrastructure |
| Client billing pass-through | Complex billing logic |
| GDPR data export/deletion | Compliance requirement for regulated markets |
| SOC 2 compliance | Enterprise requirement |
| Multi-region deployment | Scale requirement |
| Portal AI assistant | Requires stable agent system |
| Portal SSO | Enterprise feature |
| Portal mobile app (PWA) | Enhancement |
| AI-generated report narratives | Requires report system maturity |
| White-label reports | Enterprise feature |

---

## 4. MVP Success Criteria

The MVP is validated when an agency can complete this end-to-end workflow:

### 4.1 Primary Success Path

| Step | Action | Validation |
|------|--------|-----------|
| 1 | Agency owner signs up and creates agency | Agency record exists in database |
| 2 | Owner completes AI Setup wizard (foundations + 1 module + guardrails + workflow) | Readiness score >= 70% for at least one agent class |
| 3 | Owner activates AI | AI system is live for the agency |
| 4 | Owner creates a client | Client record exists |
| 5 | Owner completes AI-assisted client onboarding | Client operating record is populated |
| 6 | Owner generates a single-channel strategy | Strategy document is generated and stored |
| 7 | Owner or client approves the strategy | Strategy status changes to "approved" |
| 8 | Owner generates content briefs from the strategy | At least 1 brief is generated |
| 9 | Owner sends brief for client approval | Approval record is created |
| 10 | Client logs into portal and approves the brief | Approval status changes to "approved" |

### 4.2 Quantitative Criteria

| Metric | Target |
|--------|--------|
| End-to-end time (steps 1-10) | < 60 minutes for a new user |
| AI setup completion rate | > 70% of users who start the wizard complete it |
| Strategy generation success rate | > 90% (no errors or empty outputs) |
| Portal login success rate | > 95% of invited clients can log in |
| Page load time (p95) | < 3 seconds |
| AI generation latency (p95) | < 15 seconds |
| Uptime | 99.5% |

### 4.3 Qualitative Criteria

- An agency owner with no technical background can complete the setup without documentation
- The generated strategy is specific enough to act on (not generic filler)
- The client portal feels professional enough to present to a real client
- The approval flow is clear and requires no explanation

---

## 5. MVP Personas and Priorities

| Persona | MVP Relevance | Key Flows |
|---------|--------------|-----------|
| Agency Owner | Primary | Setup, activation, client onboarding, billing |
| Account Manager | Secondary | Client management, approvals, strategy review |
| Content Creator | Tertiary | Content brief review (minimal in MVP) |
| Strategist | Tertiary | Strategy review (minimal in MVP) |
| Client Stakeholder | Primary (portal) | Portal login, content review, approvals |

---

## 6. Technical MVP Requirements

### 6.1 Frontend

| Requirement | Specification |
|-------------|--------------|
| Framework | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router 6 (see [10-information-architecture.md](./10-information-architecture.md)) |
| State | React Query for server state, React context for auth |
| Build target | Modern browsers (Chrome, Firefox, Safari, Edge, last 2 versions) |
| Bundle size | < 500KB initial load (gzipped) |
| Code splitting | Lazy loading via `React.lazy` for all page components |

### 6.2 Backend (Supabase)

| Requirement | Specification |
|-------------|--------------|
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email/password). Separate project or schema for portal auth |
| RLS | All tables have RLS policies. Agency data scoped by `agency_id` |
| Edge Functions | Deno-based functions for AI inference, onboarding, strategy generation |
| Storage | Supabase Storage for brand assets and file uploads |
| Migrations | SQL migrations in `supabase/migrations/` |

### 6.3 AI Infrastructure

| Requirement | Specification |
|-------------|--------------|
| LLM provider | OpenAI API (GPT-4 class) via Edge Functions |
| Prompt management | Prompts stored in code, versioned with git |
| Context injection | Agency knowledge modules injected as system context |
| Rate limiting | Per-agency, per-endpoint rate limits |
| Cost control | Token budget per generation, hard ceiling per agency/month |
| Fallback | Graceful error message if generation fails |

### 6.4 Security

| Requirement | Specification |
|-------------|--------------|
| Authentication | Supabase Auth with JWT tokens |
| Authorization | RLS policies + application-level role checks |
| Data isolation | Complete agency data isolation via RLS |
| Portal isolation | Client portal users cannot access agency data |
| HTTPS | Enforced on all routes |
| Input validation | Server-side validation on all Edge Function inputs |
| Secret management | API keys in Supabase Edge Function secrets, never in client code |

---

## 7. MVP Timeline Guidance

| Phase | Duration | Deliverable |
|-------|----------|------------|
| Foundation | Weeks 1-4 | Auth, agency setup, database schema, AI setup wizard |
| Client layer | Weeks 5-8 | Client CRUD, onboarding chat, workspace tabs |
| AI pipeline | Weeks 9-12 | Strategy generation, content briefs, readiness system |
| Approval & portal | Weeks 13-16 | Approval workflow, client portal (auth + views) |
| Billing & polish | Weeks 17-18 | Stripe integration, upgrade flows, bug fixes |
| Testing & launch | Weeks 19-20 | End-to-end testing, performance, soft launch |

Total estimated duration: 20 weeks (5 months) with a small team (2-3 engineers).

---

## 8. MVP Non-Goals

These are explicitly not goals for the MVP, to prevent scope creep:

| Non-Goal | Rationale |
|----------|-----------|
| Feature parity with Hootsuite/Sprout Social | SMMAHUB is not a social media management tool; it is an AI operating system |
| Supporting all social platforms | Single-channel focus reduces complexity |
| Mobile-first design | Agency users work on desktop; portal responsive is sufficient |
| Offline support | SaaS application, always-online assumption |
| Self-hosting | Supabase-hosted only for MVP |
| Plugin/extension system | Premature architecture; revisit in V2 |
| Multi-language UI | English only with i18n infrastructure (see [12-bilingual-localization-strategy.md](./12-bilingual-localization-strategy.md)) |
| AI-generated images or video | Text-based AI outputs only |
| Real-time collaboration (multiplayer editing) | Out of scope; one user edits at a time |

---

## 9. MVP Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| AI output quality too low for professional use | Medium | High | Readiness gating prevents premature generation; guardrails constrain output |
| Client portal feels too bare for real clients | Medium | Medium | Focus on clean design; view-only is acceptable if polished |
| AI setup wizard too complex / low completion rate | Medium | High | Guided first run, checkpoint cards, progress indicators |
| Stripe integration delays | Low | Medium | Start billing integration early; use test mode throughout |
| Supabase Edge Function cold starts slow AI | Medium | Medium | Keep functions warm; optimize payload size |
| RLS policy gaps expose data between agencies | Low | Critical | Comprehensive RLS tests; security audit before launch |
| Scope creep from "just one more feature" | High | High | This document is the scope contract. Defer everything not listed in Section 2 |

---

## 10. Post-MVP Priorities (First V1 Features)

Immediately after MVP launch, the highest-impact V1 features to build:

| Priority | Feature | Rationale |
|----------|---------|-----------|
| 1 | Email notifications for approvals | Most-requested by beta users; approvals die without email nudges |
| 2 | Content calendar (month view) | Visual planning is expected in a serious content operation |
| 3 | Multi-channel strategy | Agencies serve clients across multiple platforms |
| 4 | Portal messaging | Clients need a way to communicate within the platform |
| 5 | AI audit log | Trust and transparency for governed AI |
| 6 | Meta read integration | Pull actual performance data into reports |
| 7 | RBAC | Required as team sizes grow beyond 2-3 people |
| 8 | Error tracking (Sentry) | Operational necessity for production stability |

See [13-feature-matrix-mvp-v1-v2.md](./13-feature-matrix-mvp-v1-v2.md) for the complete V1 and V2 feature breakdown.
