# Embeddings and Dimension Safety Audit

## Audit Date: 2026-01-10

---

## 1. Vector Dimension Configuration

### Database Schema

| Location | Definition |
|----------|------------|
| [20251223150000_ai_employee_v1_sprint1.sql:78](supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql#L78) | `embedding vector(1536) not null` |

### RPC Function Signatures

| Function | Parameter Type | Migration |
|----------|----------------|-----------|
| `match_ai_embeddings` | `p_query_embedding vector(1536)` | [20260108134500_match_ai_embeddings_filters.sql:13](supabase/migrations/20260108134500_match_ai_embeddings_filters.sql#L13) |

### Runtime Configuration

| Location | Code |
|----------|------|
| [_shared/embeddings.ts:4](supabase/functions/_shared/embeddings.ts#L4) | `export const DEFAULT_EMBEDDING_DIM = 1536;` |
| [_shared/embeddings.ts:6-15](supabase/functions/_shared/embeddings.ts#L6-L15) | `getExpectedEmbeddingDim()` reads `AI_EMBED_DIM_EXPECTED` env var |

**Dimension Consistency:** All references use `1536` as the expected dimension.

---

## 2. Dimension Mismatch Detection

### Runtime Check

**Location:** [embeddings.ts:59-64](supabase/functions/_shared/embeddings.ts#L59-L64)

```typescript
const expectedDim = getExpectedEmbeddingDim();
if (vector.length !== expectedDim) {
  const error = new Error("Embedding dimension mismatch") as Error & { code?: string };
  error.code = "EMBEDDING_DIM_MISMATCH";
  throw error;
}
```

### Error Handling

**Location:** [embedding-policy.ts:30-31](supabase/functions/_shared/embedding-policy.ts#L30-L31)

```typescript
if ((error as any)?.code === "EMBEDDING_DIM_MISMATCH") {
  return { status: "failed", errorCode: "EMBEDDING_DIM_MISMATCH" };
}
```

### Test Coverage

**Test File:** [tests/integration/ai/embedding-dim-mismatch.test.ts](tests/integration/ai/embedding-dim-mismatch.test.ts)

```typescript
it("throws dimension mismatch when embeddings don't match expected", async () => {
  process.env.AI_EMBED_DIM_EXPECTED = "3";
  // ... validates EMBEDDING_DIM_MISMATCH error
});
```

**Result:** 2 tests PASS

---

## 3. Zero Vector Prevention

### Audit Finding: NO ZERO VECTORS IN PRODUCTION CODE

**Verified:** No code path writes zero vectors (`Array(dim).fill(0)`) to `ai_embeddings`.

**Search Results:**
```bash
rg "Array\(.*\)\.fill\(0\)|zeroVector" supabase/functions/
# No matches found
```

### Failed Embedding Handling

Instead of writing zero vectors, failed embeddings are handled as follows:

**Location:** [embedding-store.ts:22-24](supabase/functions/_shared/embedding-store.ts#L22-L24)

```typescript
if (opts.embeddingResult.status !== "ok" || !opts.embeddingResult.vector) {
  await opts.supabase.from("ai_document_chunks").update({ embedding_status: "failed" }).eq("id", opts.chunkId);
  return { stored: false, errorCode: opts.embeddingResult.errorCode };
}
```

**Behavior:**
1. If embedding fails, chunk is marked as `embedding_status: "failed"`
2. No embedding row is inserted into `ai_embeddings`
3. Return includes error code for logging

---

## 4. Embedding Write Paths

### ai-brain-ingest

**Location:** [ai-brain-ingest/index.ts](supabase/functions/ai-brain-ingest/index.ts)

| Step | Action | Status Tracking |
|------|--------|-----------------|
| 1 | Call `embedWithPolicy()` | Captures result |
| 2 | Call `persistEmbeddingResult()` | Writes embedding OR marks failed |
| 3 | On failure | Sets `embedding_status: "failed"` on chunk |

### ai-documents-ingest

**Location:** [ai-documents-ingest/index.ts](supabase/functions/ai-documents-ingest/index.ts)

Same pattern as above:
- Uses `embedWithPolicy()` for safe embedding
- Uses `persistEmbeddingResult()` for storage
- Marks chunks as `embedding_status: "failed"` on error

### Embedding Status Values

| Status | Meaning |
|--------|---------|
| `ok` | Embedding successfully stored |
| `failed` | Embedding failed, no vector stored |
| `null` | Chunk not yet processed |

---

## 5. Fail-Hard Mode

### Configuration

**Environment Variable:** `AI_EMBEDDING_FAIL_HARD`

| Value | Behavior |
|-------|----------|
| `true` | Throw error on embedding failure (stops processing) |
| `false` (default) | Mark as failed, continue processing |

### Implementation

**Location:** [embedding-policy.ts:16-39](supabase/functions/_shared/embedding-policy.ts#L16-L39)

```typescript
export async function embedWithPolicy(options: EmbedPolicyOptions): Promise<EmbedPolicyResult> {
  if (!options.apiKey) {
    if (options.failHard) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return { status: "failed", errorCode: "MISSING_API_KEY" };
  }
  // ... embedding logic
  if (options.failHard) {
    throw error; // Re-throw on failure
  }
  return { status: "failed", errorCode: "EMBEDDING_FAILED" };
}
```

### Test Coverage

**Test File:** [tests/integration/ai/embedding-fail-hard.test.ts](tests/integration/ai/embedding-fail-hard.test.ts)

| Test | Result |
|------|--------|
| throws MISSING_API_KEY when fail-hard is on and key is missing | PASS |
| throws EMBEDDING_FAILED when embed fails and fail-hard is on | PASS |
| marks failure when fail-hard is off and key is missing | PASS |

---

## 6. Retrieval Filters

### Failed Chunks Excluded from Retrieval

**RPC Location:** [20260108134500_match_ai_embeddings_filters.sql](supabase/migrations/20260108134500_match_ai_embeddings_filters.sql)

The `match_ai_embeddings` function only returns rows from `ai_embeddings` table, which never contains failed embeddings (since `persistEmbeddingResult` skips insertion on failure).

**Implicit Filter:** Chunks with `embedding_status: "failed"` have no corresponding row in `ai_embeddings`, so they are automatically excluded from vector similarity searches.

---

## 7. Provider Dimension Support

### OpenAI Embeddings

**Location:** [providers/openai.ts:482-514](src/ai/providers/openai.ts#L482-L514)

```typescript
const body: Record<string, unknown> = {
  model: params.model,
  input: params.input,
};
if (typeof params.outputDimensionality === "number") {
  body.dimensions = params.outputDimensionality;
}
```

**Supported Models:**
- `text-embedding-3-small`: Supports `dimensions` parameter
- `text-embedding-3-large`: Supports `dimensions` parameter
- `text-embedding-ada-002`: Does not support custom dimensions (always 1536)

### Router Integration

**Location:** [embeddings.ts:45-55](supabase/functions/_shared/embeddings.ts#L45-L55)

```typescript
const result = await ai.run({
  taskType: TaskType.EMBED_TEXT,
  input: text,
  context: { environment: "prod" },
  metadata: {
    modelOverride: model,
    outputDimensionality: getExpectedEmbeddingDim(),
  },
});
```

---

## 8. Migration Plan for Dimension Changes

**Existing Plan:** [docs/audit/EMBEDDINGS_DIM_PLAN.md](docs/audit/EMBEDDINGS_DIM_PLAN.md)

### Safe Migration Steps

1. **Introduce dual storage** - Add new column `embedding_v2 vector(<target_dim>)`
2. **Update runtime config** - Set `AI_EMBED_DIM_EXPECTED=<target_dim>`
3. **Re-embed all content** - Process all documents with new dimension
4. **Add indexes** - Create vector indexes on new column
5. **Switch query path** - Update `match_ai_embeddings` to use new column
6. **Validate** - Compare retrieval quality
7. **Cutover + cleanup** - Remove legacy column

### Risks During Migration

| Risk | Mitigation |
|------|------------|
| Mixed dimensions in table | Dual-column approach keeps them separate |
| Query failures | Keep legacy path active until validation |
| Re-embedding cost | Process incrementally, not all at once |

---

## 9. Audit Findings Summary

### Verified Invariants

| Invariant | Status | Evidence |
|-----------|--------|----------|
| No zero vectors written | PASS | No `fill(0)` in production code |
| Dimension mismatch detected | PASS | Runtime check in `embedText()` |
| Failed chunks marked, not stored | PASS | `persistEmbeddingResult()` logic |
| Retrieval excludes failed chunks | PASS | No `ai_embeddings` row for failed |
| Dimension configurable via env | PASS | `AI_EMBED_DIM_EXPECTED` support |
| Fail-hard mode available | PASS | `AI_EMBEDDING_FAIL_HARD` flag |

### Test Coverage

| Test File | Tests | Focus |
|-----------|-------|-------|
| embedding-fail-hard.test.ts | 3 | Fail-hard behavior |
| embedding-dim-mismatch.test.ts | 2 | Dimension validation |
| embedding-store.test.ts | 1 | Storage logic |

### No Issues Found

- **Zero Vectors:** Not possible in current implementation
- **Dimension Mismatch:** Caught at runtime with clear error
- **Failed Embeddings:** Properly tracked with `embedding_status` column
- **Retrieval Corruption:** Failed chunks automatically excluded
