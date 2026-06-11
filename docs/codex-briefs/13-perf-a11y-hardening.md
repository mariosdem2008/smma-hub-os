# Codex Build Brief: Production Performance + Accessibility Hardening

Bring the shipped app to production-grade performance and accessibility without changing behavior. The build warns every time about chunks >500 kB (e.g. `ClientDetail-*.js` ~672 kB, `index-*.js` ~696 kB), and the fast UX redesign never had an a11y audit. This is a low-risk, presentation/loading-only hardening pass. The founder reviews, runs the E2E harness, and verifies render.

## Absolute rules
- **No behavior/logic changes.** No data hooks, edge functions, queries, migrations, or business logic. Only: code-splitting/lazy-loading, bundle config, and accessibility attributes/markup. No paid keys.
- Must NOT regress: `npm run build` passes, `npm run e2e:happy` still 44/44 (founder runs it), the app renders with no console errors, all routes work, the design system + ErrorBoundary stay intact, and `npx vitest run` stays green.
- Respect `prefers-reduced-motion`. Respect the Button `asChild` single-child rule.

## Part A — Performance / bundle
1. **Lazy-load heavy dependencies.** The biggest weight is charting (`recharts`) and other large libs pulled into route chunks. Split them so they only load on the routes/components that use them (e.g. dynamic import of chart components in analytics/performance/reports/dashboard tiles, with a small skeleton fallback). Heavy dialogs/editors that aren't needed on first paint should be lazy too.
2. **Vendor chunking.** In `vite.config.ts`, add `build.rollupOptions.output.manualChunks` to split large vendors (react/react-dom, radix-ui, recharts, tanstack-query, supabase) into separate cacheable chunks. Goal: meaningfully reduce the largest initial route chunks and clear (or greatly reduce) the >500 kB warnings. Do NOT break the existing route-level `lazy()` setup in `App.tsx`.
3. Confirm route-level code-splitting is intact and add `Suspense` fallbacks where a newly-lazy component lacks one.
4. Report before/after chunk sizes from `npm run build` output.

## Part B — Accessibility (primary flows only — don't boil the ocean)
Audit and fix on the highest-traffic surfaces: landing, auth, dashboard, client workspace shell/tabs, and the client portal shell.
1. **Icon-only buttons** must have `aria-label` (sidebar toggles, theme toggle, nav icons, close buttons).
2. **Focus states**: every interactive element has a visible focus ring (the design system defines `--ring`; ensure it's applied, not suppressed).
3. **Semantic structure**: one `<h1>` per page; nav landmarks; `<main>` present; form inputs have associated `<label>`s.
4. **Color contrast**: verify body/muted text and the gold accent meet WCAG AA on both dark and light surfaces; nudge tokens only if a specific pair fails (document any token change).
5. **Keyboard**: dialogs/sheets trap focus and close on Escape (Radix gives this — just don't break it); skip-to-content link on the app shell is a nice-to-have.
6. **Images/icons**: decorative icons `aria-hidden`; meaningful images have alt text.

## Acceptance criteria
- `npm run build` passes; the largest chunks are meaningfully smaller and the >500 kB warning is cleared or much reduced (report numbers).
- No console errors; all routes render; design system + ErrorBoundary intact; reduced-motion respected.
- Icon-only buttons have aria-labels; visible focus rings; one h1/page; AA contrast on primary surfaces.
- `npx vitest run` green. No logic/behavior change (founder will run `npm run e2e:happy` to confirm 44/44).

## Deliverables
Print `CODEX PERF-A11Y SUMMARY` with: before/after chunk sizes, what you lazy-loaded + how you chunked vendors, the a11y fixes by surface, any token contrast change (with the failing pair), test/build results, and a founder review checklist (routes to eyeball + reduced-motion + keyboard checks).

Build it now. Presentation/loading only — no behavior change.
