# Codex Build Brief: Client Portal Workflow Completeness

You are a senior engineer on SMMAHUB (React+TS+Vite SPA, Supabase Postgres+RLS+Deno edge functions). The Phase-0 audit found the client portal is structurally sound but has functional gaps that make AI/approval surfaces feel cosmetic. Close them to production quality. The technical founder reviews and tests your diff.

## Absolute rules
- **No paid AI providers / production keys in tests.** Local testing only via Ollama (`.env.local-ai`, model `qwen2.5-coder:1.5b`, OpenAI-compatible at `http://localhost:11434/v1`; the provider honors `OPENAI_BASE_URL`). Any AI call must go through the existing `ai.run` router so it works with local models.
- Preserve multi-tenant isolation (agency_id / client scoping in DB + API). New tables/columns get RLS denying anon + cross-agency. New migration with timestamp AFTER 20260610123000 — never edit applied migrations.
- Idempotent. Match existing code style. `npm run build` must pass; add/keep unit tests green.
- The UI was just redesigned (design system in `docs/design/DESIGN_SYSTEM.md`, primitives in `src/components/ui/*`, shared `EmptyState`, `PremiumPage`). Any new UI must use these — do not regress the visual system. Note the Button `asChild` rule: it clones a single child.

## Gaps to close (each verified in the audit)

### 1. AI assistant proposals are generated but never shown
`supabase/functions/ai-assistant/index.ts` returns a structured `proposals` array, but `src/pages/client-portal/PortalAiAssistant.tsx` only renders the raw message. Build a proposal display: each proposal as a card with its content and clear accept / dismiss affordances. "Accept" should route the proposal into the appropriate existing surface (e.g. create an idea / draft) using existing hooks/mutations — do not invent new backend if an existing path fits. If accept-wiring requires backend, keep it minimal and governed (approval-respecting).

### 2. Approval reminders are created but never delivered
`supabase/functions/generate-approval-reminders/index.ts` inserts `notifications` rows for stale (>48h) client-review items but sends no email. Wire it to send a branded reminder email via the existing email path (`send-approval-notification` / Resend integration — reuse, don't duplicate the transport). Add a dedupe so the same item isn't emailed more than once per 24h (a sent-marker column or check). Keep the in-app notification too.

### 3. Notification delivery is not idempotent
`supabase/functions/send-approval-notification/index.ts` can double-send on retry. Add an idempotency/dedupe key (e.g. event id or hash of {project_id, action, day}) so repeated invocations don't spam the agency/client.

### 4. Report detail is shown only as a navigation, not a real detail view
Confirm `src/components/client-tabs/ReportDetail.tsx` (route `/clients/:clientId/reports/:reportId`) renders the FULL report — all KPIs, top posts, and the AI insight narrative from `generate-monthly-report` — not just the summary cards. If the full insight content isn't surfaced, wire it through. Ensure the client portal can reach a readable report view too.

## Acceptance criteria
- New migration applies via `supabase db push --dry-run --linked` (do NOT push — founder pushes).
- `npm run build` passes; `npx vitest run` green for touched areas; add a unit test for the reminder dedupe logic and the notification idempotency key (pure functions where possible).
- No cross-agency/anon access on any new column/table.
- Proposals render and accept/dismiss work against existing data paths; reminders send once and are deduped; notifications are idempotent; report detail shows full content.
- Local-model only for any AI-dependent test.

## Deliverables
- Files changed/created with line ranges, grouped by gap.
- New schema (if any) + why.
- Test output.
- Founder review checklist (routes + how to verify each gap is closed).

Build it now.
