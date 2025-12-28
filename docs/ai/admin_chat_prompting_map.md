# Admin Chat Prompting Map (Current State)

## Discovery (current code truth)

- Strategic core: `src/ai/adminChatStrategic.ts` (router, validator, formatter).
- Prompt loader: `src/ai/promptRegistry.ts` (loadPromptText + cache).
- Prompt builder: `src/ai/prompts/adminGeneralChat.ts` (strategic pack + playbooks).
- Strategic handler: `supabase/functions/_shared/agency-admin-general-ai.ts`.
- Context merge/state patch: `supabase/functions/_shared/agency-admin-chat.ts`.
- Strategic tests: `src/data/__tests__/adminChatStrategicPlaybooks.test.ts`, `src/ai/__tests__/adminChatStrategicSchema.test.ts`.

## Request Flow (UI -> API -> LLM -> Response)

UI (`src/pages/ai/AgencyAiAdmin.tsx`)
  -> Supabase Edge: `supabase/functions/ai-agency-admin-chat/index.ts`
    -> Handler: `supabase/functions/_shared/agency-admin-chat.ts`
      -> General chat path:
         - `handleGeneralChat(...)`
         - `runAdminGeneralChatAi(...)` (non-stream)
         - `runAiTask(...)` -> `src/ai/router.ts` -> provider
      -> Guided setup path:
         - `handleAgencyAdminSetup(...)`
         - `runAiTask(...)` (guided setup + extract)
         - Optional orchestrator: `selectNextAdminSetupQuestion(...)`

Streaming path:
  UI -> Edge -> `handleAgencyAdminChatStream(...)`
    -> General chat uses `runAdminGeneralChatAiStream(...)` (legacy only)
    -> Schema/strategic modes are blocked for streaming (buffered only)

## Admin Chat LLM Calls (General Chat)

1) General Admin Chat (legacy/schema)
- Callsite: `supabase/functions/_shared/agency-admin-general-ai.ts:runAdminGeneralChatAi`
- Task: `TaskType.AGENCY_ADMIN_GENERAL_CHAT`
- Prompt builder: `src/ai/prompts/adminGeneralChat.ts`
- Messages:
  - Legacy/system: inline system prompt in `src/ai/prompts/adminGeneralChat.ts`
  - Strategic/system: `prompts/admin_chat/system_v1.md`
  - Strategic/developer: `prompts/admin_chat/developer_v1.md`
  - Strategic/contracts: `prompts/admin_chat/output_contracts_v1.md`
  - Strategic/playbook: one of `prompts/admin_chat/playbooks/*`
  - User:
    - Legacy/schema: ragContext + contextSnapshot + conversation + latestUserMessage
    - Strategic: context_blob + playbook + latest_user_message (no raw transcript)
- Models/params: `src/ai/modelPolicy.ts`
  - dev: `gpt-5-nano`, temperature 0.4
  - prod: `gpt-5-mini`, temperature 0.4
- Output:
  - Legacy: plain text format with `ASSISTANT_MESSAGE:` + `SUGGESTIONS_JSON:`
  - Schema: JSON (`adminChatSchema`)
  - Strategic: JSON (`adminChatStrategicSchema`)
- Truncation: none (no explicit truncation rules)
- Tools/actions:
  - Schema mode may return actions, executed in `executeToolAction(...)`.

2) RAG retrieval for Admin Chat
- Callsite: `supabase/functions/_shared/agency-admin-general-ai.ts:fetchAgencyRagSnippets`
- LLM embedding: `embedText(...)` -> OpenAI embeddings via `src/ai/router.ts`
- RPC: `match_ai_embeddings(...)`
- Output: snippets (text, doc_type, title, source, source_url, score)

## Guided Setup LLM Calls (Setup Threads)

1) Guided setup conversation
- Callsite: `supabase/functions/_shared/agency-admin-setup.ts`
- Task: `TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2`
- Prompt builder: `src/ai/prompts/adminSetupGuided.ts`
- Messages: system + user (single pair)
- Output: JSON schema (`agency_admin_setup_guided_v2`)
- Models/params: dev `gpt-5-nano`, prod `gpt-5-mini`, temperature 0.3

2) Extract structured answers
- Callsite: `supabase/functions/_shared/agency-admin-setup.ts`
- Task: `TaskType.AGENCY_ADMIN_SETUP_EXTRACT`
- Prompt builder: `src/ai/prompts/adminSetupExtract.ts`
- Messages: system + user (single pair)
- Output: JSON schema (`agency_admin_setup_extract`)
- Models/params: dev `gpt-5-nano`, prod `gpt-5-mini`, temperature 0.1

