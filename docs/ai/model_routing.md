# Model Routing

Model routing is centralized in `src/ai/modelPolicy.ts`.

## Environments
- DEV: cheap but trustworthy models.
- PROD: best ROI models.

## Override Rules
Use environment variables to override per-task mapping:
- `AI_PROVIDER_<TASKTYPE>`
- `AI_MODEL_<TASKTYPE>`
- `AI_PARAMS_<TASKTYPE>` (JSON, e.g. `{"temperature":0.3}`)

Legacy per-task env vars still apply where configured:
- `RAG_MODEL_ID` for `CLIENT_PORTAL_QA`
- `STRATEGY_MODEL_ID` for `STRATEGY_PLAN`
- `EMBEDDING_MODEL_ID` for `EMBED_TEXT`

## Current Task Mappings (defaults)
- CHAT_GENERAL: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- CHAT_ADMIN_ONBOARDING: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- AGENCY_ADMIN_GENERAL_CHAT: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- AGENCY_ADMIN_SETUP_EXTRACT: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- CLIENT_PORTAL_QA: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod) (uses `RAG_MODEL_ID` if set)
- SUMMARIZE: openai / gpt-5-nano
- EXTRACT_STRUCTURED: openai / gpt-5-nano
- CLASSIFY_INTENT: openai / gpt-5-nano
- STRATEGY_PLAN: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod) (uses `STRATEGY_MODEL_ID` if set)
- CONTENT_IDEAS: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- SCRIPT_WRITING: openai / gpt-5-nano (dev), openai / gpt-5-mini (prod)
- TOOL_EXECUTION: dev=openai/gpt-5-nano, prod=openai/gpt-5-mini
- EMBED_TEXT: openai / text-embedding-3-small (uses `EMBEDDING_MODEL_ID` if set)

## Notes
- Plan-based routing is supported via `context.plan` but enforcement is deferred.
- All provider calls flow through `src/ai/router.ts`.
