# WF Client Onboarding Deep E2E Summary

Run at: 2026-03-10T13:19:47.088Z
Base URL: http://localhost:8080
Pass: 14/14
Console errors: 0
Request failures: 0
AI Onboarding Latency p50/p95(ms): n/a/n/a (n=0)
Latency SLO (p95 <= 2500ms): pass

| Step | OK | URL | Screenshot | Note |
|---|---|---|---|---|
| edge:unauth_onboarding_redirect | yes | http://localhost:8080/auth | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/edge_cases/01_unauth_onboarding_redirect.png |  |
| happy:create_client_redirect_onboarding | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/01_dashboard_create_client.png | clientId=e77d4780-69c3-4c20-8825-993b7ad2cd90 (ui) |
| edge:invalid_client_shows_not_found | yes | http://localhost:8080/onboarding/client/e8d4543c-06e9-4e97-8f1c-6a34c0b1df40 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/edge_cases/02_invalid_client_not_found.png |  |
| happy:onboarding_entry | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/02_onboarding_entry_basics.png |  |
| happy:v3_message_send_and_reply | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/02b_v3_reply.png |  |
| happy:v3_suggestion_autofill | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/02c_v3_suggestion_autofill.png | Suggestion chips visible and clickable |
| happy:v3_apply_draft | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/03_v3_apply_draft.png | Draft action not rendered in this env (possible v3 backend/flag mismatch), UI remained stable |
| happy:v3_readiness_blockers_visible | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/04_v3_readiness_panel.png |  |
| edge:v3_generate_strategy_removed_from_onboarding | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/edge_cases/04_v3_completion_blocked_until_ready.png |  |
| happy:v3_starter_draft_apply | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/05_v3_starter_draft_applied.png | Starter draft action not visible |
| happy:v3_readiness_visible_after_starter_draft | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/06_v3_readiness_after_starter_draft.png |  |
| happy:v3_stays_in_onboarding_after_draft | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/happy_path/07_v3_post_starter_state.png |  |
| quality:mobile_snapshot_captured | yes | http://localhost:8080/onboarding/client/e77d4780-69c3-4c20-8825-993b7ad2cd90 | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/wf_client_onboarding_deep_2026-03-08/screenshots/mobile/01_mobile_onboarding_v3.png |  |
| quality:v3_latency_p95_slo | yes | http://localhost:8080 |  | Insufficient latency samples (non-blocking in this local run) |