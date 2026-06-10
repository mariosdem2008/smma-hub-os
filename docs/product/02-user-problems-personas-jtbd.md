# SMMAHUB User Problems, Personas & Jobs to Be Done

| Field            | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| Document ID      | `SMMAHUB-PERSONAS-001`                                       |
| Status           | **Active**                                                   |
| Owner            | Product Lead                                                 |
| Last revised     | 2026-06-10                                                   |
| Related docs     | [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md), [00-project-charter](00-project-charter.md), [01-product-vision](01-product-vision.md), [03-market-landscape](03-market-landscape-and-positioning.md), [04-value-proposition](04-value-proposition-and-messaging.md) |

---

## 1. The Agency Problem Space

SMMAHUB serves only Tier 2 operating social media marketing agencies: 5-25 active clients, EUR15k-EUR100k/month revenue, and a 2-10 person team. These agencies already sell, deliver, and retain clients. Their problem is not learning how to become an agency; it is operating with enough leverage, governance, and client-facing polish that the business can scale without the owner becoming the permanent bottleneck.

The result:

- **Context lives in people's heads.** The owner, account manager, or strategist re-explains the same client and agency context repeatedly.
- **Strategy disconnects from delivery.** Plans are created in one place, while briefs, assets, approvals, and reporting live elsewhere.
- **Approval is manual.** Slack threads, email attachments, and ad-hoc comments create delays and missed decisions.
- **Client communication is fragmented.** Updates, requests, deliverables, and reports do not share one operational spine.
- **Scaling means supervision.** Adding clients forces more owner review unless the agency can encode its standards into the system.

SMMAHUB exists to solve these operating problems for real agency teams.

---

## 2. Persona Definitions

### 2.1 Agency Owner / Founder

| Attribute | Detail |
| --------- | ------ |
| **Title** | Agency Owner, Founder, Managing Director |
| **Agency size** | 2-10 people |
| **Client load** | 5-25 active clients |
| **Revenue stage** | EUR15k-EUR100k/month |
| **Technical skill** | Uses SaaS tools daily and evaluates products on operational ROI |
| **Daily tools** | CRM, Slack, Google Workspace, scheduling tools, project tools, AI assistants |

**Goals:**
1. Reduce owner bottlenecks without lowering quality.
2. Standardize delivery across clients and team members.
3. Keep the agency's premium client experience consistent.
4. Improve margin by reducing repeated coordination work.
5. Build a business that is not dependent on the founder's memory.

**Frustrations:**
1. "The team still comes to me for every non-trivial decision."
2. "We keep rebuilding context for clients we already onboarded."
3. "I cannot see delivery risk until it is already late."
4. "Generic AI output is fast, but I still have to supervise it heavily."
5. "Our client experience should feel more premium than our internal tool stack does."

**Key JTBD:** When my agency is operating with real clients and a real team, I want to encode our standards once so the team can deliver consistently without routing every decision through me.

**Platform layers that serve this persona:** Layer 1 (Agency OS Setup), Layer 4 (Execution Spine), Layer 5 (Client Collaboration Surface), Layer 6 (Governed Agents).

---

### 2.2 Account Manager

| Attribute | Detail |
| --------- | ------ |
| **Title** | Account Manager, Client Success Manager, Project Manager |
| **Reports to** | Agency Owner or Director of Client Services |
| **Client load** | 5-12 active client accounts |
| **Technical skill** | Power user of project management and communication tools |
| **Daily tools** | Project boards, Slack, email, Google Docs, spreadsheets, reporting tools |

**Goals:**
1. Know the state of every assigned client without hunting across tools.
2. Move approvals forward with less chasing.
3. Keep client requests, deliverables, and decisions tied to the right record.
4. Look organized and proactive in front of clients.
5. Hand off work to editors and strategists with enough context to avoid rework.

**Frustrations:**
1. "I spend too much time finding the latest version of the truth."
2. "Approvals stall because nobody can see the decision owner or deadline."
3. "Requests arrive in multiple channels and lose context."
4. "Reporting takes too long because data and narrative live separately."
5. "When I am overloaded, clients feel the agency is reactive."

**Key JTBD:** When I am managing multiple client accounts, I want one governed system that shows context, blockers, approvals, and next actions so I can keep work moving without constant manual follow-up.

**Platform layers that serve this persona:** Layer 2 (Client Operating Record), Layer 4 (Execution Spine), Layer 5 (Client Collaboration Surface), Layer 6 (Blocker Detection and Approvals Follow-up Agents).

---

### 2.3 Editor / Strategist

| Attribute | Detail |
| --------- | ------ |
| **Title** | Strategist, Content Strategist, Editor, Senior Social Media Specialist |
| **Reports to** | Agency Owner or Account Manager |
| **Workload** | Strategy, briefs, quality review, content direction, reporting narrative |
| **Technical skill** | Comfortable with analytics, AI tools, creative systems, and client context |
| **Daily tools** | Slides, docs, analytics tools, creative tools, AI assistants, brand guidelines |

