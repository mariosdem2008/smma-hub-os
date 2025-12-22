# SMMAHUB

SMMAHUB is a React + Vite single-page app for agencies with auth, onboarding, client portal, messaging, and billing flows, backed by Supabase (client SDK + edge functions + migrations). (evidence: src/App.tsx:100-197, package.json:6-11, package.json:55-67, src/integrations/supabase/client.ts:2-24, supabase/functions/deno.json:1-6)

## Tech stack
- Frontend: React 18 + React Router (evidence: package.json:55-61, src/App.tsx:100-197)
- Build toolchain: Vite + TypeScript (evidence: package.json:6-11, package.json:85-87)
- Styling/UI: Tailwind CSS + shadcn/ui + Radix UI (evidence: package.json:16-42, package.json:84)
- Data/auth: Supabase JS client (evidence: src/integrations/supabase/client.ts:2-24)
- Edge functions: Supabase Deno functions (evidence: supabase/functions/deno.json:1-6)

## Local setup
1) Install deps: `npm install` (evidence: package.json:6-11)
2) Configure env: copy `.env.example` to `.env` and `.env.local.example` to `.env.local` (evidence: .env.example:1-23, .env.local.example:1-19)
3) (Optional) Start local Supabase: `supabase start` (evidence: .env.local.example:15-26)
4) Run dev server: `npm run dev` (evidence: package.json:6-11)

## Environment variables
Name | Required | Example | Where used
--- | --- | --- | ---
VITE_PUBLIC_URL | yes | `https://smmahub.net` | src/lib/env.ts:11-14
VITE_SUPABASE_PROJECT_ID | yes | `your-project-id` | .env.example:20-21
VITE_SUPABASE_URL | yes | `https://your-project.supabase.co` | src/integrations/supabase/client.ts:5-6
VITE_SUPABASE_ANON_KEY | yes | `your-anon-key` | src/integrations/supabase/client.ts:5-6
VITE_SUPABASE_PUBLISHABLE_KEY | fallback | `your-anon-key` | src/integrations/supabase/client.ts:5-6
SUPABASE_URL | yes (functions) | `https://your-project.supabase.co` | supabase/functions/_shared/env.ts:12-14
SUPABASE_SERVICE_ROLE_KEY | yes (functions) | `service-role` | supabase/functions/_shared/env.ts:12-15
SUPABASE_ANON_KEY | yes (functions) | `anon-key` | supabase/functions/_shared/env.ts:12-15
PUBLIC_URL | yes (functions) | `https://smmahub.net` | supabase/functions/_shared/env.ts:17-20
META_REDIRECT_URI | optional | `https://.../social-oauth-callback` | supabase/functions/_shared/env.ts:22-23
META_APP_ID | yes (Meta) | `123` | supabase/functions/refresh-meta-tokens/index.ts:18-21
META_APP_SECRET | yes (Meta) | `***` | supabase/functions/refresh-meta-tokens/index.ts:18-22
GRAPH_API_VERSION | optional | `v21.0` | supabase/functions/sync-social-metrics/index.ts:19-20
STRIPE_SECRET_KEY | yes (billing) | `sk_live_...` | supabase/functions/stripe-webhook/index.ts:6-8
STRIPE_WEBHOOK_SECRET | yes (billing) | `whsec_...` | supabase/functions/stripe-webhook/index.ts:12-27
STRIPE_PRICE_IDS | optional (billing) | `price_...` | audit-pack/outputs/rg_stripe_price.txt:1
RESEND_API_KEY | yes (email) | `re_...` | supabase/functions/send-portal-invite/index.ts:4-11
CLIENT_PORTAL_JWT_SECRET | yes (client portal) | `***` | supabase/functions/upload-file/index.ts:41-55
CRON_SECRET | yes (cron) | `long-random` | supabase/functions/_shared/cron.ts:1-16

## Scripts
- `npm run dev`: start Vite dev server (evidence: package.json:6-11)
- `npm run build`: production build (evidence: package.json:6-11)
- `npm run build:dev`: dev-mode build (evidence: package.json:6-11)
- `npm run lint`: ESLint (evidence: package.json:6-11)
- `npm run preview`: preview production build (evidence: package.json:6-11)

