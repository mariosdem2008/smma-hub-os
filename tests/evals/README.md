# Evals README

This folder contains planning-only dataset templates and rubric docs for the agentic migration.

JSONL fields
- query: user input or instruction string
- mode_expected: CHAT or EXECUTE
- golden_sources: array of doc or citation IDs expected to ground the response
- expected_schema: schema name expected for output (ex: IntentResultSchema, PlanSchema_v1)
- rubric: rubric ID or name used to score the output

Datasets (templates)
- tests/evals/agentic_golden.template.jsonl (100 rows; template)
- tests/evals/intent_classification_50.template.jsonl (50 rows; template)
- tests/evals/workflows/multistep_100.jsonl (100 rows; template)

How to run (when enabled)
- Set an env flag: AI_EVALS_ENABLED=true
- Run a local harness script: node scripts/evals/run_evals.ts
- CI should keep evals disabled by default to avoid runtime changes

Notes
- Templates only, no secrets
- Update datasets under version control
