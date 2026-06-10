# Codex Build Brief: Align Landing + Pricing Copy to the Locked Tier-2 Positioning

You are updating SMMAHUB's public marketing surfaces so they match the now-locked ICP and positioning. This is a **copy / messaging / presentation** task on the frontend — no business logic, no Stripe/checkout wiring changes.

## Source of truth (read first)
`docs/00-ICP-AND-POSITIONING.md`. Locked facts you must reflect:
- **Audience:** established Tier 2 operating agencies — 5–25 active clients, €15k–€100k/month, team of 2–10. Already running a real business; will instantly detect shallowness.
- **NOT for** beginners / solo freelancers / "first client" / sub-€5k aspirational agencies / free-plan seekers. Remove all such framing.
- **Positioning:** operating infrastructure / agency operating system — NOT a content tool, NOT "AI buttons," NOT a cheap app. Sell operational outcomes (context encoded once, less owner-bottlenecking, premium client-facing delivery, governed AI execution).
- **Pricing frame:** infrastructure from **€199/month**, no free plan. **Top of funnel = a booked strategy audit / guided demo**, not a self-serve free signup.

## Files (frontend copy only)
- `src/pages/LandingV2.tsx` — hero, sub-headline, value props, how-it-works, "who it's for", social-proof placeholders, pricing section, final CTA, footer.
- The pricing page if separate (`src/pages/Pricing.tsx`) — same repositioning.
- Any landing sub-components under `src/components/landing/**`.

## What to change
1. **Hero + sub-headline:** speak to an operator drowning in Slack/Docs/approval-chasing with 10+ clients. Lead with the infrastructure promise ("Configure your agency's expertise once. Run it across every client with governed AI.") and the operational outcome, not features.
2. **"Who it's for" / qualification:** explicitly frame for established agencies (5–25 clients, a team). It is acceptable — encouraged — to gently disqualify beginners so the right buyer self-selects.
3. **Value props:** operational leverage, context-once, governed AI execution, premium client portal, fewer owner bottlenecks. No "easy/cheap/for-anyone/get-your-first-client" angles.
4. **Pricing section:** present as infrastructure **from €199/month** with the indicative tiers (Operate €199 / Scale €349 / Agency €499). **Do NOT change checkout logic or Stripe price IDs** (those migrate separately). Since real self-serve checkout at these prices isn't wired yet, the **primary CTA across the page is "Book a strategy audit"** (the locked top-of-funnel) — keep existing CTA link targets/handlers working; only change labels/copy. Do not present a free plan anywhere.
5. **Remove** any remaining free-plan mentions, €29/€59/€129 references, beginner testimonials/copy, and "start for free" language.

## Rules
- Match the shipped design system (Manrope/IBM Plex Sans, muted-gold accent, the re-skinned primitives). Do not regress visuals. Respect the `Button` `asChild` single-child rule.
- Frontend copy/markup only. No data hooks, no edge functions, no Stripe logic, no migrations.
- `npm run build` must pass; the app must render with no console errors; all routes work; keep the ErrorBoundary wrapping intact.
- Keep it premium and confident — this buyer pays €199–€499/month and judges in 5 seconds.

## Acceptance criteria
- Landing + pricing copy reads as infrastructure for established Tier-2 agencies; no beginner/free/cheap framing remains.
- Primary CTA is "Book a strategy audit"; no free-plan CTA.
- `npm run build` passes; no console errors; existing CTA links/handlers still function.

## Deliverables
Print `CODEX LANDING SUMMARY` with files changed, the new hero/sub-headline copy, the pricing presentation, and a founder review checklist (routes to eyeball).

Build it now.
