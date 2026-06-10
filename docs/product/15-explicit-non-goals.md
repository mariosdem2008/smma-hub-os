# Explicit Non-Goals

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-NONGOALS-015`                                       |
| Status           | **Active**                                                   |
| Owner            | Agency OS Product Team                                       |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [00-project-charter](00-project-charter.md), [03-market-landscape](03-market-landscape-and-positioning.md), [04-value-proposition](04-value-proposition-and-messaging.md), [16-technical-architecture](16-technical-architecture.md) |

---

## 1. Purpose of This Document

Every product becomes what it refuses to become. SMMAHUB serves a precise niche:
governed AI operations for social media marketing agencies. This document codifies
what the platform deliberately does NOT attempt, why each boundary exists, and what
SMMAHUB does instead. These non-goals are not temporary deferrals. They are
permanent architectural decisions that keep the product focused, the codebase
maintainable, and the value proposition sharp.

Any feature proposal that drifts into a non-goal area must be escalated to the
product leadership team with a written justification for why the boundary should
move. The default answer is no.

---

## 2. Non-Goal Registry

### 2.1 Not a Generic CRM

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Lead scoring, sales pipeline stages, cold outreach sequences, deal forecasting, contact enrichment from third-party data providers, email drip campaigns for prospect nurturing, territory management. |
| **Why**             | CRM is a solved, commoditized category dominated by HubSpot, Salesforce, and Pipedrive. Agencies already own a CRM. Building one pulls engineering resources away from the governed-AI differentiator and puts SMMAHUB in a feature war it cannot win. |
| **What we do instead** | SMMAHUB maintains a **Client Operating Record** (Layer 2) that stores the operational context needed to serve an existing client: brand rules, audience profiles, funnel state, performance history, and active strategies. This is not a sales tool. It starts after the deal is closed. Agencies that need CRM functionality integrate their existing CRM or use the client import flow. |
| **Integration path** | Future webhook/API integration with HubSpot and Pipedrive to auto-create a Client Operating Record when a deal moves to "Closed Won." |

---

### 2.2 Not a Social Media Scheduler

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Calendar-based post scheduling UI, direct publishing to social networks, best-time-to-post algorithms, unified social inbox, social listening dashboards, hashtag suggestion engines. |
| **Why**             | The scheduling layer is a race to the bottom. Buffer, Hootsuite, Sprout Social, Later, and Metricool have spent a decade building direct API integrations with every social network. Replicating that surface area would consume 60%+ of engineering capacity and produce an inferior product. More importantly, agencies already pay for and are trained on their preferred scheduler. Forcing a switch destroys adoption. |
| **What we do instead** | SMMAHUB produces **governed campaign briefs and content drafts** that flow into the agency's existing scheduler. The Execution & Delivery Spine (Layer 4) manages the campaign lifecycle (brief, draft, review, approve) and then hands off approved assets with metadata (caption, hashtags, target publish date, channel) via export or integration. The creative intelligence stays in SMMAHUB; the last-mile publishing stays in the scheduler. |
| **Integration path** | Phase 2 integrations with Buffer and Later APIs to push approved content directly into scheduling queues. The integration is one-directional: SMMAHUB pushes out, it does not pull back engagement data for inbox management. |

---

### 2.3 Not a Replacement for Human Strategists

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Fully autonomous strategy generation with no human review, autonomous budget allocation, autonomous client communication, autonomous campaign launches, autonomous crisis response. |
| **Why**             | Agency value is built on human judgment, relationships, and creative intuition. Clients hire agencies because they trust the people, not the software. Positioning AI as a strategist replacement would alienate the exact users we need to adopt the platform (agency strategists and account managers). It would also produce liability exposure when AI-generated strategies underperform. |
| **What we do instead** | AI agents operate as **governed specialists** that prepare, analyze, recommend, and draft. Humans review, modify, approve, and decide. The approval matrix (configured during Agency OS Setup, Layer 1) defines exactly which outputs require human sign-off. No strategy document, campaign brief, or client-facing content leaves the system without passing through the agency's own approval workflow. See [08-ai-trust-safety](08-ai-trust-safety-and-evaluation.md) for the full governance model. |
| **Design principle** | Every AI output screen includes an explicit "Prepared by AI, pending your review" indicator. There is no "auto-publish" toggle for strategic outputs. |

---

### 2.4 Not a General-Purpose AI Platform

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Custom agent builder for arbitrary use cases, no-code AI workflow designer, prompt marketplace, AI model fine-tuning interface, general chatbot builder, AI agent SDKs for third-party developers. |
| **Why**             | General-purpose AI platforms (LangChain, CrewAI, Relevance AI, custom GPTs) optimize for flexibility. SMMAHUB optimizes for **governed correctness within a specific domain**. Building a general agent builder would dilute the specialist agent quality, introduce unpredictable execution paths, and make governance guarantees impossible. The 10+ specialist agents succeed precisely because they have hard-coded context requirements, output schemas, and approval rules. |
| **What we do instead** | SMMAHUB ships a **fixed registry of governed specialist agents** (Layer 6), each purpose-built for a specific agency workflow: readiness audit, diagnosis, strategy architecture, campaign brief, content generation, compliance review, approvals follow-up, blocker detection, reporting insight, renewal/risk signal. Agencies configure agent behavior through the Agency Brain (playbooks, brand rules, compliance rules) -- not by building new agents. See [16-technical-architecture](16-technical-architecture.md) for agent architecture details. |
| **Extensibility model** | New agents are added by the SMMAHUB engineering team through the standard agent development lifecycle, not by end users. |

---

### 2.5 Not an Enterprise Content Management System

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Structured content modeling (content types, fields, references), headless CMS API, localization/i18n content workflows, content versioning with branching/merging, webhook-driven content delivery to frontends, digital asset management (DAM) with rendition pipelines. |
| **Why**             | Enterprise CMS (Contentful, Sanity, Strapi, Hygraph) serves a fundamentally different user: developers and content teams building websites and apps. Agencies using SMMAHUB produce social media content (captions, visuals, short-form video scripts, carousel copy), not structured website content. The content lifecycle is short (days to weeks, not months), the volume is high (dozens of posts per client per month), and the governance model is approval-based, not version-based. |
| **What we do instead** | Content in SMMAHUB is a **task output within a campaign**, stored as a Content entity with a simple lifecycle: draft, in-review, revision-requested, approved, delivered. There is no content modeling layer, no schema builder, no headless API. Content assets (images, videos) are stored as files attached to Content records, not managed through a DAM pipeline. See [17-data-entities](17-data-entities-high-level.md) for the Content entity definition. |

---

### 2.6 Not a Full PSA/ERP System

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Timesheet tracking, hourly billing, resource allocation and capacity planning, project profitability analysis, expense management, invoicing and accounts receivable, payroll integration, utilization reporting, Gantt charts and resource leveling. |
| **Why**             | Professional Services Automation (Productive, Teamwork, Scoro, Kantata) and ERP systems are deep horizontal tools. Agencies that need time tracking and invoicing already use Harvest, Toggl, FreshBooks, or QuickBooks. Building PSA features would triple the data model complexity, require financial compliance (tax calculations, payment processing beyond subscriptions), and shift engineering focus away from the AI operations core. |
| **What we do instead** | SMMAHUB tracks **tasks with due dates, assignees, statuses, and dependencies** within the Execution & Delivery Spine (Layer 4). This is operational task management, not project accounting. The system knows "this content piece is due Thursday and blocked by client approval," not "this content piece took 3.5 hours and should be billed at $150/hr." Subscription billing is handled through Stripe integration; SMMAHUB does not generate client invoices. |
| **Integration path** | Future read-only integration with Harvest/Toggl to surface time data alongside task completion data for agency managers who want a unified view. |

---

### 2.7 Not a Design Tool

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Canvas-based graphic editor, image manipulation (crop, filter, resize), video editor or timeline, template designer with drag-and-drop, brand kit with live preview, AI image generation (DALL-E, Midjourney integration for in-platform generation). |
| **Why**             | Design tools (Canva, Figma, Adobe Express, CapCut) are extraordinarily deep products with years of rendering engine investment. Agencies have strong tool preferences for design, and designers will not switch to an inferior built-in editor. Attempting to build even a basic canvas would consume massive engineering resources and still produce a worse experience than established design-tool entry offerings. |
| **What we do instead** | SMMAHUB produces **creative briefs and content specifications** that inform design work: copy direction, visual style notes (drawn from the Client Brain's brand guidelines), format requirements, and reference examples. Designers use their preferred tool to execute. Completed assets are uploaded back into SMMAHUB for review and approval within the campaign workflow. |
| **AI image generation** | Deliberately excluded from V1-V3. If added in the future, it would be as an optional add-on that generates draft visuals for brief illustration, never as a replacement for the design workflow. |

---

### 2.8 Not a White-Label Platform Builder

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Custom domain mapping for agency-branded instances, full UI theming/skinning, white-label API for reselling, agency-built add-ons or plugins, per-agency custom feature flags controlled by the agency, sub-licensing model. |
| **Why**             | White-label platforms (GoHighLevel, Vendasta) serve agencies that want to resell software under their own brand. This is a fundamentally different business model that requires multi-level tenant isolation, per-agency billing systems, per-agency feature configuration, and support-of-support infrastructure. It also attracts a different buyer: the agency-as-software-reseller rather than the agency-as-service-provider. SMMAHUB targets agencies that sell expertise, not software. |
| **What we do instead** | The **Client Collaboration Surface** (Layer 5) is a portal that agencies share with their clients. It carries SMMAHUB branding (with agency name displayed). Agencies configure what clients can see and do, but they do not rebuild or reskin the platform. This keeps the product consistent, supportable, and upgradable. |
| **Branding accommodation** | Agency logo and color accent are configurable in the client portal header. This is a cosmetic customization, not a white-label system. |

---

### 2.9 Not a Data Warehouse or BI Tool

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | ETL pipelines for arbitrary data sources, SQL query builder, custom dashboard builder with arbitrary metrics, data warehouse storage layer, OLAP cubes, data catalog, data lineage tracking, export-to-Snowflake/BigQuery connectors. |
| **Why**             | BI tools (Looker, Tableau, Power BI, Metabase) and data warehouses (Snowflake, BigQuery) are infrastructure products. Agencies that need cross-platform analytics already use Supermetrics, Funnel.io, or agency-specific dashboards. Building a general BI layer would require supporting arbitrary data schemas, custom visualization, and query performance optimization -- none of which advance the governed-AI mission. |
| **What we do instead** | SMMAHUB provides **opinionated reporting** through the Reporting Insight agent and the Report entity. Reports are generated per-client per-period with predefined metric categories (reach, engagement, conversion, spend efficiency) and AI-generated insights tied to strategy recommendations. The data model is fixed and purpose-built, not queryable by end users. See [17-data-entities](17-data-entities-high-level.md) for the Report entity. |
| **Data export** | Agencies can export report data as CSV/PDF for import into their preferred BI tool. SMMAHUB does not attempt to be the analytics system of record. |

---

### 2.10 Not Trying to Own the Publishing Layer

| Aspect              | Detail                                                      |
| ------------------- | ----------------------------------------------------------- |
| **What we exclude** | Direct API connections to Facebook/Instagram/TikTok/LinkedIn/X for post publishing, unified publishing queue, publishing analytics (impressions, reach, engagement pulled from platform APIs), social account connection and OAuth management for publishing purposes. |
| **Why**             | Publishing APIs are unstable, rate-limited, and subject to frequent breaking changes from social networks. Maintaining direct publishing integrations requires a dedicated team monitoring API changelogs, handling OAuth token refresh, managing permission scopes, and debugging platform-specific formatting issues. This is the core competency of schedulers (Buffer, Sprout, Later) and not a defensible differentiator for SMMAHUB. Additionally, social networks increasingly restrict third-party publishing access, making this a strategic dependency risk. |
| **What we do instead** | SMMAHUB's Meta/Facebook API integration is **read-only for data ingestion** (pulling performance metrics to enrich the Client Brain and power reporting). Publishing flows through the agency's existing scheduler. The Execution & Delivery Spine tracks the publishing status as a task state ("delivered to scheduler," "published," "live") updated manually or via future scheduler integration webhooks. |
| **Exception** | The Meta API integration for pulling ad performance data is an existing integration that supports the Strategy Intelligence layer. This is read-only and does not constitute owning the publishing layer. |

---

## 3. Non-Goal Boundary Enforcement

### 3.1 Feature Request Triage

Every feature request is evaluated against this non-goal registry before entering the
backlog. The triage checklist:

```
1. Does this feature fall within one of the 6 platform layers?
   - Yes → proceed to prioritization.
   - No  → check non-goal registry.