**Goals:**
1. Produce recommendations grounded in client truth and agency standards.
2. Turn strategy into briefs that the delivery team can execute.
3. Keep brand, offer, audience, and compliance context visible while working.
4. Reduce revisions caused by unclear briefs or missing context.
5. Preserve strategic continuity across campaign cycles.

**Frustrations:**
1. "I have to reconstruct context before doing high-value strategy work."
2. "Generic AI gives fluent recommendations that are not defensible."
3. "Strategy often dies when execution starts."
4. "Briefs are edited repeatedly because the operating standard is implicit."
5. "Different team members interpret the same client context differently."

**Key JTBD:** When I am creating strategy, briefs, or client-facing recommendations, I want agency standards and client context assembled once so my output is specific, defensible, and ready for review.

**Platform layers that serve this persona:** Layer 1 (Agency OS Setup), Layer 2 (Client Operating Record), Layer 3 (Strategy Intelligence), Layer 6 (Governed Specialist Agents).

---

### 2.4 Client Stakeholder (Portal User)

| Attribute | Detail |
| --------- | ------ |
| **Title** | Marketing Manager, Business Owner, CMO, Brand Manager |
| **Relationship** | Paying client of the agency |
| **Technical skill** | Varies; portal must be clear without training |
| **Daily tools** | Email, Slack, phone, shared files |

**Goals:**
1. Know what the agency is doing without chasing updates.
2. Approve or request revisions with enough context to decide quickly.
3. See that the agency understands the brand and business.
4. Submit requests without losing them in message threads.
5. Feel like the agency is organized, premium, and proactive.

**Frustrations:**
1. "I do not know what I am supposed to approve or when."
2. "Reports and deliverables arrive in scattered channels."
3. "I have to ask for status too often."
4. "The approval process is inconsistent."
5. "The agency's work may be good, but the experience feels less polished than it should."

**Key JTBD:** When I am working with my agency, I want one polished place to review work, give decisions, and see progress so I trust the agency is organized and in control.

**Platform layers that serve this persona:** Layer 5 (Client Collaboration Surface).

---

## 3. Pain Point to Feature Mapping

| Pain Point | Persona(s) | Platform Feature | Layer |
| ---------- | ---------- | ---------------- | ----- |
| Agency standards live in the owner's head | Owner, Account Manager | Agency OS Setup | 1 |
| Client context is scattered | Owner, Account Manager, Editor / Strategist | Client Operating Record | 2 |
| Strategy disconnects from execution | Owner, Editor / Strategist | Strategy Intelligence pipeline | 3 |
| Briefs are under-specified | Editor / Strategist, Account Manager | Brief generation from approved context | 3, 4 |
| Approvals are chased manually | Account Manager, Client | Structured approval workflows | 4, 5 |
| Client requests lose context | Account Manager, Client | Portal request intake | 5 |
| Delivery risk is detected late | Owner, Account Manager | Blocker Detection Agent | 6 |
| AI output is generic | Owner, Editor / Strategist | Governed agents using agency and client context | 1, 2, 6 |
| Client experience feels fragmented | Owner, Client | Premium Client Collaboration Surface | 5 |
| Team handoffs lose knowledge | Owner, Account Manager | Client Operating Record as system of record | 2 |

---

## 4. Jobs to Be Done - Comprehensive Table

| # | Job Statement | Context / Trigger | Desired Outcome | Platform Layer | Primary Persona |
| - | ------------- | ----------------- | --------------- | -------------- | --------------- |
| J01 | Encode our agency's delivery model into a system | Team is serving multiple active clients | Team members follow the same playbooks without constant owner intervention | Layer 1 | Owner |
| J02 | Onboard a live client into a durable record | New or existing client needs structured operating context | Client is strategy-ready without repeated intake work | Layer 2 | Account Manager |
| J03 | Understand a client's current marketing state before recommending changes | Strategy cycle begins | Diagnosis surfaces opportunities, risks, and missing context | Layer 3 | Editor / Strategist |
| J04 | Produce a strategy the team can execute | Diagnosis is ready for review | Strategy converts into briefs, tasks, and approval checkpoints | Layer 3, 4 | Editor / Strategist |
| J05 | Create work from approved context | Brief is ready | Output passes review faster because standards are explicit | Layer 3, 6 | Editor / Strategist |
| J06 | Review and approve deliverables without channel hopping | Work is ready for client decision | Decision is captured with comments, history, and status | Layer 5 | Client |
| J07 | Know the status of all assigned clients | Weekly planning or urgent triage | Dashboard shows state, blockers, and next actions | Layer 4 | Account Manager, Owner |
| J08 | Generate client reports without manual assembly | Reporting cycle | Report connects performance, decisions, and next actions | Layer 4, 6 | Account Manager |
| J09 | Keep AI inside agency and client guardrails | Agent output is generated | No client-facing output bypasses review or context rules | Layer 6 | Owner, Editor / Strategist |
| J10 | Scale client capacity without proportional chaos | Agency adds clients or team members | Operating leverage increases while quality stays consistent | Layer 1, 4, 6 | Owner |
| J11 | Preserve continuity when work changes hands | Team member is unavailable or client changes stage | Context and decisions remain visible in the record | Layer 2 | Owner, Account Manager |
| J12 | Follow up on stalled approvals | Decision deadline is missed | Follow-up and escalation happen without manual tracking | Layer 6 | Account Manager |
| J13 | Present the agency professionally to every client | Client logs into the portal | Portal reinforces trust and premium service perception | Layer 5 | Owner, Client |
| J14 | Review source context behind AI output | AI recommendation is under review | Reviewer can see evidence, assumptions, and gaps | Layer 3, 6 | Editor / Strategist |
| J15 | Standardize premium delivery across 5-25 clients | Agency is operating at Tier 2 scale | The same operating system governs every active client | All | Owner |

