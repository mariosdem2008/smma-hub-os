# Landing Migration Plan (High‑Ticket SaaS) — 2026‑02‑02

Goal: make the SMMAHUB landing page **credible, premium, and conversion-focused** so it can be set live for cold traffic and reliably generate qualified leads (booked audits / demos) with **near‑zero cognitive load**.

This plan is written against the current codebase:
- Route: `/` → `src/pages/LandingV2.tsx`
- Landing components: `src/components/landing/*`
- SEO + schema: `index.html`

---

## 0) The Core Problem (What’s “terrible” today)

### Perception gaps (high-ticket buyers feel these instantly)
- **Proof doesn’t match claims** (schema ratings, security claims, “500+ clients”, etc.) → credibility tax.
- **CTA intent is unclear** (“Book Audit”, “Book Strategy Audit”, “Demo”, “Watch Demo”) → decision friction.
- **Long-form sections read like feature soup** → cognitive load and skim failure.
- **Visual hierarchy lacks “product reality”** (real UI, real outputs, real case results) → feels like a template.

### Technical/implementation gaps that surface as UX issues
- **Hardcoded placeholder links** (e.g., Loom `LOOM_ID`) break conversion paths.
- **Schema + metadata can be inaccurate** (ratings, counts, SOC2, canonical domain).
- **Tailwind dynamic classes** in some components can silently fail (no compiled CSS), degrading polish.
- **Inconsistent currency + pricing semantics** (EUR in UI vs USD in schema) creates distrust.

---

## 1) Success Criteria (Non‑Negotiables)

### Conversion
- Primary conversion: **Book Strategy Audit** (Cal.com) with consistent messaging across the page.
- Secondary conversion: **Watch Demo** (real Loom/YouTube) as low-friction proof.
- “Next best action”: capture email for follow-up (optional, but recommended for paid traffic).

### Credibility
- No unverifiable claims in UI or schema. Anything not provable becomes:
  - “in progress” (if true), or
  - removed, or
  - reframed as “target / typical / example” with clarity.

### UX
- Above-the-fold answers in <10 seconds:
  1) What is it?
  2) Who is it for?
  3) What outcome do I get?
  4) Why should I believe you?
  5) What do I do next?

### Technical
- Lighthouse (mobile): **Performance 85+**, **Accessibility 90+**, **Best Practices 90+**, **SEO 90+**
- No broken links, no placeholder IDs, no “#” dead buttons.

---

## 2) Key Decisions You Must Lock Before Design/Code

1) **ICP**: “Growth-stage social media agencies” vs “All agencies” vs “Performance agencies only”.
2) **Offer**: “Free Strategy Audit” vs “ROI Plan” vs “Founders Program” (pick one primary).
3) **Primary CTA destination**:
   - Cal.com booking (fastest), or
   - internal lead form → qualify → then booking.
4) **Proof inventory (what’s true today)**:
   - Security: SOC2? GDPR? encryption? (must be factual)
   - Usage: “12 countries”, “500+ clients”, “68% faster” (must be evidenced)
   - Results: testimonials, mini case studies, screenshots, output examples (even anonymized)
5) **Pricing**: show public pricing now, “starting at…”, or “talk to sales” (high-ticket often hides tiers).

---

## 3) Phase 0 (24–48 hours): “Set It Live” Readiness

Ship this before any “500% better” visual work. It prevents reputational damage.

### 3.1 Fix broken conversion paths
- Replace all `LOOM_ID` placeholders with a real demo URL (or remove the CTA everywhere until ready).
- Remove “View Sample Pricing” dead link or make it open a modal / scroll to pricing details.
- Unify CTA copy globally:
  - Primary: `Book Strategy Audit`
  - Secondary: `Watch Demo`

### 3.2 Remove/qualify claims you can’t defend
Audit and correct:
- `index.html` schema: rating counts, review counts, security claims, usage numbers.
- Landing sections: SOC2 / GDPR / “500+ clients” / “pilot agencies” / “95% first pass”.

If you don’t have SOC 2 Type II today, replace with a factual security block:
- “Encryption at rest + in transit”
- “Row-level security”
- “Strict tenant isolation”
- “We don’t train models on your data” (only if true with your providers)

### 3.3 SEO hygiene for a SPA
- Confirm canonical domain matches production domain.
- Add `sitemap.xml` + `robots.txt` (static) if missing.
- Ensure OG image exists and is correct.

### 3.4 Analytics (minimum viable)
- Track: `cta_book_audit_click`, `cta_watch_demo_click`, `scroll_depth_25/50/75/100`, `pricing_view`.
- Add session replay/heatmaps for iteration (PostHog or similar).

