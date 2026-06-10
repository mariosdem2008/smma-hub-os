# SMMAHUB Information Architecture

> Version 1.0 | March 2026
> Cross-references: [11-ui-ux-design-system.md](./11-ui-ux-design-system.md), [13-feature-matrix-mvp-v1-v2.md](./13-feature-matrix-mvp-v1-v2.md), [14-mvp-scope.md](./14-mvp-scope.md)

## 1. Overview

SMMAHUB serves two distinct user populations through two authentication domains:

| Domain | Auth Provider | Users | Base Path |
|--------|--------------|-------|-----------|
| Agency application | `AuthProvider` (Supabase Auth) | Agency Owner, Account Manager, Content Creator, Strategist | `/dashboard`, `/clients`, `/agency/*`, `/settings`, `/billing`, `/team`, `/messages` |
| Client portal | `ClientAuthProvider` (separate Supabase Auth scope) | Client Stakeholder | `/client/portal`, `/client/portal/:portalSlug` |

The IA maps directly to the 6 platform layers defined in the product vision. Every navigable section belongs to exactly one layer.

---

## 2. Platform Layer to Navigation Mapping

| # | Platform Layer | Primary Nav Sections | Key Routes |
|---|---------------|---------------------|------------|
| 1 | Agency OS Setup | Settings, AI Setup | `/settings`, `/agency/ai-setup/*` |
| 2 | Client Operating Record | Clients, Client Detail | `/clients`, `/clients/:clientId` |
| 3 | Strategy Intelligence | AI Setup (readiness, modules), Client Strategy tab | `/agency/ai-setup/readiness`, `/clients/:clientId` (strategy tab) |
| 4 | Execution & Delivery Spine | Content, Approvals (within client workspace) | `/clients/:clientId` (content tab, approvals tab) |
| 5 | Client Collaboration Surface | Client Portal, Messages | `/client/portal/*`, `/messages` |
| 6 | Governed Specialist Agents | AI Admin, AI Setup Modules | `/ai/admin`, `/agency/ai-setup/modules/*` |

---

## 3. Primary Navigation (Agency Application)

The agency application uses a persistent left sidebar (`AppLayout`) with top-level navigation items.

### 3.1 Sidebar Navigation Items

| Position | Label | Icon | Route | Layer |
|----------|-------|------|-------|-------|
| 1 | Dashboard | `LayoutDashboard` | `/dashboard` | 1 |
| 2 | Clients | `Users` | `/clients` | 2 |
| 3 | Messages | `MessageSquare` | `/messages` | 5 |
| 4 | Team | `UserPlus` | `/team` | 1 |
| 5 | Billing | `CreditCard` | `/billing` | 1 |
| 6 | AI Setup | `Brain` | `/agency/ai-setup` | 1, 3, 6 |
| 7 | Settings | `Settings` | `/settings` | 1 |

### 3.2 AI Setup Sub-Navigation

The AI Setup section (`AgencyAiSetupV2Layout`) provides its own internal navigation for configuring the governed AI system.

| Step | Label | Route | Purpose |
|------|-------|-------|---------|
| Overview | AI Setup Home | `/agency/ai-setup` | Dashboard of setup progress |
| 1 | Imports | `/agency/ai-setup/imports` | Import existing agency data |
| 2 | Foundations | `/agency/ai-setup/foundations` | Core operating model |
| 3 | Modules | `/agency/ai-setup/modules` | Knowledge module configuration |
| 3a | Module Detail | `/agency/ai-setup/modules/:moduleKey` | Individual module editor |
| 4 | Guardrails | `/agency/ai-setup/guardrails` | AI governance rules |
| 5 | Workflow | `/agency/ai-setup/workflow` | Approval and delivery workflow |
| 6 | Readiness | `/agency/ai-setup/readiness` | Readiness scoring dashboard |
| 6a | Readiness Preview | `/agency/ai-setup/readiness/preview/:agentClass` | Per-agent readiness detail |
| 7 | Activation | `/agency/ai-setup/activation` | Go-live controls |
| -- | Control Center | `/agency/ai-setup/control-center` | Post-activation management |

---

## 4. Secondary Navigation (Client Workspace)

When a user opens a client record (`/clients/:clientId`), they enter the `ClientDetailLayout` which replaces the sidebar with a client-specific tab bar.

### 4.1 Client Detail Tabs

| Tab | Content | Layer |
|-----|---------|-------|
| Overview | Client summary, health score, recent activity | 2 |
| Strategy | Strategy documents, AI-generated strategies, channel plans | 3 |
| Content | Content calendar, briefs, drafts, assets | 4 |
| Approvals | Pending approvals, approval history | 4 |
| Files | Shared documents, brand assets | 2 |
| Reports | Performance reports, analytics | 4 |
| Portal | Portal configuration, access management | 5 |
| Settings | Client-specific settings, team assignments | 2 |

### 4.2 Client Detail Sub-Routes

| Route | View |
|-------|------|
| `/clients/:clientId` | Default tab (Overview) |
| `/clients/:clientId/reports/:reportId` | Individual report detail |

