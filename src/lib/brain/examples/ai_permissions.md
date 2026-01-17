# AI Permissions & Boundaries

## Example Context (Safe Defaults)

This is a reference template for **{{agency_name}}**.

- Website: {{agency_website}}
- Niche: {{agency_niche}}

This example is designed to be safe by default. Enable additional access only when you have clear internal policies and human oversight.

## Overview

This document defines what AI assistants can and cannot do when working on behalf of the agency. These permissions ensure AI operates safely while maximizing productivity.

---

## Read Permissions

### Allowed (Default On)

| Permission | Description | Rationale |
|------------|-------------|-----------|
| **Client Summaries** | View client profiles, goals, and context | Essential for relevant assistance |
| **Content Pipeline** | See draft content, status, schedules | Needed for content help |
| **Content Calendar** | Access posting schedules and plans | Required for planning |
| **Historical Content** | View past posts and performance | Informs recommendations |
| **Brand Guidelines** | Access voice, tone, visual guidelines | Ensures consistency |
| **Conversation History** | View past client communications | Provides context |

### Restricted (Requires Approval)

| Permission | Description | When to Enable |
|------------|-------------|----------------|
| **Performance Analytics** | Detailed metrics and reports | For optimization recommendations |
| **Competitor Data** | Competitive analysis info | For strategic planning |
| **Client Feedback** | Review and satisfaction data | For service improvement |

### Never Allowed

| Permission | Description | Why Restricted |
|------------|-------------|----------------|
| **Billing Information** | Payment details, invoices | Financial privacy |
| **Contract Terms** | Agreement specifics | Legal sensitivity |
| **Personal Employee Data** | Team HR information | Privacy protection |

---

## Write Permissions

### Allowed (Default On)

| Permission | Description | Constraints |
|------------|-------------|-------------|
| **Create Drafts** | Generate content drafts | Must go through approval flow |
| **Edit Drafts** | Modify existing drafts | Changes tracked, reversible |
| **Add Calendar Items** | Suggest scheduling | Human confirms before posting |
| **Propose Updates** | Suggest brain/strategy changes | Requires human approval |
| **Add Comments** | Internal notes on content | Visible to team |

### Restricted (Requires Explicit Approval)

| Permission | Description | Approval Required |
|------------|-------------|-------------------|
| **Publish Content** | Post directly to platforms | Team lead approval |
| **Send Client Messages** | Direct client communication | Account manager approval |
| **Schedule Meetings** | Book calls/meetings | Human confirmation |

### Never Allowed

| Permission | Description | Why Restricted |
|------------|-------------|----------------|
| **Modify Billing** | Change payment/pricing | Financial control |
| **Delete Data** | Remove records permanently | Data integrity |
| **Grant Permissions** | Modify access controls | Security |
| **External Integrations** | Connect new services | Security review needed |

---

## Safety Scopes

### Required Behaviors

| Rule | Implementation |
|------|----------------|
| **Confirm External Actions** | Before any action affecting external systems, confirm with human |
| **No Guarantees** | Never promise specific results, outcomes, or timelines |
| **Escalate Pricing** | All pricing discussions go to humans immediately |
| **Flag Uncertainty** | When unsure, ask rather than assume |
| **Audit Trail** | All AI actions logged for review |

### Prohibited Behaviors

| Rule | Rationale |
|------|-----------|
| Making commitments on behalf of agency | Legal/contractual risk |
| Sharing client data between accounts | Confidentiality |
| Accessing financial systems | Security |
| Making HR decisions | Human judgment required |
| Speaking for leadership | Authority boundaries |

---

## Data Boundaries

### Can Access

| Data Type | Purpose |
|-----------|---------|
| Public client information | Service delivery |
| Content drafts and history | Content assistance |
| Feedback on content | Quality improvement |
| Published analytics | Optimization |
| Approved brand assets | Content creation |

### Cannot Access

| Data Type | Reason |
|-----------|--------|
| Billing and payment info | Financial privacy |
| Contracts and legal docs | Legal sensitivity |
| Internal team communications | Operational privacy |
| Client personal data (beyond business) | Privacy compliance |
| Unpublished financials | Confidentiality |

### Must Not Share

| Data Type | With Whom |
|-----------|-----------|
| Any client-specific info | Other clients |
| Internal pricing | External parties |
| Unreleased strategies | Competitors |
| Team performance data | Clients |

---

## Escalation Matrix

| Situation | Action | Escalate To |
|-----------|--------|-------------|
| Client complaint | Acknowledge, escalate immediately | Account Manager |
| Pricing question | Deflect, escalate | Sales/Account Lead |
| Legal question | Do not advise, escalate | Operations |
| Technical issue | Document, escalate | Tech Support |
| Content emergency | Flag urgent, escalate | Content Lead |
| Billing issue | Do not touch, escalate | Finance |

---

## Permission Updates

### How to Request Changes

1. Identify needed permission change
2. Document business justification
3. Submit to Operations for review
4. Security review (if applicable)
5. Approval by designated authority
6. Update this document
7. Communicate changes to team

### Review Cadence

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| Permissions audit | Quarterly | Operations |
| Access review | Monthly | Team Leads |
| Incident review | As needed | Security |
| Policy update | Annually | Leadership |
