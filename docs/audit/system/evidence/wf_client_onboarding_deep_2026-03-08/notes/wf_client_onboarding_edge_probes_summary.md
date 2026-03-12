# WF Client Onboarding Edge Probes Summary

Run at: 2026-03-09T05:26:49.495Z
Pass: 4/4
Latency p50/p95 (ms): 2426/5110 (n=4)

| Case | OK | HTTP | Intent | Status | Confidence | Latency(ms) | Update keys | Assistant preview |
|---|---|---|---|---|---:|---:|---|
| edge:direct_answer_maps_updates | yes | 200 | direct_answer | in_progress | 0.86 | 1790 | industry_niche, primary_goal, q3_market_scope, q3_country, q3_city, offers, q6_offer_name, primary_customer, audience_type | Mapped your answer into structured onboarding updates. Next: What is the client business name? |
| edge:vague_answer_clarifies | yes | 200 | vague_answer | calibration_needed | 0.5 | 5110 |  | I need one sharper detail to improve accuracy. What is the client business name? |
| edge:question_intent_helpful | yes | 200 | help_request | calibration_needed | 0.58 | 1835 | primary_customer, primary_goal | Built a practical draft from your context. Next: What is the client business name? |
| edge:offtopic_redirected | yes | 200 | off_topic | calibration_needed | 0.5 | 2426 |  | Refocused this on onboarding and prepared a targeted draft. Next: What is the client business name? |