---

## 5. Client Portal IA (Separate Auth Domain)

The client portal operates under `ClientAuthProvider` and uses a simplified navigation structure. Clients never see agency internals.

### 5.1 Portal Authentication Routes

| Route | Purpose |
|-------|---------|
| `/client/login` | Generic login |
| `/client/login/:portalSlug` | Branded login per agency |
| `/client/accept-invite` | Invitation acceptance |
| `/client/forgot-password/:portalSlug` | Password recovery |
| `/client/reset-password` | Password reset |

### 5.2 Portal Navigation (Authenticated)

Portal routes are served under both `/client/portal` and `/client/portal/:portalSlug` for white-label support.

| Position | Label | Route Segment | Layer |
|----------|-------|--------------|-------|
| 1 | Overview | `/` (index) | 5 |
| 2 | Approvals | `/approvals` | 4, 5 |
| 3 | Content Calendar | `/content-calendar` | 4, 5 |
| 4 | Performance | `/performance` | 4, 5 |
| 5 | Ideas | `/ideas` | 5 |
| 6 | Assets | `/assets` | 2, 5 |
| 7 | Branding | `/branding` | 2, 5 |
| 8 | Social | `/social` | 2, 5 |
| 9 | Social Profiles | `/social-profiles` | 2, 5 |
| 10 | Uploads | `/uploads` | 5 |
| 11 | Messages | `/messages` | 5 |
| 12 | AI Assistant | `/ai-assistant` | 5, 6 |

---

## 6. Page Hierarchy (3 Levels)

```
Level 0 (Shell)
  AuthProvider                     -- wraps all routes
  ClientAuthProvider               -- wraps /client/* routes only

Level 1 (Layout)
  AppLayout                        -- sidebar + header for agency routes
  ClientDetailLayout               -- client workspace chrome
  ClientPortalLayout               -- portal chrome
  AgencyAiSetupV2Layout            -- AI setup wizard chrome

Level 2 (Page)
  Dashboard, Clients, Team, Billing, Settings, Messages
  ClientDetail (tabbed)
  AgencyAiSetupV2Overview, ...V2Foundations, etc.
  PortalOverview, PortalApprovals, etc.

Level 3 (Detail / Sub-view)
  /clients/:clientId/reports/:reportId
  /agency/ai-setup/modules/:moduleKey
  /agency/ai-setup/readiness/preview/:agentClass
```

---

## 7. Complete URL Structure

### 7.1 Public Routes

| Pattern | Purpose |
|---------|---------|
| `/` | Landing page |
| `/auth` | Sign in / sign up |
| `/forgot-password` | Password recovery |
| `/reset-password` | Password reset |
| `/pricing` | Pricing page |
| `/terms` | Terms of service |
| `/privacy` | Privacy policy |
| `/invite/:token` | Team invitation acceptance |

### 7.2 Onboarding Routes (Authenticated, No Sidebar)

| Pattern | Purpose |
|---------|---------|
| `/bootstrap` | Tenancy detection and routing |
| `/welcome` | Post-auth welcome |
| `/select-agency` | Multi-agency selector |
| `/create-agency` | New agency creation |
| `/invitations` | Pending invitations |
| `/agency/welcome-ai` | AI welcome experience |
| `/ai/onboarding/agency` | Agency AI onboarding |
| `/onboarding/client/:clientId` | Client AI onboarding |

### 7.3 Agency Application Routes (Authenticated, Sidebar)

| Pattern | Purpose |
|---------|---------|
| `/dashboard` | Agency dashboard |
| `/clients` | Client list |
| `/clients/:clientId` | Client workspace |
| `/clients/:clientId/reports/:reportId` | Report detail |
| `/messages` | Agency messaging |
| `/team` | Team management |
| `/billing` | Billing management |
| `/billing/overview` | Billing overview |
| `/settings` | Agency settings |
| `/agency/ai-setup` | AI setup overview |
| `/agency/ai-setup/imports` | Data imports |
| `/agency/ai-setup/foundations` | Foundation config |
| `/agency/ai-setup/modules` | Module list |
| `/agency/ai-setup/modules/:moduleKey` | Module editor |
| `/agency/ai-setup/guardrails` | Guardrails config |
| `/agency/ai-setup/workflow` | Workflow config |
| `/agency/ai-setup/readiness` | Readiness dashboard |
| `/agency/ai-setup/readiness/preview/:agentClass` | Agent readiness |
| `/agency/ai-setup/activate` | Activation page |
| `/agency/ai-setup/activation` | Activation status |
| `/agency/ai-setup/control-center` | Post-activation control |
| `/ai/admin` | AI administration |

### 7.4 Client Portal Routes

