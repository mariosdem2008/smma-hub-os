# 21 Launch Acceptance Criteria

| Related | [14-mvp-scope](14-mvp-scope.md), [20-launch-assumptions-and-go-to-market](20-launch-assumptions-and-go-to-market.md), [22-product-freeze](22-product-freeze.md) |

## 1. Launch Gate

SMMAHUB should not launch broadly until it can support live agency work without breaking tenant isolation, governance, approval integrity, or client trust.

## 2. Product Criteria

- agency setup can be completed end to end
- client records can be created, enriched, and maintained
- strategy briefs can be generated from real governed context
- work can move through approval without losing traceability
- client portal users can review work and respond clearly

## 3. Technical Criteria

- RLS protects all tenant data
- pack versions are pinned to governed runs
- source provenance is retained and inspectable
- AI orchestration and grading run reliably
- audit logs exist for AI actions and approvals

## 4. Safety Criteria

- client-facing outputs are reviewed or explicitly gated
- safety failures are visible and block release when required
- missing context is surfaced instead of fabricated
- high-risk workflows have stronger evidence and human control

## 5. Operational Criteria

- support and sales can explain the product without improvising
- the team can reproduce critical workflows
- launch docs match real behavior
- a pilot agency can complete the must-prove MVP loop

## 6. Go-Live Rule

If any launch gate fails, the product should remain in controlled pilot mode.
