# AI Foundation Inventory

## Audit Date: 2026-01-10

---

## 1. Edge Functions (AI-prefixed)

| Function | Purpose | Auth | Inputs | Outputs | Key File |
|----------|---------|------|--------|---------|----------|
| `ai-strategy-generate` | Generate full strategy document with 6 modules | Bearer token or CRON_SECRET | `client_id`, `instruction?` | Strategy modules, tasks, document | [index.ts](supabase/functions/ai-strategy-generate/index.ts) |
| `ai-agency-admin-chat` | Admin conversational AI with context snapshot | Bearer token | `thread_id`, `message`, `context_snapshot` | Assistant message, suggestions, actions | [index.ts](supabase/functions/ai-agency-admin-chat/index.ts) |
| `ai-brain-ingest` | Ingest documents into client/agency brains | Bearer token | `agency_id`, `client_id?`, `content`, `doc_type` | Chunk IDs, embedding status | [index.ts](supabase/functions/ai-brain-ingest/index.ts) |
| `ai-documents-ingest` | Ingest general AI documents | Bearer token | `agency_id`, `doc_type`, `content` | Document ID, chunks | [index.ts](supabase/functions/ai-documents-ingest/index.ts) |
| `ai-brain-analyze` | Analyze brain completeness for strategy | Bearer token | `client_id` | Readiness score, missing fields | [index.ts](supabase/functions/ai-brain-analyze/index.ts) |
| `ai-brain-document-approve` | Approve brain documents for RAG | Bearer token | `document_id`, `version` | Approval status | [index.ts](supabase/functions/ai-brain-document-approve/index.ts) |
| `ai-retrieve-context` | RAG context retrieval | Bearer token | `query`, `agency_id`, `client_id?` | Matched chunks, scores | [index.ts](supabase/functions/ai-retrieve-context/index.ts) |
| `ai-ask` | General AI query with RAG | Bearer token | `question`, `context` | Answer, citations | [index.ts](supabase/functions/ai-ask/index.ts) |
| `ai-rep-chat` | Client representative chat | Portal auth | `client_id`, `message` | Response | [index.ts](supabase/functions/ai-rep-chat/index.ts) |
| `ai-onboarding-guide` | Generate onboarding guidance | Bearer token | `agency_id`, `step` | Guidance text | [index.ts](supabase/functions/ai-onboarding-guide/index.ts) |
| `ai-onboarding-scan` | Scan onboarding progress | Bearer token | `client_id` | Scan results | [index.ts](supabase/functions/ai-onboarding-scan/index.ts) |
| `ai-onboarding-suggest` | Suggest next onboarding steps | Bearer token | `agency_id`, `context` | Suggestions | [index.ts](supabase/functions/ai-onboarding-suggest/index.ts) |
| `ai-answer-quality-check` | Quality assessment of AI responses | Bearer token | `response`, `context` | Quality score | [index.ts](supabase/functions/ai-answer-quality-check/index.ts) |
| `ai-brains-agency` | Fetch agency brain JSON | Bearer token | `agency_id` | Brain JSON | [index.ts](supabase/functions/ai-brains-agency/index.ts) |
| `ai-brains-client` | Fetch client brain JSON | Bearer token | `client_id` | Brain JSON | [index.ts](supabase/functions/ai-brains-client/index.ts) |
| `ai-job-worker` | Async job processor (cron) | CRON_SECRET | N/A (processes queue) | Job results | [index.ts](supabase/functions/ai-job-worker/index.ts) |

---

## 2. Frontend AI Router (src/ai/)

### Core Router

| File | Purpose | Key Exports |
|------|---------|-------------|
| [router.ts](src/ai/router.ts) | Main AI request router | `createAiRouter()`, `ai.run()`, `ai.runStream()` |
| [taskRegistry.ts](src/ai/taskRegistry.ts) | Task type configuration | `TASK_REGISTRY`, `getTaskConfig()`, `resolveTaskModel()` |
| [taskTypes.ts](src/ai/taskTypes.ts) | Task type enum definitions | `TaskType` |
| [modelPolicy.ts](src/ai/modelPolicy.ts) | Model selection policies | `resolveModelPolicy()`, `getModelForTask()` |
| [schema.ts](src/ai/schema.ts) | Output schema definitions | `objectSchema()`, `arraySchema()`, `adminChatSchema()` |
| [brainResolver.ts](src/ai/brainResolver.ts) | On-demand brain context resolution | `createBrainResolver()` |
| [logging.ts](src/ai/logging.ts) | AI usage logging | `logUsage()` |

