# Safety UNKNOWN Policy (v1)

## Purpose
Ensure AI outputs never hallucinate when required brain fields or citations are missing.

## Rules
- If required brain fields for a task are missing, return `unknown=true`.
- Response must include 1-3 clarifying questions tied to missing fields.
- Never fabricate facts to fill missing brain or memory gaps.
- When safety/compliance context is missing, include escalation guidance.

## Minimal Response Shape
```json
{
  "answer": "UNKNOWN",
  "unknown": true,
  "questions": ["string", "string"],
  "confidence": 0,
  "sources": {
    "agency_brain_fields": [],
    "client_brain_fields": [],
    "memory_citations": []
  },
  "escalate_to_human": false,
  "escalation_reason": null
}
```

## Where Applied
- `ai-strategy-generate` (Strategy Hub "Run now" gate)
- TODO: Extend to other AI endpoints as they adopt Brain & Memory Spine
