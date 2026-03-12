# SMMAHUB WF Client Onboarding Chat Professional Audit (2026-03-12)

Owner: UX + product quality audit stream  
Date: 2026-03-12  
Environment: local (`http://localhost:8080`) + linked Supabase project

## Scope
- Walk the **new AI chat-based client onboarding** as a regular user.
- Capture screenshots across the full flow.
- Identify errors, missing points, weak parts, and professionalism gaps.
- Produce improvement actions for next iteration.

## Evidence
- Runner: [run_wf_client_onboarding_chat_audit.mjs](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/notes/run_wf_client_onboarding_chat_audit.mjs)
- JSON summary: [wf_client_onboarding_chat_audit_summary.json](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/logs/wf_client_onboarding_chat_audit_summary.json)
- MD summary: [wf_client_onboarding_chat_audit_summary.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/notes/wf_client_onboarding_chat_audit_summary.md)
- Screenshots folder: `docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/screenshots`

## Run Result
- End-to-end pass: `11/11` steps
- Console errors: `0`
- Non-2xx from onboarding edge function: `0`
- Main onboarding page scroll: `false` (fixed shell, internal thread scroll)

## Findings (ordered by severity)
1. **Medium - Redundant AI framing creates noise**  
   The same step appears twice in sequence: first as an AI intro card, then immediately again as the fillable AI card.  
   Evidence: [01_entry.png](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/screenshots/01_entry.png)

2. **Medium - Premium confidence signals are weak during submit**  
   User sees `Submitted: <card>` message, but no explicit “Saved fields” summary or durable save-state indicator. High-paying client UX usually shows what was captured and confirms reliability.  
   Evidence: [09_channels.png](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/screenshots/09_channels.png)

3. **Medium - Post-onboarding handoff messaging is unclear**  
   After completing onboarding and entering client workspace, strategy area still shows “No strategy document yet,” which can feel like completion did not work. Need explicit “Generating strategy…” state and ETA.  
   Evidence: [11_post_submit.png](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/screenshots/11_post_submit.png)

4. **Low - Business-tier visual distractions during onboarding**  
   “Free Plan — Upgrade” badges and non-essential chrome are visible during premium onboarding, which reduces concierge feel.  
   Evidence: [04_goal_conversion.png](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_chat_2026-03-12/screenshots/04_goal_conversion.png)

5. **Low - Request abort telemetry is noisy**  
   Captured request failures were mostly `ERR_ABORTED` (HEAD/prefetch/navigation abort patterns), not functional onboarding failures. Logging should classify these separately to avoid false red alarms.

## Professionalism Evaluation
- Conversation flow: **8/10** (clear and guided, no blocking runtime errors in this run)
- Visual quality: **8/10** (cohesive dark theme and spacing, but duplicate framing lowers polish)
- Trust/confidence UX: **6.5/10** (insufficient explicit “saved/what captured” feedback)
- Enterprise/premium feel: **7/10** (strong base, but needs reduced distraction and stronger completion/handoff confidence)

## Change Recommendations (actionable)
1. Render only one assistant step card per turn (merge intro + fillable block).
2. After each submit, append a read-only “Captured summary” AI bubble listing saved fields.
3. Add sticky save-state chip near submit button: `Saving...`, `Saved`, `Failed`.
4. Add handoff state after final submit: `Onboarding complete. Strategy generation in progress...` with progress indicator.
5. Hide or de-emphasize plan upsell chrome on onboarding route for premium onboarding experience.
6. Separate telemetry for benign aborts (`ERR_ABORTED`) vs actionable network failures.
