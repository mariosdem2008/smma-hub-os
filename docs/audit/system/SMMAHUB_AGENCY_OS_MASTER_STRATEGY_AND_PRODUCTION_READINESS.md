# SMMAHUB Agency OS Master Strategy and Production Readiness

Last updated: 2026-03-12  
Owner: Product strategy + AI systems  
Status: Decision-grade master document  
Purpose: Define what SMMAHUB is actually building, what promise it can credibly make, what must exist before premium launch, and when it is truly ready to sell as an AI employee / agency operating system for $300-$999/month.

## 1) Executive Decision

SMMAHUB should be built and sold as an **agency operating system with an AI employee layer**, not as a standalone onboarding product and not as a generic AI assistant.

The product promise that can justify premium monthly pricing is:

1. SMMAHUB becomes the agency's operating layer for context, delivery coordination, approvals, client collaboration, and AI-assisted execution.
2. The AI does not just answer questions. It reasons from persistent agency and client memory, follows rules, proposes actions safely, and improves team output quality.
3. The system reduces owner oversight across the full client lifecycle: intake, setup, strategy, production, approvals, reporting, and retention.

Current repo reality:

1. The foundation is strong.
2. Workflow reliability is materially ahead of many early-stage products.
3. The product is not yet at the level where an agency should view it as a true employee replacement or pay top-end premium pricing with high trust.

Bottom line:

1. This is already a credible SaaS foundation.
2. It is not yet a category-winning "AI employee for agencies."
3. You should not launch the full premium promise until the product proves ongoing operator value after onboarding, not just clean setup flows.

## 2) What This Repo Is Actually Building

After reviewing the repo, audits, routes, AI stack, and workflow evidence, SMMAHUB is not one product. It is a stack with these layers:

### 2.1 Commercial surface

1. Agency auth, bootstrap, welcome, team, billing, pricing, settings.
2. Client creation, onboarding, client detail workspace, client portal.
3. Upgrade and plan mechanics already exist in-product.

### 2.2 Delivery operating surface

1. Client detail workspace includes strategy, pipeline, idea/scripting, calendar, library, tasks, portal, overview, analytics, ads, reports, brand, social, and uploads.
2. Client portal includes approvals, calendar, performance, ideas, assets, branding, social, uploads, messages, and AI assistant routes.
3. Dashboard tracks workload, approvals, overdue items, and revenue-risk-like operational signals.

### 2.3 AI system surface

1. Agency onboarding AI.
2. Client onboarding AI.
3. Strategy generation.
4. AI assistant / AI rep chat / admin chat.
5. Brain documents, ingestion, retrieval, embeddings, memory items, usage logging, budgets, rate limits, quality gates, and deep workflow audits.

### 2.4 Key repo truth

The product intent is already much bigger than "AI onboarding":

1. [App.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/App.tsx) shows a route map for agency ops, client ops, client portal, billing, AI setup, and AI admin.
2. [SMMAHUB_ROUTE_WORKFLOW_ATLAS.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_ROUTE_WORKFLOW_ATLAS.md) frames the app as a full route/workflow system, not a single-feature product.
3. [SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md) proves the client operating workspace is central to the product.
4. [router.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/router.ts), [taskRegistry.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/taskRegistry.ts), [brainResolver.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/brainResolver.ts), and [durableExecutor.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/durableExecutor.ts) show the intended architecture is agentic, schema-driven, memory-backed, and tool-oriented.

## 3) The Correct Business Idea

### 3.1 Product thesis

SMMAHUB should be positioned as:

**The operating system for modern service agencies that want one place for client truth, execution flow, approvals, and an AI employee that understands how the agency works.**

That is stronger and more credible than:

1. "AI onboarding software"
2. "AI chatbot for agencies"
3. "Strategy generator"

### 3.2 Why this positioning is correct

Official market positioning from current tools supports this:

