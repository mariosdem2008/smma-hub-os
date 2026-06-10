# Codex Build Brief: UX Redesign Phase 2 — Deep App Screens

You are continuing the SMMAHUB premium redesign. **Phase 1 already shipped the design system** (`docs/design/DESIGN_SYSTEM.md`) and re-skinned the shared `src/components/ui/*` primitives, landing, auth, app shell, and dashboard. Your job: apply that SAME system to the deep app screens Phase 1 deferred. The technical founder reviews every screen.

## Absolute rules
- **Reuse the existing design system and primitives** — do NOT invent new tokens, colors, or fonts. Pull from `docs/design/DESIGN_SYSTEM.md`, `src/index.css` variables, `tailwind.config.ts`, and the re-skinned `src/components/ui/*`. The look must be cohesive with Phase 1 (Manrope display / IBM Plex Sans, muted-gold accent, layered dark + warm light).
- **Presentation only.** Do NOT change data hooks, Supabase queries, edge functions, or business logic. Keep every fetch and mutation; restyle the rendering. If a tab fetches data, keep the fetch.
- No paid AI providers / production keys. `npm run build` must pass with no console errors; all routes must render.
- Accessibility (AA contrast, focus rings, keyboard nav, aria labels) and responsive (13" laptop + mobile) on every screen. Every list/table needs a designed empty state (use the shared `EmptyState`) and skeleton loader.
- Watch the `Button` `asChild` rule: it now clones a single child — never pass multiple children to an `asChild` Button.

## Scope (apply the system to all of these)
1. **Client workspace tabs** (`src/components/client-tabs/*`): Overview, Analytics, Calendar, Pipeline, Ideas, IdeaScripting, Library, ContentPlanning, Tasks, Reports, Branding, AiRepChat. Give the client workspace a cohesive premium header + tab system, consistent card/table/skeleton/empty-state usage, and calm density.
2. **Strategy OS** (`src/components/strategy-os/*`): the knowledge center, module workspaces, right-rail (tasks), mission control. Make the document + module review experience feel like a premium editorial workspace — clear hierarchy, readable long-form, obvious approval affordances.
3. **Client portal** (`src/pages/client-portal/*` + `src/pages/ClientPortalLayout.tsx`): this is what agencies show THEIR clients — it must look the most premium of all. Approvals, calendar, performance, messages, assets, ideas, branding, AI assistant. Elevate the mobile bottom-nav experience. A client opening this should think the agency is high-end.
4. **Shared client surfaces**: `ClientHeader` deep states, notification center, command/search affordances if present.

## Process
- Work screen-group by screen-group. After each group, sanity-check spacing rhythm, alignment, consistent radii/shadows, and that no old blue/cyan/gradient styles remain.
- Prefer composing existing primitives over bespoke markup. Extract a shared pattern only if it's reused 3+ times.

## Acceptance criteria
- `npm run build` passes; app boots; every client tab, strategy OS screen, and portal page renders with no console errors.
- Dark + light both intentional and AA-compliant on the new screens.
- The portal in particular reads as a premium product an agency is proud to show clients.
- No data/logic regressions — all existing hooks and mutations intact.

## Deliverables
- Summary of files changed (grouped by screen area).
- A founder review checklist of every screen to eyeball, with the route to reach each.
- Anything still deferred and why.

Build it now. Keep it cohesive with Phase 1.