Deliverable: a “Go‑Live Checklist” that must be all green before running ads.

---

## 4) Phase 1 (3–7 days): Premium Re-Architecture (Low Cognitive Load)

### 4.1 Rewrite the narrative into an “Outcome → Proof → Mechanism” flow
Recommended section order (shorter + higher impact):
1) **Hero**: Outcome + ICP + mechanism in one screen
2) **Proof strip**: 3 proof chips (not cards) + real numbers (or remove numbers)
3) **Problem → cost**: show the scaling constraint in 2–3 bullets
4) **Mechanism**: “Agency Brain + Client Brain” explained visually in 1 diagram
5) **What you get**: deliverables (strategy, briefs, approvals) + 1 real output example
6) **Workflow**: 5-step stepper (only if it feels like product, not animation for animation’s sake)
7) **Security + trust**: factual and specific
8) **Pricing / Offer**: framed as ROI payback
9) **FAQ**: top 6 objections max
10) **Final CTA**

### 4.2 Upgrade “product reality”
High-ticket pages win with tangible proof:
- Replace generic UI blocks with **real screenshots** (blur/anonymize client names).
- Add a **60–120s product walk-through** video (trimmed, scripted, tight).
- Add **1–2 mini case studies**:
  - “Before / After” metrics
  - time saved
  - headcount avoided
  - revenue unlocked

### 4.3 Copy system (no fluff)
Rules:
- One claim per sentence.
- Every claim either has proof or is framed as an example.
- Avoid metaphors; use operational language (“approval workflow”, “client intake”, “strategy brief”).
- Replace “AI tool” talk with “workflow outcomes” talk.

Deliverable: a single-page “Messaging Doc” that contains:
- Hero variant A/B/C
- 10 proof statements with evidence source
- Objection handling bullets

---

## 5) Phase 2 (1–3 weeks): Technical Migration for Marketing-Grade SEO + Speed

Today your landing is inside the main React SPA (`BrowserRouter`). That is workable for direct traffic, but not ideal for SEO and content marketing.

### Option A — Keep Vite SPA (fastest)
Best when: you only need paid traffic + direct links for the next 30–60 days.
- Add prerendering (or static export) for `/` + `/pricing` + `/privacy` + `/terms`
- Keep bundle small: split marketing-only chunks, lazy-load heavy components

### Option B — Create a dedicated marketing app (recommended)
Best when: you want SEO, content, landing variants, fast iteration.
- Create `apps/marketing` with Next.js or Astro (static-first)
- Marketing routes: `/`, `/pricing`, `/case-studies/*`, `/security`, `/blog/*`, `/terms`, `/privacy`
- App remains at `app.smmahub.com`, marketing at `smmahub.com`
- Shared design tokens/components via a small internal package

Migration steps:
1) Extract design tokens (colors/type/spacing) into a shared module.
2) Port landing sections as isolated, CMS-friendly components.
3) Add a simple CMS (Sanity/Contentlayer/MDX) for case studies + blog.
4) Add A/B testing and analytics primitives.

Deliverable: “Marketing Architecture Decision” doc + repo scaffolding plan.

---

## 6) Phase 3 (Ongoing): Conversion Optimization Loop

Weekly cycle:
1) Review recordings + funnels
2) Identify 1 bottleneck (hero clarity, trust, CTA, pricing)
3) Ship 1 experiment (A/B hero or proof block)
4) Measure (bookings, qualified rate, CAC payback)

Core metrics:
- `booked_audit_rate` (unique sessions → booking)
- `qualified_rate` (bookings → qualified)
- `time_to_first_value` (audit → setup)

---

## 7) Immediate Audit Checklist (What to inspect in code right now)

### Hard blockers
- `src/pages/LandingV2.tsx`: unify CTA text + ensure demo URL is real.
- `src/components/landing/*`: remove dead links, verify every claim.
- `index.html`: update/disable schema claims that aren’t defensible.

### “Premium” debt
- Remove any dynamic Tailwind class strings that aren’t safelisted.
- Ensure consistent currency, locale, and pricing semantics.
- Verify typography scale + spacing so the page never shows “empty deserts”.

---

## 8) What I Need From You (to implement the plan correctly later)

1) Production domain + whether you want split domains (`smmahub.com` marketing, `app.smmahub.com` app)
2) Real demo URL (or confirmation to remove demo CTA)
3) Proof you can publicly claim (even anonymized):
   - pilot time range + sample size
   - 1–2 screenshots
   - 1 mini case result (numbers)
4) Your stance on pricing visibility: public tiers vs “starting at” vs “book to see pricing”

