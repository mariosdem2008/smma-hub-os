# UI Spec: Chat Onboarding

This spec defines the required professional chat interface and its contract with the `ai-onboarding` endpoint.

## 1. UI Component Spec

### 1.1 Message Stream (markdown + JSON rendering)

Responsibilities:
1. Render a chronological, read-only stream of messages.
2. Support assistant messages with markdown.
3. Render structured JSON outputs in a distinct structured block.

Rendering rules:
- Each message has: `id`, `role` (`user` | `assistant` | `system`), `content`, `created_at`.
- Markdown is sanitized (no raw HTML execution).
- JSON blocks:
  - Display as collapsed-by-default panel when large.
  - Include "Copy JSON" action.
  - When JSON represents the "current brain snapshot", label it as "Current Agency Brain (preview)".

### 1.2 Adaptive Input Field (type-aware validation)

Supported `expects` types (v1):
- `short_text`
- `textarea`
- `url`
- `single_select`
- `multi_select`
- `contact_card` (min fields: name + email or phone)

Validation sources:
1. Client-side validation for immediate feedback.
2. Server-side validation as the source of truth (must return 400 with details).

Constraints object (from backend):
- `required` boolean
- `min` / `max` (length or selection count)
- `pattern` (regex string, optional)

Behavior:
- Enter sends (except when multiline textarea and Shift+Enter is pressed).
- Draft is preserved across validation errors and retries.
- Disable send while request is in-flight unless streaming supports parallel sends (not in v1).

### 1.3 Suggestion Chip Tray (3-4 suggestions)

Responsibilities:
- Render 3-4 suggestions for each assistant prompt that expects user input.
- Support horizontal scroll and keyboard navigation.

Each suggestion has:
- `id` stable for the turn
- `label` string (display)
- optional `confidence` (0-100) for sorting/debug only

Tray states:
- `loading`: show skeleton chips
- `ready`: show 3-4 chips
- `error`: show 3-4 safe fallback chips (provided by backend) or hide with explicit message

## 2. Interaction Spec

### 2.1 Tap-to-autofill

- Clicking a chip sets the input draft to the chip's `label`.
- The user can edit before sending.
- Autofill must not create any server writes.

### 2.2 Tap-to-send

- Clicking a chip with a "send" affordance immediately sends the chip's `label` to `ai-onboarding`.
- The request includes an idempotency key `client_turn_id`.
- UI disables additional sends until a response arrives (v1).

### 2.3 Loading / retry / error states

Loading:
- Show assistant "typing" indicator (or a spinner) after send.
- If streaming, progressively append deltas.

Retry:
- On network failure, show a retry button that resends the last user message with the same `client_turn_id` (idempotent).

Errors:
- 400: show field-level validation errors (do not clear draft).
- 401/403: show "Session expired" and re-auth prompt.
- 5xx/timeouts: show retry and keep conversation state.

## 3. API Contracts (`ai-onboarding` endpoint)

Endpoint naming decision (Phase-0):
- Canonical endpoint for this blueprint is `ai-onboarding`.
- Existing endpoints (`ai-onboarding-guide`, `ai-onboarding-scan`, `ai-onboarding-suggest`) remain active until Phase-2 cutover.
- Migration strategy: dual-run behind a feature flag, then route all new chat onboarding traffic to `ai-onboarding`.

Hard rules:
1. The backend must return 3-4 suggestions for every input prompt.
2. Suggestion generation must include `current_state_json` and be derived from it (no hallucinated facts).
3. `match_ai_embeddings_scoped` is never called from the browser.

### 3.1 Request (v1)

```json
{
  "version": "v1",
  "agency_id": "uuid",
  "client_id": "uuid|null",
  "client_turn_id": "string",
  "step_id": "string|null",
  "messages": [
    { "role": "user", "content": "string" }
  ],
  "current_state_version": "string|null",
  "ui": {
    "locale": "en-US",
    "timezone": "string"
  }
}
```

Notes:
- `step_id` is the backend-defined state cursor (module/step key).
- `current_state_version` allows optimistic concurrency and cache checks.

### 3.2 Response (v1)

```json
{
  "version": "v1",
  "status": "in_progress|calibration_needed|complete|error",
  "step_id": "string",
  "assistant_message": "string",
  "expects": "short_text|textarea|url|single_select|multi_select|contact_card",
  "constraints": { "required": true, "min": 1, "max": 4, "pattern": null },
  "suggestions": [
    { "id": "s1", "label": "string", "confidence": 0 }
  ],
  "current_state_json": {},
  "current_state_version": "string",
  "calibration": {
    "needed": true,
    "missing_fields": [
      { "module": "bootstrap", "field_path": "agency_name", "description": "string" }
    ]
  },
  "errors": []
}
```

Rules:
- For input prompts, `suggestions.length` must be 3 or 4.
- `current_state_json` is always included (redacted as needed).
- If `status = calibration_needed`, `calibration` must be present.
- If `status = complete`, the response must include a final snapshot and set completion semantics on the backend.

### 3.3 Suggestion generation rules (must include current JSON state)

Inputs to suggestion generation must include:
- `current_state_json` (full snapshot or the relevant subset)
- `step_id` and `expects`
- any validated user input from the last turn

Allowed suggestion sources:
- Values already present in `current_state_json`
- Safe generic scaffolds (e.g., "Tell me more about X") that do not introduce new facts

Disallowed:
- New business names, competitors, URLs, or other proper nouns not present in the snapshot.
- Any content that contradicts previously captured data.
