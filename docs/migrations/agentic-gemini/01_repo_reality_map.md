# Repo Reality Map

## Tech stack
- Frontend: React + Vite + TypeScript (`package.json`, `vite.config.ts`)
- UI libs: Radix UI, Tailwind, React Query (`package.json`)
- Backend: Supabase Edge Functions (Deno) (`supabase/functions/deno.json`)
- Database: Postgres via Supabase (RLS, RPC, migrations in `supabase/migrations`)
- Testing: Vitest + Testing Library (`vitest.config.ts`, `src/__tests__`, `tests/integration`)
- CI: GitHub Actions (`.github/workflows/ci.yml`)

## AI provider integrations in repo
- Providers implemented in `src/ai/providers/*`: OpenAI, Gemini, Anthropic (`src/ai/providers/index.ts`)
- Model policy in `src/ai/modelPolicy.ts` (Gemini pinned for strategy + assistant, OpenAI embeddings)

## Current AI modules (router/planner/executor/tools/rag/memory/logging)
- Router: `src/ai/router.ts` (task dispatch + schema validation + logging)
- Task registry / config: `src/ai/taskRegistry.ts`, `src/ai/taskTypes.ts`
- Planner: `src/ai/planner.ts` (Phase 0 planner stub + prompts)
- Executor: durable executor + checkpoints (`src/ai/durableExecutor.ts`, `supabase/functions/_shared/executor-checkpoints.ts`, `supabase/migrations/20260202000000_add_ai_executor_checkpoints.sql`)
- Tools: registry/schema in `src/ai/toolSchemas.ts` + executor above
- RAG: embeddings + retrieval via `supabase/functions/_shared/embeddings.ts`, `supabase/functions/_shared/retrieval.ts`, `src/ai/ragPolicy.ts`
- Memory: brain documents + embeddings in DB (`brain_documents`, `ai_document_chunks`, `ai_embeddings` per audit)
- Logging: usage logging via `src/ai/logging.ts` and `supabase/functions/_shared/ai.ts` (writes `ai_runs`)
- Evaluation harness: local-only harness + dataset templates in `tests/evals/*`, `scripts/evals/*` (disabled by default via `AI_EVALS_ENABLED`)
- OpenTelemetry logging: stub spans to `ai_otel_spans` via `src/ai/otel.ts` + router/edge usage

## Where tenant scoping is enforced today
- DB RLS on AI tables (audit + `supabase/tests/cross-tenant-isolation.sql`)
- Embeddings RPC `match_ai_embeddings` restricted to service role (audit + migration hardening)
- Edge functions pass `agency_id` / `client_id` into queries (e.g., `supabase/functions/_shared/ai.ts`)
- OTel spans table `ai_otel_spans` has RLS on `agency_id` (0 cross-tenant leaks)

## Test stack and CI entrypoints
- Unit / integration: Vitest + Testing Library (`vitest.config.ts`, `src/__tests__`, `tests/integration`)
- SQL tests for isolation: `supabase/tests/cross-tenant-isolation.sql`
- CI: `npm ci`, `npm run lint`, `npx tsc -p .`, `npm run build`

## Current modules vs Target modules
| Target module (report) | Current status | Evidence in repo | Status (REUSE/REPLACE/NEW) |
| --- | --- | --- | --- |
| User Intent (UI entry) | Supabase edge functions + UI routes | `supabase/functions/*`, `src/pages/*` | REUSE |
| Router | Central router exists | `src/ai/router.ts` | REPLACE (intent classification + contracts needed) |
| Planner | Planner stub exists | `src/ai/planner.ts`, `src/ai/prompts/planner.ts` | NEW |
| Executor | Durable executor + checkpoints | `src/ai/durableExecutor.ts`, `supabase/functions/_shared/executor-checkpoints.ts` | REPLACE |
| Tool System | Tool schemas + executor exist | `src/ai/toolSchemas.ts`, `supabase/functions/_shared/tool-executor.ts` | REPLACE |
| Memory & RAG | Embeddings + ragPolicy exist | `src/ai/ragPolicy.ts`, `supabase/functions/_shared/embeddings.ts` | REPLACE |
| Logging & Evals | Usage logging + OTel span stubs + eval templates | `src/ai/logging.ts`, `src/ai/otel.ts`, `supabase/migrations/20260201001000_add_ai_otel_spans.sql`, `tests/evals/README.md` | NEW (Evals) / REPLACE (OTel exporters later) |
| Provider Abstraction Layer | Provider facade exists | `src/ai/providers/*` | REUSE (extend per report) |

## Open questions (UNKNOWN)
- UNKNOWN: OTLP exporter support for Edge/Node (optional future work; Phase 0/1 uses DB span logging only).