3) Orchestrator (optional, feature-flagged)
- Callsite: `supabase/functions/_shared/agency-admin-setup-orchestrator.ts`
- Task: `TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2`
- Prompt builder: `supabase/functions/_shared/agency-admin-setup-orchestrator.ts` (inline prompt builder)
- Messages: single system message with orchestrator prompt text
- Output: JSON schema (validated in orchestrator)

## Prompt Construction Locations

General chat:
- `src/ai/prompts/adminGeneralChat.ts`
  - Legacy/system instructions (inline)
  - Schema instructions (inline)
  - Strategic pack (file-based prompts under `prompts/admin_chat/*`)

Guided setup:
- `src/ai/prompts/adminSetupGuided.ts` (system + user prompt)
- `src/ai/prompts/adminSetupExtract.ts` (system + user prompt)
- `supabase/functions/_shared/agency-admin-setup-orchestrator.ts` (single system message)

## Context Sources Injected

General chat:
- `buildAgencyContextSnapshot(...)` (`supabase/functions/_shared/ai-context.ts`)
  - `agencies` table (name, website, niche)
  - `profiles` table (admin name)
  - `agency_onboarding_sessions` (known facts)
  - `agency_brains` (existing brain JSON)
- `fetchAgencyBrain(...)` (`agency_brains`)
- RAG snippets:
  - `ai_embeddings`, `ai_document_chunks`, `ai_documents` via `match_ai_embeddings`
- Conversation history:
  - `agency_ai_chat_messages` (role, content) used only for legacy/schema mode
- Strategic summary/state:
  - `ai_context_v1.admin_chat_summary_v1` and `ai_context_v1.admin_chat_state_v1`

Guided setup:
- Same snapshot + brain
- `agency_ai_chat_messages` for conversation
- `agency_ai_chat_threads` for thread state

## Hidden Instruction Layers

- `src/ai/router.ts`: schema repair step adds system instruction:
  "Repair the response. Return only valid JSON matching schema..."

## JSON Schemas / Output Contracts

- `adminChatSchema` (`src/ai/schema.ts`): assistant_message, suggestions, actions, escalated, unknown
- `adminChatStrategicSchema` (`src/ai/schema.ts`): playbook, clarifying_questions, section payloads
- Guided setup schemas: `agency_admin_setup_guided_v2`, `agency_admin_setup_extract`

## Upgraded Strategic Mode v1.1

- Scored router: weighted phrase scoring in `src/ai/adminChatStrategic.ts`, defaults to core_offer when all scores are 0.
- Router safety: word-boundary matching for risky tokens to avoid substring traps (e.g., "ad" in "admin").
- Strict validator: `validateStrategicOutput` enforces payload exclusivity, field lengths, and count ranges for each playbook.
- Deliver-first formatting: output sections first, then assumptions, then Next Action, then one Next Question (if any).
- Prompt loader resolution:
  - Node: `process.cwd()/prompts/<relativePath>`
  - Deno: `new URL("../../prompts/<relativePath>", import.meta.url)`
- Prompt loader guarantees: `src/ai/promptRegistry.ts` throws on missing/empty prompt and never caches empty content.

## Call Graph (Concise)

UI: `AgencyAiAdmin.tsx`
  -> Edge: `ai-agency-admin-chat`
    -> `handleAgencyAdminChat` (general/setup)
      -> general:
         `handleGeneralChat`
           -> `fetchThreadMessages`
           -> `buildAgencyContextSnapshot`
           -> `fetchAgencyRagSnippets`
           -> `runAdminGeneralChatAi`
             -> `runAiTask` (router)
               -> `taskRegistry` -> `buildAdminGeneralChatPrompt`
               -> `providers/openai.ts`
      -> setup:
         `handleAgencyAdminSetup`
           -> `runAiTask` (guided + extract)
           -> `selectNextAdminSetupQuestion` (optional)

## Files in docs/ai Referencing Onboarding/Chat/Prompt/Context

- `docs/ai/context_snapshot.md`
- `docs/ai/ui_onboarding_state.schema.json`
- `docs/ai/ui_onboarding_spec.md`
- `docs/ai/prompt_registry.schema.json`
- `docs/ai/phase1_prompt_samples.md`
- `docs/ai/onboarding_v3.md`
