# UI Move AI Rep — Findings

## Current AI Rep UI wiring (agency app)
- `src/pages/ClientDetail.tsx` imports `AiRepChatTab` and exposes a secondary tab `{ id: "ai_rep", label: "AI Rep" }`, rendering `return <AiRepChatTab clientId={clientId} />;` in `renderTabContent()` (see the `"ai_rep"` switch case).
- Chat UI component: `src/components/client-tabs/AiRepChatTab.tsx` invokes `supabase.functions.invoke("ai-rep-chat", { body: { client_id, message } })`.

## Client portal routing + nav structure
- Portal shell + routes live in `src/App.tsx` under:
  - `/client/portal/*` and `/client/portal/:portalSlug/*` (nested routes like `approvals`, `content-calendar`, `messages`, etc.).
- Portal layout + sidebar nav items: `src/pages/ClientPortalLayout.tsx` (local `navItems` array; rendered as `<Link to={`${basePortalPath}/${item.path}`}>`).
- Portal mobile bottom nav: `src/components/ClientPortalMobileBottomNav.tsx` (local `navItems` array + `grid-cols-5`).
- Portal `client_id` derivation: `src/pages/ClientPortalLayout.tsx` loads `clients` by `portal_user_id = authUser.user.id` and passes `{ clientId: client.id }` via `Outlet` context.

## Agency admin role determination (guard pattern)
- Role hook: `src/hooks/useRole.ts` derives role by:
  - Owner: `agencies.user_id = auth.user.id` ⇒ `role = "owner"`
  - Member: `agency_members.role` for `user_id`
- Convenience flags: `isAdmin` is `role === "admin"` (returned from `useRole()`), used in `src/components/AppSidebar.tsx` for conditional nav entries (e.g. billing overview).

## Backend enforcement (ai-rep-chat)
- Edge function: `supabase/functions/ai-rep-chat/index.ts` currently authorizes via `agency_members` membership against the target client’s `agency_id` and returns `403` when not a member.
- Client portal users authenticate via `clients.portal_user_id` (see above), so `ai-rep-chat` must support portal auth while enforcing `client_id` scoping server-side.

