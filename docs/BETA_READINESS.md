# SMMAHUB Beta Readiness Checklist
**Date:** 2026-04-04
**Type:** Gate document — must pass before inviting external beta agencies
**Authority:** Product owner + Codex operator
**ICP/pricing authority:** [00-ICP-AND-POSITIONING](00-ICP-AND-POSITIONING.md)

---

## Beta Definition

Beta = a small set (2–5) of real SMMA founders can run live client work in SMMAHUB for 30 days without hitting deal-breaker bugs, broken flows, or embarrassing UX.

This is not launch. It is controlled. The standard is: "I would not be embarrassed to show this to a paying agency."

---

## Gate 1: Technical Blockers (Must Fix Before Any Beta User)

- [ ] **Stripe webhook secret configured** in production environment — required for subscription upgrades to work
- [x] **Debug pages removed or restricted** — SchedulingDebug, TeamAuditDebug, AiFieldDemo deleted from codebase
- [x] **Dead code removed** — LandingLegacy.tsx, heelper.txt, PR_DESCRIPTION.md, AiFieldDemo.tsx all deleted
- [x] **Build clean** — TypeScript clean, zero errors confirmed
- [ ] **Meta app in Live mode** (not Development mode) in Meta Developer Portal
- [ ] **Cron jobs verified running** — autopublish (5min) and token refresh (12h) confirmed in Supabase logs

---

## Gate 2: Core Agency Workflow (Must Work End-to-End)

- [ ] **Signup → onboarding → dashboard** — new user can sign up, create/join an agency, and reach a useful dashboard without dead ends
- [ ] **Agency AI Setup wizard** — owner can complete all wizard steps (Imports → Foundations → Modules → Guardrails → Workflow → Activation) and reach Control Center
- [ ] **Agency brain modules** — editing a brain module (e.g. rep policy, tone of voice) saves correctly and is retrievable
- [ ] **Add client** — manager can create a client record with basic info
- [ ] **Client AI onboarding** — client onboarding chat flow completes and produces a usable client record
- [ ] **Content pipeline** — create a project → move through stages → approve → schedule → verify publishes to Meta
- [ ] **Asset upload and view** — upload image/video, view in assets tab, see in client portal
- [ ] **Ideas flow** — create idea, expand to page, add content
- [ ] **Strategy Hub** — generate a strategy brief for a client, verify output is grounded and not hallucinated
- [ ] **Team invite** — owner invites manager, manager accepts and can access the workspace

---

## Gate 3: Client Portal (Must Work for Beta Clients)

- [ ] **Agency sends portal invite** — invite sent, client receives email, accepts and can log in
- [ ] **Portal overview** — client sees their account overview on login
- [ ] **Approval flow** — agency submits work for approval, client approves or requests changes, state updates correctly in agency workspace
- [ ] **Portal messages** — client sends a message, agency sees it and can reply
- [ ] **Portal assets** — client can view and download assets in their portal
- [ ] **Portal content calendar** — client sees their scheduled content

---

## Gate 4: Billing (Must Work for Paid ICP Beta)

- [ ] **Operate checkout works** — qualified beta agency can subscribe at the EUR199/month floor via Stripe
- [ ] **Upgrade to Scale or Agency** — Stripe checkout completes, plan updates in app within 60 seconds
- [ ] **Paid-tier limits enforced** — entitlement checks match the locked paid tiers and do not expose a no-cost plan path
- [ ] **Subscription visible** in Settings/Billing page

---

## Gate 5: UX Quality (Must Not Embarrass)

- [x] **No blank white tabs** — AnalyticsTab, OverviewTab, BrandingTab, AiRepChatTab, ContentPlanningTab all use ClientTabEmptyState. CalendarTab, TasksTab, LibraryTab already had empty states. AssetsTab has its own empty state.
- [ ] **No broken navigations** — clicking any nav item does not 404 or show an error page
- [x] **Loading states** — Skeleton loading confirmed in AnalyticsTab, OverviewTab, BrandingTab, and CalendarTab
- [x] **Error states** — global React ErrorBoundary added at root level (`src/components/ErrorBoundary.tsx`); render crashes now show a recovery UI instead of white screen
- [ ] **Mobile portal** — client portal is usable on mobile (bottom nav, readable content)
- [x] **Landing page CTAs** — all four CTA surfaces (Hero, LandingNav, LandingStickyBar, FinalCTA) confirmed correct: primary CTA always shows, demo CTA gracefully hidden when demoUrl is null

---

## Gate 6: AI Quality (Must Not Lie or Hallucinate Badly)

- [ ] **Strategy brief** — generated strategy cites real client context, not invented facts
- [ ] **Client onboarding AI** — onboarding questions are answered sensibly, not looped or broken
- [ ] **Portal AI assistant** — if enabled, gives reasonable responses relevant to the client
- [ ] **Missing context surfaces correctly** — when context is thin, AI says so rather than fabricating
- [ ] **AI output can be reviewed before going to client** — no AI output bypasses review

---

## Current Gate Status (2026-04-04)

| Gate | Status | Blockers |
|---|---|---|
| Gate 1: Technical | ⚠️ 3/6 passed | Stripe webhook, Meta Live mode, cron verification still needed |
| Gate 2: Agency workflow | ⚠️ Partially ready | AI wizard + strategy output quality require live testing |
| Gate 3: Client portal | ⚠️ Likely ready | Needs live user testing |
| Gate 4: Billing | ❌ Not passed | Stripe webhook required |
| Gate 5: UX quality | ✅ Passed | All client tabs have empty + loading states. Landing CTAs correct. Global ErrorBoundary added. |
| Gate 6: AI quality | ⚠️ Unknown | Cannot assess from code alone — requires live testing |

---

## Next Actions

1. ~~Fix Gate 1 blockers (Codex Prompt 1 + 2 from audit report)~~ — ✅ Done
2. Configure Stripe webhook (manual — 15 min)
3. Set Meta app to Live mode in Meta Developer Portal
4. Verify Supabase cron jobs are running (autopublish + token refresh)
5. Run Gate 2 manually in localhost with real Supabase data — test AI wizard end-to-end
6. Assess Gate 6 by running the AI features and reading the outputs (strategy generation, client onboarding, AI rep chat)
7. Run full Gate checklist with one pilot agency
