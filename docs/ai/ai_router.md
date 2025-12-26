# AI Router (Server)

This repo uses a single AI Router entrypoint to route all AI calls by task type.
The router lives in `src/ai/router.ts` and is invoked via `supabase/functions/_shared/ai-router.ts`.

## Entry API
`runAiTask({ task_type, mode, tenant, context, input, metadata, supabase })`

The router:
1) validates task type against the registry,
2) assembles prompts via prompt builders,
3) attaches brain context when required,
4) selects provider + model based on environment and overrides,
5) enforces safety rules (UNKNOWN + 1 question),
6) validates structured output with a single repair retry,
7) logs usage.

## Model Selection
Model routing is configured in `src/ai/modelPolicy.ts` with DEV/PROD defaults and env overrides.
Overrides:
- `AI_PROVIDER_<TASKTYPE>`
- `AI_MODEL_<TASKTYPE>`
- `AI_PARAMS_<TASKTYPE>` (JSON)

Legacy env overrides:
- `RAG_MODEL_ID` (client portal QA)
- `STRATEGY_MODEL_ID` (strategy plan)
- `EMBEDDING_MODEL_ID` (embeddings)

## Providers
- OpenAI adapter: `src/ai/providers/openai.ts`
- Anthropic adapter: `src/ai/providers/anthropic.ts`

Only provider adapters call external APIs.

## Safety Rules
If required context is missing or uncertain:
- return `UNKNOWN`,
- ask exactly one clarifying question,
- avoid fabricating policies or client facts.
