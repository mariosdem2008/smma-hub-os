# SMMAHUB Current State
**Date:** 2026-04-04
**Type:** Current Reality — Not Target State
**Authority:** Product owner + code audit
**Reviewed by:** Claude (Cowork audit session)

---

## 1. Purpose

This document describes what SMMAHUB actually does today. It is not marketing copy, not a roadmap, and not aspirational. Everything here should be directly verifiable by running the app.

If this document is wrong, update it. Do not let it become optimistic.

---

## 2. Stack and Infrastructure

| Layer | Technology | Status |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite SPA | Stable |
| UI components | shadcn/ui + Radix UI + Tailwind CSS | Stable |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) | Stable |
| Data fetching | TanStack Query v5 | Stable |
| Routing | React Router v6 | Stable |
| Auth (agency) | Supabase Auth (email/password) | Working |
| Auth (client portal) | Custom client auth system via Supabase | Working |
| Billing | Stripe (checkout + subscriptions + webhooks) | ⚠️ Webhook secret not configured in prod |
| Social publishing | Meta OAuth (Instagram + Facebook) | Working |
| AI backend | Supabase Edge Functions (Deno) | Partial — depth varies by function |
| Testing | Vitest (unit) + Playwright (E2E) | Partial coverage |
| Database | 245 migrations applied | Stable |
| Edge functions | 67 deployed | Mixed — some production-ready, some experimental |

---

## 3. What Is Working

### 3.1 Authentication and Tenancy

- Agency email/password signup, login, logout
- Team invitation system with role assignment
- Client portal authentication (separate system)
- Client portal invitations from agency
- Password reset for both systems
- RBAC: owner, admin, manager, editor roles enforced
- Multi-agency: users can belong to multiple agencies
- Plan limits enforced at UI and data layers

### 3.2 Client Management

- Create, list, view, edit clients
- Client status tracking (active/paused/etc.)
- Client detail workspace with tabbed interface
- Client logo upload
- Agency isolation enforced via RLS

### 3.3 Content Pipeline

- 8-stage project pipeline: idea → pre-production → production → review → approved → scheduling → published → archived
- Project creation, editing, stage transitions
- Content calendar view with timezone support
- Bulk scheduling

### 3.4 Social Publishing

- Meta OAuth (Instagram + Facebook connection)
- Token refresh automation (12h cron job)
- Scheduled autopublishing (5min cron job)
- Post logs and failure tracking
- Instagram and Facebook autoposting functional

### 3.5 Assets

- File upload (image, video, documents)
- Asset organization per client
- Version history
- Comments on assets
- Client portal asset access

### 3.6 Ideas and Scripts

- Notion-like expandable idea pages
- Structured scripts editor
- Ideas board (kanban-style)

### 3.7 Client Portal

- Separate client login (portalSlug-based)
- Portal overview
- Content calendar (read access)
- Approval workflow (approve / request changes)
- Assets view
- Branding view (brand colors, fonts, guidelines)
- Social profiles view
- Ideas feed
- Messages thread
- Uploads (client can upload files to agency)
- AI Assistant route (depth varies)
- Performance view (basic metrics)
- Mobile bottom navigation

### 3.8 Team Management

- Invite team members
- Role assignment and management
- Multi-admin support (Agency Plus)
- Audit log for team actions

### 3.9 Billing

- Stripe checkout integration
- Subscription management (upgrade/downgrade)
- Plan limit enforcement
- Upgrade modal system
- ✅ **Stripe webhook configured and verified** (signature path tested end-to-end; idempotency/upsert fixes shipped 2026-06-10)
- ⚠️ **Pricing not yet migrated to the locked ICP model.** Per [00-ICP-AND-POSITIONING](00-ICP-AND-POSITIONING.md), the product targets Tier 2 operating agencies with a **€199/month floor and no free plan**. The code still ships the legacy Tier-1 tiers, explicitly **legacy, to be removed** (Free / Starter €29 / Pro €59 / Agency Plus €129), in `create-checkout`, `check-subscription`, and the pricing page. **Required action:** create new Stripe prices at €199 / €349 / €499 and replace the price-ID maps; remove the free plan from product surfaces.

### 3.10 Messaging

- Agency↔client message threads
- New conversation creation
- Unread message tracking

---

## 4. What Is Partially Built

### 4.1 Agency AI Setup V2

- 11-step wizard UI: Imports, Foundations, Modules, Guardrails, Workflow, Readiness, Activation, Control Center
- Navigation through wizard steps works
- Form capture at each step appears to work
- **Unclear:** How much of the wizard is wired to real AI execution vs. stored answers
- **Unclear:** Whether completing the wizard produces a behaviorally meaningful agency brain
- Brain module editor exists for: rep policy, strategy SOP, scripting SOP, tone/voice, FAQ/objections, AI permissions, offer stack, quality bar

### 4.2 Strategy Hub

