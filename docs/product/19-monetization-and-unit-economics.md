# Monetization and Unit Economics

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-MONETIZATION-019`                                   |
| Status           | **Active**                                                   |
| Owner            | Product & Business Team                                      |
| Last revised     | 2026-06-10                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [00-project-charter](00-project-charter.md), [03-market-landscape](03-market-landscape-and-positioning.md), [15-explicit-non-goals](15-explicit-non-goals.md), [16-technical-architecture](16-technical-architecture.md) |

---

## 1. Business Model Summary

SMMAHUB operates a premium SaaS subscription model for Tier 2 operating agencies: 5-25 active clients, EUR15k-EUR100k/month revenue, and 2-10 person teams. The product is sold as agency operating infrastructure, not a low-cost content app or self-serve playground.

Revenue formula:

```
Monthly Revenue = Subscription MRR + Qualified Services Revenue + Expansion Revenue
                = (Sum of agency subscription prices) + (onboarding / migration services) + (tier upgrades or custom expansion)
```

The subscription floor is EUR199/month. There is no no-cost plan and no tier below the floor.

---

## 2. Pricing Tiers

### 2.1 Tier Definitions

| Feature / Limit              | Operate        | Scale           | Agency          | Custom          |
| ---------------------------- | -------------- | --------------- | --------------- | --------------- |
| **Monthly Price**            | EUR199/mo      | EUR349/mo       | EUR499/mo       | Custom          |
| **Annual Price**             | EUR1,990/yr    | EUR3,490/yr     | EUR4,990/yr     | Custom          |
| **Client Fit**               | Up to ~10 active clients | Up to ~25 active clients | Higher client volume or governance needs | Larger agencies / special requirements |
| **User Seats**               | Core team      | Multi-seat team | Expanded team   | Custom          |
| **AI Usage**                 | Bounded governed runs | Higher governed run volume | Advanced governed run volume | Custom limits |
| **Document Storage**         | Standard       | Expanded        | Advanced        | Custom          |
| **RAG Document Ingestion**   | Core source ingestion | Higher source volume | Advanced source volume | Custom          |
| **Client Portal**            | Premium portal | Premium portal + richer workflows | Premium portal + advanced governance | Custom          |
| **Agency OS Setup**          | Guided setup   | Guided setup + deeper validation | Guided setup + advanced controls | Dedicated onboarding |
| **Strategy Intelligence**    | Core governed strategy | Multi-client strategy workflows | Advanced strategy governance | Custom workflows |
| **Reporting**                | Monthly operating reports | Weekly + monthly reports | Custom periods and deeper review | Custom + export |
| **Approval Workflows**       | Core approvals | Multi-step approvals | Advanced governance | Custom          |
| **Integrations**             | Launch-critical set | Core agency stack | Advanced integrations | Custom          |
| **Support**                  | Standard       | Priority        | Priority + success review | Dedicated support |
| **Data Retention**           | Standard       | Expanded        | Advanced        | Custom          |

### 2.2 AI Execution Definition

One governed AI execution is one agent invocation that produces an output under agency and client rules. It may include retrieval, generation, quality grading, and governance checks, but the commercial unit is value delivered to the agency, not raw token volume.

**Execution cost examples by agent type:**

| Agent Type              | Cost Sensitivity | Counted As      |
| ----------------------- | ---------------- | --------------- |
| Setup Assistant         | Low              | 1 governed run  |
| Readiness Audit         | Medium           | 1 governed run  |
| Strategy Architect      | High             | 1 governed run  |
| Campaign Brief          | Medium           | 1 governed run  |
| Content Drafting        | Medium           | 1 governed run  |
| Compliance Reviewer     | Low              | 1 governed run  |
| Reporting Insight       | High             | 1 governed run  |
| Renewal/Risk Signal     | Medium           | 1 governed run  |

### 2.3 Overage Pricing

Overage is a margin-protection mechanism, not the main pricing story. Agencies are nudged to upgrade when client count, user count, or governed run volume consistently exceeds the tier design.

| Tier          | Overage Posture      | Guardrail               |
| ------------- | -------------------- | ----------------------- |
| Operate       | Limited and capped   | Upgrade prompt before sustained overage |
| Scale         | Higher cap           | Upgrade prompt tied to client and workflow expansion |
| Agency        | Highest standard cap | Custom review before very high-volume usage |
| Custom        | Negotiated           | Contract-specific       |

Agencies are notified before limits affect core work. Critical governance checks continue to function even when non-critical generation is paused.

---

## 3. Competitive Pricing Analysis

### 3.1 Direct Competitor Pricing

| Competitor Set | Category | SMMAHUB Position |
| -------------- | -------- | ---------------- |
| Agency CRMs and automation suites | CRM, funnels, sub-accounts | Different category. SMMAHUB governs delivery, strategy, approvals, and client collaboration. |
| AI content tools | Generation and brand voice | SMMAHUB includes content as one workflow inside a governed operating system. |
| PSA / project management tools | Tasks, time, resourcing | SMMAHUB is strategy-to-delivery infrastructure, not project accounting. |
| Social scheduling tools | Publishing and analytics | SMMAHUB governs what should be produced and approved; scheduling is an integration layer. |
| Client portals | Requests and file delivery | SMMAHUB connects portal decisions to strategy, workflow state, and agency context. |
| AI agent platforms | Horizontal automation | SMMAHUB ships domain-specific governed agents, not a blank agent builder. |

### 3.2 Pricing Positioning

SMMAHUB sits in the premium agency infrastructure band. The pricing floor communicates that the product is for operating agencies with real client volume and team coordination pain.

| Positioning Rule | Decision |
| ---------------- | -------- |
| Entry floor | EUR199/month |
| Standard range | EUR199-EUR499/month |
| Larger agencies | Custom pricing |
| No-cost plan | None |
| Funnel | Booked strategy audit or guided demo |
| Buyer expectation | Expert operator evaluating infrastructure, not a casual trial user |

### 3.3 Value Justification Per Tier

| Tier          | Target Agency       | Value Proposition                         | Break-Even Comparison          |
| ------------- | ------------------- | ----------------------------------------- | ------------------------------ |
| Operate EUR199 | 2-5 person agency, up to ~10 active clients | Replaces repeated context work and basic operational chaos | Less than a few hours of senior operator time |
| Scale EUR349 | 4-10 person agency, up to ~25 active clients | Full operating workflow across team, clients, approvals, and reporting | Less than a fraction of a junior hire |
| Agency EUR499 | Larger or governance-heavy operating agency | Advanced control, portal quality, and multi-client leverage | Less than the monthly cost of unmanaged delivery drag |
| Custom | Larger agency or non-standard migration | Dedicated support, migration, and governance scope | Priced against operational transformation value |

---

## 4. Unit Economics

### 4.1 Customer Acquisition Cost (CAC) Targets

| Channel                  | Target CAC    | Rationale                                |
| ------------------------ | ------------- | ---------------------------------------- |
| Founder-led strategy audits | EUR300-EUR700 | High-intent, qualified Tier 2 buyers |
| Agency referrals / advisory network | EUR150-EUR400 | Trust carries heavily in agency communities |
| Content and operator-led education | EUR100-EUR300 | Builds authority with serious operators |
| Paid social / LinkedIn retargeting | EUR400-EUR900 | Supports demand capture, not broad cheap acquisition |
| Direct sales for custom accounts | EUR1,500-EUR5,000 | Justified by larger contract value |
| **Blended target**       | **EUR500-EUR900** | Healthy for EUR2.4k-EUR6k+ annual contracts |

### 4.2 Lifetime Value (LTV) Targets

| Tier          | Monthly Price | Target Retention | LTV           | Notes |
| ------------- | ------------- | ---------------- | ------------- | ----- |
| Operate       | EUR199        | 18 months        | EUR3,582      | Entry infrastructure tier |
| Scale         | EUR349        | 24 months        | EUR8,376      | Primary expansion tier |
| Agency        | EUR499        | 30 months        | EUR14,970     | Advanced governance tier |
| Custom        | EUR750+       | 36 months        | EUR27,000+    | Larger team / migration scope |
| **Blended**   | **~EUR350**   | **24 months**    | **~EUR8,400** | Tier 2 operating-agency model |

Target LTV:CAC ratio: **> 3:1**. The model depends on qualified acquisition and retention through operational dependency, not high-volume low-intent signups.

### 4.3 Payback Period

```
Blended CAC:              EUR700
Blended Monthly ARPU:     EUR350
Gross Margin:             ~80%
Monthly Gross Profit:     EUR280

