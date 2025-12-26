# New User / Agency Bootstrap Flow (Spec)

## Goal
After a user authenticates, route them into the correct agency context with **no new “invented” requirements**, using existing Supabase tables/RPC patterns already in this repo.

## Evidence (current system)
- Routing is defined in `src/App.tsx` (public routes like `/auth`, invite route `/invite/:token`, protected routes under `ProtectedRoute` like `/dashboard`, `/onboarding`, `/team`).
- Auth session state is managed in `src/lib/auth.tsx` (`AuthProvider`, `supabase.auth.onAuthStateChange`, `supabase.auth.getSession()`).
- The main route guard is `src/components/ProtectedRoute.tsx` (`ProtectedRoute`):
  - Checks membership via `db.from("agency_members").select("agency_id").eq("user_id", user.id).maybeSingle()`
  - Redirects logged-in users with **no membership** to `/onboarding`
  - Redirects users with membership away from `/onboarding` to `/dashboard`
- “Team invite accept” is implemented as `/invite/:token` in `src/pages/InviteAccept.tsx`:
  - Reads invite via RPC `get_agency_invite_by_token` (`supabase.rpc('get_agency_invite_by_token', { _token })`)
  - Accepts via RPC `accept_agency_invite` (`supabase.rpc('accept_agency_invite', { _invite_token, _user_id })`)
- Tenancy context assumes **single agency** in multiple places:
  - `src/data/supabase.ts` (`getAgencyContextForUser`, `getMyAgencyContext`) uses `.maybeSingle()` for both owner (`agencies`) and member (`agency_members`) lookups.
  - `src/hooks/useRole.ts` uses `.single()` for owner/member checks, which will break for multi-membership.
- Core tenancy tables and roles:
  - `public.agencies` and `public.agency_members` are created in `supabase/migrations/20251123055929_57292cd4-c2b5-4194-bd89-e4ffb02ffd74.sql`
  - `public.agency_members` and `public.agency_invites` are created in `supabase/migrations/20251123070304_f86219b6-3017-4cc9-bcee-a3caba4122a5.sql`
  - Admin role support is added in `supabase/migrations/20251123120009_0d4a3aaa-33f4-47db-8111-5968ed1d2459.sql` (`public.is_agency_admin`, constraint change on `agency_members.role`).
  - Invite “hardening” + secure token lookup and acceptance are defined in `supabase/migrations/20251221131145_team_invite_hardening.sql` (`public.get_agency_invite_by_token`, `public.accept_agency_invite`).
  - Team invite emails are sent by the edge function `supabase/functions/send-team-invite/index.ts` (invoked via `sendTeamInviteEmail` in `src/data/index.ts`).

---

## Current Flow (As-Is)

### State machine (simplified)
1) **Unauthenticated**
   - User hits a protected route ⇒ `ProtectedRoute` redirects to `/auth` and stores `redirectUrl` in `sessionStorage` (`src/components/ProtectedRoute.tsx`).
2) **Authenticated**
   - Login success navigates to `/dashboard` from `src/pages/Auth.tsx` (uses `supabase.auth.signInWithPassword()` and `navigate(redirectUrl || "/dashboard")`).
   - `ProtectedRoute` checks membership:
     - If `agency_members` has a record ⇒ allow access.
     - If no membership ⇒ redirect to `/onboarding`.
3) **Onboarding**
   - `/onboarding` is `src/pages/Onboarding.tsx` and can create an agency (`supabase.from("agencies").insert(...)`) and membership (`supabase.from("agency_members").upsert({ role: "owner" })`).
4) **Team Invites**
   - Invites are created from `src/pages/Team.tsx` using `createAgencyInvite()` (`src/data/index.ts`) which inserts into `agency_invites`.
   - Accept invite is manual via `/invite/:token` page and the RPCs `get_agency_invite_by_token` + `accept_agency_invite` (`src/pages/InviteAccept.tsx`).

### Known issues with As-Is relative to the new requirements
- No “auto-accept by email” exists today; invite acceptance requires a token (`public.accept_agency_invite(_invite_token, _user_id)` in `supabase/migrations/20251221131145_team_invite_hardening.sql`).
- Multi-agency is not supported in routing or data access; membership queries use `.single()` / `.maybeSingle()` (examples: `src/components/ProtectedRoute.tsx`, `src/data/supabase.ts`, `src/hooks/useRole.ts`).
- `/invite/:token` sends unauthenticated users to `/auth?redirect=...` (`src/pages/InviteAccept.tsx`), but `src/pages/Auth.tsx` does not parse query params; it only reads `sessionStorage.redirectUrl`. This means invite deep-links may not round-trip reliably without additional logic.

