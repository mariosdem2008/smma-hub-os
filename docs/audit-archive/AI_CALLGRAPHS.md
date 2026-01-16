# AI Foundation Callgraphs

## Audit Date: 2026-01-10

---

## 1. Overall Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (React)"]
        UI[UI Components]
        Hooks[React Hooks]
    end

    subgraph EdgeFunctions["Edge Functions (Deno)"]
        AIChat[ai-agency-admin-chat]
        AIStrategy[ai-strategy-generate]
        AIIngest[ai-brain-ingest]
        AIRetrieve[ai-retrieve-context]
        AIJobWorker[ai-job-worker]
    end

    subgraph AICore["AI Router (src/ai/)"]
        Router[router.ts]
        TaskReg[taskRegistry.ts]
        ModelPolicy[modelPolicy.ts]
        Providers[providers/]
    end

    subgraph Database["Supabase (Postgres)"]
        BrainTables[(agency_brains, client_brains)]
        EmbeddingTables[(ai_embeddings, ai_documents)]
        StrategyTables[(strategies, strategy_modules)]
        UsageTables[(ai_runs, ai_usage_logs)]
        JobQueue[(ai_jobs)]
    end

    subgraph ExternalAPIs["External APIs"]
        Gemini[Google Gemini]
        OpenAI[OpenAI]
        Anthropic[Anthropic]
    end

    UI --> Hooks
    Hooks --> EdgeFunctions
    EdgeFunctions --> AICore
    AICore --> Providers
    Providers --> ExternalAPIs

    EdgeFunctions --> Database
    AICore --> Database

    AIJobWorker --> JobQueue
    AIIngest --> EmbeddingTables
    AIStrategy --> StrategyTables
```

---

## 2. AI Router Flow

```mermaid
sequenceDiagram
    participant C as Caller
    participant R as router.ts
    participant TR as taskRegistry.ts
    participant MP as modelPolicy.ts
    participant BR as brainResolver.ts
    participant P as Provider
    participant L as logging.ts

    C->>R: ai.run({ taskType, input, context })
    R->>TR: getTaskConfig(taskType)
    TR-->>R: TaskConfig { outputMode, safetyMode, promptBuilder }

    alt useBrainResolver enabled
        R->>BR: resolveContext(taskType, agencyId)
        BR-->>R: ResolvedBrainContext | calibration_needed
    else legacy mode
        R->>R: getAgencyBrainContext(), getClientBrainContext()
    end

    R->>MP: resolveTaskModel(taskType, env)
    MP-->>R: ModelSelection { provider, model, params }

    R->>R: promptBuilder(args) -> messages
    R->>P: generate({ model, messages })
    P-->>R: GenerateResult { text, usage }

    alt outputSchema defined
        R->>R: extractJson(text)
        R->>R: schema.validate(parsed)
        alt validation fails
            R->>P: repair prompt
            P-->>R: retry result
        end
    end

    R->>L: logUsage(supabase, usageData)
    R-->>C: AiRunResult { text, output, meta }
```

**Source:** [router.ts:190-374](src/ai/router.ts#L190-L374)

---

## 3. Strategy Generation Flow

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant EF as ai-strategy-generate
    participant DB as Supabase
    participant RAG as match_ai_embeddings
    participant Router as ai.router
    participant RPC as create_strategy_snapshot

    UI->>EF: POST { client_id, instruction? }
    EF->>DB: clients.select(agency_id)
    EF->>DB: auth.getUser(token) or verify CRON_SECRET
    EF->>DB: client_brains.select(brain_json)

    EF->>EF: evaluateClientBrainForStrategy(brain_json)
    alt brain not usable
        EF-->>UI: { unknown: true, missing_fields }
    end

    EF->>DB: agency_brains.select(brain_json)
    EF->>DB: client_onboarding_profiles.select(*)
    EF->>DB: strategies.select(latest)
    EF->>DB: strategy_modules.select(by strategy_id)

    EF->>EF: embedText("strategy_draft")

    par RAG Retrieval
        EF->>RAG: match_ai_embeddings(client docs)
        EF->>RAG: match_ai_embeddings(agency docs)
        EF->>RAG: match_ai_embeddings(exemplars)
    end

    EF->>EF: applyRagPolicy(matches) -> context
    EF->>Router: ai.run({ STRATEGY_PLAN, context })
    Router-->>EF: StrategyOutput

    EF->>EF: sha256Hex(derivedFromHash inputs)
    EF->>RPC: create_strategy_snapshot(modules, document)
    RPC-->>EF: snapshot result

    EF->>DB: ai_runs.insert()
    EF->>DB: ai_usage_logs.insert()
    EF-->>UI: { modules, document, citations }
```