1. Teamwork frames client onboarding as a managed transition into delivery, with milestones, expectations, ownership, and go-live, not just intake.
2. HoneyBook frames onboarding questionnaires as one part of a broader client experience and recommends keeping them short.
3. HubSpot promotes progressive profiling, meaning strong systems collect data over time rather than forcing everything up front.
4. Assembly/Copilot positions value around client portal workflows, forms, files, messaging, billing, and onboarding.
5. HighLevel positions value around all-in-one capture, nurture, communication, automation, client management, and AI features.

Implication:

Agencies pay premium money for workflow consolidation, lower coordination overhead, and durable client operating leverage. They do not pay premium money for intake alone.

## 4) The Promise SMMAHUB Must Make

SMMAHUB should make only promises that can be proven in product.

### 4.1 Core product promise

1. SMMAHUB gives agencies one operating system for client setup, ongoing delivery, approvals, communication, reporting, and AI-assisted execution.
2. SMMAHUB stores persistent agency and client context so AI recommendations are grounded in real business constraints.
3. SMMAHUB helps agencies operate with more consistency, less owner intervention, and better client-facing professionalism.

### 4.2 AI employee promise

The AI employee promise must be defined narrowly and concretely:

1. It can understand agency rules, positioning, quality bar, permissions, and escalation limits.
2. It can understand each client's goals, offers, audience, constraints, and current delivery state.
3. It can draft, prioritize, summarize, recommend, and assist execution safely.
4. It can propose actions, but high-risk writes remain gated by permissions and approval rules.
5. It does not replace the owner's judgment in every edge case; it reduces routine cognitive load and increases execution quality.

### 4.3 Promise constraints

Do not promise:

1. full autonomy without supervision
2. senior-strategist quality in all cases before measured proof exists
3. universal one-shot strategy quality from minimal context
4. premium pricing parity with elite agency software unless the downstream operating value is already visible

## 5) Current Repo Reality vs Target Promise

### 5.1 What is already strong

Based on repo audits and workflow evidence:

1. Core workflow reliability is strong.
2. Agency onboarding, client onboarding, client detail, portal, billing, integrations, and AI surfaces have meaningful E2E evidence.
3. The app already has serious structure for guarded routes, tenant-aware data, RLS, edge functions, AI logs, and test coverage.
4. The product already has real surface area for operating work, not just setup.

Internal evidence:

1. [SMMAHUB_LAUNCH_READINESS_PACKAGE.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_LAUNCH_READINESS_PACKAGE.md) recorded a repo-level GO decision for the audited scope.
2. [SMMAHUB_WF_CLIENT_ONBOARDING_DEEP_AUDIT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_WF_CLIENT_ONBOARDING_DEEP_AUDIT.md) shows current client onboarding is operationally strong.
3. [SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md) shows the client workspace and AI quick actions are live and validated.

### 5.2 What is still not true

The repo itself also shows why the premium promise is not fully earned yet:

1. [SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md) explicitly says the system is valuable for operational acceleration, but not yet premium strategic delegation.
2. [A0_EXECUTIVE_SUMMARY.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audits/A0_EXECUTIVE_SUMMARY.md) shows unresolved architecture and context-source inconsistencies.
3. [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md) and [11_CLIENT_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/11_CLIENT_BRAIN_CURRENT_AND_TARGET.md) show the knowledge system is real, but still split and not fully unified.
4. [08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md) shows guardrails, prompts, logging, and retrieval are not yet perfectly unified across endpoints.

### 5.3 Honest maturity score

Current business maturity for the intended premium promise:

1. Workflow and app foundation: 8.5/10
2. Client operating workspace: 8.0/10
3. AI memory architecture direction: 7.5/10
4. AI strategic depth and judgment: 6.0/10
5. Premium "AI employee" readiness: 6.5/10

Verdict:

This is a strong foundation with real product depth, but not yet a fully trusted AI operator platform.

## 6) What Agencies Actually Pay For

