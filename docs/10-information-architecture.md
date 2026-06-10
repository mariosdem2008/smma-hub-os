# 10 Information Architecture

| Related | [09-core-user-flows](09-core-user-flows.md), [11-ui-ux-design-system](11-ui-ux-design-system.md), [17-data-entities-high-level](17-data-entities-high-level.md) |

## 1. IA Goal

The product structure should mirror the operating model: agency truth, client truth, governed work, approvals, and collaboration.

## 2. Top-Level Navigation

| Area | Purpose |
|---|---|
| Dashboard | Cross-workspace health, blockers, and next actions |
| Agency OS | Services, standards, packs, policies, team settings |
| Clients | Client records, status, strategy, execution, approvals |
| Work | Tasks, briefs, dependencies, review queues |
| Portal | Client-facing requests, approvals, files, and updates |
| AI Ops | Agent runs, evaluations, audit trails, exceptions |
| Billing and Admin | Subscription, workspace, access, integrations |

## 3. Client Workspace Structure

| Section | Primary contents |
|---|---|
| Overview | Status, goals, risk signals, next actions |
| Operating record | Business, brand, offer, audience, approvals |
| Sources | Documents, transcripts, uploads, provenance |
| Strategy | Readiness, diagnoses, briefs, revisions |
| Execution | Tasks, briefs, schedules, blockers |
| Approvals | Pending, approved, blocked, history |
| Collaboration | Client comments, requests, files |
| Audit | AI runs, decisions, changes |

## 4. Agency OS Structure

| Section | Primary contents |
|---|---|
| Identity and positioning | Agency profile and ICP |
| Services and offers | Commercial model and delivery units |
| Standards | Voice, quality, anti-patterns, SOPs |
| Governance | Approval matrix, risk policy, escalation rules |
| Subject packs | Draft, active, archived pack inventory |
| Team and roles | Internal users and permissions |

## 5. IA Rules

- Distinguish internal agency areas from client-facing areas.
- Keep strategy adjacent to sources and execution, not isolated.
- Make approvals reachable from any blocked workflow.
- Make AI activity inspectable without exposing prompt noise as primary UI.
