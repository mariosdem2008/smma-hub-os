# SMMAHUB Product Vision

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-VISION-001`                                         |
| Status           | **Active**                                                   |
| Owner            | Product Lead                                                 |
| Last revised     | 2026-03-23                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [00-project-charter](00-project-charter.md), [02-user-problems-personas-jtbd](02-user-problems-personas-jtbd.md), [03-market-landscape](03-market-landscape-and-positioning.md), [04-value-proposition](04-value-proposition-and-messaging.md) |

---

## 1. The Core Promise

**Configure your agency's expertise once. Run it across every client with governed AI.**

This is not a marketing slogan. It is a product constraint. Every feature, every workflow, every AI agent must deliver on this promise or it does not ship. The buyer is the Tier 2 operating agency defined in [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md): 5-25 active clients, EUR15k-EUR100k/month revenue, and a 2-10 person team.

The promise has three load-bearing words:

- **Once.** The agency encodes its expertise (services, playbooks, brand voice, approval rules, SOPs) a single time. The platform replicates that expertise across every client engagement without re-teaching.
- **Governed.** AI does not improvise. Every AI action is bounded by agency-defined guardrails. No AI output reaches a client without passing through the agency's own quality standards.
- **Every client.** The platform scales horizontally. Adding the 25th active client should not require 25x the effort of the pilot client.

---

## 2. The 6-Layer Architecture

SMMAHUB is structured as six interconnected layers. Each layer builds on the one below it. No layer functions in isolation.

### Layer 1: Agency OS Setup

**Purpose:** The agency teaches the platform how it works.

| Component | Description |
| --------- | ----------- |
| Service definitions | What the agency sells: social media management, content creation, paid ads, strategy consulting |
| Playbooks | Step-by-step workflows for recurring work: content calendars, campaign launches, crisis response |
| Brand voice rules | Tone, vocabulary, restrictions, examples — the agency's own voice and each client's voice |
| Approval rules | Who approves what, at which stage, with what escalation path |
| SOPs | Standard operating procedures for onboarding, reporting, off-boarding, quality review |
| Modules | Configurable capability blocks the agency enables or disables based on its service offering |

**Why this is Layer 1:** Without this layer, the platform has no context. AI without context is spam. The setup is the foundation that makes everything else governed rather than generic.

### Layer 2: Client Operating Record

**Purpose:** A durable, enriching record per client that accumulates context over time.

| Component | Description |
| --------- | ----------- |
| Business context | Industry, competitors, market position, business objectives, KPIs |
| Brand profile | Visual identity, tone of voice, do/don't lists, example content, client preferences |
| Audience definitions | Target segments, demographics, psychographics, platform behavior |
| Funnel mapping | Awareness, consideration, conversion — where the client's audience is and where it needs to go |
| Asset library | Approved images, templates, logos, copy blocks, past campaigns |
| Approval history | Every approval, rejection, revision — a complete audit trail |
| Interaction log | Every strategy, brief, task, and deliverable associated with this client |

**Why this layer enriches:** The record is not static. Every interaction, approval, and campaign result feeds back into the record. The platform gets smarter about each client over time, not just at onboarding.

### Layer 3: Strategy Intelligence

**Purpose:** A governed pipeline that produces strategy from context, not content from nothing.

The pipeline is sequential and each stage gates the next:

1. **Readiness Audit** — Assess whether the agency and client have sufficient context to proceed. Surface gaps before they become failures.
2. **Diagnosis** — Analyze the client's current state: what is working, what is not, where are the opportunities.
3. **Recommendation** — Generate strategic recommendations grounded in the diagnosis, bounded by agency playbooks.
4. **Channel Planning** — Map recommendations to specific channels (Instagram, LinkedIn, TikTok, etc.) with rationale.
5. **Brief Generation** — Produce content and campaign briefs that reference the strategy, the client's brand, and the agency's playbooks.
6. **Task Conversion** — Convert briefs into actionable tasks with owners, deadlines, and dependencies.
7. **Review** — Human review gate. No strategy output bypasses agency review.

**Why strategy before content:** The market is flooded with tools that generate content. None of them ask whether the content should exist, for whom, on which channel, with what objective. Strategy Intelligence is SMMAHUB's primary differentiator. See [03-market-landscape](03-market-landscape-and-positioning.md) for why competitors fail here.

### Layer 4: Execution & Delivery Spine

**Purpose:** Convert strategy into campaigns, tasks, schedules, approvals, dependencies, and reporting.

| Component | Description |
| --------- | ----------- |
| Campaign management | Campaigns tied to strategy; no orphan campaigns |
| Task management | Tasks with owners, deadlines, dependencies, status tracking |
| Scheduling | Content calendar, publishing schedule, milestone tracking |
| Approval workflows | Multi-step internal and client-facing approval chains |
| Dependency tracking | Blocked tasks surface automatically; no silent failures |
| Reporting | Automated report generation from campaign data and client records |

**Why this is not a project management tool:** SMMAHUB does not compete with Asana or Monday.com. The execution spine is opinionated for agency workflows: strategy-to-task conversion, client approval loops, and deliverable tracking. It does not support arbitrary project types.

### Layer 5: Client Collaboration Surface

**Purpose:** A premium portal that makes the client feel like a retainer-level partner, not a ticket in a queue.

| Component | Description |
| --------- | ----------- |
| Approval interface | Clients approve or request revisions on deliverables with context |
| Progress dashboard | Real-time view of what is in progress, what is complete, what needs attention |
| Request submission | Clients submit ad-hoc requests that enter the agency's workflow |
| Deliverable gallery | All deliverables organized by campaign, date, and status |
| Messaging | Threaded communication tied to specific deliverables or campaigns |
| Reports | Client-facing reports with insights, not just data dumps |

**Why portal quality matters:** Agencies sell trust and professionalism. A shoddy portal undermines the agency's brand. The client portal must look and feel like a premium product — because to the client, it is the agency's product. See [02-user-problems-personas-jtbd](02-user-problems-personas-jtbd.md) for the Client Stakeholder persona.

### Layer 6: Governed Specialist Agents

**Purpose:** AI agents that perform specific jobs within explicit agency-defined guardrails.

| Agent | Job | Guardrails |
| ----- | --- | ---------- |
| Setup Agent | Guides agency through initial platform configuration | Cannot skip required fields; validates completeness |
| Readiness Agent | Runs readiness audits on client records | Cannot proceed to strategy if readiness score is below threshold |
| Diagnosis Agent | Analyzes client performance data and surfaces insights | Cannot make recommendations; only diagnoses |
| Strategy Architect | Generates strategic recommendations from diagnosis | Bounded by agency playbooks; requires human review |
| Campaign Brief Agent | Produces briefs from approved strategy | References client brand profile and agency voice rules |
| Content Agent | Generates content drafts from approved briefs | Operates within brand voice; flags compliance concerns |
| Compliance Reviewer | Checks content against brand rules, legal constraints, platform policies | Hard-blocks non-compliant content; cannot be overridden by content creator |
| Approvals Follow-up Agent | Sends reminders and escalations for pending approvals | Follows agency-defined escalation timelines |
| Blocker Detection Agent | Identifies blocked work and surfaces it to account managers | Proactive, not reactive; runs on schedule |
| Reporting Insight Agent | Generates narrative insights from campaign performance data | Insights are suggestions, not assertions; flagged for human review |

**Why governed, not autonomous:** Autonomous AI agents are a liability for agencies. One wrong post, one off-brand message, one unapproved campaign — and the agency loses the client. Governed agents operate within explicit boundaries. They augment human judgment; they do not replace it.

---

## 3. The 9 "Done" Criteria

SMMAHUB is "done" — meaning it fulfills its vision — when all 9 of the following are true simultaneously:

| # | Criterion | Measurable Test |
| - | --------- | --------------- |
| 1 | An agency can configure its entire operating model in a single session | Setup completion rate > 80% in under 4 hours |
| 2 | A new client can be onboarded with full context in under 2 hours | Onboarding time measured from first click to readiness-audit-complete |
| 3 | Strategy is produced from context, not from prompts | Every strategy artifact traces back to client record and agency playbook |
| 4 | Content is governed by strategy, brand, and compliance rules | Zero content reaches client portal without passing all three checks |
| 5 | Approvals flow without manual chasing | Approval turnaround < 12 hours; automated follow-ups active |
| 6 | The client portal is indistinguishable from a bespoke agency tool | Client portal NPS > 50; clients do not ask "what tool is this?" |
| 7 | One account manager handles 15-20 clients without quality loss | Client satisfaction scores remain stable as load increases |
| 8 | Every AI agent stays within its guardrails 100% of the time | Guardrail violation rate = 0% in production |
| 9 | The platform gets smarter per client over time | Recommendation quality improves measurably after 3 months of usage |

---

## 4. Product Principles

These principles resolve ambiguity. When the team disagrees on a product decision, these principles are the tiebreaker.

### Principle 1: One Platform, Not Feature Islands

Every feature connects to the whole. A task is tied to a brief, which is tied to a strategy, which is tied to a diagnosis, which is tied to a client record, which is governed by the agency setup. If a feature cannot trace its lineage to this chain, it is an orphan and it does not ship.

### Principle 2: Context Before Autonomy

The platform must understand before it acts. No AI agent operates without sufficient context. The readiness audit exists specifically to prevent premature action. If the client record is incomplete, the platform says so — it does not guess.

### Principle 3: Strategy Before Content Spam

The world does not need another tool that generates 50 Instagram captions from a keyword. SMMAHUB generates content only when a strategy exists, a brief has been approved, and brand governance is active. Content without strategy is noise.

### Principle 4: State Drives Work

The platform knows the state of every client, every campaign, every task, every approval. State is not inferred from activity; it is explicitly tracked. This enables blocker detection, progress reporting, and proactive follow-ups. If the system does not know the state, the work does not move.

### Principle 5: Approvals Are Product, Not Friction

Approvals are not a gate that slows people down. They are a feature that protects quality, builds client trust, and creates an audit trail. The approval workflow is designed to be fast, contextual, and mobile-friendly — not a checkbox buried in a settings page.

### Principle 6: Client-Facing Quality Matches Internal Speed

Internal tools can be rough. Client-facing surfaces cannot. The portal, the reports, the deliverable presentations — these are the agency's face to the client. Every pixel, every interaction, every notification must meet the quality bar the agency would set for itself.

---

## 5. The End-State Agency Journey (12 Steps)

This is the complete journey an agency takes through SMMAHUB, from first login to steady-state operation.

| Step | Actor | Action | Platform Layer |
| ---- | ----- | ------ | -------------- |
| 1 | Agency Owner | Signs up and begins guided setup | Layer 1 |
| 2 | Agency Owner | Defines services, uploads playbooks, configures brand voice | Layer 1 |
| 3 | Agency Owner | Sets approval rules and SOPs | Layer 1 |
| 4 | Agency Owner | Invites team members (Account Managers, Creators, Strategists) | Layer 1 |
| 5 | Account Manager | Creates a new client and begins onboarding | Layer 2 |
| 6 | Account Manager | Completes client operating record (business context, brand, audience) | Layer 2 |
| 7 | Strategist | Runs readiness audit; addresses gaps | Layer 3 |
| 8 | Strategist | Reviews AI-generated diagnosis and recommendations | Layer 3 |
| 9 | Strategist | Approves channel plan and briefs | Layer 3 |
| 10 | Content Creator | Generates content from approved briefs; compliance review runs automatically | Layer 4 + Layer 6 |
| 11 | Client Stakeholder | Reviews deliverables in portal; approves or requests revisions | Layer 5 |
| 12 | Account Manager | Reviews automated reports; shares insights with client | Layer 4 + Layer 5 |

After Step 12, the cycle repeats from Step 7 onward. The client record enriches with each cycle. The platform's recommendations improve. The agency scales.

---

## 6. What the Platform Must Never Pretend

These are explicit anti-patterns. If the platform finds itself doing any of these, it has failed.

| # | Anti-Pattern | Why It Fails |
| - | ------------ | ------------ |
| 1 | Generating content without a strategy | Produces noise, not value; indistinguishable from ChatGPT |
| 2 | Acting on incomplete client context | Garbage in, garbage out; agencies lose trust |
| 3 | Bypassing approval workflows for speed | Speed without governance is recklessness; one mistake costs a client |
| 4 | Presenting AI output as human-reviewed when it is not | Deception erodes trust; agencies need to know what has been reviewed |
| 5 | Claiming autonomy when it provides assistance | Governed agents assist humans; they do not replace judgment |
| 6 | Treating the client portal as a secondary concern | The portal IS the product for the client; neglecting it is neglecting half the value |
| 7 | Optimizing for feature count over workflow depth | Agencies need 6 deep layers, not 60 shallow features |
| 8 | Competing with publishing tools | SMMAHUB governs what gets published; it does not press the publish button |
| 9 | Allowing AI agents to operate outside defined guardrails | One ungoverned action can destroy an agency-client relationship |
| 10 | Treating onboarding as a one-time event | The client record must enrich continuously; onboarding is the beginning, not the end |

---

## 7. The Competitive Moat

SMMAHUB's moat is not any single feature. It is the interconnection of all six layers.

- GoHighLevel has client isolation but no strategy intelligence. See [03-market-landscape](03-market-landscape-and-positioning.md).
- Jasper has content generation but no agency governance.
- Productive has project management but no AI agents.
- ManyRequests has a client portal but no strategy engine.
- Lindy has AI agents but no agency-specific workflows.

SMMAHUB is the only platform where:
- Agency expertise is encoded once and applied everywhere.
- Strategy governs content, not the other way around.
- AI agents operate within agency-defined guardrails.
- The client portal is a first-class product surface.
- Every layer feeds every other layer.

This interconnection is the moat. Competitors would need to build all six layers and connect them — which is a multi-year effort for any team that starts with only one.

---

## 8. Technical Vision Alignment

The product vision constrains the technical architecture:

| Product Requirement | Technical Implication |
| ------------------- | --------------------- |
| Multi-tenant client isolation | Supabase RLS on every table; tenant ID in every query |
| Real-time collaboration | Supabase Realtime subscriptions for approvals, comments, status changes |
| AI governance | Structured prompt pipelines with guardrail checks before output delivery |
| Client portal as premium surface | Dedicated portal routes with client-scoped authentication |
| Enriching client records | Append-only interaction logs; computed fields for readiness scores |
| Specialist agents | Edge Functions for agent orchestration; function calling for structured outputs |
| Strategy-to-task pipeline | Relational schema linking strategies to briefs to tasks to deliverables |

See [00-project-charter](00-project-charter.md) for technical constraints and phase delivery timeline.

---

## 9. Vision Validation Checkpoints

The vision is validated at each project phase:

| Phase | Checkpoint Question | Pass Criteria |
| ----- | ------------------- | ------------- |
| Phase 1 (Foundation) | Can an agency configure its expertise and onboard a client? | Setup + onboarding complete in under 6 hours total |
| Phase 2 (Intelligence) | Does the strategy pipeline produce governed output? | 80% of strategy artifacts pass agency review without revision |
| Phase 3 (Portal & Agents) | Does the client portal feel premium? Do agents stay governed? | Portal NPS > 50; guardrail violation rate = 0% |
| Phase 4 (Scale) | Does the platform scale without degradation? | Sub-2s page loads at 500 agencies; unit economics positive |

---

*This vision document is the north star. It does not change with quarterly priorities. It changes only when the fundamental understanding of what agencies need changes — and that requires evidence, not opinion.*
