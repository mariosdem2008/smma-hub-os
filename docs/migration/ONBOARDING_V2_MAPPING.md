# AI Onboarding v2 Mapping (Legacy -> AI Employee v1)

## Legacy Onboarding Routes (current)
- /onboarding (src/pages/Onboarding.tsx)
- /ai/onboarding/agency (src/pages/ai/AiOnboardingAgency.tsx)
- /ai/onboarding/client (src/pages/ai/AiOnboardingClient.tsx)

## Target v2 Routes (Phase 1)
- /onboarding/ai/agency
- /onboarding/ai/client/:client_id

## Legacy Tables & Storage Used
- profiles (profiles.full_name)
- agencies (name, website, niche)
- agency_members (agency_id, user_id, role)
- clients (name, website, logo_url, brand_colors, notes, status)
- client_branding (brand_voice, brand_tone, brand_guidelines, colors)
- client_content_pillars (title, description)
- client_assets (file_url, file_name)
- client_inspiration (source_url, description)
- storage bucket: client-logos (logo upload)

## Field-by-Field Mapping

### Legacy -> agency_brains (JSONB)
| Legacy Source | Legacy Field | Target Brain Field | Transform | Notes |
| --- | --- | --- | --- | --- |
| agencies | name | identity.name | string -> string | direct map |
| agencies | niche | identity.niches | string -> array | wrap single value into array |
| agencies | website | none | n/a | store in ai_documents as agency_sop with metadata.source=legacy |
| agencies | brand color (UI-only) | none | n/a | no direct storage; optionally record in ai_documents metadata |
| profiles | full_name | none | n/a | profile remains; not part of brain schema |

### Legacy -> client_brains (JSONB)
| Legacy Source | Legacy Field | Target Brain Field | Transform | Notes |
| --- | --- | --- | --- | --- |
| clients | name | brand_basics.name | string -> string | direct map |
| clients | website | brand_basics.website | string -> string | direct map |
| clients | logo_url | assets_links.key_urls | string -> array | append logo URL to key_urls |
| clients | brand_colors | none | n/a | no direct field; store in ai_documents client_notes metadata |
| clients | notes | faq or constraints? | n/a | store in ai_documents doc_type=client_notes with metadata.source=legacy |
| clients | status | none | n/a | remains on clients table only |
| client_branding | brand_voice/brand_tone | brand_basics.tone | string -> string | prefer brand_tone, fallback brand_voice |
| client_branding | brand_guidelines | constraints.dos/donts | string -> array | store as single-element arrays with provenance |
| client_content_pillars | title/description | pillars | rows -> array | map title + description into pillars entries |
| client_assets | file_url | assets_links.key_urls | string -> array | append asset URLs |
| client_inspiration | source_url | assets_links.key_urls | string -> array | append inspiration URLs |

### Legacy -> ai_documents (memory)
| Legacy Source | Legacy Field | doc_type | content | metadata |
| --- | --- | --- | --- | --- |
| agencies | website, niche, brand color | agency_sop | summary text | { source: 'legacy_onboarding', field: '<field>' } |
| clients | notes, brand_colors | client_notes | notes text | { source: 'legacy_onboarding', field: '<field>' } |
| clients | logo_url | client_guidelines | logo URL | { source: 'legacy_onboarding', field: 'logo_url' } |
| client_branding | brand_guidelines | client_guidelines | guidelines text | { source: 'legacy_onboarding', field: 'brand_guidelines' } |
| client_assets | file_url | client_guidelines | asset URLs | { source: 'legacy_onboarding', field: 'client_assets' } |

## Writeback (AI Fields)
- AI Field approved outputs -> ai_documents doc_type=ai_artifact with metadata.source='ai_field_output'

## Gaps / Unmapped
- Agencies: website and brand color not represented in brain schema; preserved in memory metadata.
- Clients: brand_colors and status not represented in brain schema; preserved or left in legacy tables.
