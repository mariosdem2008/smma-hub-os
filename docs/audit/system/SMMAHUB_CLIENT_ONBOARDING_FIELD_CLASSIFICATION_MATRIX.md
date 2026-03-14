# SMMAHUB Client Onboarding Field Classification Matrix

Last updated: 2026-03-12  
Owner: Product + AI systems  
Purpose: Define which onboarding fields belong to `essential intake`, `operations setup`, and `progressive enrichment`.

## 1) Current-field classification

| Field | Stage | Why it belongs there |
|---|---|---|
| `q1_business_name` | essential intake | Core client identity needed immediately. |
| `industry_niche` | essential intake | Grounds initial positioning and planning. |
| `q2_website` / `q2_social_links` via `q2_website_or_socials` | essential intake | Needed to confirm the real business presence. |
| `q3_market_scope` | essential intake | Defines how strategy should frame the market. |
| `q3_country` + `q3_city` via `q3_geo` | essential intake | Needed when the business operates locally. |
| `primary_goal` | essential intake | Determines what success means first. |
| `conversion_path` | essential intake | Defines the main action marketing must drive. |
| `conversion_link` / `dm_keyword` | essential intake | Required only when the selected conversion path depends on them. |
| `offers` | essential intake | A usable workspace needs a clear offer focus. |
| `primary_customer` | essential intake | Defines the initial buyer focus in plain business terms. |
| `platforms` | essential intake | Confirms where the business is already active. |
| `available_assets` | essential intake | Determines what can be executed immediately. |
| `q4_languages` | operations setup | Important for execution, but not first-session blocking. |
| `formats` | operations setup | Delivery preference that can be set after the core intake. |
| `cadence_preset` / `cadence_per_platform` via `cadence_requirement` | operations setup | Execution planning detail, not core first-session discovery. |
| `on_camera_availability` | operations setup | Production constraint needed before content execution. |
| `response_handling` | operations setup | Ownership detail needed before live campaign execution. |
| `audience_type` | progressive enrichment | Helpful for strategy depth, but often too abstract for clients initially. |
| `main_objection` | progressive enrichment | Often requires strategist interpretation. |
| `q9_pain_points` | progressive enrichment | Valuable depth, but high-friction in first-session intake. |
| `brand_voice` | progressive enrichment | Better captured through examples and later refinement. |
| `content_style` | progressive enrichment | Creative taxonomy should not block first usability. |
| `proof_types` | progressive enrichment | Improves trust positioning later. |
| `competitor_link` | progressive enrichment | Useful reference, not an operational minimum. |
| `q13_differentiators` | progressive enrichment | High-value strategy context, but often unclear at the start. |

## 2) Planned missing operating-context fields

These are not fully implemented in the current schema but should be added in the next phase.

### Operations setup

1. `primary_contact_name`
2. `primary_contact_role`
3. `primary_contact_email`
4. `main_approver_name`
5. `main_approver_role`
6. `approval_sla`
7. `preferred_comms_channel`
8. `launch_window`
9. `required_access_status`
10. `missing_assets`
11. `escalation_contact`

### Progressive enrichment

1. `compliance_notes`
2. `client_capacity_notes`
3. `budget_range`
4. `sales_cycle_notes`
5. `prior_campaign_history`
6. `lead_quality_threshold`

## 3) Product rule

Use this classification as the source of truth for:

1. staged readiness calculations
2. onboarding card sequencing decisions
3. what blocks `setup_usable`
4. what blocks `execution_ready`
5. what is allowed to be collected later without breaking first value
