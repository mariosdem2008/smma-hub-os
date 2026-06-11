# SMMAHUB Current State
**Date:** 2026-06-11
**Type:** Current Reality — Not Target State
**Authority:** Product owner + code audit + verified execution session
**Reviewed by:** Claude (founder execution session, 2026-06-10/11)

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
| Billing | Stripe (checkout + subscriptions + webhooks) | ✅ Webhook configured + verified; pricing model migration to €199 floor pending Stripe price IDs |
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

## 4. Governed AI — Verified (2026-06-11 session)

The AI systems previously marked "uncertain" were audited, hardened, validated with local models (no paid keys), and verified in production this session. See [AUDIT_VERDICT_2026-06-10](AUDIT_VERDICT_2026-06-10.md) and `docs/codex-briefs/`.

### 4.1 Agency AI Setup V2 → Agency Brain — Verified governing

- The wizard's foundations/guardrails/workflow (`agency_ai_setup_status_v2.meta_json`) are now injected into the strategy agents' prompts (diagnosis, recommendation, plan), traced end-to-end (metadata.context → prompt builder → user message).
- **Verified:** a strategy generated against a configured brain demonstrably obeys it — a strong-model governance probe (`scripts/agent-governance-probe.ts`, local `qwen2.5:7b-instruct`) shows the governed run avoids banned claims and routes them to "donts", measurably stricter than the no-governance control.
- Agency onboarding now materializes the completed draft into approved `brain_documents` + RAG ingestion (was previously stored and never consumed).

### 4.2 Strategy Hub → Strategy + Execution — Verified end-to-end

- Strategy generation runs the V2 pipeline (readiness → diagnosis → recommendation → plan); LLM publisher enabled (`STRATEGY_PLAN_PUBLISHER`) with deterministic fallback.
- **Verified:** a published strategy automatically creates real work — `content_plan_items`, `content_briefs`, draft pipeline `projects`, and `scheduled_posts` (draft = autopublish-safe) — proven by the `npm run e2e:happy` harness (44/44) against live Supabase.
- Strategy output is now graded against the brain (deterministic, non-blocking) — governance flags surfaced for review.

### 4.3 AI Onboarding — Consolidated

- Dead onboarding edge functions removed (`ai-onboarding-v3`, `-guide`, `-copilot`). Active: `ai-onboarding` (agency), `ai-onboarding-client-chat` (client), `-scan`/`-suggest` (helpers).

### 4.4 Reports — Grounded + governed

- `generate-monthly-report` upgraded to a reporting-insight agent: grounded in agency brain + client strategy + blocker/delivery state + real KPIs, structured JSON output, and the client-facing narrative graded before delivery. Full report detail view wired for agency + client portal.

### 4.5 Performance Analytics

- Analytics hooks exist (`useClientAnalytics`, `useProfileTrends`, `useMetaAds`); portal performance tab renders charts from real data. Real Meta API end-to-end data flow remains the one area not independently re-verified this session.

### 4.6 Governed agent team (new this session)

- **Grading** (`ai-answer-quality-check` + `_shared/answer-grading.ts`) — enforces the brain on rep-chat, content generation, and strategy output; `ai_gradings` audit table.
- **Blocker detection** (`ai-blocker-scan` + `client_blockers`) — per-client delivery state, owner routing, next actions; surfaced in dashboard + workspace.
- **Reporting insight** — see 4.4.
- **Agency Pulse** (`ai-agency-pulse`) — orchestration: one prioritized attention queue across clients on the dashboard, verified live.
- All deterministic-first (work with no paid keys), validated via `scripts/{grader,blocker,pulse,blocker}-validate.ts`.

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
| Overlapping AI onboarding edge functions | ✅ Consolidated — `ai-onboarding-v3`, `-guide`, `-copilot` removed |

---

## 6. Production Readiness Status

| Area | Status | Notes |
|---|---|---|
| Auth + tenant isolation | ✅ Ready | Both systems working; anon RLS leak fixed + verified |
| Client management | ✅ Ready | Core CRUD working |
| Content pipeline | ✅ Ready | 8-stage pipeline working |
| Social publishing | ✅ Ready | Meta posting working |
| Client portal | ✅ Ready | Approvals, reminders (email), AI assistant proposals, report detail wired |
| Billing (webhook) | ✅ Ready | Webhook verified end-to-end; idempotency/upsert fixes shipped |
| Billing (pricing model) | ⚠️ Blocked on owner | Code still ships legacy €29–€129 tiers; needs Stripe price IDs for €199/€349/€499 + free-plan removal (see 3.9) |
| Agency Brain / AI Setup | ✅ Verified | Wizard governance reaches + governs strategy output (probe-verified) |
| Strategy + Execution | ✅ Verified | Strategy creates real work; 44/44 E2E harness |
| Governed AI enforcement | ✅ Ready | Grader enforces brain on rep-chat, content, strategy |
| Agent team + orchestration | ✅ Ready | Grading, blocker, reporting, pulse — live on dashboard |
| AI onboarding | ✅ Ready | Consolidated; agency onboarding materializes brain |
| Performance analytics | ⚠️ Partial | Renders real data; Meta API end-to-end not re-verified this session |
| UX / design system | ✅ Ready | Premium redesign live on smmahub.net; ErrorBoundary wraps routes |
| Dead code cleanup | ✅ Done | Dead files + onboarding functions removed |
| E2E regression | ✅ Ready | `npm run e2e:happy` (44/44) covers the core loop |

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
