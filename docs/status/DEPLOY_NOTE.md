# Deploy Note — Portal AI Rep Access

## What changed
- `supabase/functions/ai-rep-chat/index.ts` now allows **client portal** users to call `ai-rep-chat` when `clients.portal_user_id === auth.uid()`, and still enforces agency-member access for agency users.

## Deploy
- `supabase functions deploy ai-rep-chat`

---

# Deploy Note — Agency Bootstrap + Create Agency Onboarding

## What changed
- New post-auth bootstrap routes: `/bootstrap`, `/welcome`, `/select-agency`, `/create-agency` (`src/App.tsx`).
- New Supabase RPCs for bootstrap + invite auto-accept:
  - `public.get_user_agency_bootstrap()`
  - `public.accept_pending_agency_invites()`
  - Migration: `supabase/migrations/20251225201500_bootstrap_rpcs.sql`
- New agency creation + onboarding persistence:
  - RPC: `public.create_agency_with_admin(_name text, _website text)`
  - Table: `public.agency_onboarding_sessions`
  - Migrations:
    - `supabase/migrations/20251225210000_agency_onboarding_and_create_agency_rpc.sql`
    - `supabase/migrations/20251225210100_grant_agency_onboarding_sessions.sql`

## Deploy
- Apply DB migrations (RPCs + new table): `supabase db push`