**Source:** [ai-strategy-generate/index.ts:87-609](supabase/functions/ai-strategy-generate/index.ts#L87-L609)

---

## 4. Embedding Pipeline

```mermaid
sequenceDiagram
    participant C as Caller
    participant IF as ai-brain-ingest
    participant E as embeddings.ts
    participant EP as embedding-policy.ts
    participant Router as ai.router
    participant DB as Supabase

    C->>IF: POST { agency_id, content, doc_type }
    IF->>IF: tokenize(content)
    IF->>IF: buildChunks(tokens, chunkSize, overlap, maxChunks)

    loop For each chunk
        IF->>E: embedText(chunkText, apiKey, model)
        E->>Router: ai.run({ EMBED_TEXT, input: text })
        Router-->>E: { output: vector[] }

        E->>E: validate vector.length === expectedDim
        alt dimension mismatch
            E-->>IF: throw EMBEDDING_DIM_MISMATCH
        end
        E-->>IF: vector

        IF->>DB: ai_document_chunks.insert(chunk)
        IF->>DB: ai_embeddings.insert(vector)
    end

    IF->>DB: ai_documents.update(status: 'embedded')
    IF-->>C: { chunks: count, status: 'ok' }
```

**Source:** [embeddings.ts:45-66](supabase/functions/_shared/embeddings.ts#L45-L66), [ai-brain-ingest/index.ts](supabase/functions/ai-brain-ingest/index.ts)

---

## 5. Edge Function AI Wrapper Flow

```mermaid
sequenceDiagram
    participant EF as Edge Function
    participant AI as _shared/ai.ts
    participant RL as ai_rate_limits
    participant Budget as ai_budgets
    participant Router as ai.router
    participant Log as ai_runs + ai_usage_logs

    EF->>AI: runAiTask({ task_type, tenant, input })

    AI->>RL: enforceRateLimit(agency_id, user_id, dayKey)
    alt rate limit exceeded
        AI->>Log: log blocked request
        AI-->>EF: { error: AI_RATE_LIMIT }
    end

    AI->>Budget: enforceBudget(agency_id, monthKey)
    alt budget exceeded
        AI->>Log: log blocked request
        AI-->>EF: { error: AI_BUDGET_EXCEEDED }
    end

    AI->>Router: ai.run({ taskType, context: { skipUsageLog: true } })
    Router-->>AI: result

    AI->>AI: calculateCost(provider, model, tokensIn, tokensOut)
    AI->>Log: logAiRunAndUsage(full details)
    AI->>Budget: incrementBudget(costUsd)

    AI-->>EF: { assistant_message, json, meta }
```

**Source:** [_shared/ai.ts:212-345](supabase/functions/_shared/ai.ts#L212-L345)

---

## 6. RAG Retrieval Flow

```mermaid
sequenceDiagram
    participant C as Caller
    participant RAG as match_ai_embeddings RPC
    participant IDX as pgvector index
    participant Filter as doc_type + approval filters

    C->>RAG: match_ai_embeddings(p_query_embedding, p_doc_types, p_match_count)

    RAG->>Filter: WHERE doc_type IN (p_doc_types)
    RAG->>Filter: AND (doc_type != 'brain_document' OR metadata->>'status' = 'approved')
    RAG->>Filter: AND agency_id = p_agency_id
    RAG->>Filter: AND (client_id IS NULL OR client_id = p_client_id)

    RAG->>IDX: embedding <=> p_query_embedding
    RAG->>RAG: ORDER BY similarity DESC
    RAG->>RAG: LIMIT p_match_count

    RAG-->>C: rows { chunk_id, chunk_text, doc_type, similarity, document_id }
```

**Source:** [20260108134500_match_ai_embeddings_filters.sql](supabase/migrations/20260108134500_match_ai_embeddings_filters.sql)

---

## 7. Job Worker Flow

```mermaid
sequenceDiagram
    participant Cron as pg_cron / External Trigger
    participant Worker as ai-job-worker
    participant Queue as ai_jobs
    participant Strategy as ai-strategy-generate
    participant DB as Supabase

    Cron->>Worker: POST (CRON_SECRET header)
    Worker->>Queue: claim_ai_jobs(p_limit: 5)
    Queue-->>Worker: claimed jobs[]

    loop For each job
        Worker->>Worker: check backoff (next_attempt_at)
        alt job is strategy_generate
            Worker->>Strategy: internal call with client_id
            Strategy-->>Worker: result
        end

        alt success
            Worker->>Queue: UPDATE status = 'completed'
        else failure
            Worker->>Queue: UPDATE attempts++, next_attempt_at = now + backoff
            alt attempts >= max_attempts
                Worker->>Queue: UPDATE status = 'failed'
            end
        end
    end

    Worker-->>Cron: { processed: count, failed: count }
```

**Source:** [ai-job-worker/index.ts](supabase/functions/ai-job-worker/index.ts), [20260108152000_ai_jobs_queue.sql](supabase/migrations/20260108152000_ai_jobs_queue.sql)

---

## 8. Client Brain Mapping Flow

```mermaid
sequenceDiagram
    participant OB as Onboarding UI
    participant Hook as useStrategyModules
    participant DB as Supabase
    participant Map as client-brain-mapping.ts
    participant Brain as client_brains

    OB->>DB: client_onboarding_profiles.upsert(v5_meta)
    OB->>Hook: triggerBrainSync()

    Hook->>DB: client_onboarding_profiles.select()
    Hook->>Map: mapOnboardingToClientBrain(profile)
    Map-->>Hook: brain_json structure

    Hook->>Brain: client_brains.upsert({ brain_json, usable })
    Brain-->>Hook: updated brain record

    Note over Brain: Triggers strategy tab gating via get_client_brain_status RPC
```

**Source:** [_shared/client-brain-mapping.ts](supabase/functions/_shared/client-brain-mapping.ts)

---

## 9. Brain Document Approval Flow

```mermaid
stateDiagram-v2
    [*] --> Draft: Document created
    Draft --> PendingApproval: Submit for review
    PendingApproval --> Approved: Approve (ai-brain-document-approve)
    PendingApproval --> Draft: Request changes
    Approved --> [*]

    note right of Approved
        Only approved brain_documents
        are included in RAG retrieval
        (match_ai_embeddings filter)
    end note
```

**Source:** [ai-brain-document-approve/index.ts](supabase/functions/ai-brain-document-approve/index.ts), [20260108134500_match_ai_embeddings_filters.sql](supabase/migrations/20260108134500_match_ai_embeddings_filters.sql)

---

## 10. Model Policy Resolution

```mermaid
graph TD
    A[TaskType] --> B{Check env overrides}
    B -->|AI_MODEL__TASK__MODE| C[Use override model]
    B -->|AI_MODEL__TASK| C
    B -->|AI_MODEL__MODE| C
    B -->|AI_MODEL| C
    B -->|No override| D[Use DEFAULT_POLICIES]

    D --> E{Get env mode}
    E -->|AI_MODE=prod| F[prod config]
    E -->|AI_MODE=dev or default| G[dev config]

    F --> H{Check quality tier}
    G --> H
    H -->|qualityTierOverrides| I[Apply tier override]
    H -->|No override| J[Use base config]

    I --> K[Return ModelSelection]
    J --> K
    C --> K
```

**Source:** [modelPolicy.ts:166-201](src/ai/modelPolicy.ts#L166-L201)
