# p95 Measurement Spec

Measurement points
- Router entry/exit: `src/ai/router.ts`
- Edge function entry/exit: `supabase/functions/*`
- Tool call duration: tool executor wrapper
- RAG retrieval duration: `supabase/functions/_shared/retrieval.ts`

Aggregation
- Compute p95 per 15-minute window.
- Group by task_type and stage.

Data required
- trace_id, span_id
- start_time, end_time
- task_type, stage

Output
- JSON summary of p95 per stage and total.
