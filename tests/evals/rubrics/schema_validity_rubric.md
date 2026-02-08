# Schema Validity Rubric (v1)

Goal: Ensure EXECUTE outputs conform to JSON schema.

Failure categories
- parse_error
- missing_fields
- type_mismatch
- constraint_violation

Pass threshold
- Valid outputs / total >= 0.99

Reviewer checklist
- JSON parses without repair
- All required fields present
- Types match schema
- Constraints satisfied (enums, min/max, etc)

Execution spec (Phase 0/1)
- Data source: collect EXECUTE outputs from:
  - offline eval runs (when implemented), or
  - sampled production logs (Phase 2), or
  - controlled replay harness outputs (Phase 1).
- Validation: validate against the expected schema in `src/ai/schema.ts` (Zod).
- Categorization:
  - parse_error: output is not valid JSON
  - missing_fields: required keys missing
  - type_mismatch: wrong type (string vs object, etc.)
  - constraint_violation: enum/range/format constraints violated
