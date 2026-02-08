# Workflow Success Rubric (v1)

Goal: Validate multi-step workflow completion.

Success definition
- All steps completed within retries and timeouts
- Outputs validate against expected schema
- No blocked tool calls due to scope violations

Failure categories
- step_timeout
- retry_exhausted
- schema_invalid
- tool_scope_violation

Pass threshold
- Success rate >= 0.95 on 100 workflows

Reviewer checklist
- Step ordering correct
- Tool outputs recorded
- Final state persisted