Payback Period = CAC / Monthly Gross Profit = EUR700 / EUR280 = 2.5 months

Target: < 6 months
```

### 4.4 Gross Margin Analysis

| Cost Component            | Monthly Cost per Agency | Notes                         |
| ------------------------- | ----------------------- | ----------------------------- |
| Supabase hosting allocation | EUR3-EUR8              | Shared infrastructure allocation |
| LLM API costs             | EUR15-EUR70             | Varies by governed run volume |
| Embedding costs           | EUR1-EUR4               | Document ingestion and retrieval |
| OCR processing            | EUR1-EUR8               | Usage-dependent source ingestion |
| Transactional email       | EUR1-EUR3               | Invitations, approval alerts, reports |
| File storage              | EUR1-EUR4               | Source and asset storage |
| **Total COGS per agency** | **EUR22-EUR97**         | Range from Operate to Agency |

| Tier          | Price   | Estimated COGS | Gross Profit | Gross Margin |
| ------------- | ------- | -------------- | ------------ | ------------ |
| Operate       | EUR199  | EUR35          | EUR164       | 82%          |
| Scale         | EUR349  | EUR60          | EUR289       | 83%          |
| Agency        | EUR499  | EUR95          | EUR404       | 81%          |
| **Blended**   | **EUR350** | **EUR65**    | **EUR285**   | **~81%**     |

---

## 5. Revenue Model Components

### 5.1 Primary: Subscriptions (>90% of recurring revenue)

```
Monthly Recurring Revenue (MRR) = Sum of all active agency subscription prices