### 6.1 Recurring pain points that premium software solves

Current agency/service-business tooling consistently optimizes for:

1. fragmented client communication
2. delayed approvals
3. asset collection chaos
4. onboarding inconsistency
5. scattered context across docs, chat, and meetings
6. delivery bottlenecks
7. reporting overhead
8. too much owner review and intervention

### 6.2 What this means for SMMAHUB

Agencies will pay $300-$999/month only if SMMAHUB reduces one or more of these every week:

1. hours spent chasing approvals
2. hours spent rewriting briefs or reminding team members of account context
3. time lost searching across Slack, Notion, Google Drive, email, and dashboards
4. quality inconsistency between team members
5. delay between onboarding and production
6. retention risk caused by weak client communication and low operational visibility

### 6.3 Pricing-reality benchmark

Official market references show agencies already pay for workflow operating systems:

1. HighLevel markets agency plans and AI employee capabilities from an all-in-one position.
2. ManyRequests prices around the client portal / requests / approvals / billing value stack.
3. Copilot/Assembly sells the combined client portal, forms, messaging, billing, and workflow experience.

Implication:

Your target price band is credible only if SMMAHUB behaves like a consolidated operating layer, not a polished questionnaire plus some AI helpers.

## 7) The Product Definition That Can Earn $300-$999/Month

SMMAHUB becomes premium-worthy when it has all of these:

### 7.1 System of record

1. The agency has one durable source of truth for agency rules, client profile, constraints, decisions, approvals, and history.
2. Memory is not split in ways that create contradictory behavior.
3. The team can understand why the AI made a recommendation.

### 7.2 Daily operating utility

1. Team members use it every day, not only at setup.
2. It shortens execution loops across strategy, content, approvals, and reporting.
3. It becomes the default place to review account context and next actions.

### 7.3 High-trust AI assistance

1. AI proposes useful next actions in the right context.
2. AI outputs reference known business constraints and account history.
3. AI writes and recommendations are safe, explainable, and reversible where needed.

### 7.4 Client collaboration value

1. Clients experience a clean portal for approvals, messages, and visibility.
2. Agencies reduce client-chaos overhead.
3. Client-facing interactions reinforce professionalism instead of exposing internal complexity.

### 7.5 Administrative consolidation

1. Billing, subscriptions, invites, and workflow administration are coherent.
2. Core operating tasks do not require bouncing across five tools.

## 8) Must-Have Capability Matrix Before Premium Launch

These are the non-negotiables.

### 8.1 Agency foundation

Must have:

1. agency onboarding that captures business model, positioning, pricing, process, QA standards, permissions, and escalation rules
2. modular agency brain with approved modules as the authoritative AI source
3. default brain-pack seeding and repair that is transparent and reliable

Current status:

1. Largely present in architecture
2. Still needs source-of-truth unification between `agency_brains` and `brain_documents`

### 8.2 Client foundation

Must have:

1. fast client intake with progressive enrichment
2. client brain that becomes usable deterministically and blocks unsafe strategy generation when incomplete
3. onboarding that captures both strategy facts and operating constraints

Current status:

1. Strong baseline
2. Still under-collects operating reality
3. Still asks too much in first-session intake

### 8.3 Strategy and execution

Must have:

1. strategy generation grounded in onboarding + agency memory + client memory + retrieval context
2. task, pipeline, and calendar actions that save time for operators
3. AI outputs that are directly usable, not only inspirational

Current status:

1. Strong base already exists in client detail
2. Strategic depth and consistency still need work

### 8.4 Approvals and collaboration

Must have:

1. clean approvals flow for clients
2. clear status visibility for pending feedback and overdue review states
3. messages, assets, and approvals tied to the same client operating space

Current status:

1. Present and validated at workflow level
2. Needs stronger commercial packaging as a core value driver

### 8.5 Agentic system layer

Must have:

