# Admin Guided Setup v2

Setup thread (kind=`setup`) is now a true AI-guided onboarding conversation.
The AI asks one question at a time and persists structured knowledge to the agency brain.

## Flow
1) First load: assistant introduces itself and asks for readiness (`READY`/yes).
2) After READY: the AI runs an awareness mission and asks one question per turn.
3) If the admin asks unrelated questions, the AI answers briefly and continues onboarding.
4) If uncertain, the assistant returns `UNKNOWN` and asks one clarifying question.

## Stored Data (agency_brains.brain_json)
- `rep_policy_v1`: voice, boundaries, escalation, SLA, CTA style
- `faq_v1`: list of FAQ pairs
- `setup_progress_v1`: status, started_at, updated_at, completed_at, progress_percent, missing_fields

## Output Contract (AI response JSON)
```
{
  "assistant_message": "string",
  "expects": "text" | "choice" | "faq_pair",
  "choices": [{"id":"string","label":"string"}],
  "progress_percent": 0-100,
  "done": boolean,
  "memory_patch": {
    "rep_policy_v1": { ...partial... },
    "faq_v1": [ ...optional... ],
    "setup_progress_v1": { ...partial... }
  },
  "debug": {
    "reasoning_summary": "short string",
    "next_intent": "short string"
  }
}
```

Memory patches are merged into the agency brain only when valid.
If the JSON is invalid, the server returns UNKNOWN and does not write.
