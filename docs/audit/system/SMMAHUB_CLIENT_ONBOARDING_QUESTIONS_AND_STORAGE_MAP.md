# SMMAHUB Client Onboarding: Questions and Exact Stored Fields

## Scope
This maps the **current V5 client onboarding flow** (`/onboarding/client/:clientId`) to exactly what gets persisted in `public.client_onboarding_profiles`.

Write path:
1. If profile does not exist: `upsert_onboarding_profile(...)` creates row.
2. During onboarding: UI autosave does direct `UPDATE client_onboarding_profiles`.
3. On completion: `complete_onboarding_profile(p_client_id)` sets `completed_at` and enqueues `ingest_client_brain`.

---

## Question-to-Storage Map (Current V5 UX)

### Basics
1. Question: `Business name`
- Stored fields:
  - `q1_business_name` (TEXT)

2. Question: `Industry / niche`
- Stored fields:
  - `industry_niche` (TEXT enum-like value)

3. Question: `Website URL (optional)`
- Stored fields:
  - `q2_website` (TEXT)

4. Question: `Main social profile (required if no website)`
- Stored fields:
  - `q2_social_links` (TEXT[])

5. Question: `Additional social profiles (optional)`
- Stored fields:
  - `q2_social_links` (TEXT[]) (same array, additional values)

6. Question: `Scope` (market scope)
- Stored fields:
  - `q3_market_scope` (TEXT)

7. Question: `Country`
- Stored fields:
  - `q3_country` (TEXT)

8. Question: `City/Region`
- Stored fields:
  - `q3_city` (TEXT)

9. Question: `Language`
- Stored fields:
  - `q4_languages` (TEXT[])

### Goal + Conversion
10. Question: `Primary goal`
- Stored fields:
  - `primary_goal` (TEXT)

11. Question: `Conversion path`
- Stored fields:
  - `conversion_path` (TEXT)

12. Conditional question (when path is `book_call`, `book_appointment`, or `website_checkout`): `Conversion link`
- Stored fields:
  - `conversion_link` (TEXT)

13. Conditional question (when path is `dm_keyword`): `DM keyword`
- Stored fields:
  - `dm_keyword` (TEXT)

### Offers
14. Question: `Top offers (pick 1-3)`
- Stored fields:
  - `offers` (JSONB array)
  - plus mirrors from first offer:
    - `q6_offer_name` (TEXT)
    - `q6_price_min` (NUMERIC)
    - `q6_price_max` (NUMERIC)

15. Question(s) per selected offer: `Offer name`, `Price range`, `1-line promise`
- Stored fields:
  - `offers` (JSONB array of objects `{ type, name, price_min, price_max, promise }`)
  - mirror of first offer into:
    - `q6_offer_name`
    - `q6_price_min`
    - `q6_price_max`

### Audience
16. Question: `Audience type`
- Stored fields:
  - `audience_type` (TEXT)

17. Question: `Primary customer`
- Stored fields:
  - `primary_customer` (TEXT)

18. Question: `Main objection`
- Stored fields:
  - `main_objection` (TEXT)

19. Question: `Pain points (pick 3)`
- Stored fields:
  - `q9_pain_points` (TEXT[])

### Brand + Content
20. Question: `Brand voice`
- Stored fields:
  - `brand_voice` (TEXT[])

21. Question: `Content style`
- Stored fields:
  - `content_style` (TEXT[])

22. Question: `On-camera availability`
- Stored fields:
  - `on_camera_availability` (TEXT)

23. Question: `Available assets`
- Stored fields:
  - `available_assets` (TEXT[])

### Proof + Competitors
24. Question: `Proof you can show`
- Stored fields:
  - `proof_types` (TEXT[])

25. Question: `1 competitor I want to beat (or account I admire)`
- Stored fields:
  - `competitor_link` (TEXT)

26. Optional detail question: `Client differentiators` (+ optional rank order)
- Stored fields:
  - `q13_differentiators` (TEXT[])

### Channels + Cadence
27. Question: `Platforms`
- Stored fields:
  - `platforms` (TEXT[])
  - mirrored legacy field:
    - `q16_enabled_channels` (TEXT[])

28. Question: `Content formats`
- Stored fields:
  - `formats` (TEXT[])

29. Question: `Cadence` preset
- Stored fields:
  - `cadence_preset` (TEXT)
  - `cadence_per_platform` (JSONB)
  - mirrored legacy field:
    - `q18_cadence` (JSONB)

30. Conditional question (when preset = `custom`): per-platform posts/week
- Stored fields:
  - `cadence_per_platform` (JSONB)
  - `q18_cadence` (JSONB mirror)

31. Optional question: `Response handling`
- Stored fields:
  - `response_handling` (TEXT)

### Review
32. Action: `Generate Strategy`
- Stored fields:
  - `completed_at` (TIMESTAMPTZ) via `complete_onboarding_profile`
  - also enqueues `ai_jobs.job_type = 'ingest_client_brain'`

---

## AI Scan and Copilot: What Gets Stored

### AI Scan (`Scan website/profile`)
- The scan result is used to suggest/apply values into onboarding fields above.
- In current V5 UI, scan application persists by updating the normal onboarding fields.
- `v5_meta.last_scan` is also stored with:
  - `timestamp`
  - `confidence`
  - `applied_fields_count`

### Copilot (`AI Copilot`)
- Draft suggestions apply directly to the same onboarding fields above.
- No separate copilot answer table in this flow; persisted through profile autosave updates.

---

## Auto-Saved Non-Question Metadata (written during onboarding)

These are persisted on autosave even though they are not direct user questions:
- `v5_meta.progress.active_section`
- `v5_meta.progress.completed_sections`
- `v5_meta.progress.percent_complete`
- `v5_meta.progress.updated_at`
- `readiness_score`
- `blockers` (array of `{ field, message }`)
- `current_step` (derived from active section index)
- `flow_type` (defaults `agency_led` in this flow)
- `updated_at`

---

## Legacy/Schema Fields Not Actively Asked in Current V5 UI

Present in table/schema but not explicitly collected as separate current V5 questions:
- `q5_offer_type`
- `q6_main_cta`
- `q7_business_model`
- `q10_desired_outcome`
- `q11_sales_cycle`
- `q12_competitors`
- `q14_proof_level`
- `q15_proof_points`
- `q17_primary_goal`
- most `q*_provenance` columns
- `ai_scan_result`, `ai_scan_at`, `ai_scan_accepted` are schema fields but current V5 flow primarily stores applied output fields + `v5_meta.last_scan`.

---

## Important Mapping Rules
- Offer mirror rule: first `offers[0]` maps into `q6_offer_name`, `q6_price_min`, `q6_price_max`.
- Platform mirror rule: `platforms` mirrors into `q16_enabled_channels`.
- Cadence mirror rule: `cadence_per_platform` mirrors into `q18_cadence`.
- Conditional requirement rules:
  - `conversion_link` required only for booking/checkout paths.
  - `dm_keyword` required only for `dm_keyword` conversion path.
  - `q3_country` + `q3_city` required when market scope is `local`.
