# Embeddings Dimension Migration Plan

## Current State

- DB vector dimension: `ai_embeddings.embedding` is `vector(1536)` (see `supabase/migrations/20251223150000_ai_employee_v1_sprint1.sql`).
- Runtime expected dimension: `AI_EMBED_DIM_EXPECTED` (default `1536`) in `supabase/functions/_shared/embeddings.ts`.

## Target Dimension Options

- 768: Smaller footprint, faster queries, lower storage.
- 1536: Current baseline.
- 3072: Higher recall potential, higher storage/compute.

## Safe Migration Steps

1) **Select target dim**  
   Decide target (768/1536/3072) and ensure provider supports it.

2) **Introduce dual storage (optional but safest)**  
   - Add a new column `embedding_v2 vector(<target_dim>)` or a new table `ai_embeddings_v2`.
   - Keep `embedding` untouched for production queries.

3) **Update runtime config**  
   - Set `AI_EMBED_DIM_EXPECTED=<target_dim>` in edge/runtime secrets.
   - If provider supports it, request `output_dimensionality` to match the target.

4) **Re-embed all content**  
   - Reprocess `ai_documents` and `agency/client` brain chunks into the new target dim.
   - Write results to the new column/table only.

5) **Backfill indexes**  
   - Add indexes on the new vector column/table (same filter fields as `ai_embeddings`).

6) **Switch query path**  
   - Update `match_ai_embeddings` to prefer the new column/table.
   - Keep legacy path for fallback while validating recall/quality.

7) **Validate**  
   - Compare retrieval quality and latency on a sample of queries.
   - Verify no dimension mismatch errors in logs.

8) **Cutover + cleanup**  
   - Remove legacy usage from queries.
   - Drop legacy embeddings or keep for historical comparison.