---

## 5. Persona Journey Maps

### 5.1 Agency Owner - First 30 Days on SMMAHUB

| Day | Activity | Emotional State | Platform Touchpoint |
| --- | -------- | --------------- | ------------------- |
| 1 | Completes guided strategy audit or demo and starts agency setup | Skeptical but commercially serious | Layer 1: Agency OS Setup |
| 1-3 | Defines services, playbooks, quality bar, approval rules | Evaluating whether the system respects agency depth | Layer 1: Operating model configuration |
| 3-5 | Invites account manager and editor / strategist | Focused on team adoption | Layer 1: Team management |
| 5-7 | Connects a live client as the pilot operating record | Critical evaluation phase | Layer 2: Client Operating Record |
| 7-10 | Runs readiness audit and reviews gaps | Testing whether the system sees real operational risk | Layer 3: Readiness |
| 10-15 | Reviews generated strategy and brief | Comparing AI quality against agency standards | Layer 3 and Layer 6 |
| 15-20 | Routes work through approval | Looking for less chasing and fewer lost decisions | Layer 4 and Layer 5 |
| 20-30 | Reviews portal experience and operating leverage | Deciding whether to expand usage across more clients | Layer 5 and Layer 4 |

**Critical moment:** Days 7-15. If readiness, strategy, and brief quality feel generic, the owner will not trust the operating-system promise.

### 5.2 Account Manager - Typical Week

| Day | Morning | Afternoon | Platform Touchpoints |
| --- | ------- | --------- | -------------------- |
| Mon | Review cross-client state and blockers | Follow up on stalled approvals | Layer 4 dashboard, Layer 6 follow-up |
| Tue | Prepare for client calls from operating records | Update records with new decisions | Layer 2, Layer 5 |
| Wed | Review briefs and route approvals | Handle client requests | Layer 4, Layer 5 |
| Thu | Coordinate editor / strategist handoffs | Check strategy and task traceability | Layer 3, Layer 4 |
| Fri | Review reports and next actions | Publish client-facing summaries | Layer 4, Layer 5, Layer 6 |

---

## 6. Persona Prioritization

| Priority | Persona | Rationale |
| -------- | ------- | --------- |
| P0 | Agency Owner | Buyer and operating-standard owner. If this persona does not trust the depth, the product fails. |
| P0 | Account Manager | Primary daily operator. Usage depends on reducing status hunting, chasing, and handoff friction. |
| P1 | Editor / Strategist | High-leverage expert user whose output proves whether AI and context are truly governed. |
| P1 | Client Stakeholder | Portal user. Client-facing quality drives retention and perceived agency premium. |

See [04-value-proposition](04-value-proposition-and-messaging.md) for messaging tailored to each persona's priorities and language.

---

## 7. Unserved and Underserved Needs

These are needs that existing tools do not adequately address for Tier 2 operating agencies.

| Need | Current State | Why Unserved | SMMAHUB Solution |
| ---- | ------------- | ------------ | ---------------- |
| Strategy-to-execution traceability | Strategy in slides, execution in project tools, no link | No tool connects strategic artifacts to delivery state | Layer 3 output feeds Layer 4 tasks and approvals |
| Brand governance across many clients | PDFs and memory | Brand tools serve single-brand teams more naturally than agencies | Layer 1 and Layer 2 govern per-client context |
| Premium client-facing approvals | Email, Slack, ad-hoc comments | Portal tools often lack strategy and context | Layer 5 approvals connect to briefs, status, and history |
| Governed AI for agencies | Generic assistants with no operating context | AI tools do not encode agency playbooks or approval rules | Layer 6 agents bounded by Layer 1 and Layer 2 |
| Durable client operating records | Static CRM notes or scattered documents | CRMs track contacts, not delivery truth | Layer 2 enriches with every source, decision, and approval |
| Cross-client operational visibility | Spreadsheets or manual dashboards | Project tools show tasks without agency-level operating context | Layer 4 shows state, blockers, and next actions |

See [03-market-landscape](03-market-landscape-and-positioning.md) for detailed analysis of why each competitor category fails to address these needs.

---

*This document is updated quarterly based on user research, support conversations, and advisory board feedback. Persona definitions must remain aligned with [00-ICP-AND-POSITIONING](../00-ICP-AND-POSITIONING.md).*