1. schema-first task execution
2. retrieval with tenant-safe provenance
3. durable execution/checkpointing for multi-step plans
4. permission-aware tools
5. approval gates on sensitive writes
6. observability and evals tied to real workflows

Current status:

1. The repo clearly aims here
2. Not all endpoints are yet unified behind the same guardrail/execution path
3. Durable executor exists, but the repo does not yet prove mature end-to-end agentic action orchestration across the full product

### 8.6 Trust, security, and supportability

Must have:

1. zero cross-tenant leakage
2. human-safe errors
3. no silent failures in critical AI journeys
4. run logs, usage logs, budgets, and traceability for all important AI surfaces

Current status:

1. Strong focus already exists
2. Must remain launch-blocking and non-negotiable

## 9) What Is Missing to Become a Real "AI Employee"

### 9.1 Knowledge-source unification

The biggest internal architecture gap is that agency context still has multiple conceptual sources.

Required decision:

1. `brain_documents` becomes the authoritative editable source for the agency brain
2. any monolithic JSON layer becomes derived, cached, or deprecated

Without this, the AI employee promise stays weaker than it sounds.

### 9.2 Ongoing operator intelligence

Right now, the strongest proven capability is setup + generation.

For premium positioning, the system must also be strong at:

1. reminding what matters now
2. detecting blockers
3. prioritizing tasks
4. surfacing stale approvals
5. highlighting performance anomalies
6. recommending next best action per client

This is how the AI becomes operational, not just generative.

### 9.3 Better operating-context capture

Current onboarding still under-captures:

1. stakeholder map
2. approval owner
3. timelines and launch windows
4. access readiness
5. compliance risk
6. client-side capacity and dependencies
7. commercial realities and success thresholds

### 9.4 Output quality bar

To be perceived as employee-grade, AI must consistently show:

1. context recall
2. business reasoning
3. recommendation relevance
4. non-generic drafts
5. confidence-aware clarification

This is still a meaningful gap in the current audits.

## 10) What Production Means for This Product

For SMMAHUB, "production ready" cannot mean only:

1. the app builds
2. routes load
3. onboarding completes

It must mean:

1. the system is safe enough for daily use
2. the system is valuable enough to justify retention
3. the system is reliable enough that agencies can operationally depend on it
4. the AI quality is good enough that outputs reduce oversight rather than create more review work

## 11) Production Readiness Gates

These are the gates that should decide launch.

### 11.1 Product reliability gates

All must pass:

1. critical E2E flows green
2. zero P0/P1 workflow regressions
3. no silent AI failures in critical paths
4. request failures in deep runs = 0 for certification packs
5. console errors = 0 for certification packs

Required critical flows:

1. signup -> agency create -> agency onboarding -> dashboard
2. client create -> client onboarding -> strategy generation -> client detail
3. client portal invite -> login -> approvals/messages/AI surfaces
4. billing portal + checkout + plan state transitions
5. social/reporting/integration runtime checks

### 11.2 AI quality gates

All must pass:

1. golden-set onboarding quality >= 8.5/10
2. question-intent handling >= 90%
3. suggestion relevance >= 85%
4. strategy readiness after onboarding >= 90%
5. factual grounding / provenance requirements enforced for retrieval-backed flows

### 11.3 Agentic safety gates

All must pass:

1. all tool calls scoped by tenant and permission model
2. approval-required writes cannot bypass approval path
3. memory writes have review policy where needed
4. traceability exists for planner, executor, tool call, and result state
5. durable execution failure paths are observable and recoverable

### 11.4 Commercial readiness gates

All must pass:

1. agencies can understand the value proposition in under 2 minutes
2. onboarding-to-first-value time is low enough for a live agency trial
3. at least one weekly-use workflow is clearly better inside SMMAHUB than outside it
4. the system replaces enough existing workflow friction to justify retention

## 12) Pricing Readiness Framework

The right question is not "Can we technically charge this?" It is "What level of value is credible at each price?"

### 12.1 $300/month readiness

