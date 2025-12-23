# AI Employee v1 Spec (Brain + Memory + UI)

## Vision (12 bullets)
- Agency Brain: one canonical, versioned source of agency identity, voice, strategy defaults, and policies.
- Client Brain: per-client versioned profile that tunes outputs for each brand, offer, and audience.
- Memory (RAG): dual store of relational truth + vectorized documents for grounded retrieval.
- Retrieval hierarchy: Client Brain > Client Memory > Agency Brain > Agency Memory > General knowledge.
- Chat Onboarding UI: 1 question at a time in a conversation flow with save/resume.
- Answer quality checks: server-side validation with 1-3 follow-ups per core question.
- Review & Confirm: AI presents structured fields + confidence for human approval.
- AI Fields: consistent in-app AI-assisted fields with citations and locking.
- Safety by default: UNKNOWN + 1-3 questions or escalation when not grounded.
- Observability: log every run with prompt version, model, tokens, cost, latency, and citations.
- Cost controls: per-run token caps, per-user rate limits, per-agency budget caps with hard stops.
- Client portal readiness: answers grounded, with escalation when out of scope.

## Scope
- Included: Brain, Memory, Retrieval, Run Logging, Cost Controls, Onboarding UI specs, In-app AI Fields UI specs.
- Excluded: implementation, migrations, and any client-side AI calls.

## Components
1) Brain System
   - Agency Brain (JSONB + versioned)
   - Client Brain (JSONB + versioned)
2) Memory System
   - Document ingestion: chunking + embedding
   - Storage: document metadata + chunks + embeddings
3) Retrieval + Grounding
   - Hierarchical retrieval with filtering and recency weighting
   - Strict JSON output contract
4) Run Logging + Cost Controls
   - Per-run logging and budgets enforcement
5) UI Systems (spec-only)
   - Chat Onboarding
   - AI Field component pattern

## Flows
### Agency Brain Onboarding
1) Start onboarding (create draft brain version)
2) Ask core questions (20-40) with 1-3 follow-ups
3) Ingest at least 5 exemplar strategies
4) Review & Confirm (show fields + confidence)
5) Lock v1

### Client Brain Onboarding
1) Start onboarding (create draft brain version)
2) Ask core questions (25-50) with 1-3 follow-ups
3) Review & Confirm
4) Lock v1

### Ask (RAG)
1) Validate budget + rate limits + per-run token cap (6,000)
2) Retrieve context (hierarchy + filters)
3) Generate response with strict JSON output contract
4) Log run, including citations
5) Return response, or UNKNOWN + questions/escalation

## Data Requirements (Brains + Memory)
### Agency Brain (JSONB + versioning)
1) Identity: name, niches, offers, geo, language(s)
2) ICP: industries, size, personas, pains, objections
3) Voice/tone: 5 adjectives, banned words, preferred vocab, writing rules
4) Strategy defaults: pillars, hook styles, CTA styles, per-platform formats
5) Safety/claims policy: allowed/avoid/compliance notes
6) Process rules: revisions, approvals, escalation rules
7) Sales/Support FAQ: 10-30 Q/A
8) Gold examples: 5-20 structured examples + why good (embeddable)

### Client Brain (JSONB + versioning)
1) Brand basics: name, website, socials, tone, differentiators
2) Offer details: products/services, pricing optional, USPs
3) Audience: demographics, location, intent, problems, objections
4) Competitors: 3-10 + notes
5) Constraints: banned claims, legal constraints, taboo topics, do/don't
6) Pillars: 3-7 + examples
7) FAQ: 10-30 Q/A
8) Assets/links: key URLs, guidelines link, lead magnet optional

### Memory System
- Document types: agency_exemplar_strategy, agency_sop, client_guidelines, client_notes, approved_posts, ai_artifact
- AI Field writeback: approved_locked outputs stored as ai_artifact
- Chunking defaults: chunk_size_tokens=900, overlap_tokens=140, max_chunks_per_doc=120
- Ingestion limits: allowed PDF, DOCX, TXT, MD, URL; max_file_size_mb=20; max_extracted_chars_per_doc=150000
- Embeddings defaults: embedding_dim=1536, similarity=cosine
- Retrieval defaults: top_k_total=12 (allocation: 6 client_memory, 4 agency_memory, 2 exemplars), recency_half_life_days=45
- Retrieval filters: agency_id required, client_id optional, doc_type filter supported
- Grounding rule: if not grounded in brain/memory -> UNKNOWN + ask 1-3 questions or escalate

