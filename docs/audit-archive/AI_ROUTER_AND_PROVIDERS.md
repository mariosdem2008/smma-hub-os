# AI Router and Providers Audit

## Audit Date: 2026-01-10

---

## 1. Router Architecture

### Entry Points

| Location | Export | Purpose |
|----------|--------|---------|
| [router.ts:526](src/ai/router.ts#L526) | `ai` | Default router instance |
| [router.ts:190](src/ai/router.ts#L190) | `createAiRouter()` | Factory for custom instances |

### Router Methods

| Method | Purpose | Output Modes | Source |
|--------|---------|--------------|--------|
| `run()` | Single request execution | freeform, json_schema, embedding | [router.ts:195-374](src/ai/router.ts#L195-L374) |
| `runStream()` | Streaming execution | freeform only | [router.ts:376-521](src/ai/router.ts#L376-L521) |

### Router Flow

1. **Task Config Lookup**: `getTaskConfig(taskType)` - [router.ts:197-200](src/ai/router.ts#L197-L200)
2. **Context Validation**: Check `requires.agency` / `requires.client` - [router.ts:204-206](src/ai/router.ts#L204-L206)
3. **Safety Mode Gate**: Return UNKNOWN if context missing and `strict_unknown` - [router.ts:207-226](src/ai/router.ts#L207-L226)
4. **Brain Resolution**: Via `brainResolver` (v2) or legacy `getAgencyBrainContext` - [router.ts:232-265](src/ai/router.ts#L232-L265)
5. **Model Selection**: `resolveTaskModel(taskType, environment)` - [router.ts:275-283](src/ai/router.ts#L275-L283)
6. **Provider Invocation**: Via `generateWithRetry()` - [router.ts:330-342](src/ai/router.ts#L330-L342)
7. **Schema Validation**: Parse JSON + validate + optional repair - [router.ts:102-188](src/ai/router.ts#L102-L188)
8. **Usage Logging**: `logUsage()` to `ai_usage_logs` - [router.ts:346-361](src/ai/router.ts#L346-L361)

---

## 2. Provider Implementations

### Provider Registry

**Location:** [providers/index.ts](src/ai/providers/index.ts)

```typescript
export const providers = {
  openai,
  anthropic,
  gemini,
};
```

### OpenAI Provider

**File:** [providers/openai.ts](src/ai/providers/openai.ts)

| Method | API Endpoint | Purpose |
|--------|--------------|---------|
| `generate()` | `/v1/chat/completions` or `/v1/responses` | Text generation |
| `generateStream()` | Same, with `stream: true` | Streaming generation |
| `embed()` | `/v1/embeddings` | Text embeddings |

**Key Features:**
- Model-aware routing: newer models (gpt-5, o1, o3, o4) use Responses API
- Automatic retry on unsupported parameters
- Circuit breaker support (`AI_CIRCUIT_BREAKER=true`)
- Timeout support (`AI_PROVIDER_TIMEOUTS=true`)

**API Key:** `OPENAI_API_KEY` - [openai.ts:11-13](src/ai/providers/openai.ts#L11-L13)

### Gemini Provider

**File:** [providers/gemini.ts](src/ai/providers/gemini.ts)

| Method | API Endpoint | Purpose |
|--------|--------------|---------|
| `generate()` | `v1beta/models/{model}:generateContent` | Text generation |
| `generateText()` | Same | Text mode |
| `generateJson()` | Same, with `response_mime_type: application/json` | JSON mode |

**API Key:** `GEMINI_API_KEY` - [gemini.ts:10-12](src/ai/providers/gemini.ts#L10-L12)

### Anthropic Provider

**File:** [providers/anthropic.ts](src/ai/providers/anthropic.ts)

| Method | API Endpoint | Purpose |
|--------|--------------|---------|
| `generate()` | `/v1/messages` | Text generation |
| `generateStream()` | Same, with streaming | Streaming generation |

**API Key:** `ANTHROPIC_API_KEY`

---

## 3. No-Bypass Verification

### Bypass Guard Test

**Location:** [tests/guards/edge-llm-bypass.test.ts](tests/guards/edge-llm-bypass.test.ts)

**Test 1: Provider SDK Imports** (lines 68-84)
```typescript
const PROVIDER_IMPORTS = new Set([
  "openai", "anthropic", "@anthropic-ai/sdk", "cohere-ai",
  "groq-sdk", "@mistralai/mistralai", "@google/generative-ai",
  "@azure/openai", "@aws-sdk/client-bedrock-runtime"
]);

const ALLOWLIST_DIRS = [path.join("src", "ai", "providers")];
```
**Result:** Only `src/ai/providers/` may import provider SDKs directly.

**Test 2: Direct API URL Patterns** (lines 86-103)
```typescript
const PROVIDER_URL_PATTERNS = [
  /api\.openai\.com/i,
  /api\.anthropic\.com/i,
  /api\.cohere\.ai/i,
  /api\.groq\.com/i,
  /api\.mistral\.ai/i,
  /api\.together\.xyz/i,
  /api\.deepseek\.com/i,
  /generativelanguage\.googleapis\.com/i,
  /bedrock-runtime/i,
];
```
**Result:** No direct API URLs in `supabase/functions/`.

### Verification Results

| Check | Status | Evidence |
|-------|--------|----------|
| Provider imports restricted | PASS | Guard test passes |
| No direct API URLs in edge functions | PASS | Guard test + manual grep |
| Edge functions use `runAiTask()` wrapper | PASS | [_shared/ai.ts:212](supabase/functions/_shared/ai.ts#L212) |
| `runAiTask()` calls `ai.run()` from router | PASS | [_shared/ai.ts:274](supabase/functions/_shared/ai.ts#L274) |

**Conclusion:** All LLM calls are routed through the central router. No bypass detected.

---

## 4. Environment Variables

### Provider API Keys

| Variable | Provider | Required For |
|----------|----------|--------------|
| `OPENAI_API_KEY` | OpenAI | Embeddings, chat |
| `GEMINI_API_KEY` | Gemini | Default text model |
| `ANTHROPIC_API_KEY` | Anthropic | Claude models |

### Model Selection

| Variable | Scope | Example |
|----------|-------|---------|
| `AI_MODE` | Global | `dev` or `prod` |
| `AI_PROVIDER` | Global override | `gemini` |
| `AI_MODEL` | Global model override | `gpt-4o` |
| `AI_MODEL__STRATEGY_PLAN` | Task-specific | `gpt-4o-mini` |
| `AI_MODEL__STRATEGY_PLAN__prod` | Task + env specific | `gpt-4o` |
| `AI_TEXT_MODEL_DEFAULT` | Text tasks default | `gemini-1.5-flash` |

**Source:** [modelPolicy.ts:114-148](src/ai/modelPolicy.ts#L114-L148)

### Reliability Flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_PROVIDER_TIMEOUTS` | `false` | Enable request timeouts |
| `AI_PROVIDER_RETRIES` | follows timeouts | Enable automatic retries |
| `AI_CIRCUIT_BREAKER` | `false` | Enable circuit breaker |

---

## 5. Task → Model Mapping

| TaskType | Provider | Model | Temperature |
|----------|----------|-------|-------------|
| `CHAT_GENERAL` | gemini | gemini-1.5-flash | 0.4 |
| `AGENCY_ADMIN_GENERAL_CHAT` | gemini | gemini-1.5-flash | 0.4 |
| `AGENCY_ADMIN_SETUP_GUIDED_V2` | gemini | gemini-1.5-flash | 0.3 |
| `CLIENT_PORTAL_QA` | gemini | gemini-1.5-flash | 0.2 |
| `STRATEGY_PLAN` | gemini | gemini-1.5-flash | 0.2 |
| `EXTRACT_STRUCTURED` | gemini | gemini-1.5-flash | 0.1 |
| `CLASSIFY_INTENT` | gemini | gemini-1.5-flash | 0 |
| `CONTENT_IDEAS` | gemini | gemini-1.5-flash | 0.8 |
| `EMBED_TEXT` | openai | text-embedding-3-small | N/A |

**Source:** [modelPolicy.ts:36-109](src/ai/modelPolicy.ts#L36-L109)

---

## 6. Error Taxonomy

### Router Errors

| Error | Thrown When | Location |
|-------|-------------|----------|
| `Unknown task type` | TaskType not in registry | [router.ts:199](src/ai/router.ts#L199) |
| `Provider not available` | Provider key not found | [router.ts:282](src/ai/router.ts#L282) |
| `Embedding not supported` | Provider lacks `embed` method | [router.ts:287](src/ai/router.ts#L287) |
| `context_missing` | Required agency/client ID missing | [router.ts:225](src/ai/router.ts#L225) |
| `agency_brain_missing` | Brain fetch failed | [router.ts:263](src/ai/router.ts#L263) |
| `schema_repair_failed` | JSON output invalid after repair | [router.ts:171](src/ai/router.ts#L171) |
| `brain_resolver_error` | Brain resolver failed | [router.ts:250](src/ai/router.ts#L250) |
| `calibration_needed` | On-demand calibration required | [router.ts:239](src/ai/router.ts#L239) |

### Provider Errors

| Error | Provider | Thrown When | Location |
|-------|----------|-------------|----------|
| `OPENAI_API_KEY is not configured` | OpenAI | Missing API key | [openai.ts:159](src/ai/providers/openai.ts#L159) |
| `GEMINI_API_KEY is not configured` | Gemini | Missing API key | [gemini.ts:109](src/ai/providers/gemini.ts#L109) |
| `CIRCUIT_OPEN` | All | Circuit breaker tripped | [openai.ts:46](src/ai/providers/openai.ts#L46) |
| `INVALID_JSON` | Gemini | JSON parse failed | [gemini.ts:164](src/ai/providers/gemini.ts#L164) |

### Edge Wrapper Errors

| Error Code | Meaning | Location |
|------------|---------|----------|
| `AI_RATE_LIMIT` | Daily rate limit exceeded | [_shared/ai.ts:99-103](supabase/functions/_shared/ai.ts#L99-L103) |
| `AI_BUDGET_EXCEEDED` | Monthly budget exceeded | [_shared/ai.ts:137-141](supabase/functions/_shared/ai.ts#L137-L141) |

---

## 7. Edge Function Wrapper

### Purpose
- Enforce rate limits (daily per user)
- Enforce budgets (monthly per agency)
- Log all AI runs to `ai_runs` table
- Log usage to `ai_usage_logs` table
- Skip double-logging from router

### Key Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `runAiTask()` | Single request with guards | [_shared/ai.ts:212-345](supabase/functions/_shared/ai.ts#L212-L345) |
| `runAiTaskStream()` | Streaming with guards | [_shared/ai.ts:347-460](supabase/functions/_shared/ai.ts#L347-L460) |
| `enforceRateLimit()` | Check/update daily limits | [_shared/ai.ts:71-114](supabase/functions/_shared/ai.ts#L71-L114) |
| `enforceBudget()` | Check/update monthly budget | [_shared/ai.ts:116-145](supabase/functions/_shared/ai.ts#L116-L145) |

### Guard Flow

```
runAiTask()
  → enforceRateLimit() → if blocked: log + return error
  → enforceBudget() → if blocked: log + return error
  → ai.run({ skipUsageLog: true })
  → logAiRunAndUsage()
  → incrementBudget()
  → return result
```

---

## 8. Timeout Configuration

| Task Type | Timeout (ms) | Location |
|-----------|--------------|----------|
| `EMBED_TEXT` | 10,000 | [router.ts:87-88](src/ai/router.ts#L87-L88) |
| `STRATEGY_PLAN` | 60,000 | [router.ts:89-90](src/ai/router.ts#L89-L90) |
| `CLIENT_PORTAL_QA` | 60,000 | [router.ts:89-90](src/ai/router.ts#L89-L90) |
| `SUMMARIZE` | 45,000 | [router.ts:91-93](src/ai/router.ts#L91-L93) |
| `CHAT_GENERAL` | 30,000 | [router.ts:94-95](src/ai/router.ts#L94-L95) |
| Default | 30,000 | [router.ts:97-98](src/ai/router.ts#L97-L98) |

---

## 9. Test Coverage

| Test File | Tests | Coverage |
|-----------|-------|----------|
| [router.test.ts](src/ai/__tests__/router.test.ts) | 5 | Router core logic |
| [modelPolicy.test.ts](src/ai/__tests__/modelPolicy.test.ts) | 6 | Model selection |
| [taskRegistry.test.ts](src/ai/__tests__/taskRegistry.test.ts) | 1 | Task config |
| [providers/utils.test.ts](src/ai/providers/__tests__/utils.test.ts) | 4 | Provider utilities |
| [edge-llm-bypass.test.ts](tests/guards/edge-llm-bypass.test.ts) | 2 | Bypass prevention |
| [circuit-breaker.test.ts](tests/integration/ai/circuit-breaker.test.ts) | 1 | Circuit breaker |

---

## 10. Audit Findings

### Verified Invariants

| Invariant | Status | Evidence |
|-----------|--------|----------|
| All LLM calls go through router | PASS | Bypass guard tests |
| Edge functions use `runAiTask()` | PASS | Code inspection |
| Rate limits enforced before AI calls | PASS | [_shared/ai.ts:229](supabase/functions/_shared/ai.ts#L229) |
| Budget enforced before AI calls | PASS | [_shared/ai.ts:251](supabase/functions/_shared/ai.ts#L251) |
| Usage logged after AI calls | PASS | [_shared/ai.ts:298](supabase/functions/_shared/ai.ts#L298) |

### No Bypass Detected

- No direct provider SDK imports outside `src/ai/providers/`
- No direct provider API URLs in edge functions
- All edge functions import from `_shared/ai.ts` or router

**Bypass Guard Enforcement:** [tests/guards/edge-llm-bypass.test.ts:67-104](tests/guards/edge-llm-bypass.test.ts#L67-L104)