Credible only if:

1. onboarding, client detail, portal, billing, and core AI flows are stable
2. agencies can centralize intake, context, approvals, and some execution support
3. the product clearly saves admin time every week

Best fit:

1. smaller agencies
2. founder-led teams
3. agencies replacing scattered docs/forms/portal tools

### 12.2 $500/month readiness

Credible only if $300 criteria are true plus:

1. AI outputs are reliably useful across strategy, prioritization, and client operations
2. agency brain and client brain behavior are clearly better than simple templates
3. workflow consolidation is obvious enough to replace multiple tools or processes

Best fit:

1. growing agencies with delivery teams
2. agencies managing multiple active retainers

### 12.3 $999/month readiness

Credible only if $500 criteria are true plus:

1. the AI employee layer materially reduces owner review burden
2. the system produces high-trust recommendations from persistent context
3. operational intelligence is proactive, not only reactive
4. approvals, reporting, and task prioritization feel like a coordinated OS
5. at least several real clients use it successfully in production with retention proof

Verdict:

1. $300 can become credible earlier.
2. $500 needs stronger ongoing operating value.
3. $999 requires proof that the product behaves like a real operating layer, not a bundle of promising features.

## 13) Release Stages and When to Go Live

### Stage 1: Controlled release candidate

Definition:

1. current audited workflow stack is stable
2. first agencies can use onboarding, client workspace, portal, and core AI assists
3. positioning is "AI-assisted agency OS foundation"

Can charge:

1. low-to-mid entry pricing
2. not full premium AI employee pricing yet

### Stage 2: Premium workflow OS

Definition:

1. onboarding is faster and more consultative
2. memory sources are unified enough to be explainable
3. client collaboration and approvals are clearly differentiated
4. weekly operator workflows are materially easier in-product

Can charge:

1. around the lower-middle of your target premium range

### Stage 3: Trusted AI employee

Definition:

1. AI knows agency rules and client context reliably
2. AI assists planning, drafting, prioritization, and recommendations with high trust
3. multi-step agentic actions are safe, observable, and useful
4. production accounts show reduced owner intervention and improved team consistency

Can charge:

1. the upper end of the premium range

## 14) Recommended Implementation Priorities

### Priority 0: Stop ambiguity about the product

1. Position SMMAHUB as an agency OS with AI employee layer
2. Stop centering onboarding as the whole business idea
3. Make client operating value the commercial center

### Priority 1: Unify the brain architecture

1. make `brain_documents` the authoritative agency brain source
2. define exactly how `agency_brains` and `client_brains` are derived or used
3. expose provenance in AI outputs where relevant

### Priority 2: Improve client and agency data capture

1. trim first-session intake
2. add stakeholder/approval/timeline/access/compliance/commercial fields
3. move to progressive enrichment

### Priority 3: Build operator-grade AI behavior

1. stronger ambiguity handling
2. stronger recommendation reasoning
3. stronger context continuity
4. stronger account-specific prioritization

### Priority 4: Double down on daily-use workflows

1. approvals
2. task prioritization
3. content production and review loops
4. anomaly and bottleneck summaries
5. reporting with action recommendations

### Priority 5: Finish the agentic infrastructure path

1. unify tool governance
2. operationalize durable execution where multi-step plans matter
3. ensure write safety, auditability, and rollback/approval patterns

## 15) First Ideal Customer Profile for Live High-Paying Clients

Do not start with every agency.

Best first premium customers:

1. 5-25 person agencies
2. recurring retainer model
3. multiple active clients per month
4. already suffering from approval, handoff, context, and client-comms chaos
5. willing to adopt a client portal and structured ops process

Avoid as first premium target:

1. solo agencies with very low complexity
2. custom project shops with no repeatable process
3. agencies expecting unsupervised AI autonomy on day one

## 16) Definition of Done for the Premium Product Claim

You should claim "AI employee for agencies" only when all of this is true:

