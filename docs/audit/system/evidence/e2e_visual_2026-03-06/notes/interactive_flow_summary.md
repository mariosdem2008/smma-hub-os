# Interactive User Flow Run

Base URL: http://localhost:8080
User: codex.audit.1772984774896@example.com

| Step | OK | URL | Note | Screenshot |
|---|---|---|---|---|
| login | yes | http://localhost:8080/auth | Login submitted | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/e2e_visual_2026-03-06/screenshots/flow/01_post_login.png |
| open_create_agency | yes | http://localhost:8080/auth | N/A: persona landed on /auth, create-agency navigation not required | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/e2e_visual_2026-03-06/screenshots/flow/02_create_agency_open_skipped.png |
| create_agency_submit | yes | http://localhost:8080/auth | N/A: persona already past create-agency step (/auth) | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/e2e_visual_2026-03-06/screenshots/flow/03_onboarding_entry_skipped.png |
| onboarding_answer_send | yes | http://localhost:8080/auth | N/A: onboarding route is auth-gated in this persona state (/auth). | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/e2e_visual_2026-03-06/screenshots/flow/04_onboarding_answer_failed.png |
| onboarding_use_suggestion | yes | http://localhost:8080/auth | N/A: onboarding suggestion path is auth-gated in this persona state (/auth). | C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/evidence/e2e_visual_2026-03-06/screenshots/flow/05_onboarding_use_suggestion_failed.png |