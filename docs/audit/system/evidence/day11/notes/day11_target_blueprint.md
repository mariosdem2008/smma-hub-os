# Day 11 Target Product Blueprint

Date: 2026-03-06

## Objective
Define the exact target behavior for a high-quality launch-ready SMMAHUB across agency onboarding, client lifecycle, portal, AI surfaces, and billing/integrations.

## Target User Outcomes
1. New agency owner can complete signup -> agency creation -> onboarding -> dashboard activation without support.
2. Invited agency member can accept invite, select tenancy, and operate within role boundaries.
3. Client portal user can authenticate and complete approvals/messages/content interactions with clear status feedback.

## Core Product Contracts
1. Agency onboarding contract
   - Entry: `/ai/onboarding/agency`
   - Backend: `ai-onboarding`
   - Completion guarantees: onboarding status complete, prompt cache invalidated, workspace activation path available.
2. Client onboarding contract
   - Entry: `/onboarding/client/:clientId`
   - Persistence: `client_onboarding_profiles`
   - Completion path: `complete_onboarding_profile` RPC, then strategy pipeline readiness.
3. Billing contract
   - Entry: `/pricing`, `/billing`, `/billing/overview`
   - Integration: `create-checkout`, `customer-portal`, `check-subscription`, `stripe-webhook`.

## UX Quality Bar
1. Every critical screen has deterministic `loading`, `empty`, `error`, `success` states.
2. No dead-end navigation states in core routes.
3. User-facing errors are actionable and role-appropriate.
4. Page-level performance remains acceptable under realistic data volumes.

## Integration Quality Bar
1. Every frontend-invoked edge function exists and is deployable.
2. Every external callback path has explicit failure and recovery UX.
3. All cross-tenant and role boundaries are test-backed.

## Known Gap to Resolve for Launch
1. Frontend invokes `generate-brand-guidelines-pdf` without matching function directory.

## Acceptance Conditions for Launch Readiness
1. P0 blockers resolved and retested.
2. Core agency + client + portal journeys pass E2E evidence checklist.
3. Billing and external integrations validated in staging with callback outcomes.
4. No unresolved high-severity contract mismatches.
