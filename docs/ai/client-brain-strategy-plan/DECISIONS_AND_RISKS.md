## Decisions + Risks

### Decisions needed (tracked)
1) Canonical competitors shape:
   - v1: string list
   - v2: objects `{ name, notes }`
2) Where onboarding→raw_responses mapping lives:
   - edge shared module (recommended)
   - client-side (avoid; duplication risk)
3) How to represent diffs:
   - JSON Patch vs existing `json_diff` shape

### Risks
- Adding a unique index may fail if duplicates exist; mitigation: de-duplication step before index.
- Trigger insert must remain idempotent; mitigation: `WHERE NOT EXISTS` on insert.
- Changing missing-brain from HTTP 400 to gated HTTP 200 may affect clients that expect errors; mitigation: UI already supports gated flows and will display deep link.

### Non-goals (for now)
- Full redesign of onboarding UI.
- Automatic, unapproved changes to sensitive brand constraints.