## Retrieval + Grounding
- Hierarchy priority: Client Brain > Client Memory > Agency Brain > Agency Memory > General knowledge
- Citation rules:
  - Factual claims: >= 1 citation OR explicit brain_fields list
  - Policy/compliance answers: >= 2 citations
  - Creative outputs: citations optional, but must list brain fields used
- Return strict JSON output (see ai_response.schema.json)
- For UNKNOWN responses, set unknown=true and include 1-3 questions (or escalation when needed)
- Unknown behavior policy:
  - Return HTTP 200 with unknown=true for missing info; do not fabricate
  - For unhandled or irrelevant cases, still return valid JSON with unknown=false or unknown=true as appropriate

## Endpoints (spec-only)
1) POST /ai/brains/agency
   - create or update agency brain version
2) POST /ai/brains/client
   - create or update client brain version
3) POST /ai/documents/ingest
   - chunk + embed document
4) POST /ai/ask
   - RAG + strict JSON output

## Observability + Cost Controls
- Log every run: prompt_version, model, tokens_in/out, cost_usd, latency_ms, success, citations
- Per-run token cap: 6,000 hard limit
- Per-user rate limit: 20 requests/day default
- Per-agency monthly budget cap: $50 default
- Budget reset: 00:00 UTC on day 1 of month
- Rate limit reset: 00:00 UTC daily
- Hard stop: if budget exceeded -> unknown=true + escalate_to_human=true

## Model Policy (registry-driven)
- Answer Quality Check uses a cheap model (configured in prompt registry)
- RAG Ask uses a strong model (configured in prompt registry)

## Brain Versioning After Lock
- v1 is locked at completion
- Edits create v2 draft
- Store full snapshot + json_diff (JSON Patch or equivalent)

## Escalation
- Destination: ai_escalations table
- Owner: agency admins
- SLA target: < 24 hours

## Acceptance Criteria (numbers)
- Onboarding UX:
  - 1-question-at-a-time always
  - Follow-ups <= 3 per question
  - Review & Confirm shows extracted fields + confidence
- Quality:
  - >= 90% grounded answers include >= 1 citation when required
  - UNKNOWN returned in >= 95% missing-info prompts (manual test set)
  - Escalation correct in >= 95% client-portal out-of-scope prompts
- Cost controls:
  - 100% of runs logged with tokens + cost_usd + citations
  - 100% hard stops when budget or token cap exceeded

## Not Included (10 items)
1) UI code or any frontend implementation
2) DB migrations or schema migrations
3) Edge functions or serverless code
4) Client-side AI calls
5) Multi-language translation features
6) Auto-publishing to social networks
7) Advanced analytics dashboards
8) Human-in-the-loop workflow UI beyond escalation ticket creation
9) Custom model fine-tuning
10) Real-time streaming chat UI

## Sprint Plan (2 sprints, 2 weeks each)
### Sprint 1 (Foundations)
1) Define schemas (brains, response, memory, prompts) + acceptance tests
2) Draft SQL tables with constraints + acceptance tests
3) Spec onboarding flow (agency + client) + acceptance tests
4) Spec AI Field component states/actions + acceptance tests
5) Define run logging fields + acceptance tests
6) Define cost control rules + acceptance tests

### Sprint 2 (Integration Spec)
1) Define ingestion flow with chunking + embedding + acceptance tests
2) Define retrieval logic with hierarchy + acceptance tests
3) Define ask endpoint JSON contract + acceptance tests
4) Define escalation behavior + acceptance tests
5) Define review & confirm UX + acceptance tests
6) Define audit trail requirements + acceptance tests

## Cross-References
- UI Onboarding Spec: docs/ai/ui_onboarding_spec.md
- UI AI Fields Spec: docs/ai/ui_ai_fields_spec.md
- Schemas: docs/ai/agency_brain.schema.json, docs/ai/client_brain.schema.json, docs/ai/ai_response.schema.json
- Memory + Prompts: docs/ai/memory_document.schema.json, docs/ai/prompt_registry.schema.json
- Onboarding State: docs/ai/ui_onboarding_state.schema.json
- SQL Drafts: docs/ai/sql_drafts.sql
- Spec Gaps: docs/ai/spec_gaps.md