### Providers

| File | Purpose | Key Exports |
|------|---------|-------------|
| [providers/index.ts](src/ai/providers/index.ts) | Provider registry | `providers` |
| [providers/openai.ts](src/ai/providers/openai.ts) | OpenAI integration | `generate()`, `embed()` |
| [providers/anthropic.ts](src/ai/providers/anthropic.ts) | Anthropic/Claude integration | `generate()`, `generateStream()` |
| [providers/gemini.ts](src/ai/providers/gemini.ts) | Google Gemini integration | `generate()`, `generateStream()`, `embed()` |

### Prompt Builders

| File | Purpose | Task Types |
|------|---------|------------|
| [prompts/adminGeneralChat.ts](src/ai/prompts/adminGeneralChat.ts) | Admin chat prompts | `AGENCY_ADMIN_GENERAL_CHAT` |
| [prompts/adminSetupGuided.ts](src/ai/prompts/adminSetupGuided.ts) | Guided setup prompts | `AGENCY_ADMIN_SETUP_GUIDED_V2` |
| [prompts/strategyPlan.ts](src/ai/prompts/strategyPlan.ts) | Strategy generation prompts | `STRATEGY_PLAN` |
| [prompts/clientPortalQa.ts](src/ai/prompts/clientPortalQa.ts) | Client portal Q&A | `CLIENT_PORTAL_QA` |
| [prompts/contentIdeas.ts](src/ai/prompts/contentIdeas.ts) | Content ideation | `CONTENT_IDEAS`, `SCRIPT_WRITING` |
| [prompts/summarize.ts](src/ai/prompts/summarize.ts) | Text summarization | `SUMMARIZE` |

---

## 3. Task Types and Model Mapping

| TaskType | Default Provider | Default Model | Temperature | Output Mode | Safety Mode |
|----------|------------------|---------------|-------------|-------------|-------------|
| `CHAT_GENERAL` | gemini | gemini-1.5-flash | 0.4 | freeform | normal |
| `CHAT_ADMIN_ONBOARDING` | gemini | gemini-1.5-flash | 0.2 | freeform | strict_unknown |
| `AGENCY_ADMIN_SETUP_GUIDED_V2` | gemini | gemini-1.5-flash | 0.3 | json_schema | strict_unknown |
| `AGENCY_ADMIN_GENERAL_CHAT` | gemini | gemini-1.5-flash | 0.4 | freeform | strict_unknown |
| `AGENCY_ADMIN_SETUP_EXTRACT` | gemini | gemini-1.5-flash | 0.1 | json_schema | normal |
| `CLIENT_PORTAL_QA` | gemini | gemini-1.5-flash | 0.2 | json_schema | strict_unknown |
| `SUMMARIZE` | gemini | gemini-1.5-flash | 0.2 | freeform | normal |
| `EXTRACT_STRUCTURED` | gemini | gemini-1.5-flash | 0.1 | json_schema | strict_unknown |
| `CLASSIFY_INTENT` | gemini | gemini-1.5-flash | 0 | json_schema | normal |
| `STRATEGY_PLAN` | gemini | gemini-1.5-flash | 0.2 | json_schema | strict_unknown |
| `CONTENT_IDEAS` | gemini | gemini-1.5-flash | 0.8 | json_schema | normal |
| `SCRIPT_WRITING` | gemini | gemini-1.5-flash | 0.8 | json_schema | normal |
| `TOOL_EXECUTION` | gemini | gemini-1.5-flash | 0 | json_schema | normal |
| `EMBED_TEXT` | openai | text-embedding-3-small | N/A | embedding | normal |

