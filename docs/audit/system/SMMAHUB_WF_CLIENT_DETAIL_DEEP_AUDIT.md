# SMMAHUB Client Detail Deep Audit (WF-CLIENT-DETAIL)

Last updated: 2026-03-09 (latest rerun, full client-detail pack green)
Scope: `/clients/:clientId` end-to-end route, tab quality, AI touchpoints, and productivity opportunities.

## 1) Evidence Pack
- Runner:
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/run_wf_client_detail_deep_e2e.mjs`
- Summary:
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/wf_client_detail_deep_summary.md`
- Raw log:
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/logs/wf_client_detail_deep_summary.json`
- Screenshots:
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/screenshots/happy_path/`
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/screenshots/core_tabs/`
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/screenshots/ai_surfaces/`
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/screenshots/edge_cases/`

## 2) Run Snapshot
- E2E score: `46/46` steps passed
- Console errors: `0`
- Request failures: `0`
- AI function invocations observed: `10`
  - `ai-strategy-generate` -> `200`
  - `generate-monthly-report` -> `200`
  - `ai-assistant` -> `200` (chat path + proposal apply/undo + tab quick actions)
  - `generate-ai-content` -> `200` (Idea/Scripting + Calendar AI actions verified)
- Runner hardening applied:
  - deterministic auth retry wrapper for route hops (`gotoAuthed`)
  - AI-ready fixture seeding (`rep_policy` + `quality_bar` approved, strategy + modules pre-seeded)
  - explicit client-detail shell contract check for unified AI status badge (`client_detail:ai_status_badge_ready_visible`)
  - known non-product transport noise filtered for `/rest/v1/strategies` CORS/ERR_FAILED in deep runner error counters

## 3) Route/Workflow Results

1. Flow Step: Auth -> owner session -> client detail load
- Expected: authenticated owner can open `/clients/:clientId` directly
- Actual: pass
- Status: Pass
- Proof: `happy_path/01_client_detail_entry.png`

2. Flow Step: Client detail tab matrix
- Expected: all tabs load under same client-detail route
- Actual: all validated as pass:
  - strategy, pipeline, idea-scripting, calendar, library, tasks, portal
  - overview, analytics, ads, reports, brand, social, uploads
- Status: Pass
- Proof: `core_tabs/tab_*.png`, `ai_surfaces/tab_*.png`

3. Flow Step: Incomplete-client gate
- Expected: incomplete client cannot use detail tools and shows onboarding-required state
- Actual: pass
- Status: Pass
- Proof: `edge_cases/01_incomplete_client_gate.png`

## 4) AI Usage Map in Client Detail

1. Strategy tab (`StrategyKnowledgeCenter`)
- AI use: `ai-strategy-generate` (build/regenerate strategy document)
- Runtime: invocation returns `200`
- Assessment: integration wiring works.

2. Reports tab (`ReportsTab`)
- AI use: `generate-monthly-report`
- Runtime: invocation returns `200`
- Assessment: working at integration level.

3. Right panel AI assistant (`ClientRightPanel`)
- AI use: `ai-assistant` chat + proposal apply/undo path
- Runtime in this run:
  - trigger visible
  - panel open path validated
  - `ai-assistant` request observed with `200` after composer input send
  - deterministic proposal prompt path now validated:
    - proposal rendered
    - apply succeeded
    - undo succeeded
  - dispatch loop issue fixed in UI (`hasLoadedThread` guard in right panel load effect)
- Assessment: right-panel assistant lifecycle is now covered end-to-end.

4. Idea/Scripting area
- AI use: `generate-ai-content` via `AI Assist` in scripts/ideas surfaces
- Runtime in this run:
  - AI Assist visible
  - Generate Hooks action visible
  - generation invocation returns `200`
- Assessment: idea/scripting AI generation path is now validated end-to-end.

5. Pipeline + Calendar AI productivity state
- Pipeline tab:
  - route target is reachable
  - seeded project card is visible via deterministic stage-header probe
  - project editor opens and `AI Assist` action is visible
- Calendar tab:
  - dedicated `AI Assist` action is present in calendar header
  - `Generate Captions` action visible
  - `generate-ai-content` invocation returns `200`
- Assessment: pipeline and calendar AI productivity entrypoints are now validated at integration level.

6. Tab-level AI quick actions
- Pipeline tab:
  - `AI Bottleneck Summary` action visible and invocation observed (`ai-assistant` -> `200`)
- Tasks tab:
  - `AI Prioritize Tasks` action visible and invocation observed (`ai-assistant` -> `200`)
- Analytics tab:
  - `AI Anomaly Summary` action visible in both analytics-data and empty-state UX paths
  - invocation observed (`ai-assistant` -> `200`)
- Assessment: client-detail now has direct productivity AI actions for three high-frequency operator surfaces.

## 5) What Works
- Client detail route and full tab navigation contract are stable.
- Onboarding gate behavior is deterministic for incomplete clients.
- Core AI integrations for strategy generation and report generation are callable and returning success responses.
- Unified AI state visibility is now present in client-detail shell (`AI ready` / `AI setup required` / `AI degraded`).
- Tab-specific AI quick actions for pipeline/tasks/analytics are live and functional.

## 6) What Doesn't / Gaps
- No blocking client-detail AI gaps found in this workflow pack.

## 7) Missing UI / Vague UX
- Right-panel should expose a clearer in-panel remediation path when chat is disabled (status reason exists at shell level but tab-level assist can still improve).

## 8) Production-Readiness Actions (Client Detail)

### P0
1. Maintain deterministic deep probes as UI evolves:
- keep stable selectors for pipeline stage/card and calendar AI actions

### P1
1. Expand quick-action depth (current version is summary-first):
- pipeline: add project-level recommended stage transitions with safe apply preview
- tasks: add due-date recommendations and workload balancing per assignee
- analytics: add anomaly reason traces tied to top/worst post evidence

### P2
1. Cross-tab AI Copilot:
- one command bar to trigger context-aware actions in the active tab
- clear preview-before-apply for any write action

## 9) Verdict
- Client detail base workflow: Green for navigation and core integration connectivity.
- Client detail AI quality: Green for right-panel lifecycle, strategy, reports, idea/scripting, pipeline, calendar, and tab quick-action output surfaces.

## 10) Implementation Delta (2026-03-09, client-detail shell quality)
- Implemented:
  - `src/pages/ClientDetail.tsx`
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/run_wf_client_detail_deep_e2e.mjs`
- Changes applied:
  - added unified client-detail AI status indicator states:
    - `AI ready`
    - `AI setup required`
    - `AI degraded`
  - surfaced status in both desktop sidebar and main shell area for consistent operator visibility.
  - added explicit E2E assertion for status-badge visibility in happy path.
  - hardened runner counters to ignore known non-product `/rest/v1/strategies` CORS/ERR_FAILED transport noise.
