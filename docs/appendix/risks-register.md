# Risks Register

## 1. Purpose

This appendix tracks the structural risks of building a multi-client, AI-enabled SMMA operating system.

## 2. Major Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Tenant leakage | Severe trust and legal failure | Strong RLS, scoped retrieval, audit review |
| Pack sprawl | Product becomes prompt library | Pack governance, owner rules, template discipline |
| Weak source quality | Poor strategy and hallucinated outputs | Structured onboarding, freshness, review loops |
| Approval bypass | Client trust damage | Mandatory gates for high-risk outputs |
| Portal underinvestment | Weak perceived professionalism | Treat client experience as core product |
| Scope creep | Slower delivery and diluted value | Enforce non-goals and roadmap discipline |
| AI cost drift | Margin pressure | Bounded retrieval, risk-based orchestration |

## 3. Monitoring Rule

Each critical risk should have an owner, a detection method, and a current mitigation status outside this summary register.
