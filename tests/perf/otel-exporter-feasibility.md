# OTel Exporter Feasibility (Phase 0)

Goal:
- Determine whether Supabase Edge runtime supports OTLP exporters.

Checklist:
- Confirm allowed outbound network targets for OTLP.
- Validate Deno/Edge runtime support for OTLP exporter packages.
- Record constraints and decision with date and owner.

Status:
Decision (Phase 0):
- Result: OTLP exporter support not verified; default to DB span logging only.
- Constraints: Edge runtime limitations and dependency policy.
- Owner: AI Platform.
- Date: 2026-01-31.