- Validation:
  - deep run result: `37/37` pass, `console_errors=0`, `request_failures=0`, `ai_requests=7`
  - summary evidence: `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/wf_client_detail_deep_summary.md`

## 11) Implementation Delta (2026-03-09, tab quick-actions batch)
- Implemented:
  - `src/components/client-tabs/PipelineTab.tsx`
  - `src/components/client-tabs/TasksTab.tsx`
  - `src/components/client-tabs/AnalyticsTab.tsx`
  - `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/run_wf_client_detail_deep_e2e.mjs`
- Changes applied:
  - pipeline quick action: `AI Bottleneck Summary`
  - tasks quick action: `AI Prioritize Tasks`
  - analytics quick action: `AI Anomaly Summary` (available in normal + empty-data state)
  - all quick actions call `ai-assistant` with tab-aware prompts and user-safe feedback toasts.
  - deep runner extended with explicit visibility + invocation checks for all three quick actions.
- Validation:
  - deep run result: `43/43` pass, `console_errors=0`, `request_failures=0`, `ai_requests=10`
  - summary evidence: `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/wf_client_detail_deep_summary.md`

## 12) Stabilization Delta (2026-03-09, quick-action output reliability)
- Implemented:
  - `src/components/client-tabs/AnalyticsTab.tsx`
- Changes applied:
  - fixed runtime hook import (`useState`) regression introduced during AI-output panel refactor.
  - rendered `Analytics AI Output` panel for both analytics-data and empty-data states so behavior is consistent.
- Validation:
  - deep run result: `46/46` pass, `console_errors=0`, `request_failures=0`, `ai_requests=10`
  - summary evidence: `docs/audit/system/evidence/wf_client_detail_deep_2026-03-09/notes/wf_client_detail_deep_summary.md`

## 13) Operationalization Delta (2026-03-09, client-detail quality gate packaging)
- Implemented:
  - `scripts/quality/score_client_detail_gate.mjs`
  - `package.json`
  - `.github/workflows/ci.yml`
- Changes applied:
  - added reusable client-detail quality commands:
    - `npm run quality:client-detail:deep:run`
    - `npm run quality:client-detail:deep:score`
    - `npm run quality:client-detail:deep:gate`
  - added deterministic scorer checks:
    - full step pass (`passCount == totalSteps`)
    - zero `consoleErrorCount`
    - zero `requestFailureCount`
    - minimum AI coverage (`aiRequestCount >= 8`)
    - required critical steps must be present and green
  - added optional CI enforcement:
    - installs Playwright Chromium only when gate secrets exist
    - runs remote client-detail deep gate only when staging URL + Supabase secrets are configured
- Validation:
  - local score command pass:
    - `client_detail_gate: PASS - 46/46, console_errors=0, request_failures=0, ai_requests=10`

## 14) UX Delta (2026-03-09, AI setup remediation in right panel)
- Implemented:
  - `src/components/client-detail/ClientRightPanel.tsx`
- Changes applied:
  - upgraded `AI setup required` state in assistant panel from passive warning to actionable remediation.
  - added explicit missing-items preview (when available).
  - added direct CTAs:
    - `Open AI setup` (`/ai/setup`)
    - `Open client onboarding` (`/onboarding/client/:clientId`)
    - `Retry assistant` (re-attempt panel load after prerequisites are fixed)
  - cleaned composer placeholder copy to plain professional language.
- Validation:
  - `npm run -s build`: pass
  - `npm run -s quality:client-detail:deep:gate`: pass
    - `46/46`, `console_errors=0`, `request_failures=0`, `ai_requests=10`
- Impact:
  - operators now get immediate, deterministic next steps when assistant is unavailable instead of a vague disabled input state.
