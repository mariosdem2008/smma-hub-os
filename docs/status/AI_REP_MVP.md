# AI Rep MVP — Client Brief v1 + Chat

## What ships

1) **Canonical `client_brief_v1` generated on ingest**
- Built in `supabase/functions/_shared/client-brain-mapping.ts` (function: `mapV3AnswersToClientBrain()`).
- Stored at: `client_brains.brain_json.client_brief_v1`.
- Deterministic precedence:
  - Uses user-provided V3 answers when present (`offers`, `audience`, `pillars`, `banned_claims`/`taboo_topics`, `cta_styles`).
  - Otherwise derives from existing answers (fallback pillars from offers+differentiators, CTA styles from goals).

2) **AI Representative chat edge function**
- Function: `supabase/functions/ai-rep-chat/index.ts`
- Input: `{ client_id, message }`
- Reads: latest `client_brains.brain_json.client_brief_v1`
- Optional retrieval: `match_ai_embeddings` via RPC (if `OPENAI_API_KEY` present for embeddings)
- Behavior:
  - If required brief info missing (e.g. `offers.core`): returns `assistant_message` starting with `UNKNOWN` and asks exactly 1 clarification.
  - Otherwise returns a deterministic “rep” response and includes `used_sections`.
- Output: `{ assistant_message, used_sections, unknown }`

3) **UI entrypoint**
- Client workspace tab: `src/components/client-tabs/AiRepChatTab.tsx`
- Wired into Client Detail tabs: `src/pages/ClientDetail.tsx` (tab id: `ai_rep`)
- Calls `supabase.functions.invoke("ai-rep-chat", { body: { client_id, message } })`

## Data flow

1) V3 onboarding saves `answers_json` + brain `raw_responses`
- `src/components/ai/AiOnboardingV3Guided.tsx`

2) Lock triggers ingest with freshest answers
- `src/components/ai/AiOnboardingV3Guided.tsx` → `ai-brain-ingest` called with `raw_responses: finalAnswers`

3) Ingest maps V3 answers → canonical brain_json (incl. `client_brief_v1`)
- `supabase/functions/ai-brain-ingest/index.ts` → `mapV3AnswersToClientBrain()`

4) Chat uses canonical `client_brief_v1`
- UI: `AiRepChatTab.tsx` → edge: `ai-rep-chat`

## Tests

- `src/data/__tests__/aiRepChat.test.ts`
  - Asserts `UNKNOWN` when brief lacks `offers.core`
  - Asserts `used_sections` includes `client_brief_v1` when brief is present

