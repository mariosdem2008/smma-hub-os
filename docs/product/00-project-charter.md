# SMMAHUB Project Charter

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-CHARTER-001`                                        |
| Status           | **Active**                                                   |
| Owner            | Agency OS Product Team                                       |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [01-product-vision](01-product-vision.md), [02-user-problems-personas-jtbd](02-user-problems-personas-jtbd.md), [03-market-landscape](03-market-landscape-and-positioning.md), [04-value-proposition](04-value-proposition-and-messaging.md) |

---

## 1. Project Identity

**Project name:** SMMAHUB — The Governed AI Operating System for Social Media Marketing Agencies

**Tagline:** Configure your agency's expertise once. Run it across every client with governed AI.

**Domain:** B2B SaaS platform serving Tier 2 social media marketing agencies with 5-25 active clients, EUR15k-EUR100k/month revenue, and 2-10 person teams.

---

## 2. Mission

Eliminate the chaos tax that Tier 2 agencies pay when scaling by providing a single operating system that encodes agency expertise into governed AI workflows, replaces fragmented toolchains, and delivers client-facing quality that matches or exceeds the agency's own standards.

---

## 3. Vision

Within 24 months, SMMAHUB becomes the default operating backbone for Tier 2 operating SMM agencies. Every agency running SMMAHUB can:

- Onboard a new client in under 2 hours (not 2 weeks).
- Let one account manager handle more active clients without quality degradation.
- Produce strategy-first content governed by the agency's own playbooks.
- Give every client a portal experience that feels like a premium retainer.
- Operate specialist AI agents that act within explicit guardrails, never outside them.

See [01-product-vision](01-product-vision.md) for the full articulation of the 6-layer architecture and the 9 "done" criteria.

---

## 4. Scope

### 4.1 In Scope

| Layer | Description | Charter Priority |
| ----- | ----------- | ---------------- |
| 1. Agency OS Setup | Agency teaches the platform its services, playbooks, brand voice, approval rules, SOPs | P0 — Foundation |
| 2. Client Operating Record | Durable, enriching record per client: business context, brand, audience, funnel, assets, approvals | P0 — Foundation |
| 3. Strategy Intelligence | Governed pipeline: readiness audit, diagnosis, recommendation, channel planning, brief generation, task conversion, review | P0 — Core differentiator |
| 4. Execution & Delivery Spine | Strategy-to-campaign conversion: tasks, schedules, approvals, dependencies, reporting | P1 — Phase 2 |
| 5. Client Collaboration Surface | Premium portal: approvals, progress, requests, deliverables, messaging, reports | P1 — Phase 2 |
| 6. Governed Specialist Agents | 10 specialist agents operating within agency-defined guardrails | P1 — Phase 2-3 |

### 4.2 Out of Scope

- Direct social media publishing (integration with publishing tools, not replacement).
- CRM for lead generation or sales pipelines (agencies already have CRMs).
- Billing, invoicing, or payment processing (integrate, not build).
- Consumer-facing social media management (this is a B2B agency OS, not a Hootsuite competitor).
- Custom LLM training or fine-tuning (the platform uses prompt governance, not model training).

---

## 5. Stakeholders

| Role | Name / Group | Interest | Influence |
| ---- | ------------ | -------- | --------- |
| Executive Sponsor | Founding Team | Strategic direction, funding allocation | High |
| Product Owner | Product Lead | Backlog priority, feature definition, acceptance | High |
| Engineering Lead | Platform Engineering | Architecture, delivery, technical constraints | High |
| Design Lead | UX/UI Team | User experience, interaction patterns, portal quality | Medium |
| Agency Owner (user) | Target persona | ROI, scaling, client retention | High (voice of customer) |
| Account Manager (user) | Target persona | Daily efficiency, context switching, approvals | High (primary daily user) |
| Editor / Strategist (user) | Target persona | Brief clarity, strategy quality, playbook adherence | Medium |
| Client Stakeholder (user) | Portal persona | Transparency, approval speed, deliverable quality | Medium |

See [02-user-problems-personas-jtbd](02-user-problems-personas-jtbd.md) for full persona definitions.

---

## 6. Success Criteria — Measurable Objectives

### 6.1 Efficiency Metrics

| Metric | Baseline (No SMMAHUB) | Target (With SMMAHUB) | Improvement |
| ------ | ---------------------- | --------------------- | ----------- |
| Client onboarding time | 5-10 business days | 2 hours or less | 60-95% reduction |
| Accounts per account manager | 5-8 clients | 10-15 clients | 2x increase |
| Time from strategy approval to first content brief | 3-5 days | Same day | 80% reduction |
| Approval turnaround (client side) | 48-72 hours | Under 12 hours | 75% reduction |
| Monthly reporting generation | 4-8 hours per client | 15 minutes per client | 95% reduction |

### 6.2 Quality Metrics

| Metric | Target |
| ------ | ------ |
| Content brief compliance with agency playbook | 95% or higher |
| Client portal NPS | 50+ |
| Strategy recommendations that pass agency review without revision | 80% or higher |
| AI agent actions that stay within defined guardrails | 100% (hard constraint) |

### 6.3 Business Metrics

| Metric | 6-Month Target | 12-Month Target | 24-Month Target |
| ------ | -------------- | --------------- | --------------- |
| Agencies on platform | 20 | 100 | 500 |
| Monthly recurring revenue | EUR7K | EUR35K | EUR200K |
| Client records managed | 200 | 1,500 | 10,000 |
| Net revenue retention | 110% | 120% | 130% |
| Churn rate (monthly) | < 5% | < 3% | < 2% |

---

## 7. Constraints

### 7.1 Technical Constraints

- **Stack:** React + Vite + TypeScript frontend, Supabase backend (PostgreSQL with RLS, Edge Functions, Realtime).
- **UI framework:** Tailwind CSS + shadcn/ui component library. No custom design system from scratch.
- **Multi-tenancy:** Row-Level Security (RLS) at the database layer. Every query is tenant-scoped. No exceptions.
- **AI governance:** All AI outputs must pass through agency-defined guardrails before surfacing to users or clients. No unreviewed AI content reaches the client portal.
- **Data residency:** Supabase-managed infrastructure. Data processing must comply with GDPR for EU agencies.

### 7.2 Resource Constraints

- Small engineering team (under 10 engineers) for the first 12 months.
- No dedicated ML/AI engineering team — AI capabilities are orchestrated through prompt engineering, function calling, and structured outputs against commercial LLM APIs.
- Design capacity is limited; leverage shadcn component patterns aggressively.

### 7.3 Market Constraints

- Agencies are tool-fatigued. Migration cost must be low. Onboarding must prove value within the first session.
- Agencies sell trust. Any AI output that embarrasses the agency in front of a client is an existential bug.
- Pricing must fit agency economics: per-client or per-seat, not per-AI-call.

---

## 8. Assumptions

| # | Assumption | Risk if Wrong | Mitigation |
| - | ---------- | ------------- | ---------- |
| A1 | Agencies will invest 2-4 hours to configure their expertise (playbooks, voice, SOPs) upfront | Low adoption if setup is too heavy | Guided wizard with progressive disclosure; value visible after first module |
| A2 | Agency owners want governed AI, not autonomous AI | Product-market misfit | Validate through early adopter interviews; guardrails are non-negotiable |
| A3 | Client-facing portal quality is a purchase driver, not a nice-to-have | Underinvestment in portal UX | Dedicate design resources to portal; treat portal as a product, not a feature |
| A4 | Supabase RLS is sufficient for multi-tenant isolation at scale | Security incident or performance degradation | Load-test RLS policies at 500+ agencies; have migration path to dedicated schemas |
| A5 | Commercial LLM APIs (OpenAI, Anthropic) remain cost-effective at scale | Margin compression | Abstract AI provider; support multiple models; cache aggressively |
| A6 | Agencies prefer an opinionated workflow over a customizable blank canvas | Feature requests for flexibility dilute the product | Hold the line on opinionated defaults; customization within guardrails only |

---

## 9. Governance Model

### 9.1 Decision Rights

| Decision Type | Decision Maker | Consulted | Informed |
| ------------- | -------------- | --------- | -------- |
| Product strategy & roadmap | Executive Sponsor + Product Owner | Engineering Lead, Design Lead | All stakeholders |
| Feature prioritization (quarterly) | Product Owner | Engineering Lead, Agency advisory board | Team |
| Architecture decisions | Engineering Lead | Product Owner | Team |
| UX patterns and portal design | Design Lead | Product Owner, Account Managers (user interviews) | Team |
| AI guardrail policy defaults | Product Owner + Engineering Lead | Agency advisory board | All stakeholders |
| Pricing model | Executive Sponsor | Product Owner | Team |

### 9.2 Cadences

| Cadence | Frequency | Purpose |
| ------- | --------- | ------- |
| Sprint planning | Bi-weekly | Commit to deliverables for the next 2 weeks |
| Product review | Bi-weekly (end of sprint) | Demo working software; validate against charter objectives |
| Roadmap review | Monthly | Re-prioritize based on user feedback, metrics, market signals |
| Advisory board sync | Monthly | 5-8 agency owners provide feedback on direction and priorities |
| Architecture review | As needed (triggered by RFCs) | Evaluate technical proposals against constraints |
| Retrospective | Bi-weekly | Process improvement |

### 9.3 Change Control

- Scope changes to the charter require Executive Sponsor approval.
- Feature additions that affect the 6-layer architecture require an RFC reviewed by Engineering Lead and Product Owner.
- AI guardrail changes require explicit sign-off from Product Owner (guardrails are product, not engineering convenience).

---

## 10. Project Phases

### Phase 1: Foundation (Months 1-4)

**Objective:** Establish the agency setup experience and client operating record so that an agency can configure its expertise and begin building client context.

| Deliverable | Layer | Exit Criteria |
| ----------- | ----- | ------------- |
| Agency OS Setup wizard (services, playbooks, brand voice, approval rules) | Layer 1 | Agency can complete full setup in under 2 hours |
| Client Operating Record schema and CRUD | Layer 2 | Client record captures business context, brand, audience, funnel |
| Multi-tenant RLS and data isolation | Infrastructure | Pen-test confirms tenant isolation |
| Authentication, authorization, role management | Infrastructure | Agency owner, account manager, editor / strategist roles functional |
| Basic navigation shell and layout | Infrastructure | All 6 layers have navigation stubs |

### Phase 2: Intelligence & Execution (Months 5-8)

**Objective:** Deliver the strategy intelligence pipeline and execution spine so that agencies produce governed strategy and convert it into actionable work.

| Deliverable | Layer | Exit Criteria |
| ----------- | ----- | ------------- |
| Readiness audit engine | Layer 3 | Automated readiness score with actionable gaps |
| Diagnosis and recommendation pipeline | Layer 3 | AI-generated diagnosis passes agency review 80%+ of the time |
| Channel planning and brief generation | Layer 3 | Briefs reference agency playbooks and client context |
| Task management and scheduling | Layer 4 | Strategy converts to tasks with owners, dates, dependencies |
| Approval workflows (internal and client) | Layer 4 | Multi-step approval chains functional |
| Reporting foundation | Layer 4 | Monthly report generation under 15 minutes per client |

### Phase 3: Portal & Agents (Months 9-14)

**Objective:** Launch the client collaboration portal and governed specialist agents to complete the operating system.

| Deliverable | Layer | Exit Criteria |
| ----------- | ----- | ------------- |
| Client portal: approvals, progress, deliverables | Layer 5 | Client portal NPS 50+ in beta |
| Client portal: messaging and requests | Layer 5 | Clients can submit requests and receive responses within portal |
| Client portal: reports and insights | Layer 5 | Clients access reports without agency manual distribution |
| Setup Agent and Readiness Agent | Layer 6 | Agents operate within defined guardrails; 100% compliance |
| Diagnosis Agent and Strategy Architect | Layer 6 | Strategy output quality matches Phase 2 benchmarks |
| Content Agent and Compliance Reviewer | Layer 6 | Content generated within brand voice; compliance flags accurate |
| Campaign Brief Agent | Layer 6 | Briefs generated from strategy without manual reformatting |
| Approvals Follow-up Agent | Layer 6 | Automated follow-ups reduce approval turnaround by 50% |
| Blocker Detection Agent | Layer 6 | Blockers surfaced proactively, not discovered retroactively |
| Reporting Insight Agent | Layer 6 | Insights generated from data, not just data presented |

### Phase 4: Scale & Optimize (Months 15-24)

**Objective:** Harden the platform for 500+ agencies, optimize AI costs, expand integrations, and establish market position.

| Deliverable | Layer | Exit Criteria |
| ----------- | ----- | ------------- |
| Performance optimization at scale | All | Sub-2s page loads at 500 agencies, 10K clients |
| Integration marketplace (publishing tools, CRMs, billing) | All | 5+ integrations live |
| Advanced analytics and agency benchmarking | Layer 3-4 | Agencies can compare performance across clients |
| White-label portal options | Layer 5 | Agencies can brand the client portal as their own |
| Agent orchestration and chaining | Layer 6 | Multi-agent workflows (e.g., strategy-to-content pipeline) |

---

## 11. Risks

| # | Risk | Likelihood | Impact | Mitigation |
| - | ---- | ---------- | ------ | ---------- |
| R1 | Agency setup takes too long, causing drop-off | Medium | High | Guided wizard, progressive value demonstration, quick simulation |
| R2 | AI guardrails are too restrictive, limiting perceived value | Medium | Medium | Tunable guardrails per agency; defaults are conservative, adjustable |
| R3 | Client portal quality does not meet agency standards | Medium | High | Dedicated design investment; agency beta feedback loop |
| R4 | Supabase RLS performance degrades at scale | Low | High | Load testing early; migration path documented |
| R5 | LLM cost per client makes unit economics unsustainable | Medium | High | Caching, prompt optimization, tiered AI usage |
| R6 | Competitor (GoHighLevel, Jasper) builds similar governed AI layer | Medium | Medium | Speed to market; depth of agency-specific workflows is the moat |
| R7 | Agencies resist opinionated workflows | Low | Medium | Hold conviction; opinionated products win categories |

See [03-market-landscape](03-market-landscape-and-positioning.md) for competitive risk analysis.

---

## 12. Principles Governing This Charter

These principles are non-negotiable. Every product decision, engineering trade-off, and design choice is evaluated against them.

1. **One platform, not feature islands.** Every layer connects. No orphan features.
2. **Context before autonomy.** The platform must understand the agency and the client before it acts.
3. **Strategy before content spam.** No content generation without a governing strategy.
4. **State drives work.** The system knows what has been done, what is pending, and what is blocked.
5. **Approvals are product, not friction.** Approval workflows are a core feature, not a gate to route around.
6. **Client-facing quality matters as much as internal speed.** The portal is a product, not an afterthought.

See [01-product-vision](01-product-vision.md) for the full articulation of these principles.

---

*This charter is a living document. It is revised at each monthly roadmap review and requires Executive Sponsor approval for scope changes.*
