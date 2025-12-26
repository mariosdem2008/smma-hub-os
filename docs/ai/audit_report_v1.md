# AI Infrastructure Audit Report v1

1) Executive Summary (max 15 lines)
- Risks (5): dual logging systems split across ai_usage_logs/ai_runs vs ai_history/ai_generation_usage; model attribution mismatch between router policy and logged model ids; silent zero-vector embedding fallbacks in ingestion degrade RAG quality; provider calls lack timeouts/retries; some AI flows lack consistent citations/contract enforcement across endpoints.
- Wins (5): single router with task registry and model policy; schema validation + repair in router for JSON tasks; rich AI data model (brains, docs, embeddings, budgets, rate limits); RLS hardening for brains and match_ai_embeddings; edge functions mostly use ai.run with centralized logging.
- Next steps (3): pick canonical logging tables and migrate legacy usage/history; align model source-of-truth and log actual runtime model; enforce explicit failure behavior when embeddings are missing to avoid zero-vector pollution.

2) Inventory: All AI Entry Points
| entry_point_name | location | used_by | provider(s) | models used | purpose |
| --- | --- | --- | --- | --- | --- |
| Edge: ai-agency-admin-chat | supabase/functions/ai-agency-admin-chat/index.ts:45 | src/pages/ai/AgencyAiAdmin.tsx:399 (invoke), src/pages/ai/AgencyAiAdmin.tsx:417 (stream fetch) | openai via ai router | gpt-5-nano (dev), gpt-5-mini (prod) for AGENCY_ADMIN_GENERAL_CHAT / AGENCY_ADMIN_SETUP_GUIDED_V2 / AGENCY_ADMIN_SETUP_EXTRACT | Agency admin chat + guided setup |
| Edge: ai-answer-quality-check | supabase/functions/ai-answer-quality-check/index.ts:21 | src/components/ai/AiOnboardingV2Chat.tsx:185 | none | n/a | Server-side answer validation for onboarding v2 |
| Edge: ai-ask | supabase/functions/ai-ask/index.ts:61 | No UI caller found in src | openai via ai router + embeddings | gpt-5-nano/dev, gpt-5-mini/prod (RAG_MODEL_ID override); text-embedding-3-small (EMBEDDING_MODEL_ID override) | Client portal QA with RAG |
| Edge: ai-brain-ingest | supabase/functions/ai-brain-ingest/index.ts:60 | src/components/ai/AiOnboardingV2Chat.tsx:314, src/components/ai/AiOnboardingV3Guided.tsx:787, src/pages/CreateAgencyStub.tsx:228 | openai embeddings via ai router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Map onboarding answers to brains and embed summaries |
| Edge: ai-brains-agency | supabase/functions/ai-brains-agency/index.ts:17 | src/components/ai/AiOnboardingV2Chat.tsx:164, src/pages/CreateAgencyStub.tsx:176 | none | n/a | CRUD agency brain versions |
| Edge: ai-brains-client | supabase/functions/ai-brains-client/index.ts:17 | src/components/ai/AiOnboardingV2Chat.tsx:164, src/components/ai/AiOnboardingV3Guided.tsx:391 | none | n/a | CRUD client brain versions |
| Edge: ai-documents-ingest | supabase/functions/ai-documents-ingest/index.ts:30 | No UI caller found in src | openai embeddings via ai router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Chunk + embed documents |
| Edge: ai-onboarding-guide | supabase/functions/ai-onboarding-guide/index.ts:661 | src/components/ai/AiOnboardingV3Guided.tsx:473 | openai via ai router | gpt-5-nano (dev), gpt-5-mini (prod) for EXTRACT_STRUCTURED | Step-by-step onboarding suggestions |
| Edge: ai-rep-chat | supabase/functions/ai-rep-chat/index.ts:44 | src/components/client-tabs/AiRepChatTab.tsx:27 | openai embeddings via ai router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Client portal chat retrieval + response mapping |
| Edge: ai-retrieve-context | supabase/functions/ai-retrieve-context/index.ts:14 | No UI caller found in src | openai embeddings via ai router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | RAG retrieval endpoint |
| Edge: ai-strategy-generate | supabase/functions/ai-strategy-generate/index.ts:39 | src/components/client-tabs/StrategyHubTab.tsx:77 | openai via ai router + embeddings | gpt-5-nano/dev, gpt-5-mini/prod (STRATEGY_MODEL_ID override); text-embedding-3-small (EMBEDDING_MODEL_ID override) | Strategy plan generation + storage |
| Edge: generate-ai-content | supabase/functions/generate-ai-content/index.ts:21 | src/components/pipeline/CaptionEditor.tsx:50, src/components/pipeline/AIGenerateModal.tsx:100, src/components/pipeline/ProjectFinalContentTab.tsx:283 | openai via ai router | gpt-5-nano (dev), gpt-5-mini (prod) for CONTENT_IDEAS | Post ideas/captions/scripts |
| Edge: generate-monthly-report | supabase/functions/generate-monthly-report/index.ts:13 | src/hooks/useGenerateReport.ts:17 | openai via ai router | gpt-5-nano (dev/prod) for SUMMARIZE | Monthly analytics summary |
| UI: AiOnboardingV2Chat | src/components/ai/AiOnboardingV2Chat.tsx:164 | Onboarding V2 | via ai-brains-* / ai-answer-quality-check / ai-brain-ingest | n/a (delegates) | Legacy onboarding flow |
| UI: AiOnboardingV3Guided | src/components/ai/AiOnboardingV3Guided.tsx:391 | Onboarding V3 | via ai-brains-client / ai-onboarding-guide / ai-brain-ingest | n/a (delegates) | Guided onboarding v3 |
| UI: AgencyAiAdmin | src/pages/ai/AgencyAiAdmin.tsx:399 | Admin chat | via ai-agency-admin-chat | n/a (delegates) | Admin assistant + setup |
| UI: AiRepChatTab | src/components/client-tabs/AiRepChatTab.tsx:27 | Client portal | via ai-rep-chat | n/a (delegates) | Client rep chat |
| UI: StrategyHubTab | src/components/client-tabs/StrategyHubTab.tsx:77 | Strategy hub | via ai-strategy-generate | n/a (delegates) | Strategy generation |
| UI: CreateAgencyStub | src/pages/CreateAgencyStub.tsx:176 | Agency setup | via ai-brains-agency / ai-brain-ingest | n/a (delegates) | Agency brain creation |
| UI: AI Content Generators | src/components/pipeline/CaptionEditor.tsx:50 | Pipeline tools | via generate-ai-content | n/a (delegates) | Content generation |
| UI: useGenerateReport | src/hooks/useGenerateReport.ts:17 | Reporting | via generate-monthly-report | n/a (delegates) | Monthly report generation |

