# Codex Build Brief: SMMAHUB Design System + UX Redesign (Phase 1 — Foundation + Landing + App Shell)

You are a world-class product designer-engineer rebuilding SMMAHUB's interface to the standard of a $1M/yr premium B2B SaaS. The technical founder will review every screen. This is Phase 1 of a multi-phase redesign: **build the design system foundation, then apply it to the landing page, auth, and the authenticated app shell + dashboard.** Do NOT touch backend logic, edge functions, data hooks, or Supabase queries — only presentation, layout, components, theming, and routing-level composition.

## Who this is for (ICP — design for this person)
A busy, non-technical agency owner running 10+ clients. They are time-poor, allergic to anything that feels like homework, and judge software in 5 seconds. They will show this product to their own clients, so it must make THEM look premium. Every screen must feel: calm, confident, fast, expensive, and obviously in control. Governed AI = trust, clarity, and "nothing happens without me approving it."

## Design direction (be opinionated; do NOT produce generic AI/Bootstrap/default-shadcn look)
- **Aesthetic:** restrained, editorial, high-contrast, generous whitespace. Think Linear + Vercel + Stripe dashboard discipline, with the warmth of a premium agency brand. Dark theme is the default (app already defaults dark via `main.tsx` `defaultTheme="dark"`) — make dark genuinely beautiful (true layered surfaces, not flat black), and ship a polished light theme too.
- **Typography:** one strong, distinctive type pairing (a characterful display/grotesk for headings, a clean neutral sans for UI/body). Establish a real type scale. No default system-ui everywhere. Big, confident headings on marketing; tight, legible density in the app.
- **Color:** a disciplined palette — one confident brand/accent color used sparingly for action and focus, a full neutral ramp for surfaces/borders/text, and semantic colors (success/warning/danger/info) that read clearly in both themes. Define everything as CSS variables / Tailwind tokens. No rainbow gradients, no purple-on-purple "AI" cliché.
- **Depth & motion:** soft, layered elevation (subtle borders + low-spread shadows, not heavy drop shadows). Motion is purposeful and quick (150–250ms), respects `prefers-reduced-motion`. Micro-interactions on the things that matter (approvals, AI generating, state changes). Never gratuitous.
- **Components:** the app already uses shadcn/ui + Radix + Tailwind. Re-skin the shared primitives (button, card, input, dialog, tabs, badge, table, sidebar, empty states, skeletons) to the new system rather than inventing a parallel kit. Every interactive state (hover/focus/active/disabled/loading) must be designed. Every list/table needs a designed empty state and skeleton.

## Absolute rules
- Do NOT use paid AI providers or production keys for anything. No backend/data changes.
- Keep all existing routes working and all data wiring intact — this is a visual/UX refactor, not a rewrite of logic. If a component fetches data, keep the fetch; restyle the presentation.
- `npm run build` must pass and the app must run with no console errors and no broken routes after your changes.
- Accessibility: WCAG AA contrast, visible focus rings, keyboard navigation, semantic HTML, aria labels on icon buttons.
- Responsive: flawless on a 13" laptop and on mobile (the portal already has mobile bottom nav — honor and elevate it).

## Scope for THIS phase (do all of it)
1. **Design tokens & theme:** establish the token layer (CSS variables in the global stylesheet + Tailwind config extension): color ramps, semantic colors, spacing scale, radii, shadows, typography scale, motion durations/easings. Wire fonts (self-hosted or via a performant source). Make dark + light both first-class.
2. **Core primitive re-skin:** restyle the shared `src/components/ui/*` primitives to the system so the whole app inherits the upgrade. Add/upgrade: Button (variants + sizes + loading), Card, Input/Select/Textarea, Dialog/Sheet, Tabs, Badge/Pill, Table, Tooltip, Skeleton, and a reusable `EmptyState`.
3. **Landing page:** redesign the public landing (hero, value prop, how-it-works, social proof placeholders, pricing, final CTA, footer). Sharp positioning copy for "Configure your agency's expertise once. Run it across every client with governed AI." Conversion-aware, premium, fast. Keep existing CTA targets/links working.
4. **Auth screens:** sign in / sign up / reset — branded, minimal, trustworthy (both agency and client portal login).
5. **App shell:** sidebar/topbar navigation, command-palette-ready structure if feasible, breadcrumbs, page header pattern, consistent content container. Re-skin `src/components/AppSidebar.tsx`, `ClientHeader.tsx`, and the dashboard (`src/pages/Dashboard.tsx`).
6. **Dashboard:** make it a genuinely useful, premium "operator home" — clear hierarchy, real metrics cards (keep existing data), what-needs-attention surfacing, calm defaults, designed empty/loading states.

## Process
- First create `docs/design/DESIGN_SYSTEM.md` documenting the tokens, type scale, color usage, component variants, and motion rules — this is the contract later phases follow.
- Then implement. Use the installed design skill marketplaces if helpful, but the output must be cohesive and hand-crafted, not template-stamped.
- Take a pass for consistency at the end: spacing rhythm, alignment, consistent radii/shadows, no orphaned old styles.

## Acceptance criteria
- `npm run build` passes; app boots with no console errors; all existing routes render.
- A reviewer opening the landing page and the dashboard would describe them as "premium / high-end / would pay for this," not "generic AI app."
- Dark and light themes both look intentional and pass AA contrast.
- `DESIGN_SYSTEM.md` exists and matches the implemented tokens.
- Reduced-motion and keyboard/focus states work.

## Deliverables
- Summary of files created/changed.
- The token decisions (palette hexes, type pairing, scale) and why they fit the ICP.
- A "founder review checklist" of screens to eyeball and any tradeoffs you made.
- Note anything you intentionally deferred to a later redesign phase (e.g. client-tab deep screens, strategy OS, portal internals).

Build it now. Make it beautiful and cohesive.