## Architecture overview
- Entry: `index.html` loads `src/main.tsx` which renders `App` (evidence: index.html:29-31, src/main.tsx:1-20)
- Routing: `src/App.tsx` defines public, protected, and client portal routes (evidence: src/App.tsx:100-197)
- Auth: agency auth via `AuthProvider` and client portal auth via `ClientAuthProvider` (evidence: src/App.tsx:7-8, src/lib/auth.tsx:17-129, src/lib/client-auth.tsx:28-239)
- Data access: `db` wraps Supabase client and exposes helpers (evidence: src/data/supabase.ts:1-73)
- Edge functions: backend workflows live under `supabase/functions/*` (evidence: supabase/functions/deno.json:1-6)

## Database & Supabase notes
- Migrations live in `supabase/migrations` (evidence: supabase/migrations/20251123055929_57292cd4-c2b5-4194-bd89-e4ffb02ffd74.sql:56-67)
- RLS is enabled on core tables like `clients` and `posts` (evidence: supabase/migrations/20251123055929_57292cd4-c2b5-4194-bd89-e4ffb02ffd74.sql:69-71, supabase/migrations/20251123055929_57292cd4-c2b5-4194-bd89-e4ffb02ffd74.sql:106-108)
- Edge function JWT verification is configured in `supabase/config.toml` (evidence: supabase/config.toml:3-96)
- Cron setup guidance exists for scheduled functions (evidence: supabase/functions/CRON_SETUP.md:7-103)

## Deployment notes
- Publish flow is documented via Lovable checklist steps (evidence: PRODUCTION_CHECKLIST.md:141-147)
- Edge function redeploys happen on code change (evidence: PRODUCTION_CHECKLIST.md:21-22)

## Cron security
Scheduled/privileged functions require header `x-cron-secret` matching `CRON_SECRET`:
- `publish-scheduled-posts`
- `refresh-meta-tokens`
- `sync-social-metrics`
- `generate-approval-reminders`
- `sync-meta-ads`

Evidence: supabase/functions/_shared/cron.ts:1-16, supabase/functions/CRON_SETUP.md:7-103

Local test (expect 401 without header):
```sh
curl -i https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts
```

Local test (expect 200 with header):
```sh
curl -i -H "x-cron-secret: $CRON_SECRET" https://YOUR_PROJECT_REF.supabase.co/functions/v1/publish-scheduled-posts
```

## Stripe webhook verification
- Stripe signature verification uses `STRIPE_WEBHOOK_SECRET` (evidence: supabase/functions/stripe-webhook/index.ts:12-33).

Stripe CLI test (local):
```sh
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Local checks
Run these before pushing:
```sh
npm run lint
npx tsc -p .
npm run build
```

## CI / branch protection
Enable branch protection on `main` and require the CI workflow checks to pass before merge.
Evidence: .github/workflows/ci.yml:1-32

## Known issues (top 10)
1) Stripe webhook secret is marked required but not yet set in checklist (evidence: PRODUCTION_CHECKLIST.md:5-23)
2) No test script defined (evidence: package.json:6-11)
3) Non-strict TS config allows implicit any/unused params (evidence: tsconfig.json:5-13)
4) Large JS bundle (2,042.93 kB) in build output (evidence: audit-pack/outputs/build_safe_to_sell.txt:10-12)
5) Debug pages exist but are not routed (evidence: src/pages/SchedulingDebug.tsx:11, src/pages/TeamAuditDebug.tsx:33, src/App.tsx:100-197)

## Roadmap
- P0: Set `CRON_SECRET` in secrets and verify cron jobs (evidence: supabase/functions/_shared/cron.ts:1-16, supabase/functions/CRON_SETUP.md:7-103)
- P0: Add STRIPE_WEBHOOK_SECRET in production and verify webhook handling (evidence: PRODUCTION_CHECKLIST.md:5-23, supabase/functions/stripe-webhook/index.ts:12-32)
- P1: Enforce branch protections for CI checks (evidence: .github/workflows/ci.yml:1-32)
- P1: Introduce tests for auth, billing, and scheduling flows (evidence: package.json:6-11)
- P2: Reduce bundle size via code splitting (evidence: audit-pack/outputs/build_safe_to_sell.txt:10-12)

## Definition of Done (production)
- 100% of required secrets configured in Supabase/Lovable (evidence: PRODUCTION_CHECKLIST.md:5-23, supabase/functions/_shared/env.ts:12-23)
- 100% edge functions either verify_jwt or implement explicit auth checks (evidence: supabase/config.toml:3-96, supabase/functions/_shared/cron.ts:1-16)
- 1 CI pipeline running lint + typecheck + build on PRs (evidence: .github/workflows/ci.yml:1-32)
- 1 staging run of cron jobs with logs reviewed (evidence: supabase/functions/CRON_SETUP.md:7-103)
