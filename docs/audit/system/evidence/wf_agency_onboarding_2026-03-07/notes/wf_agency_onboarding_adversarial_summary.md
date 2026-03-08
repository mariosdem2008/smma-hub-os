# WF Agency Onboarding Adversarial E2E Summary

Run at: 2026-03-07T09:52:10.608Z
Base URL: http://localhost:8080
Pass: 4/4

## Scenario Matrix

| Scenario | Expected Advance | Actual Advance | Pass |
|---|---:|---:|---|
| user_question_should_not_advance | no | no | yes |
| garbage_should_not_advance | no | no | yes |
| idk_should_not_advance_required | no | no | yes |
| valid_answer_should_advance | yes | yes | yes |

## Evidence

- screenshots: `adv_01_entry.png` ... `adv_05_valid_answer.png`
- JSON log: `wf_agency_onboarding_adversarial_summary.json`
- turn logs captured: 3