| Pattern | Purpose |
|---------|---------|
| `/client/login` | Login |
| `/client/login/:portalSlug` | Branded login |
| `/client/portal` | Portal home |
| `/client/portal/:portalSlug` | White-label portal home |
| `/client/portal/[slug/]approvals` | Approvals |
| `/client/portal/[slug/]content-calendar` | Content calendar |
| `/client/portal/[slug/]performance` | Reports |
| `/client/portal/[slug/]ideas` | Idea submissions |
| `/client/portal/[slug/]assets` | Brand assets |
| `/client/portal/[slug/]branding` | Brand guidelines |
| `/client/portal/[slug/]social` | Social profiles |
| `/client/portal/[slug/]uploads` | File uploads |
| `/client/portal/[slug/]messages` | Messages |
| `/client/portal/[slug/]ai-assistant` | AI assistant |

---

## 8. Search and Filtering Model

### 8.1 Global Search

Global search is accessed via the command palette (Cmd/Ctrl+K). Search scope:

| Entity | Searchable Fields | Result Action |
|--------|------------------|---------------|
| Clients | Name, company, tags | Navigate to client workspace |
| Team members | Name, email, role | Navigate to team management |
| Content | Title, brief text | Navigate to content detail |
| Strategies | Title, channel | Navigate to strategy view |
| Messages | Subject, body preview | Navigate to message thread |

### 8.2 List Filtering

All list pages support consistent filtering patterns (see [11-ui-ux-design-system.md](./11-ui-ux-design-system.md) for component specs):

- **Text search**: Free-text filter within the current list
- **Status filters**: Dropdown or pill toggles (active/archived, pending/approved/rejected)
- **Date range**: Date picker for time-bounded views
- **Tag filters**: Multi-select for client tags, content categories
- **Sort controls**: Column header sorting on data tables

---

## 9. Notification Architecture

| Channel | Trigger Examples | Persona |
|---------|-----------------|---------|
| In-app toast | Action confirmation, AI generation complete | All |
| In-app badge | Pending approvals count, unread messages | Agency Owner, Account Manager |
| Email | Approval request, client portal invite, billing alert | All |
| Portal notification | Content ready for review, message from agency | Client Stakeholder |

Notifications are stored in Supabase and delivered via real-time subscriptions for in-app, with Edge Functions triggering email delivery.

---

## 10. Breadcrumb Strategy

Breadcrumbs appear on Level 2 and Level 3 pages. They follow the navigation hierarchy:

| Page | Breadcrumb |
|------|-----------|
| Client workspace | Clients > {Client Name} |
| Report detail | Clients > {Client Name} > Reports > {Report Title} |
| AI Setup module | AI Setup > Modules > {Module Name} |
| Readiness preview | AI Setup > Readiness > {Agent Class} |
| Portal approvals | Home > Approvals |

Breadcrumbs are not shown on Level 1 pages (Dashboard, Clients list, etc.) since the sidebar provides sufficient context.

---

## 11. Mobile Considerations

SMMAHUB is a desktop-first application. Mobile support is tiered:

| Tier | Viewport | Support Level | Notes |
|------|----------|--------------|-------|
| Desktop | >= 1280px | Full feature parity | Primary target |
| Tablet | 768-1279px | Full features, collapsed sidebar | Sidebar becomes hamburger menu |
| Mobile | < 768px | Portal only, limited agency | Client portal is fully responsive; agency app shows critical views only (dashboard, approvals, messages) |

The client portal is fully responsive because Client Stakeholders frequently access it from mobile devices. The agency application prioritizes desktop since agency teams work primarily on desktop.

### Mobile Navigation

- **Agency (tablet)**: Sidebar collapses to icon-only rail, expandable on tap
- **Agency (mobile)**: Bottom tab bar with 4 items: Dashboard, Clients, Messages, More
- **Portal (mobile)**: Bottom tab bar with 5 items: Home, Approvals, Calendar, Messages, More

---

## 12. Legacy Route Handling

The application maintains backward compatibility with deprecated routes:

| Legacy Route | Redirect Target |
|-------------|----------------|
| `/agency/brain` | `/agency/ai-setup` |
| `/agency/brain/:layer` | `/agency/ai-setup/:mappedModule` (via `LegacyBrainLayerRedirect`) |
| `/onboarding` | `/welcome` |
| `/ai/onboarding/client/:clientId` | `/onboarding/client/:clientId` |

All legacy redirects use `replace` to keep browser history clean.

---

## 13. Route Protection Model

| Route Group | Protection | Component |
|-------------|-----------|-----------|
| Public (`/`, `/auth`, `/pricing`) | None | Direct render |
| Onboarding (`/bootstrap`, `/welcome`) | Authenticated | `ProtectedRoute` |
| Agency app (`/dashboard`, `/clients`) | Authenticated + agency tenant | `ProtectedAppShell` (includes `AppLayout`) |
| Client detail (`/clients/:clientId`) | Authenticated + agency tenant | `ProtectedClientDetailShell` |
| Client portal (`/client/portal`) | Client-authenticated | `ClientAuthShell` > `ClientPortalLayout` |

The two auth providers (`AuthProvider` for agency, `ClientAuthProvider` for portal) are completely independent. A user cannot access portal routes with agency credentials and vice versa.