3) Inventory: All AI Call Sites (COMPLETE)
| callsite_id | file path + line numbers | provider | model | task/purpose | input sources | output contract | validation present? | logging present? | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CS-001 | src/ai/providers/openai.ts:106 | openai | params.model (router-resolved) | chat.completions (non-stream) | router messages | OpenAI chat.completions JSON | N | N (logged upstream) | Low-level provider call |
| CS-002 | src/ai/providers/openai.ts:147 | openai | params.model (router-resolved) | responses (non-stream) | router messages | OpenAI responses JSON | N | N (logged upstream) | Low-level provider call |
| CS-003 | src/ai/providers/openai.ts:283 | openai | params.model (router-resolved) | chat.completions (stream) | router messages | SSE JSON chunks | N | N (logged upstream) | Low-level provider call |
| CS-004 | src/ai/providers/openai.ts:316 | openai | params.model (router-resolved) | responses (stream) | router messages | SSE JSON chunks | N | N (logged upstream) | Low-level provider call |
| CS-005 | src/ai/providers/openai.ts:411 | openai | params.model (router-resolved) | embeddings | input text | OpenAI embeddings JSON -> vector | Y (array check in router) | N (logged upstream) | Low-level provider call |
| CS-006 | src/ai/providers/anthropic.ts:27 | anthropic | params.model (router-resolved) | messages API | router messages | Anthropic messages JSON | N | N (logged upstream) | Provider available but unused by default policy |
| CS-007 | src/ai/router.ts:80 | openai/anthropic (router) | modelPolicy/env | ai.run -> generate | task prompts + messages | freeform or JSON schema | Y for json_schema | Y (ai_usage_logs) | Central routing call |
| CS-008 | src/ai/router.ts:191 | openai | modelPolicy/env | ai.run -> embed | text input | vector array | Y (array check) | Y (ai_usage_logs) | Embedding path |
| CS-009 | src/ai/router.ts:372 | openai | modelPolicy/env | ai.runStream | task prompts + messages | streaming text | N | Y (ai_usage_logs, tokens 0) | Stream path |
| CS-010 | supabase/functions/_shared/ai-router.ts:28 | openai via router | modelPolicy/env | runAiTask wrapper | edge function inputs | freeform or JSON schema | Y for json_schema | Y | Shared wrapper for agency admin AI |
| CS-011 | supabase/functions/_shared/ai-router.ts:50 | openai via router | modelPolicy/env | runAiTaskStream wrapper | edge function inputs | streaming text | N | Y | Shared streaming wrapper |
| CS-012 | supabase/functions/_shared/agency-admin-general-ai.ts:81 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | AGENCY_ADMIN_GENERAL_CHAT | admin message + snapshot | freeform text (parsed with prefixes) | N | Y | Output parsing is custom (ASSISTANT_MESSAGE/SUGGESTIONS_JSON) |
| CS-013 | supabase/functions/_shared/agency-admin-general-ai.ts:130 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | AGENCY_ADMIN_GENERAL_CHAT (stream) | admin message + snapshot | streaming text | N | Y | Stream parsed post-hoc |
| CS-014 | supabase/functions/_shared/agency-admin-setup.ts:1129 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | AGENCY_ADMIN_SETUP_GUIDED_V2 / AGENCY_ADMIN_SETUP_EXTRACT | admin setup Q/A | JSON schema | Y | Y | Guided setup AI |
| CS-015 | supabase/functions/_shared/embeddings.ts:36 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | EMBED_TEXT helper | text input | vector array | Y (array check) | Y (ai_usage_logs) | Embeddings shared helper |
| CS-016 | supabase/functions/ai-ask/index.ts:314 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed question for RAG | question string | vector array | Y (array check) | Y | Embedding for retrieval |
| CS-017 | supabase/functions/ai-ask/index.ts:316 | postgres RPC | n/a | match_ai_embeddings (client) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-018 | supabase/functions/ai-ask/index.ts:324 | postgres RPC | n/a | match_ai_embeddings (agency) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-019 | supabase/functions/ai-ask/index.ts:332 | postgres RPC | n/a | match_ai_embeddings (exemplar) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-020 | supabase/functions/ai-ask/index.ts:393 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod (RAG_MODEL_ID override) | CLIENT_PORTAL_QA | question + RAG context | JSON schema (client_portal_qa) | Y | Y (ai_usage_logs + ai_runs) | Prompt registry model logged separately |
| CS-021 | supabase/functions/ai-strategy-generate/index.ts:146 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed query for RAG | static text | vector array | Y (array check) | Y | Embedding for retrieval |
| CS-022 | supabase/functions/ai-strategy-generate/index.ts:148 | postgres RPC | n/a | match_ai_embeddings (client) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-023 | supabase/functions/ai-strategy-generate/index.ts:156 | postgres RPC | n/a | match_ai_embeddings (agency) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-024 | supabase/functions/ai-strategy-generate/index.ts:164 | postgres RPC | n/a | match_ai_embeddings (exemplar) | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-025 | supabase/functions/ai-strategy-generate/index.ts:207 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod (STRATEGY_MODEL_ID override) | STRATEGY_PLAN | brains + RAG context | JSON schema (strategy_plan) | Y | Y (ai_usage_logs) | ai_usage_logs model logged separately | 
| CS-026 | supabase/functions/ai-strategy-generate/index.ts:278 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed strategy chunks | chunk text | vector array | Y (array check) | Y | Embedding for storage |
| CS-027 | supabase/functions/ai-documents-ingest/index.ts:156 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed ingested chunks | chunk text | vector array | Y (array check) | Y | Zero-vector fallback when key missing |
| CS-028 | supabase/functions/ai-brain-ingest/index.ts:258 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed brain summary | summary text | vector array | Y (array check) | Y | Zero-vector fallback when key missing |
| CS-029 | supabase/functions/ai-retrieve-context/index.ts:68 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed query | query string | vector array | Y (array check) | Y | Retrieval helper |
| CS-030 | supabase/functions/ai-retrieve-context/index.ts:70 | postgres RPC | n/a | match_ai_embeddings | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-031 | supabase/functions/ai-rep-chat/index.ts:26 | openai via router | text-embedding-3-small (EMBEDDING_MODEL_ID override) | Embed query | chat message | vector array | Y (array check) | Y | Retrieval for rep chat |
| CS-032 | supabase/functions/ai-rep-chat/index.ts:27 | postgres RPC | n/a | match_ai_embeddings | query embedding + filters | rows with chunk_text/score | N | N | RAG retrieval |
| CS-033 | supabase/functions/ai-onboarding-guide/index.ts:322 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | EXTRACT_STRUCTURED (offers) | website + niche | JSON schema (extract_structured array) | Y | Y | Onboarding AI options |
| CS-034 | supabase/functions/ai-onboarding-guide/index.ts:354 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | EXTRACT_STRUCTURED (audience) | niche + offers | JSON schema (extract_structured array) | Y | Y | Onboarding AI options |
| CS-035 | supabase/functions/ai-onboarding-guide/index.ts:383 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | EXTRACT_STRUCTURED (differentiators) | brand + niche | JSON schema (extract_structured array) | Y | Y | Onboarding AI options |
| CS-036 | supabase/functions/generate-ai-content/index.ts:178 | openai via router | gpt-5-nano/dev, gpt-5-mini/prod | CONTENT_IDEAS | input_text + brand_context | JSON schema (content_ideas array) | Y | Y (ai_usage_logs + ai_history + ai_generation_usage) | Legacy logging tables |
| CS-037 | supabase/functions/generate-monthly-report/index.ts:172 | openai via router | gpt-5-nano/dev, gpt-5-nano/prod | SUMMARIZE | computed metrics | freeform text | N | Y | Optional call when OPENAI_API_KEY present |
| CS-038 | src/ai/modelPolicy.ts:33 | openai | gpt-5-nano/gpt-5-mini/text-embedding-3-small | model selection | env + task type | config only | n/a | n/a | Model ids live here (patterns: gpt, embedding) |

