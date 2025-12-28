# Admin Chat Context Contract (v1)

This document defines the single context blob provided to the Admin Chat model on each turn.

## Context Blob Shape

```
{
  "context_version": "v1",
  "agency_profile": {
    "name": string | null,
    "website": string | null,
    "niche": string | null,
    "positioning": string | null,
    "tone": string[] | null,
    "offers": string[] | null,
    "proof": string[] | null,
    "constraints": string | null
  },
  "client_profile": null | {
    "name": string,
    "website": string | null,
    "industry": string | null,
    "goals": string[] | null
  },
  "agency_policies": {
    "rep_policy_v1": object | null,
    "faq_v1": array | null,
    "dos_donts": string | null,
    "escalation_rules": string | null
  },
  "memory_snippets": [
    {
      "rank": number,
      "text": string,
      "doc_type": string | null,
      "title": string | null,
      "score": number | null,
      "source": object | null,
      "source_url": string | null
    }
  ],
  "conversation_state": {
    "goal": string | null,
    "stage": string | null,
    "last_decision": string | null,
    "open_questions": string[],
    "clarifying_questions_asked": number,
    "playbook": "core_offer|strategy|copywriting",
    "summary": {
      "summary": string,
      "key_facts": string[],
      "decisions": string[],
      "updated_at": string
    } | null
  },
  "safety_rules": {
    "unknown_policy": string,
    "escalation_policy": string,
    "no_hallucinations": boolean
  }
}
```

## Field Population Rules

- agency_profile
  - name/website/niche from `agencies` via `buildAgencyContextSnapshot`.
  - positioning/tone/offers/proof/constraints from `agency_brains.setup_profile_v1` when available.
- client_profile
  - Optional (null by default). Populate when a client context is selected in the future.
- agency_policies
  - `rep_policy_v1` and `faq_v1` from `agency_brains`.
  - `dos_donts`, `escalation_rules` from `setup_profile_v1`.
- memory_snippets
  - Retrieved via `match_ai_embeddings` for the current agency.
  - Top-K (default 5). Include source metadata and score.
- conversation_state
  - Derived from `ai_context_v1.admin_chat_state_v1` in `agency_brains`.
  - `clarifying_questions_asked` tracks max of 3.
  - `summary` derived from `ai_context_v1.admin_chat_summary_v1`.
  - Stored via non-destructive merge into `ai_context_v1` (existing keys preserved).
- safety_rules
  - Static policy strings for UNKNOWN and escalation.

## Max Lengths

- agency_profile.*: 256 chars per string; arrays max 12 items.
- memory_snippets.text: 1200 chars per snippet, max 5 snippets, max ~2000 chars total.
- conversation_state.open_questions: max 6.
- conversation_state.summary.summary: 900 chars.
- conversation_state.summary.key_facts: max 10.
- conversation_state.summary.decisions: max 8.
- policies: store only summarized forms; avoid raw PII.

## Privacy Constraints

- Do not include raw user messages in the context blob.
- Do not include internal IDs or secrets.
