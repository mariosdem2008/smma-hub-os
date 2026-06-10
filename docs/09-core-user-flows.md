# 09 Core User Flows

| Related | [10-information-architecture](10-information-architecture.md), [16-technical-architecture](16-technical-architecture.md), [21-launch-acceptance-criteria](21-launch-acceptance-criteria.md) |

## 1. Flow Design Rule

Every core flow should move through the same control chain:

**source of truth -> governed context -> generation or action -> grading -> approval -> collaboration -> audit**

## 2. Primary Flows

| Flow | Primary user | Outcome |
|---|---|---|
| Agency setup | Owner | Agency operating model is encoded |
| Client onboarding | Strategist or manager | Strategy-ready client record exists |
| Strategy generation | Strategist | Governed strategy brief is produced |
| Execution planning | Manager or strategist | Work is converted into briefs, tasks, and dependencies |
| Content production | Creator | Brand-safe draft is created from approved brief |
| Approval handling | Manager or client | Decision is recorded and state advances |
| Client request intake | Client stakeholder | Request becomes structured work |
| Reporting and follow-up | Owner or manager | Performance summary and next actions are captured |

## 3. Agency Setup Flow

1. Create agency workspace.
2. Define services, offers, positioning, and approval model.
3. Ingest agency operating sources.
4. Create and approve baseline agency packs.
5. Confirm readiness for live client onboarding.

## 4. Client Onboarding Flow

1. Create client record.
2. Capture business, offer, brand, audience, and channel context.
3. Upload and ingest source documents.
4. Resolve missing fields or source conflicts.
5. Produce a strategy-ready operating record and active client pack.

## 5. Strategy-To-Execution Flow

1. Assemble agency, client, offer, and workflow packs.
2. Retrieve relevant approved sources.
3. Generate a strategy brief.
4. Grade the brief and route for review.
5. Approve or revise the brief.
6. Convert approved strategy into execution briefs, tasks, and dependencies.

## 6. Content Production Flow

1. Start from an approved strategy or content brief.
2. Select required channel, compliance, and workflow packs.
3. Retrieve source evidence and brand constraints.
4. Generate draft output.
5. Grade, review, and approve as required.
6. Promote approved work into collaboration or downstream execution.

## 7. Client Collaboration Flow

1. Client receives an approval item, request form, or status update.
2. Client reviews supporting context and due date.
3. Client submits a decision, comment, or request.
4. The system records the outcome, updates state, and triggers follow-up work.

## 8. Flow Quality Rules

- Every flow should expose current status.
- Every blocked step should explain why.
- Every approval should retain history.
- Every important artifact should point back to sources and pack versions.