- `StrategyKnowledgeCenter` component mounted at client detail → Strategy tab
- Strategy generation edge function exists (`ai-strategy-generate`)
- **Unclear:** Whether generated strategies are grounded in real client context and agency brain
- **Unclear:** Strategy-to-execution conversion (brief → task creation)

### 4.3 AI Onboarding

- Multiple versions exist: agency onboarding, client onboarding, client onboarding chat (V3)
- Chat-based client onboarding is the current primary flow
- **Issue:** Multiple overlapping edge functions suggest version instability
- Active flow: `ai-onboarding-v3` for client, `ai-onboarding` for agency

### 4.4 Reports

- Monthly report generation edge function exists
- PDF generation edge function exists
- Report detail page exists in client tabs
- **Unclear:** Whether reports are useful and complete or skeleton-level

### 4.5 Performance Analytics

- Analytics hooks exist (`useClientAnalytics`, `useProfileTrends`, `useMetaAds`)
- Portal performance tab exists
- **Unclear:** Whether real Meta API data flows through correctly

---

## 5. What Is Dead or Should Be Removed

All previously identified dead files have been removed. No dead code remains.

| Item | Status |
|---|---|
| LandingLegacy.tsx | ✅ Deleted |
| SchedulingDebug.tsx | ✅ Deleted |
| TeamAuditDebug.tsx | ✅ Deleted |
| AiFieldDemo.tsx | ✅ Deleted |
| heelper.txt | ✅ Deleted |
| PR_DESCRIPTION.md | ✅ Deleted |
| Multiple overlapping AI onboarding edge functions | ⚠️ Not yet consolidated — document which is active before beta |

---

## 6. Production Readiness Status

| Area | Status | Notes |
|---|---|---|
| Auth | ✅ Ready | Both systems working |
| Client management | ✅ Ready | Core CRUD working |
| Content pipeline | ✅ Ready | 8-stage pipeline working |
| Social publishing | ✅ Ready | Meta posting working |
| Client portal | ✅ Ready | Core portal working |
| Billing | ⚠️ Blocked | Stripe webhook secret not configured |
| Agency AI Setup | ⚠️ Uncertain | UI complete, AI depth unknown |
| Strategy Hub | ⚠️ Uncertain | Exists, depth unknown |
| AI onboarding | ⚠️ Uncertain | Multiple versions, one is active |
| Performance analytics | ⚠️ Uncertain | Hooks exist, real data flow unclear |
| Dead code cleanup | ✅ Done | All dead files removed |

---

## 7. Changes Applied (2026-04-04 Execution Session)

The following improvements were applied by Codex and validated as part of the product owner audit loop:

### Route Guards
- Added `OwnerAdminRoute` component to `src/App.tsx` — wraps `/agency/ai-setup/legacy` and `/ai/admin` routes; non-owner/non-admin users are redirected to `/dashboard` rather than seeing a blank or unauthorized page.

### Empty and Loading States (Client Tabs)
- **AnalyticsTab.tsx** — Empty state now uses `ClientTabEmptyState` with "No analytics data yet" messaging and Sync + AI Anomaly buttons. Skeleton loading states retained.
- **OverviewTab.tsx** — Empty state for `topPosts` array now uses `ClientTabEmptyState`. Skeleton loading for top posts card added.
- **BrandingTab.tsx** — Empty state for empty `brand_palette` now uses `ClientTabEmptyState` with context ("Add your client's primary colors to enable consistent AI content generation"). Skeleton loading replaces `animate-pulse`.
- **AiRepChatTab.tsx** — Initial welcome message upgraded from generic "Ask me anything about this client" to contextual greeting with 4 SMMA-specific starting suggestion chips (content ideas, performance review, next best action, post captions).
- **ContentPlanningTab.tsx** — All 5 AI history tabs (AI Ideas, AI Hooks, AI Captions, AI Scripts, AI All) now show `ClientTabEmptyState` with mode-specific messaging and `Sparkles` icon, directing users to the right generation surface.

### Confirmed Already Implemented (no changes needed)
- Landing CTAs (Hero, LandingNav, LandingStickyBar, FinalCTA) — all correctly guard demo URL and always show the primary "Book strategy audit" CTA.
- Agency AI Setup V2 Activation — fully wired to `useActivateAgencyAgentClassV2`, certification tracking, staleness detection, and guided strategy activation. Not placeholder UI.
- Agency AI Setup V2 Control Center — fully wired to real simulations, promotion to certification, staleness alerts, and audit event log.
- Dashboard dark theme — `bg-black/40`, `text-white` CSS is intentional; app defaults to dark via `defaultTheme="dark"` in `main.tsx`.

---

## 8. Update Protocol

This document must be updated whenever:
- A feature moves from "uncertain" to confirmed working or confirmed broken
- A new feature ships
- A feature is deprecated or removed

Do not let this document go stale. A stale current state is worse than no current state.
