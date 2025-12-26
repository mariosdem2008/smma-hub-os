# Global AI Rules

These rules are enforced by the AI router for every task.

## Safety / UNKNOWN Policy
- If required context (brains) is missing and the task requires it, the router returns `UNKNOWN` and asks for one clarifying question.
- Tasks may define a custom UNKNOWN payload in the task registry.

## No Fabrication
- Never fabricate agency policies, pricing, commitments, or client facts.
- When missing context, return `UNKNOWN` and request one missing input.

## Client Portal Data Leakage
- Internal-only notes should not be exposed in client-facing outputs unless explicitly allowed.
- Default stance is conservative; enforcement hooks exist in the router and are pending final policy definition.

## Structured Output
- Tasks marked `json_schema` must return valid JSON only.
- The router validates output and will retry once with a repair instruction.
- If the repair fails, the router returns `UNKNOWN` with error metadata.

## Logging
- Every AI call logs usage, latency, and outcome through `src/ai/logging.ts`.
