# Load Test Plan

Tool choice: TBD (no new dependencies).

Scope
- Simulate CHAT and EXECUTE requests for agentic workflows.
- Include RAG retrieval and tool calls.

Inputs
- Use templates from `tests/evals/agentic_golden.template.jsonl`.
- Use multistep templates from `tests/evals/multistep_100.template.jsonl`.

Workload
- Concurrency levels: 1, 5, 10, 25, 50.
- Duration: 10 minutes per level.
- Ramp: 2 minutes between levels.

Metrics
- p50, p95 latency per stage and end-to-end.
- Error rate by step.
- Success rate by workflow.

Pass/Fail
- p95 <= 2.5s
- Success rate >= 95%
- Schema validity >= 99%
- Cross-tenant leaks = 0

Artifacts
- CSV or JSON summary per run.
- Dashboard screenshots (placeholder).
