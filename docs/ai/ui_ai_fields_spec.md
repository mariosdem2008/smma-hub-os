# AI Fields UI Spec

## AI Field Component Contract
### States
1) empty
2) suggested (AI draft)
3) edited_by_human
4) approved_locked
5) stale (needs refresh after new info)

### Actions
- Generate (server-side)
- Regenerate (server-side)
- Why this? (shows citations + reasoning summary)
- Accept (locks)
- Edit (human overrides)
- Request changes (adds feedback to memory)

### Citations Display
- Must show:
  - Brain fields used (agency + client)
  - Memory citations: doc_id + chunk_id + doc_type
- Minimum 1 citation for grounded answers when required fields used

### Locking Rules
- Accept locks the field and marks state approved_locked
- Editing after lock creates a new version and sets state edited_by_human
- Stale when new info added to brain or memory affecting the field

### Stale Rules (numbers)
- Mark stale when:
  - Any related brain field changes
  - New memory doc of same doc_type added in last 30 days
- Show stale badge and allow regenerate

### Memory Writeback
- Every approved output is stored as an artifact in memory
- Artifacts use doc_type ai_artifact

## Where AI Fields Exist (minimum v1)
1) Agency settings: voice/tone rules, strategy defaults, safety policy, FAQs
2) Client workspace: client strategy summary, pillars, constraints summary, FAQs
3) Content pipeline item: AI suggestions panel (hooks/captions/script)
   - Manual override remains source of truth
4) Client portal: Ask AI widget (grounded answers, escalation when needed)

## Escalation UX (client portal)
- If answer unknown or policy/pricing not found:
  - Show: "I'm not sure - I'll ask the agency."
  - Create internal notification/ticket (spec-only)
  - Log escalation_reason

## Cross-References
- AI Response Schema: docs/ai/ai_response.schema.json
- Memory Document Schema: docs/ai/memory_document.schema.json
