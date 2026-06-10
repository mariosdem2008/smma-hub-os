# SMMAHUB Feature Matrix: MVP / V1 / V2

> Version 1.0 | March 2026
> Cross-references: [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [14-mvp-scope.md](./14-mvp-scope.md), [10-information-architecture.md](./10-information-architecture.md), [11-ui-ux-design-system.md](./11-ui-ux-design-system.md)

## Legend

| Symbol | Meaning |
|--------|---------|
| Y | Included in release |
| -- | Not included |
| P0 | Critical / launch blocker |
| P1 | High priority |
| P2 | Medium priority |
| P3 | Nice to have |

Platform layers: (1) Agency OS Setup, (2) Client Operating Record, (3) Strategy Intelligence, (4) Execution & Delivery Spine, (5) Client Collaboration Surface, (6) Governed Specialist Agents.

---

## 1. Agency Setup

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 1.1 | Agency creation and onboarding | Y | Y | Y | P0 | 1 |
| 1.2 | Agency profile (name, logo, timezone) | Y | Y | Y | P0 | 1 |
| 1.3 | Operating model configuration (services, niches) | Y | Y | Y | P0 | 1 |
| 1.4 | AI welcome / guided first run | Y | Y | Y | P0 | 1 |
| 1.5 | Knowledge module editor (single module) | Y | Y | Y | P0 | 1, 6 |
| 1.6 | Knowledge module library (all modules) | -- | Y | Y | P1 | 1, 6 |
| 1.7 | Agency data import (CSV, manual) | Y | Y | Y | P1 | 1 |
| 1.8 | Agency data import (CRM integrations) | -- | -- | Y | P3 | 1 |
| 1.9 | Multi-agency support (select agency) | Y | Y | Y | P1 | 1 |
| 1.10 | Agency archiving / deletion | -- | Y | Y | P2 | 1 |

## 2. Client Management

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 2.1 | Client creation (manual) | Y | Y | Y | P0 | 2 |
| 2.2 | AI-assisted client onboarding (chat) | Y | Y | Y | P0 | 2, 6 |
| 2.3 | Client workspace (tabbed detail view) | Y | Y | Y | P0 | 2 |
| 2.4 | Client list with search and filters | Y | Y | Y | P0 | 2 |
| 2.5 | Client health score | -- | Y | Y | P1 | 2 |
| 2.6 | Client tags and segmentation | -- | Y | Y | P2 | 2 |
| 2.7 | Client archiving | Y | Y | Y | P1 | 2 |
| 2.8 | Client notes and activity log | -- | Y | Y | P2 | 2 |
| 2.9 | Client brand asset storage | Y | Y | Y | P1 | 2 |
| 2.10 | Client social profile linking | Y | Y | Y | P1 | 2 |
| 2.11 | Bulk client operations | -- | -- | Y | P3 | 2 |

## 3. Strategy Engine

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 3.1 | Readiness scoring (per agent class) | Y | Y | Y | P0 | 3 |
| 3.2 | Readiness preview per agent | Y | Y | Y | P0 | 3 |
| 3.3 | Single-channel strategy generation | Y | Y | Y | P0 | 3, 6 |
| 3.4 | Multi-channel strategy generation | -- | Y | Y | P1 | 3, 6 |
| 3.5 | Strategy versioning and history | -- | Y | Y | P1 | 3 |
| 3.6 | Competitor analysis input | -- | Y | Y | P2 | 3 |
| 3.7 | Strategy templates (per niche) | -- | Y | Y | P2 | 3 |
| 3.8 | Strategy scoring and confidence | -- | Y | Y | P1 | 3 |
| 3.9 | Strategy-to-content pipeline | -- | Y | Y | P1 | 3, 4 |
| 3.10 | Audience persona generation | -- | -- | Y | P2 | 3, 6 |
| 3.11 | Market trend analysis | -- | -- | Y | P3 | 3, 6 |

## 4. Content System

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 4.1 | Content brief generation (AI) | Y | Y | Y | P0 | 4, 6 |
| 4.2 | Content calendar (month view) | -- | Y | Y | P1 | 4 |
| 4.3 | Content calendar (week view) | -- | Y | Y | P2 | 4 |
| 4.4 | Draft editor (rich text) | -- | Y | Y | P1 | 4 |
| 4.5 | Image/video asset attachment | Y | Y | Y | P1 | 4 |
| 4.6 | Content status tracking | Y | Y | Y | P0 | 4 |
| 4.7 | Content templates | -- | Y | Y | P2 | 4 |
| 4.8 | AI caption generation | -- | Y | Y | P1 | 4, 6 |
| 4.9 | AI hashtag suggestions | -- | Y | Y | P2 | 4, 6 |
| 4.10 | Content batch generation | -- | -- | Y | P2 | 4, 6 |
| 4.11 | Direct publishing (Meta API) | -- | -- | Y | P2 | 4 |
| 4.12 | Content performance tracking | -- | -- | Y | P2 | 4 |

## 5. Approval Workflows

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 5.1 | Basic approval (approve/reject) | Y | Y | Y | P0 | 4 |
| 5.2 | Approval with comments | Y | Y | Y | P0 | 4 |
| 5.3 | Multi-step approval chains | -- | Y | Y | P1 | 4 |
| 5.4 | Approval notifications (in-app) | Y | Y | Y | P0 | 4 |
| 5.5 | Approval notifications (email) | -- | Y | Y | P1 | 4 |
| 5.6 | Approval SLA / deadline tracking | -- | Y | Y | P2 | 4 |
| 5.7 | Bulk approvals | -- | -- | Y | P2 | 4 |
| 5.8 | Approval analytics (turnaround time) | -- | -- | Y | P3 | 4 |
| 5.9 | Client-side approval (portal) | Y | Y | Y | P0 | 4, 5 |

## 6. Client Portal

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 6.1 | Client authentication (separate auth) | Y | Y | Y | P0 | 5 |
| 6.2 | Portal overview dashboard | Y | Y | Y | P0 | 5 |
| 6.3 | View-only content calendar | Y | Y | Y | P0 | 5 |
| 6.4 | Approval interface (portal) | Y | Y | Y | P0 | 4, 5 |
| 6.5 | Performance reports (portal) | -- | Y | Y | P1 | 5 |
| 6.6 | File/asset sharing | Y | Y | Y | P1 | 5 |
| 6.7 | Portal messaging | -- | Y | Y | P1 | 5 |
| 6.8 | Idea submission | -- | Y | Y | P2 | 5 |
| 6.9 | Branding section | -- | Y | Y | P2 | 5 |
| 6.10 | Social profile management | -- | Y | Y | P2 | 5 |
| 6.11 | White-label portal (custom slug, branding) | -- | -- | Y | P2 | 5 |
| 6.12 | Portal AI assistant | -- | -- | Y | P2 | 5, 6 |
| 6.13 | Portal SSO | -- | -- | Y | P3 | 5 |
| 6.14 | Portal mobile app (PWA) | -- | -- | Y | P3 | 5 |

## 7. AI Agents & Governance

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 7.1 | Trust level 1: Suggestions only | Y | Y | Y | P0 | 6 |
| 7.2 | Trust level 2: Draft with approval | -- | Y | Y | P1 | 6 |
| 7.3 | Trust level 3: Auto-execute within guardrails | -- | -- | Y | P2 | 6 |
| 7.4 | AI guardrails configuration | Y | Y | Y | P0 | 1, 6 |
| 7.5 | Agent readiness system | Y | Y | Y | P0 | 3, 6 |
| 7.6 | Knowledge module system | Y | Y | Y | P0 | 1, 6 |
| 7.7 | AI workflow configuration | Y | Y | Y | P1 | 1, 6 |
| 7.8 | AI activation / go-live controls | Y | Y | Y | P0 | 1, 6 |
| 7.9 | AI control center (post-activation) | -- | Y | Y | P1 | 6 |
| 7.10 | Agent marketplace (browse & install) | -- | -- | Y | P2 | 6 |
| 7.11 | Custom agent builder | -- | -- | Y | P3 | 6 |
| 7.12 | AI audit log | -- | Y | Y | P1 | 6 |
| 7.13 | AI cost tracking / token usage | -- | Y | Y | P2 | 6 |
| 7.14 | Agent performance analytics | -- | -- | Y | P2 | 6 |

## 8. Reporting

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 8.1 | Basic report generation (per client) | Y | Y | Y | P0 | 4 |
| 8.2 | Report templates | -- | Y | Y | P1 | 4 |
| 8.3 | Automated scheduled reports | -- | Y | Y | P2 | 4 |
| 8.4 | Cross-client agency dashboard | -- | Y | Y | P1 | 4 |
| 8.5 | Custom metrics and KPIs | -- | -- | Y | P2 | 4 |
| 8.6 | Report PDF export | -- | Y | Y | P1 | 4 |
| 8.7 | Report sharing via portal | -- | Y | Y | P1 | 4, 5 |
| 8.8 | White-label reports | -- | -- | Y | P2 | 4, 5 |
| 8.9 | AI-generated report narratives | -- | -- | Y | P2 | 4, 6 |

## 9. Billing

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 9.1 | Stripe subscription management | Y | Y | Y | P0 | 1 |
| 9.2 | Paid plan selection (Operate, Scale, Agency, Custom) | Y | Y | Y | P0 | 1 |
| 9.3 | Billing overview dashboard | Y | Y | Y | P0 | 1 |
| 9.4 | Invoice history | -- | Y | Y | P1 | 1 |
| 9.5 | Usage-based billing (token metering) | -- | -- | Y | P2 | 1 |
| 9.6 | Client billing pass-through | -- | -- | Y | P3 | 1 |
| 9.7 | Upgrade prompts and assistant | Y | Y | Y | P0 | 1 |

## 10. Team Management

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 10.1 | Team member invitations (email) | Y | Y | Y | P0 | 1 |
| 10.2 | Role assignment (owner, manager, creator) | Y | Y | Y | P0 | 1 |
| 10.3 | Team member list and management | Y | Y | Y | P0 | 1 |
| 10.4 | Role-based access control (RBAC) | -- | Y | Y | P1 | 1 |
| 10.5 | Client-level team assignment | -- | Y | Y | P1 | 1, 2 |
| 10.6 | Activity audit log (per team member) | -- | -- | Y | P2 | 1 |
| 10.7 | Team performance metrics | -- | -- | Y | P3 | 1 |

## 11. Integrations

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 11.1 | Supabase Auth (agency) | Y | Y | Y | P0 | 1 |
| 11.2 | Supabase Auth (client portal) | Y | Y | Y | P0 | 5 |
| 11.3 | Stripe billing | Y | Y | Y | P0 | 1 |
| 11.4 | Meta Business Suite (read-only) | -- | Y | Y | P1 | 4 |
| 11.5 | Meta Business Suite (publishing) | -- | -- | Y | P2 | 4 |
| 11.6 | Google Analytics integration | -- | -- | Y | P2 | 4 |
| 11.7 | Slack notifications | -- | Y | Y | P2 | 4 |
| 11.8 | Zapier / webhooks | -- | -- | Y | P2 | 4 |
| 11.9 | Public REST API | -- | -- | Y | P2 | 1 |
| 11.10 | Google Drive / Dropbox (asset sync) | -- | -- | Y | P3 | 2 |
| 11.11 | Canva integration | -- | -- | Y | P3 | 4 |

## 12. Admin & Infrastructure

| # | Feature | MVP | V1 | V2 | Priority | Layer |
|---|---------|-----|----|----|----------|-------|
| 12.1 | Row-level security (RLS) | Y | Y | Y | P0 | 1 |
| 12.2 | Edge Functions (AI endpoints) | Y | Y | Y | P0 | 6 |
| 12.3 | Real-time subscriptions | -- | Y | Y | P1 | 5 |
| 12.4 | Database migrations | Y | Y | Y | P0 | 1 |
| 12.5 | Error tracking (Sentry or similar) | -- | Y | Y | P1 | 1 |
| 12.6 | Analytics (PostHog or similar) | -- | Y | Y | P1 | 1 |
| 12.7 | Rate limiting (AI endpoints) | Y | Y | Y | P0 | 6 |
| 12.8 | Backup and disaster recovery | -- | Y | Y | P1 | 1 |
| 12.9 | GDPR data export / deletion | -- | Y | Y | P1 | 1 |
| 12.10 | SOC 2 compliance readiness | -- | -- | Y | P2 | 1 |
| 12.11 | Multi-region deployment | -- | -- | Y | P3 | 1 |

---

## Summary Counts

| Category | MVP | V1 | V2 |
|----------|-----|----|----|
| Agency Setup | 6 | 9 | 10 |
| Client Management | 6 | 9 | 11 |
| Strategy Engine | 3 | 8 | 11 |
| Content System | 4 | 9 | 12 |
| Approval Workflows | 4 | 7 | 9 |
| Client Portal | 5 | 10 | 14 |
| AI Agents & Governance | 7 | 11 | 14 |
| Reporting | 1 | 6 | 9 |
| Billing | 4 | 5 | 7 |
| Team Management | 3 | 5 | 7 |
| Integrations | 3 | 5 | 11 |
| Admin & Infrastructure | 4 | 8 | 11 |
| **Total** | **50** | **92** | **126** |

---

## Release Definitions

### MVP: Minimum Viable Governed AI Platform

The smallest product that proves an agency can configure its expertise once and run governed AI across a client engagement. See [14-mvp-scope.md](./14-mvp-scope.md) for detailed scope.

### V1: Full Operating System

Complete platform for running a Tier 2 SMMA with AI. Adds multi-channel strategy, content calendar, advanced approvals, integrations, and full portal features. Target: operating agencies with 5-25 active clients.

### V2: Marketplace & Enterprise

Marketplace for agent packs, custom agent builder, advanced branding, compliance readiness, and API access. Target: larger qualified agencies and custom accounts.
