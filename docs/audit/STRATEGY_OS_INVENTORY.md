# Strategy OS Inventory

## Audit Date: 2026-01-10

---

## 1. Strategy OS Tables

| Table | Purpose | Key Columns | RLS | Migration |
|-------|---------|-------------|-----|-----------|
| `strategies` | Versioned strategy records | `id`, `client_id`, `agency_id`, `version_int`, `derived_from_hash`, `created_by` | Yes | [20251230090000_strategy_os_ops.sql:4](supabase/migrations/20251230090000_strategy_os_ops.sql) |
| `strategy_modules` | Per-module structured content | `id`, `strategy_id`, `module`, `content_json`, `ai_confidence`, `locked_at` | Yes | [20251229100000_strategy_os.sql:33](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_documents` | Full markdown/HTML snapshots | `id`, `strategy_id`, `markdown`, `html`, `model`, `instruction` | Yes | [20260106120000_strategy_documents.sql:3](supabase/migrations/20260106120000_strategy_documents.sql) |
| `strategy_history` | Module change audit trail | `id`, `module_id`, `strategy_id`, `changed_by`, `change_type`, `old_value`, `new_value` | Yes | [20251229100000_strategy_os.sql:56](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_tasks` | Tasks linked to modules | `id`, `strategy_id`, `module`, `title`, `description`, `status`, `priority` | Yes | [20251229100000_strategy_os.sql:68](supabase/migrations/20251229100000_strategy_os.sql) |
| `strategy_decisions` | Decision locks and values | `id`, `strategy_id`, `module`, `decision_key`, `value`, `locked`, `locked_by` | Yes | [20251230090000_strategy_os_ops.sql:22](supabase/migrations/20251230090000_strategy_os_ops.sql) |

---

## 2. Strategy Modules

| Module Key | Label | Purpose | Schema Location |
|------------|-------|---------|-----------------|
| `positioning` | Positioning | Target, differentiator, benefit statement + proof points | [strategy-output.ts:17-54](supabase/functions/_shared/strategy-output.ts#L17-L54) |
| `pillars` | Pillars | Content pillars with coverage %, purpose, KPIs | [strategy-output.ts:56-87](supabase/functions/_shared/strategy-output.ts#L56-L87) |
| `campaign_plan` | Campaign plan | Monthly campaigns with offers, CTAs, assets | [strategy-output.ts:89-122](supabase/functions/_shared/strategy-output.ts#L89-L122) |
| `weekly_plan` | Weekly plan | Week-by-week focus, cadence, production checklist | [strategy-output.ts:124-156](supabase/functions/_shared/strategy-output.ts#L124-L156) |
| `channel_adaptations` | Channel adaptations | Platform-specific rules, formats, dos/don'ts | [strategy-output.ts:158-200](supabase/functions/_shared/strategy-output.ts#L158-L200) |
| `rules_constraints` | Rules + constraints | Claims policy, banned words, disclaimers | [strategy-output.ts:202-228](supabase/functions/_shared/strategy-output.ts#L202-L228) |

---

## 3. Entrypoints

### Frontend (UI Triggers)

| Location | Action | Handler | Edge Function |
|----------|--------|---------|---------------|
| [StrategyHubTab.tsx](src/components/client-tabs/StrategyHubTab.tsx) | Generate/Regenerate button | `useStrategyDocuments` | `ai-strategy-generate` |
| [useStrategyDocuments.ts:67](src/hooks/useStrategyDocuments.ts#L67) | `supabase.functions.invoke("ai-strategy-generate")` | N/A | Direct invoke |

### Backend (Edge Functions)

| Function | Trigger | Input | Tables Written |
|----------|---------|-------|----------------|
| [ai-strategy-generate](supabase/functions/ai-strategy-generate/index.ts) | HTTP POST | `client_id`, `instruction?` | `strategies`, `strategy_modules`, `strategy_documents`, `strategy_tasks`, `strategy_decisions`, `ai_runs`, `ai_usage_logs` |
| [ai-job-worker](supabase/functions/ai-job-worker/index.ts) | CRON / HTTP | Claims from `ai_jobs` | Same as above (via internal call) |

### Database RPCs

| RPC | Purpose | Tables Touched |
|-----|---------|----------------|
| `create_strategy_snapshot` | Atomic write of strategy + modules + document | `strategies`, `strategy_modules`, `strategy_documents`, `strategy_tasks`, `strategy_decisions` |

---

## 4. Data Sources for Strategy Generation

| Source | Table | Fields Used | Read Location |
|--------|-------|-------------|---------------|
| Client Brain | `client_brains` | `brain_json`, `usable`, `status` | [ai-strategy-generate:169-176](supabase/functions/ai-strategy-generate/index.ts#L169-L176) |
| Agency Brain | `agency_brains` | `brain_json` | [ai-strategy-generate:199-205](supabase/functions/ai-strategy-generate/index.ts#L199-L205) |
| Onboarding Profile | `client_onboarding_profiles` | `*` (all fields, especially `v5_meta`, `ai_scan_result`) | [ai-strategy-generate:207-213](supabase/functions/ai-strategy-generate/index.ts#L207-L213) |
| Existing Strategy | `strategies`, `strategy_modules` | `id`, `module`, `content_json` | [ai-strategy-generate:215-228](supabase/functions/ai-strategy-generate/index.ts#L215-L228) |
| RAG Context | `ai_embeddings` via `match_ai_embeddings` | chunk_text, doc_type, similarity | [ai-strategy-generate:273-307](supabase/functions/ai-strategy-generate/index.ts#L273-L307) |

---

## 5. Frontend Hooks

| Hook | Purpose | Tables Read | Tables Written |
|------|---------|-------------|----------------|
| [useStrategies.ts](src/hooks/useStrategies.ts) | Load strategy records | `strategies` | - |
| [useStrategyModules.ts](src/hooks/useStrategyModules.ts) | Load/save modules, generate | `strategy_modules` | `strategy_modules` |
| [useStrategyDocuments.ts](src/hooks/useStrategyDocuments.ts) | Load documents, trigger generation | `strategy_documents` | Triggers edge function |
| [useStrategyDecisions.ts](src/hooks/useStrategyDecisions.ts) | Load/save decisions | `strategy_decisions` | `strategy_decisions` |
| [useStrategyTasks.ts](src/hooks/useStrategyTasks.ts) | Load/manage tasks | `strategy_tasks` | `strategy_tasks` |
| [useStrategyHistory.ts](src/hooks/useStrategyHistory.ts) | Load change history | `strategy_history` | - |

---

## 6. Atomicity Mechanism

### Strategy Snapshot RPC

**Location:** [20260108143000_strategy_snapshot_rpc.sql](supabase/migrations/20260108143000_strategy_snapshot_rpc.sql)

**Behavior:**
1. All writes happen within a single PostgreSQL function (atomic transaction)
2. Creates or updates `strategies` record with new `version_int`
3. Upserts `strategy_modules` for each module
4. Inserts `strategy_documents` with markdown + HTML
5. Upserts `strategy_tasks` with deduplication by `dedupe_key`
6. Upserts `strategy_decisions`

**Failure Mode:** If any step fails, entire transaction rolls back. No partial state.

---

## 7. Freshness Hash (`derived_from_hash`)

**Purpose:** Detect when source data has changed and strategy may be out-of-date.

**Computation Location:** [ai-strategy-generate:437-447](supabase/functions/ai-strategy-generate/index.ts#L437-L447)

**Inputs Included:**
```javascript
{
  onboardingProfile,
  scan: {
    ai_scan_result,
    ai_scan_at,
    ai_scan_accepted,
  },
  brain_documents: brainDocVersions, // { id, module, version, status, approved_at }
}
```

**Hash Algorithm:** SHA-256 of stable-stringified JSON

**UI Staleness Detection:** Compare current hash with stored `derived_from_hash` on strategy record.

---

## 8. Task Auto-Generation

**Location:** [ai-strategy-generate:455-480](supabase/functions/ai-strategy-generate/index.ts#L455-L480)

**Logic:**
1. For each module with `confidence_0_100 < 70`:
   - Create validation task with `dedupe_key: validation:{module}`
   - Include `open_questions` in description (max 5)
2. Merge with any tasks from LLM output
3. Deduplicate by `dedupe_key` or `{module}:{title}`

---

## 9. RLS Policies

| Table | Policy | Condition |
|-------|--------|-----------|
| `strategies` | agency_access | `agency_id = auth.jwt()->>'agency_id'` |
| `strategy_modules` | via strategy | Joins to `strategies` |
| `strategy_documents` | via strategy | Joins to `strategies` |
| `strategy_tasks` | via strategy | Joins to `strategies` |
| `strategy_decisions` | via strategy | Joins to `strategies` |
| `strategy_history` | via strategy | Joins to `strategies` |

**Source:** [20251229120000_strategy_os_grants.sql](supabase/migrations/20251229120000_strategy_os_grants.sql), [20251230100000_strategy_os_ops_grants.sql](supabase/migrations/20251230100000_strategy_os_ops_grants.sql)

---

## 10. Schema Validation

**Schema Name:** `strategy_plan_v2`

**Validation Location:** [strategy-output.ts:287-301](supabase/functions/_shared/strategy-output.ts#L287-L301)

**Key Constraints:**
- All 6 modules required
- Each module includes `evidenceSchema`: `facts_used[]`, `assumptions[]`, `open_questions[]` (max 5), `confidence_0_100`
- `document.markdown` required (min 1 char)
- Strict mode: no additional properties

**Test Coverage:** [strategy-output.test.ts](supabase/functions/_shared/__tests__/strategy-output.test.ts)
