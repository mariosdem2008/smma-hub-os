# Cleanup Guardrails v1 (AI)

## Edge function inventory (callers + recommendation)

| Edge function | Callers (UI/notes) | Last touched | Recommendation |
| --- | --- | --- | --- |
| ai-answer-quality-check | src/components/ai/AiOnboardingV2Chat.tsx | 2025-12-27 | V2-only; deprecate after V2 retirement, then lock down and delete later. |
| ai-retrieve-context | No UI callers found in src/ | 2025-12-27 | Mark unused; monitor invocations, plan lock down behind AI_LOCKDOWN_UNUSED_ENDPOINTS. |
| ai-documents-ingest | No UI callers found in src/ | 2025-12-27 | Verify backend usage; if none, lock down behind AI_LOCKDOWN_UNUSED_ENDPOINTS and schedule delete. |
| ai-ask | TaskType.CLIENT_PORTAL_QA (usageEndpoint: "ai-ask") | 2025-12-27 | ACTIVE; do not lock down or delete. |
| ai-brain-ingest | AiOnboardingV2Chat, AiOnboardingV3Guided, CreateAgencyStub | 2025-12-27 | Keep (active). |
| ai-brains-agency | AiOnboardingV2Chat, CreateAgencyStub | 2025-12-27 | Keep until V2/agency stub retired; then reassess. |
| ai-brains-client | AiOnboardingV2Chat, AiOnboardingV3Guided | 2025-12-27 | Keep (active). |
| ai-onboarding-guide | AiOnboardingV3Guided | 2025-12-27 | Keep (active). |
| ai-rep-chat | src/components/client-tabs/AiRepChatTab.tsx | 2025-12-27 | Keep (active). |
| ai-strategy-generate | src/components/client-tabs/StrategyHubTab.tsx | 2025-12-27 | Keep (active). |
| generate-ai-content | AIGenerateModal, CaptionEditor, ProjectFinalContentTab | 2025-12-27 | Legacy core; keep until migration off legacy logging is complete. |
| generate-monthly-report | src/hooks/useGenerateReport.ts | 2025-12-27 | Keep (active). |

## Unused AI edge functions (UI search)
- ai-retrieve-context: no UI callers found in src.
- ai-documents-ingest: no UI callers found in src.
- ai-answer-quality-check: only called by deprecated AiOnboardingV2Chat.

## ACTIVE / Core AI Endpoints
- ai-ask
  - Status: ACTIVE
  - Used by: TaskType.CLIENT_PORTAL_QA (client portal Q&A)
  - Source of truth: src/ai/taskRegistry.ts (usageEndpoint: "ai-ask")

## LOCK DOWN FIRST (guarded rollout)
If endpoints appear unused and risk is high:
1. Add minimal auth guard in the edge function behind AI_LOCKDOWN_UNUSED_ENDPOINTS=false (default false).
2. When enabled, require a valid Authorization header and agency membership before processing.
3. Log attempts to ai_usage_logs with endpoint and model="lockdown" for visibility.
4. Return 404 or 410 for non-authenticated calls when guard is enabled.

## DELETE LATER (30/90 day schedule)
Aligned to docs/ai/migration_map_v1.md:
- Day 0: Mark endpoint as deprecated in docs + logs.
- Day 30: If zero invocations, disable behind AI_LOCKDOWN_UNUSED_ENDPOINTS and keep returning 410.
- Day 90: Delete endpoint folder and remove references if still zero usage.

## Cleanup targets (ranked by risk)
1. ai-retrieve-context (unused; direct retrieval surface) - High
2. ai-documents-ingest (unused; writes embeddings) - High
3. ai-answer-quality-check (V2-only onboarding) - Medium
4. src/components/ai/AiOnboardingV2Chat.tsx (deprecated UI) - Medium
5. supabase/functions/ai-brains-agency (used by V2 + CreateAgencyStub) - Medium
6. src/hooks/useClientAIHistory.ts (legacy table) - Medium
7. public.ai_history (deprecated table, Phase 2 cleanup) - Medium
8. public.ai_generation_usage (deprecated table, Phase 2 cleanup) - Medium
9. generate-ai-content (legacy dual-write path) - Low
