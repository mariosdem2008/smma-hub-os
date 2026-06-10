# 02 User Problems Personas JTBD

| Related | [00-ICP-AND-POSITIONING](00-ICP-AND-POSITIONING.md), [01-product-vision](01-product-vision.md), [09-core-user-flows](09-core-user-flows.md), [14-mvp-scope](14-mvp-scope.md) |

This document describes only the locked Tier 2 ICP: operating agencies with 5-25 active clients, EUR15k-EUR100k/month revenue, and 2-10 person teams. It does not include non-operating agency profiles or getting-started use cases.

## 1. Core User Groups

| Persona | Primary concern | Product value |
|---|---|---|
| Agency owner | Consistency, leverage, margin, trust | Encode the agency model and reduce owner bottlenecks |
| Strategist | Better inputs and stronger recommendations | Generate grounded strategy from durable context |
| Account manager | Workflow clarity and client coordination | Track state, approvals, blockers, and next actions |
| Editor / strategist | Clear briefs and fewer rewrites | Produce governed drafts and strategic outputs from approved rules |
| Client stakeholder | Low-friction visibility and approvals | Review work, request changes, and understand status |

## 2. User Problems

### 2.1 Agency owner

- Agency knowledge lives in the founder's head.
- Team quality varies by account manager or creator.
- Client onboarding is expensive to repeat.
- Tool sprawl obscures what the team is actually doing.

### 2.2 Strategist

- Inputs are incomplete or stale.
- Brand and offer context are scattered across files and messages.
- Generic AI generates polished but weak recommendations.
- Strategy often dies as soon as execution starts.

### 2.3 Account manager

- Status is hard to explain with confidence.
- Approvals are fragmented across channels.
- Client requests arrive as unstructured messages.
- Blockers are discovered too late.

### 2.4 Editor / strategist

- Briefs are vague or inconsistent.
- Brand rules are implicit instead of explicit.
- Review cycles cause repetitive edits.
- Compliance-sensitive outputs are risky to draft.

### 2.5 Client stakeholder

- The agency process feels opaque.
- Approvals are time-consuming and confusing.
- It is hard to know what is waiting on them.
- Requests disappear into email and chat threads.

## 3. Jobs To Be Done

| Persona | Functional JTBD | Emotional JTBD |
|---|---|---|
| Agency owner | Standardize delivery across clients | Feel in control without reviewing everything personally |
| Strategist | Turn client truth into an actionable plan | Trust that recommendations are defensible |
| Account manager | Move work forward with less chasing | Feel organized and credible in front of clients |
| Editor / strategist | Produce work that passes review faster | Feel clear about the target and quality bar |
| Client stakeholder | Review and request work without friction | Feel confident the agency is organized and proactive |

## 4. Design Implications

- The product should store agency truth and client truth as durable records.
- Strategy should be reviewable, not a one-shot generation event.
- Workflow status should be visible to internal and external users.
- AI should reduce ambiguity, not introduce it.
- Client interactions should feel premium, structured, and low-friction.
