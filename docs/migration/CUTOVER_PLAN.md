# AI Onboarding v2 Cutover Plan

## 7-Day Monitoring Checklist
Day 1
- Monitor AI onboarding v2 completion rate (goal: >= 90% of sessions complete core questions).
- Verify ai_runs logging volume matches onboarding sessions.
- Check error logs for ai-answer-quality-check and ai-brains endpoints.

Day 2
- Review draft vs usable status distribution in agency_brains/client_brains.
- Validate follow-up counts (max 3) and average response times.
- Confirm no writes to legacy onboarding tables.
  - Note: sparse legacy accounts may backfill as draft; expected to complete via onboarding v2.

Day 3
- Sample 10 agency brains and 10 client brains for data quality.
- Validate citations in AI Field outputs (if used).
- Check memory document ingestion success rate.

Day 4
- Monitor budgets/rate-limits impact on onboarding and ask flows.
- Validate ai_escalations creation when UNKNOWN + policy/budget triggers.

Day 5
- Compare legacy onboarding completion metrics vs v2 (if both active).
- Confirm client portal approvals unaffected.

Day 6
- Verify backfill coverage metrics and usability thresholds.
- Review any agency support tickets related to onboarding.

Day 7
- Go/No-Go review with stakeholders.
- Decide deprecation timeline for legacy onboarding.

## Rollback Plan
- Flip feature flag: VITE_AI_ONBOARDING_V2_ENABLED=false.
- Stop writes to AI onboarding v2 routes.
- Revert routing to legacy /onboarding only.
- Retain all AI v1 tables and data (no deletes).

## Deletion List (post-cutover only)
- Legacy /onboarding page (src/pages/Onboarding.tsx)
- Legacy onboarding proxy signals in Dashboard (if replaced)
- Any temporary v2 feature flag UI gates
- Deprecated AI onboarding v1 demo routes (/ai/onboarding/*) if unused

## Guardrails
- Do not delete legacy tables until v2 is stable for >= 14 days.
- Maintain dual-write or compatibility layer until data parity is validated.
