# SMMAHUB Technical Founder Audit — Verdicts and Actions
**Date:** 2026-06-10
**Type:** Current reality + executed fixes
**Method:** Full code-path tracing (4 parallel deep audits) + live production probing

## Executive summary

The codebase is substantially better than "messy 4-month foundation": the governed-AI architecture (activation gates, readiness scoring, artifact evaluations, multi-provider AI router, V2 strategy pipeline) is real and well-built. The failures are **wiring gaps**, not wrong foundations: configured intelligence that never reaches prompts, AI surfaces that silently run deterministic templates, and one severe security hole. Nothing required a rebuild from zero.

## Verdicts per system

| System | Verdict | Core finding |
|---|---|---|
| Security / tenant isolation | **Fix (SEV-1)** — ✅ FIXED & DEPLOYED | `anon` role could read full `clients` rows (names, emails, phones) via `clients_public_portal_discovery` policy. Policy dropped, anon revoked, discovery routed through column-whitelisted `portal_public_clients` view. Verified closed in prod. |
| Billing / Stripe | **Fix** — ✅ FIXED & DEPLOYED | Webhook secret WAS configured (CURRENT_STATE.md was stale). Real bugs: `handleCheckoutCompleted` used `update` on a possibly-missing row (silent no-op) and `create-checkout` never persisted new Stripe customer IDs (duplicate customers → webhook can't resolve user → silent failures). Both fixed; webhook signature path verified end-to-end via probe (`ok: true`). |
| Strategy generation | **Fix** — ✅ CORE FIXED & DEPLOYED | Diagnosis + recommendation used real LLMs, but the final published plan was hardcoded to a deterministic template (`useCompactPublicationContext = true`). Now env-driven (`STRATEGY_PLAN_PUBLISHER`, default `llm`) with graceful deterministic fallback on any model failure (no more hard 500s), and `plan_mode`/`plan_fallback_reason` recorded for auditability. |
| Agency Brain governance | **Fix** — ✅ CORE FIXED & DEPLOYED | Wizard guardrails/foundations/workflow (`agency_ai_setup_status_v2.meta_json`) were used only for readiness gating, never injected into prompts. Now injected as a binding `AgencyGovernance` block into diagnosis, recommendation, and plan contexts. Activation gating + readiness engine were verified strict and auditable — keep. |
| Agency onboarding | **Fix** — ✅ CORE FIXED & DEPLOYED | Completed onboarding stored `draft_brain_json` that nothing consumed — agencies finished onboarding with no operational brain. Now materialized into approved `brain_documents` (idempotent, owner-authored = approved, never clobbers manual edits) + RAG ingestion on completion. |
| Client onboarding (chat v5 cards) | **Keep** | Verified end-to-end: cards → `client_onboarding_profiles` → `mapV3AnswersToClientBrain` → usable `client_brains` → strategy generation. Essential path ≈8–12 min. |
| AI rep chat / portal assistant | **Fix** — ✅ CORE FIXED & DEPLOYED | `ai-rep-chat` loaded brief + RAG but replied with a deterministic echo — no LLM at all. Now: grounded LLM generation (brief + retrieved docs + thread history) with governance rules in prompt, deterministic fallback, real token logging. |
| Client portal | **Fix (incremental)** | Structure is sound: approvals, calendar, messaging, performance all wired to real data. Gaps: report detail hidden behind navigation, approval reminders created but never delivered (no email), AI assistant proposals generated but not rendered, no notification idempotency. |
| Content pipeline / publishing | **Keep** | 8-stage pipeline, Meta autopublish + token refresh crons working. |
| Auth / tenancy / team | **Keep** | Both auth systems verified working; RLS otherwise sound (agencies, subscriptions, brains all deny anon). |
| Dead code | **Remove (pending)** | Unreferenced edge functions: `ai-onboarding-v3`, `ai-onboarding-guide`, `ai-onboarding-copilot`; `ai-onboarding-scan`/`-suggest` invoked but cosmetic. |
| Deployment | **Keep GitHub Pages** | smmahub.net live and healthy on Pages with correct keys. Switching to Vercel adds migration risk for zero user benefit — explicit founder decision to stay. Local `.env` keys were stale/rotated; refreshed. |

## Highest-impact remaining gaps (next iterations)

1. **Strategy → Execution bridge**: strategy tasks land in `strategy_tasks` only; `client_execution_tasks` is a parallel disconnected system; no 90-day content plan; no calendar entry generation from strategy; tasks created before module approval.
2. **Portal polish**: report detail view, reminder email delivery, assistant proposal rendering, notification dedupe keys.
3. **Wizard UX**: module approval status invisible in wizard (users complete it and still hit activation blocks); no tone/voice capture step.
4. **Dead function cleanup** + CURRENT_STATE.md refresh.
5. **End-to-end QA**: timed agency signup → brain → client onboarding → strategy → execution happy path; verify LLM publisher quality in prod logs (`plan_mode` metadata).

## Production changes shipped today

- Migration `20260610120000_fix_clients_anon_rls_leak.sql` (applied to prod, verified).
- Edge functions deployed: `stripe-webhook`, `create-checkout`, `ai-strategy-generate`, `ai-rep-chat`, `ai-onboarding`.
- Frontend: `ClientForgotPassword` now queries the safe view.
- New shared helper `_shared/agency-onboarding-brain.ts` (+11 unit tests), rep-chat prompt builder (+8 tests). All 37 related tests green.
