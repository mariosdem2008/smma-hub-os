# Brain & Memory Spine v1 Contract

## AgencyBrain (canonical JSON)
```json
{
  "identity": {
    "name": "string",
    "niches": ["string"],
    "offers": ["string"],
    "geo": ["string"],
    "languages": ["string"]
  },
  "icp": {
    "industries": ["string"],
    "size": ["string"],
    "personas": ["string"],
    "pains": ["string"],
    "objections": ["string"]
  },
  "voice_tone": {
    "adjectives": ["string"],
    "banned_words": ["string"],
    "preferred_vocab": ["string"],
    "writing_rules": ["string"]
  },
  "strategy_defaults": {
    "pillars": ["string"],
    "hook_styles": ["string"],
    "cta_styles": ["string"],
    "platform_formats": ["string"]
  },
  "safety_policy": {
    "allowed": ["string"],
    "avoid": ["string"],
    "compliance_notes": ["string"]
  },
  "process_rules": {
    "revisions": "string",
    "approvals": "string",
    "escalation_rules": "string"
  },
  "faq": [{"question": "string", "answer": "string"}],
  "gold_examples": ["string"],
  "raw_responses": "object",
  "followup_responses": "object",
  "inference_metadata": {
    "source": "string",
    "generated_at": "string"
  }
}
```

## ClientBrain (canonical JSON)
```json
{
  "brand_basics": {
    "name": "string",
    "website": "string",
    "socials": ["string"],
    "tone": "string",
    "differentiators": ["string"]
  },
  "offer_details": {
    "products_services": ["string"],
    "pricing_optional": "string",
    "usps": ["string"]
  },
  "audience": {
    "demographics": ["string"],
    "location": ["string"],
    "intent": ["string"],
    "problems": ["string"],
    "objections": ["string"]
  },
  "competitors": ["string"],
  "constraints": {
    "banned_claims": ["string"],
    "legal_constraints": ["string"],
    "taboo_topics": ["string"],
    "dos": ["string"],
    "donts": ["string"]
  },
  "pillars": [{"name": "string", "examples": ["string"]}],
  "faq": [{"question": "string", "answer": "string"}],
  "assets_links": {
    "key_urls": ["string"],
    "guidelines_link": "string",
    "lead_magnet_optional": "string"
  },
  "goals": ["string"],
  "metrics": ["string"],
  "timeline": "string",
  "approvals": "string",
  "contacts": ["string"],
  "raw_responses": "object",
  "followup_responses": "object",
  "inference_metadata": {
    "source": "string",
    "generated_at": "string"
  }
}
```

## Required fields for deep strategy safe generation
These fields must be present (non-empty) for `client_brains.usable = true`:
- `brand_basics.name`
- `offer_details.products_services`
- `audience.problems`
- `pillars` (>= 1)
- `constraints` (at least one of `banned_claims` or `taboo_topics`)
- `goals`

TODO: Confirm this minimal required set with product/strategy owners.

## Onboarding v2 mapping (question_id -> fields)
Agency onboarding:
- `identity` -> `identity.name`, `identity.niches`
- `offers` -> `identity.offers`
- `geo` -> `identity.geo`
- `languages` -> `identity.languages`
- `icp` -> `icp.industries`
- `personas` -> `icp.personas`
- `pains` -> `icp.pains`
- `objections` -> `icp.objections`
- `tone` -> `voice_tone.adjectives`
- `banned` -> `voice_tone.banned_words`
- `vocab` -> `voice_tone.preferred_vocab`
- `rules` -> `voice_tone.writing_rules`
- `pillars` -> `strategy_defaults.pillars`
- `hooks` -> `strategy_defaults.hook_styles`
- `ctas` -> `strategy_defaults.cta_styles`
- `formats` -> `strategy_defaults.platform_formats`
- `safety` -> `safety_policy.allowed` (raw note kept)
- `process` -> `process_rules.revisions/approvals/escalation_rules` (raw note kept)
- `faq` -> `faq` (stored as raw lines if not structured)
- `examples` -> `gold_examples`

Client onboarding:
- `brand` -> `brand_basics.name` (raw note kept); website parsed when present
- `differentiators` -> `brand_basics.differentiators`
- `socials` -> `brand_basics.socials`
- `tone` -> `brand_basics.tone`
- `offers` -> `offer_details.products_services`
- `pricing` -> `offer_details.pricing_optional`
- `audience` -> `audience.demographics` (raw note kept)
- `problems` -> `audience.problems`
- `competitors` -> `competitors`
- `constraints` -> `constraints.banned_claims` (raw note kept)
- `dos` -> `constraints.dos`
- `pillars` -> `pillars`
- `faq` -> `faq` (stored as raw lines if not structured)
- `assets` -> `assets_links.key_urls`
- `lead_magnet` -> `assets_links.lead_magnet_optional`
- `cta` -> `offer_details.usps`
- `voice` -> `constraints.donts`
- `platforms` -> `assets_links.key_urls` (TODO: confirm target field)
- `goals` -> `goals`
- `metrics` -> `metrics`
- `timeline` -> `timeline`
- `approvals` -> `approvals`
- `contacts` -> `contacts`
- `assets_upload` -> `assets_links.key_urls`
- `final_notes` -> `constraints.taboo_topics`

TODO: Confirm whether `platforms` belongs in a dedicated field (not defined yet).
