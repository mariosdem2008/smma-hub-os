# Model Matrix

This document defines the model selection policy for the AI Router. Defaults are set to match current model usage in the repo to avoid behavior changes.

## Task Types and Defaults

| taskType | intent | dev default provider/model | prod default provider/model | typical params | notes |
| --- | --- | --- | --- | --- | --- |
| CHAT_GENERAL | General admin chat | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.4 | Freeform chat |
| CHAT_ADMIN_ONBOARDING | Admin onboarding chat | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.2 | Strict UNKNOWN safety |
| AGENCY_ADMIN_SETUP_GUIDED_V2 | Guided setup (JSON) | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.3 | JSON output contract |
| AGENCY_ADMIN_GENERAL_CHAT | Admin general chat (JSON) | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.4 | JSON output contract (assistant_message + suggestions) |
| AGENCY_ADMIN_SETUP_EXTRACT | Setup extraction (JSON) | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.1 | JSON output contract (value only) |
| CLIENT_PORTAL_QA | Client portal QA | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.2 | JSON schema output, legacy model env `RAG_MODEL_ID` |
| SUMMARIZE | Summaries | openai / gpt-5-nano | openai / gpt-5-nano | temperature=0.2 | Freeform |
| EXTRACT_STRUCTURED | JSON extraction | openai / gpt-5-nano | openai / gpt-5-nano | temperature=0.1 | JSON schema output |
| CLASSIFY_INTENT | Intent classification | openai / gpt-5-nano | openai / gpt-5-nano | temperature=0.0 | JSON schema output |
| STRATEGY_PLAN | Strategy generation | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.2 | JSON schema output, legacy model env `STRATEGY_MODEL_ID` |
| CONTENT_IDEAS | Content ideas | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.8 | JSON schema output |
| SCRIPT_WRITING | Script writing | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.8 | JSON schema output |
| TOOL_EXECUTION | Tool/command output | openai / gpt-5-nano | openai / gpt-5-mini | temperature=0.0 | JSON schema output |
| EMBED_TEXT | Embeddings | openai / text-embedding-3-small | openai / text-embedding-3-small | n/a | Legacy model env `EMBEDDING_MODEL_ID` |

## Override Precedence (Exact Order)

1) Per-task per-mode provider override: `AI_PROVIDER__<TASKTYPE>__<MODE>`
2) Per-task per-mode model override: `AI_MODEL__<TASKTYPE>__<MODE>`
3) Per-task provider override: `AI_PROVIDER__<TASKTYPE>`
4) Per-task model override: `AI_MODEL__<TASKTYPE>`
5) Global per-mode provider/model: `AI_PROVIDER__<MODE>`, `AI_MODEL__<MODE>`
6) Global provider/model: `AI_PROVIDER`, `AI_MODEL`
7) Registry defaults (table above)

Legacy compatibility:
- `RAG_MODEL_ID`, `STRATEGY_MODEL_ID`, and `EMBEDDING_MODEL_ID` still override their respective tasks.

## Examples (8)

1) `AI_MODE=dev`
2) `AI_PROVIDER__CHAT_GENERAL__dev=openai`
3) `AI_MODEL__CHAT_GENERAL__dev=gpt-5-nano`
4) `AI_PROVIDER__SCRIPT_WRITING__prod=anthropic`
5) `AI_MODEL__SCRIPT_WRITING__prod=claude-3-5-sonnet`
6) `AI_MODEL__prod=gpt-5-mini`
7) `AI_PROVIDER__prod=openai`
8) `AI_MODEL__CHAT_GENERAL=gpt-5-mini`

## Plan-Tier Hooks

Quality tier mapping (used only to influence defaults when no per-task override is set):
- dev: always `cheap`
- prod:
  - free -> `cheap`
  - starter -> `standard`
  - growth -> `standard`
  - pro -> `premium`

## Migration Plan: Switch One Task to Anthropic in PROD

To route `SCRIPT_WRITING` to Anthropic in production without code changes:
1) Set `AI_PROVIDER__SCRIPT_WRITING__prod=anthropic`
2) Set `AI_MODEL__SCRIPT_WRITING__prod=claude-3-5-sonnet`
3) Deploy env changes; no code changes required.