Growth drivers:
  - New qualified agency customers
  - Tier upgrades as agencies add clients, team members, and governance workflows
  - Annual commitments that improve cash flow and retention
```

### 5.2 Secondary: Qualified Services Revenue

```
Services Revenue = Setup + migration + operating-model configuration

Expected use:
  - Initial operating-model setup for serious buyers
  - Migration from scattered docs, spreadsheets, and portals
  - Custom onboarding for Agency and Custom accounts
```

Services should accelerate subscription success, not become the core business model.

### 5.3 Future: Marketplace Commission (V2, not in current projections)

```
Planned for V2+:
  - Reviewed operating templates and subject packs
  - Partner integrations
  - Revenue share only after core operating workflows are proven
```

---

## 6. Upgrade Triggers and Expansion Revenue

### 6.1 Natural Upgrade Triggers

| Trigger                           | From -> To           | Signal Detection                |
| --------------------------------- | ------------------- | ------------------------------- |
| Client volume exceeds tier fit    | Operate -> Scale    | Client count approaches tier design |
| Team needs broader access         | Operate -> Scale    | Seat invites and role usage |
| Multi-step approvals become standard | Operate -> Scale | Approval workflow configuration |
| Governance and reporting depth expands | Scale -> Agency | Advanced reporting, portal, or agent controls |
| Migration / non-standard requirements | Agency -> Custom | Custom support, integration, or data needs |

### 6.2 Expansion Revenue Model

```
Expected tier distribution (steady state):

  Operate: 35% of agencies
  Scale:   40% of agencies
  Agency:  20% of agencies
  Custom:   5% of agencies

Expected upgrade behavior:
  - 20% of Operate agencies upgrade to Scale within 6-9 months
  - 12% of Scale agencies upgrade to Agency within 12 months
  - 5% of Agency accounts move to Custom within 18 months

