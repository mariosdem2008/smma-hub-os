## Phase 3 — Continuous Collaboration ClientBrain Evolution

**Outcome:** ClientBrain improves over time from real signals (chat, approvals, analytics, goals) without unsafe drift, via versioned updates and (where needed) human approval.

### Concepts
**Signals (append-only)**
- Facts/observations sourced from:
  - onboarding, AI-client chat, approvals, analytics, goals, manual notes

**Proposals (AI suggested changes)**
- Suggested diffs (JSON Patch or existing `json_diff`) with:
  - rationale, confidence, citations/references to signals
  - required_approval flag for risky fields

**Apply**
- Applying a proposal creates a new `client_brains` version and re-evaluates `usable`.

### Safety rules
- Never auto-apply changes to:
  - constraints/legal/banned claims
  - offer/pricing
  - voice/tone rules
without explicit approval.
- Auto-apply allowed only for low-risk additive updates (examples, FAQs, asset links) when grounded.

### DoD
- Signals and proposals are persisted and traceable.
- Brain updates are versioned and auditable.

### Readiness checklist (before Phase 4)
- [ ] Tool permissions prevent arbitrary DB mutation.
- [ ] Approval workflow exists for risky fields.
