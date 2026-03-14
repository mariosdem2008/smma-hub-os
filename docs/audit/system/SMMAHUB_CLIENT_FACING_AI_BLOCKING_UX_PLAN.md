# SMMAHUB Client-Facing AI Blocking UX Plan

## Goal

Replace the current toast-only failure state in the client-facing AI assistant with a clear blocked-state experience that:
- explains why the assistant is unavailable
- preserves the runtime deep link and required rollout mode
- gives agency users a direct path into setup
- gives true portal users a clear non-technical fallback

## Constraints

- `AiRepChatTab` is currently used only in the client portal.
- Some viewers are authenticated agency users with a Supabase session.
- Some viewers are client portal users with a cookie token and no agency-session access.
- `AGENT_ACTIVATION_REQUIRED` can now mean:
  - readiness blocked
  - activation mode blocked
  - certification missing

## UX Direction

### Phase 1
- parse edge-function blocking payloads instead of collapsing them into a generic error
- render an inline blocked-state card above the chat composer
- if the viewer has an agency session and `deep_link` exists:
  - show `Open AI Setup`
- if the viewer is a portal user without an agency session:
  - show `Contact your agency team`
- keep the toast, but make the inline state the primary recovery path

### Phase 2
- tailor the blocked-state copy by cause:
  - readiness incomplete
  - activation mode too low
  - certification missing
- surface required rollout mode in human copy
- add a support note for portal users

### Phase 3
- reuse the same blocking component across:
  - portal AI assistant
  - other client-facing AI surfaces
  - future client-facing approval/chat assistants

## Implementation Order

1. add a small blocker-state model in `AiRepChatTab`
2. parse `AGENT_ACTIVATION_REQUIRED` with `parseEdgeFunctionResponse`
3. render a session-aware CTA card
4. add tests for agency-session and portal-session blocked states

## Acceptance

- blocked client-facing AI no longer fails as a generic toast-only interaction
- agency users get a direct setup path
- portal users get a clear explanation without an unusable agency-route CTA
- existing send/response behavior remains unchanged for allowed flows