---

## Target Flow (To-Be) — Required Product Behavior

### Definitions
- **Membership**: user has either
  - an owned agency row (`agencies.user_id = auth.uid()`), and/or
  - one or more `agency_members` rows (`agency_members.user_id = auth.uid()`).
- **Pending invite**: `agency_invites.accepted = false` AND `expires_at > now()` AND `lower(agency_invites.email) = lower(user_email)`.
  - Note: “user_email” is currently stored in `public.profiles.email` created by `public.handle_new_user()` trigger (`supabase/migrations/20251123055929_...sql`), and is also surfaced on the client as `user.email` via Supabase Auth (`src/lib/auth.tsx`).

### State machine (authoritative)
This is the required post-authentication bootstrap decision tree:

**S0: Authenticated (session established)**
- Entry point: immediately after authentication, before entering agency-scoped pages.

**S1: Load memberships**
- Load owned agency (0..1) and member agencies (0..N).
- If membership count == 0 ⇒ go to S2.
- If membership count == 1 ⇒ go to S4 with that agency.
- If membership count > 1 ⇒ go to S3.

**S2: No memberships**
- Check for pending invites for the user’s email.
  - If any pending invite exists ⇒ auto-accept at least one invite and then re-run S1.
  - If no pending invites ⇒ go to S5.

**S3: Multiple agencies**
- Show an agency picker to choose the active agency.
  - If “last used agency” is implemented, choose it automatically; otherwise require the picker.
  - Store chosen agency as “active agency” for the session (see “Active agency storage” below).
- Then go to S4.

**S4: Active agency resolved**
- Route user to the agency dashboard (current app route is `/dashboard` in `src/App.tsx`).

**S5: No agencies + no invites**
- Ask: “Are you a member of an existing agency?”
  - YES ⇒ show message only: “Ask your agency admin to invite you.” (no further action).
  - NO ⇒ allow “Create an agency”:
    - Create agency
    - Set user as admin
    - Route into agency onboarding flow

---

## Route Map (Exact Routes)

### Existing routes (evidence: `src/App.tsx`)
- Public:
  - `/` (Landing)
  - `/auth` (Auth UI)
  - `/invite/:token` (Team invite accept)
  - `/forgot-password`, `/reset-password`, `/pricing`
- Protected (wrapped by `ProtectedRoute`):
  - `/dashboard`
  - `/clients`, `/clients/:clientId`, `/team`, `/settings`, `/messages`, `/billing`, etc.
  - `/onboarding` (currently used as “no membership” redirect)
  - `/ai/onboarding/agency` (agency AI onboarding)
  - `/ai/onboarding/client(/:clientId)` and `/onboarding/ai/client(/:clientId)` (client onboarding V3 entry points)

### Proposed new routes (required by To-Be flow)
Because the To-Be flow introduces a post-auth “decision point” and an agency picker, the cleanest minimal routing addition is:
- `/bootstrap` (protected, auth-required)
  - Implements S1–S5 above (including picker UI when needed).
  - Redirects to `/dashboard` once an active agency is resolved.

Notes:
- This is intentionally a single route to avoid proliferating new pages; it mirrors the “client portal bootstrap” pattern that runs on mount in `src/pages/ClientPortalLayout.tsx` and `src/pages/client/ClientLogin.tsx`.
- If you prefer not to add a new route, the same logic can live inside `ProtectedRoute`, but that risks redirect loops and makes the guard significantly more complex.

### Onboarding destination (agency)
The To-Be flow requires “Route into agency onboarding flow” after creating an agency. Existing candidates:
- `src/pages/Onboarding.tsx` at route `/onboarding` currently creates an agency + an “owner” membership.
- `src/pages/ai/AiOnboardingAgency.tsx` at route `/ai/onboarding/agency` is explicitly an agency onboarding experience.

This spec does not assume which is canonical; see `docs/status/SPEC_GAPS.md`.

---

## Active Agency Storage (Multi-agency enablement)

### What exists today
There is no “active agency” selection persisted; multiple critical lookups assume there is at most one agency:
- `getAgencyContextForUser()` in `src/data/supabase.ts` uses `.maybeSingle()` on `agency_members`.
- `ProtectedRoute` membership check in `src/components/ProtectedRoute.tsx` uses `.maybeSingle()` on `agency_members`.
- `useRole()` in `src/hooks/useRole.ts` uses `.single()` for both agencies and agency_members checks.