Net Revenue Retention (NRR) target: 115-125%
```

---

## 7. Churn Reduction Strategy

### 7.1 Operational Dependency Moat

The primary churn defense is **operational dependency**. Once an agency configures its operating model, builds Client Operating Records, and runs strategy, approvals, reports, and portal workflows through SMMAHUB, switching cost becomes meaningful.

```
Switching cost components:
  - Agency operating model: services, playbooks, quality bar, approval rules
  - Client operating records: brand, audience, decisions, assets, and history
  - Active strategies and campaigns: traceability to briefs, approvals, and reports
  - Client portal habits: client-facing trust and repeatable approval paths
  - Agent execution history: evidence, grades, and governance outcomes
```

### 7.2 Churn Targets

| Metric                      | Target (Year 1)  | Target (Year 2+) |
| --------------------------- | ---------------- | ---------------- |
| Monthly logo churn          | < 5%             | < 3%             |
| Monthly revenue churn       | < 4%             | < 2%             |
| Net revenue retention       | > 105%           | > 115%           |

### 7.3 Churn Risk Indicators

| Indicator                             | Risk Level | Response                       |
| ------------------------------------- | ---------- | ------------------------------ |
| No login in 14 days                   | Medium     | Operator-led check-in or targeted prompt |
| No governed AI run in 30 days         | High       | Success review for qualified accounts |
| Client count declining                | High       | Account review and operating-model reset |
| Support ticket volume spike           | Medium     | Priority support routing       |
| Portal not shared with any client     | Medium     | Portal activation guidance     |
| Annual renewal approaching (60 days)  | Routine    | Renewal campaign + value report |

---

## 8. Cost Structure

### 8.1 Infrastructure Costs

| Component               | Monthly Cost (at 100 agencies) | Monthly Cost (at 500 agencies) |
| ----------------------- | ------------------------------ | ------------------------------ |
| Supabase hosting        | EUR25-EUR100                   | EUR75-EUR300                   |
| Supabase addons         | EUR50-EUR150                   | EUR200-EUR500                  |
| LLM API                 | EUR2,000-EUR5,000              | EUR8,000-EUR18,000             |
| Embedding API           | EUR100-EUR250                  | EUR400-EUR900                  |
| OCR API                 | EUR100-EUR400                  | EUR400-EUR1,500                |
| Transactional email     | EUR20-EUR60                    | EUR80-EUR200                   |
| Monitoring              | EUR30-EUR100                   | EUR80-EUR250                   |
| Hosting / CDN           | EUR20-EUR80                    | EUR50-EUR200                   |
| **Total Infrastructure**| **EUR2,345-EUR6,140**          | **EUR9,285-EUR21,850**         |
| **Per-Agency Cost**     | **EUR23-EUR61**                | **EUR19-EUR44**                |

Infrastructure cost per agency should decrease as the base scales and fixed costs amortize.

### 8.2 Team Costs (Not in COGS, in OPEX)

```
Year 1 target team (lean):
  - 2 full-stack engineers
  - 1 AI/product engineer
  - 1 product lead
  - 1 designer or design contractor
  - 1 customer success / implementation operator
  - Founder-led sales and operator-led content

