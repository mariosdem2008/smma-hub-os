# Phase 6 Cleanup Evidence

## Repo search evidence (rg)

### ai-retrieve-context
Command:
rg "ai-retrieve-context" -n
Result:
- Matches only in docs and supabase/functions/ai-retrieve-context/index.ts; no UI invoke call sites in src/.

### ai-documents-ingest
Command:
rg "ai-documents-ingest" -n
Result:
- Matches only in docs and supabase/functions/ai-documents-ingest/index.ts; no UI invoke call sites in src/.

### functions.invoke search
Command:
rg "functions.invoke\(" -n src supabase
Result:
- No references to ai-retrieve-context or ai-documents-ingest in invoke call sites.

### invoke search (broader)
Command:
rg "invoke\(" -n src supabase
Result:
- No references to ai-retrieve-context or ai-documents-ingest in invoke call sites.

### combined search
Command:
rg "ai-retrieve-context|ai-documents-ingest" -n
Result:
- Matches only in docs and supabase function sources; no src/ call sites.

## Ops view usage validation (best-effort)
- To detect endpoint usage:
  - v_ai_runs_last_24h (if logs include endpoint-derived task_type)
  - v_ai_router_compliance (best-effort join of ai_runs and ai_usage_logs)

Queries:
```sql
select * from public.v_ai_runs_last_24h
order by total_calls desc;

select * from public.v_ai_router_compliance;
```

Limitations:
- ai_usage_logs does not store explicit provider/task_type; best-effort inference only.
- If endpoint name is not present in logs, these views cannot confirm usage conclusively.
