# Bootstrap Flow Tasks (Max 10)

1) Add `/bootstrap` route + page
   - Acceptance: Route exists in `src/App.tsx` and is reachable after login for users without a resolved agency; shows loading, picker, question, or redirects appropriately.

2) Refactor membership discovery to support multi-agency
   - Acceptance: Replace `.single()` / `.maybeSingle()` membership assumptions with list queries in `src/components/ProtectedRoute.tsx`, `src/data/supabase.ts` (`getAgencyContextForUser` / `getMyAgencyContext`), and `src/hooks/useRole.ts` without breaking single-agency behavior.

3) Implement “active agency” selection storage
   - Acceptance: After selecting an agency in the picker, the chosen `agency_id` is persisted (e.g., `localStorage`) and used consistently by data access helpers (e.g., `getMyAgencyContext()`).

4) Add Supabase RPC: list my pending agency invites (by email)
   - Acceptance: A security definer function (e.g., `public.get_my_pending_agency_invites()`) returns only the authenticated user’s pending, unexpired invites without exposing other emails; callable from the app as `supabase.rpc(...)`.

5) Add Supabase RPC: auto-accept my pending invites
   - Acceptance: A security definer function accepts pending invites for the authenticated user (creates/upserts `agency_members`, marks `agency_invites.accepted=true`, sets `accepted_at`); safe on repeated calls (idempotent).

6) Update post-auth routing to enter bootstrap
   - Acceptance: After sign-in, users are navigated to `/bootstrap` (or a flow that runs bootstrap logic) instead of directly to `/dashboard`, and `ProtectedRoute` redirects “logged in but no resolved agency” to `/bootstrap` rather than `/onboarding`.

7) Implement “No agencies + no invites” question UX
   - Acceptance: `/bootstrap` shows exactly: “Are you a member of an existing agency?” with YES → “Ask your agency admin to invite you.” and NO → “Create an agency”.

8) Wire “Create an agency” → agency onboarding
   - Acceptance: Creating an agency sets the user as admin/owner in `agency_members` and routes into the existing agency onboarding flow (`/onboarding` or `/ai/onboarding/agency`, whichever is chosen).

9) Fix invite deep-link redirect (manual accept path)
   - Acceptance: Visiting `/invite/:token` while signed out returns the user to `/invite/:token` after completing `/auth` (currently `src/pages/InviteAccept.tsx` uses `?redirect=...` but `src/pages/Auth.tsx` ignores it).

10) Add minimal tests for bootstrap decisions
   - Acceptance: Add unit tests covering: (a) no membership + pending invites → auto-accept invoked, (b) multiple memberships → picker state, (c) no membership + no invites → question state. Tests should follow existing test setup (e.g., `src/components/ai/__tests__` and `vitest.config.ts`).

