# Executor Replay Harness (Phase 1 Stub)

Purpose:
- Define deterministic replay for multi-step workflows to validate >= 95% success.

Inputs:
- Dataset: `tests/evals/workflows/multistep_100.jsonl`
- Expected schemas: PlanSchema_v1, ToolCall, ToolResult
 - Runner: `scripts/evals/replay_executor.ts` (disabled by default)

Replay steps (stub):
1) Load workflow row.
2) Initialize executor state with plan_id and steps[].
3) Execute each step in order with deterministic tool mocks.
4) Validate each tool_result schema.
5) Record success/failure with error_code.

Success criteria:
- >= 95% success on 100 workflows.
- 0 cross-tenant leaks across all tool results.

TODO:
- Define fixture inputs per tool.
- Add deterministic mock provider.