4) Current Architecture Map
UI -> Edge function -> ai.run -> taskRegistry -> modelPolicy -> provider adapter -> parse/validate -> ai_usage_logs -> DB writes -> response

Concrete flows:
- AiRepChatTab -> ai-rep-chat -> embedText -> ai.run(EMBED_TEXT) -> openai embeddings -> match_ai_embeddings -> ai_usage_logs -> response
- StrategyHubTab -> ai-strategy-generate -> embedText -> match_ai_embeddings -> ai.run(STRATEGY_PLAN) -> openai -> schema validate -> ai_documents/ai_document_chunks/ai_embeddings -> ai_usage_logs -> response
- AgencyAiAdmin -> ai-agency-admin-chat -> runAiTask -> ai.run(AGENCY_ADMIN_*) -> openai -> parse prefixes -> agency_ai_chat_messages -> response

Agency Brain usage:
- Read via router in src/ai/router.ts:165 (getAgencyBrainContext), and in supabase/functions/_shared/ai-context.ts:62 (admin snapshots).
Client Brain usage:
- Read via router in src/ai/router.ts:172 (getClientBrainContext), and in supabase/functions/ai-strategy-generate/index.ts:85 for gating.

5) Alignment with “Big Vision” (AI Employee)
What is aligned:
- Brains and memory schema exist (agency_brains, client_brains, ai_documents, ai_embeddings) with RLS (supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql).
- Router + task registry implement single entrypoint, model policy, and schemas (src/ai/router.ts, src/ai/taskRegistry.ts, src/ai/modelPolicy.ts).
- Cost controls in ai-ask (ai_rate_limits, ai_budgets, ai_escalations) match spec defaults (supabase/functions/ai-ask/index.ts:124, :175, :204).
What is missing:
- Consistent citations and strict response contract across all AI endpoints (freeform paths rely on custom parsing).
- Unified logging and budget enforcement across generate-ai-content and ai-ask (legacy tables still used).
What is conflicting/legacy:
- generate-ai-content logs to ai_history/ai_generation_usage instead of ai_usage_logs/ai_runs (supabase/functions/generate-ai-content/index.ts:217, :233).
- Logged model ids sometimes diverge from router model policy (ai-ask uses ai_prompt_registry model; ai-strategy-generate logs STRATEGY_MODEL_ID).
Single Router entrypoint compliance score: 85%
- All external provider calls are in src/ai/providers/* and invoked via ai.run; however legacy endpoints still use legacy logging and some flows bypass schema enforcement (freeform parsing), reducing compliance.

6) Code Quality Review (Strict)
- Simplicity: 6/10. Router and task registry are clean, but edge functions are large and do multiple responsibilities (validation, DB, AI).
- Clarity: 7/10. Core AI layers are documented; some edge function flows are hard to scan due to size.
- Consistency: 5/10. Mixed logging tables (ai_usage_logs vs ai_history) and model attribution inconsistencies.
- Separation of concerns: 7/10. Router/task registry/providers are separated, but ingestion and strategy functions mix RAG, storage, and AI in one file.
- Test coverage: 4/10. Some tests exist, but limited for edge function behavior and RAG correctness.
- Reliability (retries/timeouts): 4/10. Provider fetches lack explicit timeouts; no retry/backoff wrappers.
- Security (RLS/service role/secrets): 7/10. RLS hardened for brains/embeddings; edge functions use service role with membership checks.
- Observability: 6/10. ai_usage_logs/ai_runs exist, but legacy logging creates gaps.
- Extensibility (new tasks/models): 8/10. Task registry + model policy make new tasks straightforward.

7) Spec Gaps / Ambiguities (No guessing)
- Canonical logging tables and migration plan for ai_history/ai_generation_usage vs ai_usage_logs/ai_runs (docs/ai/spec_gaps.md:14).
- Model source-of-truth (prompt registry vs model policy) and how to log actual runtime model (docs/ai/spec_gaps.md:15).
- Embedding failure behavior for ingestion (hard fail vs zero-vector) (docs/ai/spec_gaps.md:16).

8) Migration Plan to Target Architecture (Router + Brains + Task Registry)
Phase 1 (1-3 days): unify call sites behind router shim
- Goals: route all LLM calls through ai.run; standardize ai_usage_logs.
- Create: src/ai/logging.ts wrapper for edge usage; supabase/functions/_shared/logging.ts (if needed).
- Delete/replace: none (shim only).
- Risks: logging duplication while both systems active.
- Acceptance criteria: generate-ai-content emits ai_usage_logs; ai_history remains for backward compatibility.
- Tests to add: edge function integration test for ai_usage_logs insert in generate-ai-content.

Phase 2 (3-7 days): task registry + model policy + logging + strict JSON
- Goals: align model attribution; enforce schema for all tasks; deprecate legacy logging tables.
- Create: mapping to log actual model from ai.run; optional prompt registry integration in router.
- Delete/replace: migrate usage from ai_history/ai_generation_usage to ai_runs/ai_usage_logs.
- Risks: analytics changes; breaking historical reporting.
- Acceptance criteria: ai_runs/ai_usage_logs contain true model ids and costs for all AI endpoints.
- Tests to add: unit tests in src/ai/router.test.ts for model resolution + logging.

Phase 3 (7-14 days): brains + memory + RAG correctness + suggestions
- Goals: enforce citation rules, standardize RAG output contracts, improve retrieval hierarchy.
- Create: RAG policy module (e.g., src/ai/ragPolicy.ts) and citation validator.
- Delete/replace: legacy freeform parsing in admin chat (if migrated to schema output).
- Risks: behavior change in admin chat and portal outputs.
- Acceptance criteria: all RAG endpoints include citations and pass schema validation.
- Tests to add: integration tests for match_ai_embeddings filtering and citation formatting.

9) Kill List (Legacy to remove)
- supabase/functions/generate-ai-content/index.ts (replace with taskRegistry + ai_usage_logs/ai_runs canonical logging).
- supabase/migrations/20251201192305_5dcbd960-b7b6-4885-86b9-f4add3806cf2.sql (ai_history) once migrated.
- supabase/migrations/20251124133649_334878d3-6f11-41c7-ac57-53e7e85a4c1b.sql (ai_generation_usage) once migrated.
- src/hooks/useClientAIHistory.ts (deprecated with ai_runs/ai_usage_logs UI surface).
- src/components/ai/AiOnboardingV2Chat.tsx (legacy onboarding path superseded by v3).

10) Appendix
ALL rg commands used (exact):
- rg --files -g 'AGENTS.md' -g 'CONTRIBUTING*' -g 'docs/ai/*'
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'from [''"]openai[''"]|new OpenAI\(|openai\.|chat\.completions|responses\.|completions\.|embeddings\.' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' '@anthropic-ai|anthropic\.|new Anthropic\(|claude' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'supabase\.functions\.invoke\(|functions\.invoke\(' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' '(app|pages)/api/|route\.ts|edge|functions/' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'createClient\(|supabaseClient|@supabase/supabase-js' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'MODEL|model_id|MODEL_ID|STRATEGY_MODEL|RAG_MODEL|EMBEDDING_MODEL|OPENAI|ANTHROPIC|CLAUDE' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'process\.env\.|import\.meta\.env' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'pgvector|vector|embedding|embeddings|similarity|match_|rpc\(' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'ilike|tsvector|to_tsvector|fts' .
- rg -n --hidden --no-ignore-vcs --glob '!docs/ai/audit_artifacts/*' 'brain|rep_policy_v1|faq_v1|setup_progress|memory|conversation|messages|chat_history|embedd' .
- rg --files -g 'supabase/migrations/**' -g 'schema.sql' -g '*schema*.sql' -g '*.sql' -g '*.prisma' -g '*.dbml' -g 'types.ts' -g 'supabase/**/*.sql'
- rg -n --hidden --no-ignore-vcs "create table|create view|create function|create or replace function|rpc|ai_|brain|embedding|embeddings|chat|memory|match_" supabase/migrations
- rg -n --hidden --no-ignore-vcs "ai_generation_usage|ai_history|ai_memory_items|ai_usage_logs|agency_brains|client_brains|ai_documents|ai_document_chunks|ai_embeddings|ai_prompt_registry|ai_runs|ai_budgets|ai_rate_limits|ai_escalations|agency_ai_chat_threads|agency_ai_chat_messages|client_onboarding_sessions|agency_onboarding_sessions|match_ai_embeddings|get_client_brain_status" src supabase docs
- rg -n --hidden --no-ignore-vcs "agency_brains|client_brains|ai_documents|ai_document_chunks|ai_embeddings|ai_memory_items|ai_usage_logs|ai_runs|ai_prompt_registry|ai_budgets|ai_rate_limits|ai_escalations|agency_ai_chat_threads|agency_ai_chat_messages|ai_history|ai_generation_usage|client_onboarding_sessions|agency_onboarding_sessions|get_client_brain_status|match_ai_embeddings" src supabase
- rg -n --hidden --no-ignore-vcs --glob '!docs/**' --glob '!node_modules/**' "openai|anthropic|claude|chat\.completions|responses\.|completions\.|embeddings\." src supabase
- rg -n "fetch\(" src/ai/providers/openai.ts src/ai/providers/anthropic.ts
- rg -n "ai\.run" supabase/functions src
- rg -n "agency_brains|client_brains|ai_documents|ai_document_chunks|ai_embeddings|ai_memory_items|ai_usage_logs" supabase/functions/ai-brain-ingest/index.ts
- rg -n "ai_documents|ai_document_chunks|ai_embeddings|ai_usage_logs" supabase/functions/ai-documents-ingest/index.ts
- rg -n "ai_usage_logs|client_brains|agency_brains|ai_documents|ai_document_chunks|ai_embeddings|match_ai_embeddings" supabase/functions/ai-strategy-generate/index.ts
- rg -n "ai_prompt_registry|ai_rate_limits|ai_budgets|ai_escalations|ai_runs|ai_usage_logs|match_ai_embeddings" supabase/functions/ai-ask/index.ts
- rg -n "match_ai_embeddings|ai_usage_logs" supabase/functions/ai-retrieve-context/index.ts
- rg -n "ai_usage_logs|match_ai_embeddings|client_brains" supabase/functions/ai-rep-chat/index.ts
- rg -n "embedText" supabase/functions/ai-strategy-generate/index.ts
- rg -n "embedText" supabase/functions/ai-documents-ingest/index.ts
- rg -n "embedText" supabase/functions/ai-brain-ingest/index.ts
- rg -n "embedText" supabase/functions/ai-retrieve-context/index.ts
- rg -n "embedText" supabase/functions/ai-rep-chat/index.ts
- rg -n "ai\.run" supabase/functions/ai-onboarding-guide/index.ts
- rg -n "ai\.run" supabase/functions/ai-ask/index.ts
- rg -n "ai\.run" supabase/functions/ai-strategy-generate/index.ts
- rg -n "ai\.run" supabase/functions/generate-ai-content/index.ts
- rg -n "ai\.run" supabase/functions/generate-monthly-report/index.ts
- rg -n "runAiTask|runAiTaskStream" supabase/functions/_shared/agency-admin-general-ai.ts
- rg -n "runAiTask" supabase/functions/_shared/agency-admin-setup.ts
- rg -n "ai\.run" supabase/functions/_shared/embeddings.ts
- rg -n "provider\.generate|generateStream|embed\(" src/ai/router.ts
- rg -n "serve\(" supabase/functions/ai-agency-admin-chat/index.ts supabase/functions/ai-answer-quality-check/index.ts supabase/functions/ai-ask/index.ts supabase/functions/ai-brain-ingest/index.ts supabase/functions/ai-brains-agency/index.ts supabase/functions/ai-brains-client/index.ts supabase/functions/ai-documents-ingest/index.ts supabase/functions/ai-onboarding-guide/index.ts supabase/functions/ai-rep-chat/index.ts supabase/functions/ai-retrieve-context/index.ts supabase/functions/ai-strategy-generate/index.ts supabase/functions/generate-ai-content/index.ts supabase/functions/generate-monthly-report/index.ts
- rg -n "functions\.invoke\(" src
- rg -n "ai-" src/components/ai/AiOnboardingV3Guided.tsx
- rg -n "ai-" src/components/ai/AiOnboardingV2Chat.tsx
- rg -n "ai-rep-chat" src/components/client-tabs/AiRepChatTab.tsx
- rg -n "ai-strategy-generate" src/components/client-tabs/StrategyHubTab.tsx
- rg -n "ai-agency-admin-chat" src/pages/ai/AgencyAiAdmin.tsx
- rg -n "ai-" src/pages/CreateAgencyStub.tsx
- rg -n "generate-ai-content" src/components/
- rg -n "generate-monthly-report" src
- rg -n "client_onboarding_sessions" src/components/ai/AiOnboardingV3Guided.tsx
- rg -n "agency_onboarding_sessions" src/pages/CreateAgencyStub.tsx src/pages/Dashboard.tsx
- rg -n "agency_ai_chat_threads|agency_ai_chat_messages" src/pages/ai/AgencyAiAdmin.tsx supabase/functions/_shared/agency-admin-chat.ts supabase/functions/_shared/agency-admin-setup.ts
- rg -n "ai_history" src/hooks/useClientAIHistory.ts
- rg -n "get_client_brain_status" src/data/index.ts

Search patterns used:
- from ['"]openai['"]|new OpenAI\(|openai\.|chat\.completions|responses\.|completions\.|embeddings\.
- @anthropic-ai|anthropic\.|new Anthropic\(|claude
- fetch\(.*openai|api\.openai\.com|anthropic\.com|api\.anthropic
- Authorization: Bearer|OPENAI_API_KEY|ANTHROPIC_API_KEY
- supabase\.functions\.invoke\(|functions\.invoke\(
- (app|pages)/api/|route\.ts|edge|functions/
- createClient\(|supabaseClient|@supabase/supabase-js
- MODEL|model_id|MODEL_ID|STRATEGY_MODEL|RAG_MODEL|EMBEDDING_MODEL|OPENAI|ANTHROPIC|CLAUDE
- process\.env\.|import\.meta\.env
- pgvector|vector|embedding|embeddings|similarity|match_|rpc\(
- ilike|tsvector|to_tsvector|fts
- brain|rep_policy_v1|faq_v1|setup_progress|memory|conversation|messages|chat_history|embedd

Assumptions (minimized):
- Call-site inventory is limited to runtime code under src and supabase/functions; docs, dist, and node_modules are excluded from the call-site table.