1. the system has a unified and trusted memory architecture
2. onboarding creates strategy-ready and operations-ready profiles
3. daily workflows in client detail and portal are genuinely useful
4. AI recommendations are context-aware, non-generic, and safe
5. tool-driven actions are permission-aware, traceable, and reversible when needed
6. agencies can point to real time saved and fewer coordination failures
7. pilot clients renew because the product becomes part of their operating rhythm

## 17) Final Verdict

SMMAHUB is building the right category, but the wrong part of the story has been carrying too much weight.

The correct story is not:

1. "we built AI onboarding"
2. "we built strategy generation"

The correct story is:

1. "we are building the operating system where agencies store context, run delivery, manage approvals, and use an AI employee that works from that context"

That vision is commercially strong.

This repo is already much closer to that vision than a typical early SaaS, because it already contains:

1. workflow depth
2. client operating surfaces
3. AI and memory architecture
4. portal and collaboration
5. billing and runtime infrastructure
6. serious audits and quality gating

But the premium promise is not earned until the product proves three things at the same time:

1. operational reliability
2. ongoing weekly value
3. trustworthy employee-grade AI behavior

That is the bar for the $300-$999/month product you want to launch.

## 18) Source Notes

### Internal repo sources

1. [README.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/README.md)
2. [App.tsx](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/App.tsx)
3. [A0_EXECUTIVE_SUMMARY.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audits/A0_EXECUTIVE_SUMMARY.md)
4. [SMMAHUB_PROMISE_CONTRACT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_PROMISE_CONTRACT.md)
5. [SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_BUSINESS_VALUE_REALITY_GAP_AND_TRANSFORMATION_PLAN.md)
6. [SMMAHUB_ROUTE_WORKFLOW_ATLAS.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_ROUTE_WORKFLOW_ATLAS.md)
7. [SMMAHUB_LAUNCH_READINESS_PACKAGE.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_LAUNCH_READINESS_PACKAGE.md)
8. [SMMAHUB_WF_CLIENT_ONBOARDING_DEEP_AUDIT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_WF_CLIENT_ONBOARDING_DEEP_AUDIT.md)
9. [SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/SMMAHUB_WF_CLIENT_DETAIL_DEEP_AUDIT.md)
10. [10_AGENCY_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/10_AGENCY_BRAIN_CURRENT_AND_TARGET.md)
11. [11_CLIENT_BRAIN_CURRENT_AND_TARGET.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/11_CLIENT_BRAIN_CURRENT_AND_TARGET.md)
12. [08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/docs/audit/system/08_AI_PROMPTS_CONTEXT_ASSEMBLY_AND_MEMORY.md)
13. [router.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/router.ts)
14. [taskRegistry.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/taskRegistry.ts)
15. [brainResolver.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/brainResolver.ts)
16. [durableExecutor.ts](C:/Users/mario/Desktop/SMMAHUB/smmahub/2/smma-hub-os/src/ai/durableExecutor.ts)

### External market and workflow sources

1. Teamwork client onboarding checklist: https://www.teamwork.com/templates/client-onboarding-checklist/
2. Teamwork client onboarding article: https://www.teamwork.com/blog/client-onboarding/
3. HoneyBook client onboarding questionnaire article: https://www.honeybook.com/blog/client-onboarding-questionnaire
4. HubSpot progressive fields / progressive profiling knowledge base: https://knowledge.hubspot.com/forms/create-forms-with-progressive-fields
5. Asana creative request intake template: https://asana.com/templates/creative-request
6. Asana approval request template: https://asana.com/templates/approval-request
7. Assembly client portal: https://assembly.com/client-portal
8. Copilot pricing: https://www.copilot.app/pricing
9. ManyRequests pricing: https://www.manyrequests.com/pricing
10. HighLevel pricing: https://www.gohighlevel.com/pricing
11. HighLevel AI employee: https://www.gohighlevel.com/ai-employee
