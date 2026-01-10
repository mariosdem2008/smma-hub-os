# Default Brain Pack v1 — Templates (Local Only, No DB Changes)

This doc describes the Default Brain Pack v1 templates implemented in code (no automatic seeding yet).

## Source of Truth

- Templates + renderer live in `src/brain/defaultPackV1.ts:1`.
- Unit tests live in `src/brain/__tests__/defaultPackV1.test.ts:1`.

## Rules

- Exactly 3 modules:
  - `bootstrap`
  - `rep_policy`
  - `quality_bar`
- Content is generic and safe for any agency:
  - No niche-specific claims.
  - No promises/guarantees of outcomes.
  - No invented facts, metrics, rankings, testimonials.
- Placeholders supported (string replacement, recursive):
  - `{{agency_name}}`
  - `{{agency_website}}`
  - `{{agency_niche}}`
- JSON shapes must match existing editors exactly:
  - `BootstrapProfileEditor` schema keys: `src/components/brain/editors/BootstrapProfileEditor.tsx:24`
  - `RepPolicyEditor` schema keys: `src/components/brain/editors/RepPolicyEditor.tsx:28`
  - `QualityBarEditor` schema keys: `src/components/brain/editors/QualityBarEditor.tsx:20`

## Template Overview

### 1) `bootstrap` — “Bootstrap Profile (Default Brain Pack v1)”

Purpose: a safe starting draft for agency identity fields and basic positioning language. Uses placeholders for name/website/niche and leaves “fill in” guidance for everything else.

Expected `content_json` keys:
- `agency_name`, `niche`, `website`, `positioning`, `services`, `ideal_client_profile`, `pain_points`, `unique_value_proposition`, `target_industries`

### 2) `rep_policy` — “Rep Policy (Default Brain Pack v1)”

Purpose: safe defaults for AI persona, boundaries, escalation triggers, and “never say” rules that prevent guarantees and invented claims.

Expected `content_json` keys:
- `ai_name`, `persona`, `response_sla`, `can_do`, `cannot_do`, `escalation_triggers`, `never_say`, `response_templates`, `tone_guidelines`

### 3) `quality_bar` — “Quality Bar (Default Brain Pack v1)”

Purpose: generic QA checklist and escalation rules that enforce “no guarantees” and “no unverified claims” as non-negotiables.

Expected `content_json` keys:
- `review_criteria`, `minimum_score`, `critical_criteria`, `non_negotiables`, `revision_policy`, `escalation_triggers`, `qa_steps`