### Minimal implementation approach (no DB changes)
- Store `active_agency_id` in `localStorage` (or `sessionStorage`) after the picker.
- Teach data-layer helpers (e.g., `getMyAgencyContext()` in `src/data/supabase.ts`) to:
  - list memberships, then
  - select the active one based on `active_agency_id` if present and valid, else
  - require `/bootstrap` selection when >1.

### Optional stronger approach (DB-backed “last used”)
If you need cross-device persistence, add a DB field (e.g., `profiles.last_agency_id uuid null`) and RLS:
- Allow authenticated users to update only their own `profiles.last_agency_id` (`auth.uid() = profiles.id` pattern already used in `supabase/migrations/20251123055929_...sql`).
- Ensure the chosen agency is one the user belongs to (enforced either in app logic or via a security definer RPC).

This optional DB change is not required to meet the stated behavior, but is the cleanest way to support “choose last used”.

---

## DB / RLS Requirements (To support auto-accept by email)

### Current invite model (evidence)
- Table: `public.agency_invites` (`supabase/migrations/20251123070304_...sql`, TS types in `src/integrations/supabase/types.ts`):
  - `agency_id`, `email`, `role`, `token`, `expires_at`, `accepted`, `accepted_at` (accepted_at added in `supabase/migrations/20251221131145_team_invite_hardening.sql`).
- Secure RPCs:
  - `public.get_agency_invite_by_token(_token text)` (security definer, `supabase/migrations/20251221131145_team_invite_hardening.sql`)
  - `public.accept_agency_invite(_invite_token text, _user_id uuid)` (security definer, checks profile email vs invite email, then upserts into `agency_members`)

### What’s missing for the new behavior
Auto-accept requires locating invites by email **without knowing a token**. The current RLS stance does not allow invitees to query `agency_invites` by email directly (policies are membership-based, e.g. `public.is_member_of_agency` in `supabase/migrations/20251215181154_changes_team_members.sql`).

### Proposed additions (minimal + consistent with existing hardening)
Add one or two security definer RPCs:
1) `public.get_my_pending_agency_invites()`
   - Returns minimal rows: `invite_id`, `agency_id`, `role`, `expires_at`
   - Filters by `lower(agency_invites.email) = lower(profiles.email)` for `auth.uid()`
   - Filters out expired/accepted
2) `public.accept_my_pending_agency_invites()` (or `public.accept_my_pending_agency_invite(agency_id uuid)` if you only want one)
   - Accepts pending invites for the authenticated user’s email
   - Inserts/upserts `agency_members` and sets `agency_invites.accepted = true, accepted_at = now()`

RLS posture:
- Keep `agency_invites` table private-by-default (membership-based) to avoid email harvesting.
- Use security definer RPCs for invitee self-service, as already done with `get_agency_invite_by_token`.

---

## Edge / RPC Requirements

### Existing (do not replace)
- `public.get_agency_invite_by_token` and `public.accept_agency_invite` (see `supabase/migrations/20251221131145_team_invite_hardening.sql`)
- `send-team-invite` edge function (`supabase/functions/send-team-invite/index.ts`)

### New (required by auto-accept)
- RPC(s) described above for “my pending invites” and “accept by email”.

---

## Failure Cases (must handle)
- **Auth session loading**: `AuthProvider` sets `loading` state (`src/lib/auth.tsx`); bootstrap UI must render a stable loading state.
- **No membership + pending invites, but profile email missing**: current `public.accept_agency_invite` can return `profile_missing_email` (see `supabase/migrations/20251221131145_team_invite_hardening.sql`); bootstrap should surface a clean error and suggest re-login/support.
- **Email mismatch**: current accept returns `email_mismatch`; can happen if:
  - invite email differs from `profiles.email` / `user.email`
  - user changes email after invite creation
- **Multiple agencies**:
  - No “last used” exists today → picker is required.
  - Stored “active agency” is stale (user removed from agency) → picker required.
- **Pending invites to multiple agencies**:
  - If auto-accept accepts multiple → immediately triggers the “multiple agencies” picker (S3).
  - If auto-accept accepts one → remaining invites stay pending; user may later accept via `/invite/:token` link.
- **Redirect loops**:
  - If `ProtectedRoute` continues to hard-redirect “no membership” to `/onboarding`, it will bypass the new S2/S5 decisions. The guard must be updated to send users to `/bootstrap` instead.