Break-even should be modeled on EUR199-EUR499 MRR accounts, not low-price self-serve volume.
```

---

## 9. Financial Projections Template

### 9.1 Year 1 (Launch + Growth)

| Quarter | New Agencies | Total Agencies | MRR       | Quarterly Subscription Revenue | Services Revenue | Total Revenue |
| ------- | ------------ | -------------- | --------- | ------------------------------ | ---------------- | ------------- |
| Q1      | 10           | 10             | EUR3,000  | EUR9,000                       | EUR8,000         | EUR17,000     |
| Q2      | 20           | 28             | EUR9,800  | EUR29,400                      | EUR15,000        | EUR44,400     |
| Q3      | 30           | 54             | EUR18,900 | EUR56,700                      | EUR20,000        | EUR76,700     |
| Q4      | 40           | 88             | EUR30,800 | EUR92,400                      | EUR25,000        | EUR117,400    |
| **Y1**  | **100**      | **88**         | **-**     | **EUR187,500**                 | **EUR68,000**    | **EUR255,500** |

Assumptions: Blended ARPU of EUR350/mo, qualified acquisition, and controlled beta-to-launch conversion.

### 9.2 Year 2 (Scale)

| Quarter | New Agencies | Total Agencies | MRR        | Quarterly Subscription Revenue | Services Revenue | Total Revenue |
| ------- | ------------ | -------------- | ---------- | ------------------------------ | ---------------- | ------------- |
| Q1      | 45           | 125            | EUR43,750  | EUR131,250                     | EUR20,000        | EUR151,250    |
| Q2      | 55           | 170            | EUR59,500  | EUR178,500                     | EUR25,000        | EUR203,500    |
| Q3      | 65           | 225            | EUR78,750  | EUR236,250                     | EUR30,000        | EUR266,250    |
| Q4      | 75           | 290            | EUR101,500 | EUR304,500                     | EUR35,000        | EUR339,500    |
| **Y2**  | **240**      | **290**        | **-**      | **EUR850,500**                 | **EUR110,000**   | **EUR960,500** |

Assumptions: Blended ARPU remains near EUR350/mo, with expansion offsetting churn.

### 9.3 Year 3 (Maturity)

| Quarter | New Agencies | Total Agencies | MRR        | Quarterly Subscription Revenue | Services Revenue | Total Revenue |
| ------- | ------------ | -------------- | ---------- | ------------------------------ | ---------------- | ------------- |
| Q1      | 85           | 360            | EUR144,000 | EUR432,000                     | EUR35,000        | EUR467,000    |
| Q2      | 95           | 440            | EUR176,000 | EUR528,000                     | EUR40,000        | EUR568,000    |
| Q3      | 105          | 530            | EUR212,000 | EUR636,000                     | EUR45,000        | EUR681,000    |
| Q4      | 115          | 630            | EUR252,000 | EUR756,000                     | EUR50,000        | EUR806,000    |
| **Y3**  | **400**      | **630**        | **-**      | **EUR2,352,000**               | **EUR170,000**   | **EUR2,522,000** |

Assumptions: Blended ARPU rises toward EUR400/mo as Scale, Agency, and Custom accounts expand.

### 9.4 Summary

| Metric                  | Year 1        | Year 2          | Year 3          |
| ----------------------- | ------------- | --------------- | --------------- |
| Total Revenue           | EUR255,500    | EUR960,500      | EUR2,522,000    |
| Gross Margin            | ~80%          | ~82%            | ~84%            |
| Total Agencies (end)    | 88            | 290             | 630             |
| ARR (ending)            | EUR369,600    | EUR1,218,000    | EUR3,024,000    |

The model is intentionally based on fewer, better-fit agencies rather than mass acquisition of unqualified low-price accounts.

---

## 10. Key Metrics Dashboard

These metrics should be tracked in real-time and reviewed weekly:

| Metric                     | Formula                                          | Target             |
| -------------------------- | ------------------------------------------------ | ------------------ |
| MRR                        | Sum of active subscription prices                | Growing month/month |
| ARPU                       | MRR / active agencies                            | > EUR300           |
| Logo Churn (monthly)       | Churned agencies / start-of-month agencies       | < 3%               |
| Revenue Churn (monthly)    | Lost MRR / start-of-month MRR                    | < 2%               |
| Net Revenue Retention      | (Start MRR + expansion - contraction - churn) / Start MRR | > 115% |
| CAC                        | Total sales and marketing spend / new agencies acquired | < EUR900 |
| LTV:CAC                    | LTV / CAC                                        | > 3:1              |
| Payback Period             | CAC / (ARPU * gross margin)                      | < 6 months         |
| AI Cost per Agency         | Total LLM + embedding costs / active agencies    | < EUR75            |
| Gross Margin               | (Revenue - COGS) / Revenue                       | > 80%              |

---

*For the product scope that informs this pricing, see [00-project-charter](00-project-charter.md). For features excluded from scope, see [15-explicit-non-goals](15-explicit-non-goals.md). For infrastructure costs driving COGS, see [16-technical-architecture](16-technical-architecture.md). Pricing and ICP must remain aligned with [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md).*