2. Does this feature overlap with a documented non-goal?
   - Yes → reject with reference to this document.
   - Partial overlap → escalate to product lead with written justification.
   - No  → evaluate as a potential new capability.

3. If the feature is in a non-goal area but has overwhelming user demand:
   - Document the demand (number of requests, revenue at risk).
   - Present to product leadership with a scope impact assessment.
   - If approved, update this document with a formal boundary revision.
```

### 3.2 Integration Over Building

For every non-goal area, the preferred approach is integration:

| Non-Goal Area              | Preferred Integration Partner(s)              |
| -------------------------- | --------------------------------------------- |
| CRM                        | HubSpot, Pipedrive (webhook on deal close)    |
| Social scheduling          | Buffer, Later (push approved content)         |
| Time tracking              | Harvest, Toggl (read-only data pull)          |
| Design                     | Canva, Figma (asset upload back to SMMAHUB)   |
| BI / Analytics             | Supermetrics, Funnel.io (CSV/PDF export)      |
| Publishing                 | Buffer, Sprout Social (via scheduler)         |
| Invoicing                  | Stripe (subscription only), QuickBooks (N/A)  |
| Content management         | N/A (not applicable to social content)        |
| AI platform                | N/A (agents are internal, not extensible)     |
| White-label                | N/A (not a business model SMMAHUB pursues)    |

---

## 4. When Non-Goals Become Goals

A non-goal can be reclassified only when ALL of the following conditions are met:

1. **Market signal**: At least 30% of churned customers cite the missing capability
   as a primary reason for leaving.
2. **Strategic alignment**: The capability can be built in a way that reinforces
   (not dilutes) the governed-AI value proposition.
3. **Engineering capacity**: The team has shipped all committed roadmap items for
   the current quarter and has capacity for the new scope.
4. **Reversibility**: The implementation can be built as an optional module that
   does not compromise the core product's simplicity.
5. **Leadership approval**: Written sign-off from the product lead and engineering
   lead, with an updated version of this document published before work begins.

---

## 5. Summary Table

| #    | Non-Goal                        | Category       | Risk if Violated                          |
| ---- | ------------------------------- | -------------- | ----------------------------------------- |
| 2.1  | Generic CRM                     | Scope creep    | Feature war with HubSpot; diluted focus   |
| 2.2  | Social media scheduler          | Scope creep    | 60%+ eng capacity consumed; inferior UX   |
| 2.3  | Replace human strategists       | Trust risk     | User alienation; liability exposure       |
| 2.4  | General-purpose AI platform     | Arch. risk     | Ungovernable agents; quality collapse     |
| 2.5  | Enterprise CMS                  | Scope creep    | Wrong user; wrong content lifecycle       |
| 2.6  | Full PSA/ERP                    | Scope creep    | Financial compliance burden; eng drain    |
| 2.7  | Design tool                     | Scope creep    | Inferior to established design tools; wasted eng |
| 2.8  | White-label platform            | Business model | Different buyer; support-of-support cost  |
| 2.9  | Data warehouse / BI tool        | Scope creep    | Arbitrary schema support; perf issues     |
| 2.10 | Publishing layer                | API risk       | Unstable APIs; dedicated team required    |

---

*This document is a living reference. It should be reviewed quarterly and updated
when market conditions or strategic direction change. Any boundary revision must
follow the process in Section 4.*