**Source:** [modelPolicy.ts:36-109](src/ai/modelPolicy.ts#L36-L109)

---

## 4. Database Tables (AI + Strategy)

### Core AI Tables

| Table | Purpose | Key Columns | Migration |
|-------|---------|-------------|-----------|
| `ai_documents` | Source documents for AI | `id`, `agency_id`, `client_id`, `doc_type`, `content`, `metadata` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_document_chunks` | Chunked document text | `id`, `document_id`, `chunk_text`, `chunk_index` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_embeddings` | Vector store (pgvector) | `id`, `chunk_id`, `embedding vector(1536)` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_runs` | AI execution logs | `id`, `model`, `tokens_in`, `tokens_out`, `cost_usd`, `success` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_usage_logs` | Endpoint usage tracking | `id`, `endpoint`, `model`, `tokens_estimate`, `latency_ms` | [20251224090000_brain_spine_v1.sql](supabase/migrations/20251224090000_brain_spine_v1.sql) |
| `ai_budgets` | Per-tenant budget caps | `id`, `agency_id`, `month_yyyy_mm`, `budget_usd`, `spent_usd` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_rate_limits` | Rate limit tracking | `id`, `agency_id`, `user_id`, `day_yyyy_mm_dd`, `used_count` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `ai_jobs` | Async job queue | `id`, `job_type`, `client_id`, `status`, `dedupe_key` | [20260108152000_ai_jobs_queue.sql](supabase/migrations/20260108152000_ai_jobs_queue.sql) |

### Brain Tables

| Table | Purpose | Key Columns | Migration |
|-------|---------|-------------|-----------|
| `agency_brains` | Agency-level brain JSON | `id`, `agency_id`, `brain_json`, `version`, `status` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `client_brains` | Client-level brain JSON | `id`, `client_id`, `brain_json`, `version`, `usable`, `status` | [20251223150000_ai_employee_v1_sprint1.sql](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql) |
| `brain_documents` | Versioned brain documents | `id`, `agency_id`, `module`, `version`, `status`, `content` | [20251228120000_brain_documents_and_calibration_state.sql](supabase/migrations/20251228120000_brain_documents_and_calibration_state.sql) |

### Strategy Tables

| Table | Purpose | Key Columns | Migration |
|-------|---------|-------------|-----------|
| `strategies` | Versioned strategy records | `id`, `client_id`, `version_int`, `derived_from_hash` | [20251230090000_strategy_os_ops.sql](supabase/migrations/20251230090000_strategy_os_ops.sql) |
| `strategy_modules` | Per-module content | `id`, `strategy_id`, `module`, `content_json`, `ai_confidence` | [20251229100000_strategy_os.sql](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_documents` | Full document snapshots | `id`, `strategy_id`, `markdown`, `html`, `model` | [20260106120000_strategy_documents.sql](supabase/migrations/20260106120000_strategy_documents.sql) |
| `strategy_history` | Module change history | `id`, `module_id`, `changed_by`, `change_type` | [20251229100000_strategy_os.sql](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_tasks` | Tasks linked to modules | `id`, `strategy_id`, `module`, `title`, `status` | [20251229100000_strategy_os.sql](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_decisions` | Decision locks/values | `id`, `strategy_id`, `module`, `decision_key`, `locked` | [20251230090000_strategy_os_ops.sql](supabase/migrations/20251230090000_strategy_os_ops.sql) |

### Client Onboarding

| Table | Purpose | Key Columns | Migration |
|-------|---------|-------------|-----------|
| `client_onboarding_profiles` | Onboarding data (v5) | `id`, `client_id`, `v5_meta`, `ai_scan_result` | [20251230200000_client_onboarding_v4.sql](supabase/migrations/20251230200000_client_onboarding_v4.sql) |

---

## 5. Key RPCs

| RPC | Purpose | Key Parameters | Migration |
|-----|---------|----------------|-----------|
| `match_ai_embeddings` | Vector similarity search | `p_agency_id`, `p_query_embedding`, `p_match_count`, `p_doc_types` | [20260108134500_match_ai_embeddings_filters.sql](supabase/migrations/20260108134500_match_ai_embeddings_filters.sql) |
| `create_strategy_snapshot` | Atomic strategy write | `p_client_id`, `p_modules`, `p_document_markdown` | [20260108143000_strategy_snapshot_rpc.sql](supabase/migrations/20260108143000_strategy_snapshot_rpc.sql) |
| `claim_ai_jobs` | Claim jobs from queue | `p_limit`, `p_job_types` | [20260108152000_ai_jobs_queue.sql](supabase/migrations/20260108152000_ai_jobs_queue.sql) |
| `get_client_brain_status` | Check brain readiness | `p_client_id` | [20251224121500_get_client_brain_status_rpc.sql](supabase/migrations/20251224121500_get_client_brain_status_rpc.sql) |

---

## 6. Shared Edge Utilities (_shared/)

| File | Purpose | Key Exports |
|------|---------|-------------|
| [ai.ts](supabase/functions/_shared/ai.ts) | Base AI execution wrapper with guards | `runAiTask()`, `runAiTaskStream()` |
| [embeddings.ts](supabase/functions/_shared/embeddings.ts) | Text embedding + chunking | `embedText()`, `buildChunks()`, `DEFAULT_EMBEDDING_DIM` |
| [embedding-policy.ts](supabase/functions/_shared/embedding-policy.ts) | Embedding failure handling | `embedWithPolicy()` |
| [retrieval.ts](supabase/functions/_shared/retrieval.ts) | RAG retrieval with token caps | `capMatchesByTokenBudget()`, `clampMatchCount()` |
| [strategy-output.ts](supabase/functions/_shared/strategy-output.ts) | Strategy document schema | `strategyOutputSchema`, `buildStrategyOutputSchema()` |
| [brain-quality.ts](supabase/functions/_shared/brain-quality.ts) | Brain quality scoring | `evaluateClientBrainForStrategy()` |
| [budgets.ts](supabase/functions/_shared/budgets.ts) | Cost calculations | `calculateCost()`, `checkBudget()`, `incrementBudget()` |
| [endpoint-guard.ts](supabase/functions/_shared/endpoint-guard.ts) | Endpoint quarantine | `getEndpointGuardResponse()` |

---

## 7. Environment Variables

| Variable | Purpose | Default | Used In |
|----------|---------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API access | Required | Providers |
| `ANTHROPIC_API_KEY` | Anthropic API access | Required | Providers |
| `GOOGLE_AI_API_KEY` | Google Gemini API access | Required | Providers |
| `AI_MODE` | dev/prod mode selection | `dev` | Model policy |
| `AI_EMBED_DIM_EXPECTED` | Expected embedding dimension | `1536` | Embeddings |
| `AI_EMBEDDING_FAIL_HARD` | Fail on embedding errors | `false` | Ingest functions |
| `AI_SCHEMA_STRICT` | Strict schema validation | `false` | Strategy generation |
| `AI_ADMIN_CHAT_SCHEMA` | Enable schema mode for admin chat | `false` | Task registry |
| `AI_ADMIN_CHAT_STRATEGIC` | Enable strategic mode for admin chat | `false` | Task registry |
| `CRON_SECRET` | Job worker authentication | Required | ai-job-worker |
| `ENABLE_UNUSED_AI_ENDPOINTS` | Quarantine flag for unused endpoints | `false` | Endpoint guard |

---

## 8. Test Coverage Summary

| Category | Test Files | Tests | Status |
|----------|------------|-------|--------|
| Router | 1 | 5 | PASS |
| Model Policy | 1 | 6 | PASS |
| Task Registry | 1 | 1 | PASS |
| Bypass Guards | 1 | 2 | PASS |
| Budget Enforcement | 1 | 3 | PASS |
| RAG Correctness | 1 | 3 | PASS |
| Embedding Safety | 3 | 6 | PASS |
| Strategy Output | 1 | varies | PASS |
| Tool Executor | 1 | 60 | PASS |
| **Total** | **68** | **379** | **PASS** |
