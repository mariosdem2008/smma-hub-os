# AI Infrastructure Overview

This repo now routes all AI calls through a single entrypoint: `src/ai/router.ts`.
The router enforces task typing, model policy, safety, output contracts, and logging.

## Layers
1) Task Call Sites
   - Features call `ai.run({ taskType, input, context, metadata })`.
2) Task Registry
   - `src/ai/taskRegistry.ts` defines prompt builders, brain requirements, safety mode, output mode, and usage endpoints.
3) Router
   - `src/ai/router.ts` validates tasks, attaches brains, selects model, enforces safety, validates output schemas, and logs usage.
4) Provider Adapters
   - `src/ai/providers/openai.ts`
   - `src/ai/providers/anthropic.ts`
5) Logging
   - `src/ai/logging.ts` writes to `ai_usage_logs`.

## How to add a new task
1) Add a new task type in `src/ai/taskTypes.ts`.
2) Add a prompt builder in `src/ai/prompts/`.
3) Register the task in `src/ai/taskRegistry.ts`.
4) (Optional) Add a schema in `src/ai/schema.ts` and set `outputMode` to `json_schema`.
5) Call `ai.run(...)` from the feature or edge function.

## Migration Path
Future tasks (strategy, scripting, monitoring) plug in by adding:
- a task config in `taskRegistry.ts`,
- a prompt builder in `src/ai/prompts/`,
- an optional schema for structured outputs,
- and optional brain requirements.

## Lightweight Enforcement
- Use `rg -n "api\\.openai\\.com|api\\.anthropic\\.com" src supabase` to ensure only provider adapters call external AI APIs.
- All feature code should call `ai.run(...)` only.
