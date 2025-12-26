# Spec Gaps / Unknowns (Evidence-based)

1) “Agency dashboard” is currently a single route (`/dashboard` in `src/App.tsx`), not an agency-scoped route (e.g., `/agency/:id/dashboard`). The To-Be flow requires choosing an agency, but the app has no explicit URL scoping for that today.

2) Multi-agency membership is not supported by current code paths:
   - `src/components/ProtectedRoute.tsx` membership check uses `.maybeSingle()` on `agency_members`.
   - `src/data/supabase.ts` (`getAgencyContextForUser`) uses `.maybeSingle()` on `agency_members`.
   - `src/hooks/useRole.ts` uses `.single()` on `agency_members`.
   This means “show an agency picker” is new work and requires refactoring across multiple call sites.

3) “Last used agency” persistence does not exist in the DB schema:
   - `public.profiles` in `supabase/migrations/20251123055929_...sql` contains `email`, `full_name`, `timezone` (see `src/integrations/supabase/types.ts`), but no `last_agency_id` (or similar) field.
   A picker can use `localStorage` (no schema change) or you can add a column/table (schema change).

4) Role taxonomy is inconsistent across migrations and UI:
   - Initial roles include `owner/manager/creator/viewer` (`supabase/migrations/20251123070304_...sql`).
   - Later migration constrains to `owner/admin/manager/member` (`supabase/migrations/20251123120009_...sql`).
   - UI uses roles like `manager/creator/viewer` in `src/pages/InviteAccept.tsx` and `owner` in `src/pages/Onboarding.tsx`.
   The “Set user as admin” requirement needs a clarified mapping: should the created user be `owner` or `admin` in `agency_members.role`?

5) Auto-accept-by-email needs new RPCs:
   - Existing acceptance requires token (`public.accept_agency_invite(_invite_token, _user_id)` in `supabase/migrations/20251221131145_team_invite_hardening.sql`).
   - RLS policies for `agency_invites` are membership-based (e.g., `public.is_member_of_agency` in `supabase/migrations/20251215181154_changes_team_members.sql`).
   There is no verified mechanism to list invites for the authenticated user by email without a token.

6) Canonical “agency onboarding” route is unclear:
   - `/onboarding` (`src/pages/Onboarding.tsx`) creates an agency and optionally a first client.
   - `/ai/onboarding/agency` (`src/pages/ai/AiOnboardingAgency.tsx`) is an agency onboarding experience.
   The To-Be flow requires “start full Agency onboarding” after creating an agency; the product should choose which route is canonical.

7) Invite deep-link redirect behavior is currently inconsistent:
   - `src/pages/InviteAccept.tsx` navigates to `/auth?redirect=/invite/:token` when signed out.
   - `src/pages/Auth.tsx` does not parse query params, only `sessionStorage.redirectUrl`.
   This must be resolved to ensure manual invite acceptance works reliably.

