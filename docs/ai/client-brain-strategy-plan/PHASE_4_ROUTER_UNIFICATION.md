## Phase 4 — Route All AI Calls Through the Router

**Outcome:** Every AI call goes through a router that can load ClientBrain + AgencyBrain context and use allowlisted tools to read/write in a controlled way.

### Target behavior
- AI endpoints call a single router entrypoint with:
  - `context.supabase` attached
  - context loaders for client + agency brains
- Each task declares context requirements and returns `unknown=true` when missing (never fabricates).

### Implementation tasks
- Standardize edge functions to use the router consistently (including strategy generation).
- Implement an allowlisted tool executor for:
  - fetching brain + memory + approved docs
  - writing signals/proposals
  - enqueueing jobs
- Ensure observability:
  - ai_runs for every attempt
  - citations / brain fields used

### DoD
- No AI endpoint bypasses the router for model calls.
- Missing context always results in a gated UX path, not brittle errors.
