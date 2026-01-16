# AI Foundation Snapshot

## Audit Metadata

| Field | Value |
|-------|-------|
| Audit Date | 2026-01-10 |
| Auditor | Claude Opus 4.5 (Staff+ Engineer) |
| Git Commit | `233a343208d02f8cc42061e24d6cd3cc08f8eeb4` |
| Branch | `main` |

## Environment Baseline

| Component | Version/Value |
|-----------|---------------|
| Node.js | v24.12.0 |
| Package Manager | npm (package-lock.json present; bun.lockb also exists) |
| Supabase CLI | 2.65.5 |
| Project Name | vite_react_shadcn_ts |

## Repository Structure Summary

### AI Source Files (src/ai/)
- **Total Files**: 49 source files + 11 test files
- **Core Components**:
  - `router.ts` - Main AI request router
  - `schema.ts` - Output schema definitions
  - `taskRegistry.ts` - Task type configuration
  - `modelPolicy.ts` - Model selection policies
  - `brainResolver.ts` - Runtime context resolution

### Edge Functions (supabase/functions/)
- **AI Functions**: 16 edge functions
- **Shared Utilities**: 39 files in `_shared/`
- **Test Files**: 7 test files

### Database Migrations
- **AI-related migrations**: 95+ files
- **Key tables**:
  - `ai_embeddings`, `ai_documents`, `ai_document_chunks`
  - `agency_brains`, `client_brains`, `brain_documents`
  - `strategies`, `strategy_modules`, `strategy_documents`
  - `ai_runs`, `ai_usage_logs`, `ai_budgets`, `ai_rate_limits`
  - `ai_jobs` (queue)

## Provider Architecture

| Provider | Integration File | Primary Use |
|----------|-----------------|-------------|
| OpenAI | `src/ai/providers/openai.ts` | Embeddings, Chat |
| Anthropic | `src/ai/providers/anthropic.ts` | Claude models |
| Google Gemini | `src/ai/providers/gemini.ts` | 1.5-flash/pro |

## Key Architectural Patterns

1. **Task-Based Routing**: TaskType enum drives model selection, prompts, schemas
2. **Brain Architecture**: Dual-layer (monolithic legacy + modular v2)
3. **RAG Infrastructure**: pgvector embeddings with `match_ai_embeddings()` RPC
4. **Async Jobs**: `ai_jobs` queue with `claim_ai_jobs()` RPC and `ai-job-worker` cron
5. **Budget Enforcement**: Token budgeting, rate limits, usage logging

## Files Modified Since Last Commit (Unstaged)

```
M supabase/functions/_shared/__tests__/strategy-output.test.ts
M supabase/functions/_shared/strategy-output.ts
?? supabase/functions/_shared/zod.edge.ts
```

## Audit Scope Confirmation

This audit covers:
- [x] Provider layer + router + model policy
- [x] Embeddings pipeline + dimension enforcement
- [x] Agency Brain (brain_documents, versions, approval) -> RAG
- [x] Client onboarding profiles + client_brains mapping
- [x] RAG retrieval RPCs
- [x] Strategy OS tables and flows
- [x] Strategy generation atomicity and freshness
- [x] Observability (ai_runs, ai_usage_logs, ai_budgets)
- [x] Security (RLS, auth, secrets, quarantine)
- [x] Performance (token budgets, retrieval caps)
