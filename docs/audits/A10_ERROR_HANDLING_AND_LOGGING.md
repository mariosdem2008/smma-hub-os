# A10 — Error Handling and Logging (Current Truth)

## Purpose
Audit error response patterns and logging across AI edge functions and frontend hooks, focusing on consistency of error codes, unknown/gated responses, and persistence of telemetry (`ai_runs`, `ai_usage_logs`). This matters because the platform needs “0 silent failures” and reliable observability for debugging.

## Key Findings Summary
- Many AI endpoints use an `unknown: true` pattern for gated/incomplete inputs; this must be consistently surfaced in UI.
- `ai_usage_logs` is written by both router-level logging and edge-function logging depending on `skipUsageLog` usage.
- `ai_runs` is the canonical detailed run log table; strategy generation now logs attempts across success, gated, and error paths.
- Frontend hooks treat edge function failures as exceptions; for strategy generation, `unknown` and key error codes are converted to user-visible messages.

## Detailed Analysis
### Error response patterns
- Edge functions return a mix of:
  - 4xx/5xx `{ error, code, message? }`
  - 200 `{ unknown: true, missing_fields, questions, code?, deep_link? }`

### Logging
- `ai_usage_logs` captures tokens/latency/unknown flags for lightweight analytics.
- `ai_runs` captures detailed metadata and citations for traceability.

### Frontend propagation
- For strategy generation, the UI now throws on `unknown: true` and uses toast + CTA with `deep_link` to direct the user to remediation.

## Code Evidence
### Frontend catch blocks (useStrategy hooks) (`rg -n "catch\\s*\\(" src/hooks -g "useStrategy*.ts" -A 3`)
```text
```

### Unknown responses in edge functions (`rg unknown: true`)

```text
supabase/functions\ai-ask\index.ts:66:    unknown: true,
supabase/functions\ai-ask\index.ts-67-    questions,
supabase/functions\ai-ask\index.ts-68-    confidence: 0,
--
supabase/functions\ai-ask\index.ts:171:      unknown: true,
supabase/functions\ai-ask\index.ts-172-      questions: ["Daily rate limit reached. Please try again after 00:00 UTC."],
supabase/functions\ai-ask\index.ts-173-      confidence: 0,
--
supabase/functions\ai-ask\index.ts:192:      unknown: true,
supabase/functions\ai-ask\index.ts-193-      escalate_to_human: false,
supabase/functions\ai-ask\index.ts-194-      escalation_reason: null,
--
supabase/functions\ai-ask\index.ts:220:      unknown: true,
supabase/functions\ai-ask\index.ts-221-      questions: null,
supabase/functions\ai-ask\index.ts-222-      confidence: 0,
--
supabase/functions\ai-ask\index.ts:251:      unknown: true,
supabase/functions\ai-ask\index.ts-252-      escalate_to_human: true,
supabase/functions\ai-ask\index.ts-253-      escalation_reason: responsePayload.escalation_reason,
--
supabase/functions\ai-ask\index.ts:265:      unknown: true,
supabase/functions\ai-ask\index.ts-266-      questions: ["Your request is too long. Please shorten it."],
supabase/functions\ai-ask\index.ts-267-      confidence: 0,
--
supabase/functions\ai-ask\index.ts:286:      unknown: true,
supabase/functions\ai-ask\index.ts-287-      escalate_to_human: false,
supabase/functions\ai-ask\index.ts-288-      escalation_reason: null,
--
supabase/functions\ai-ask\index.ts:327:      unknown: true,
supabase/functions\ai-ask\index.ts-328-      escalate_to_human: false,
supabase/functions\ai-ask\index.ts-329-      escalation_reason: null,
--
supabase/functions\ai-ask\index.ts:341:      unknown: true,
supabase/functions\ai-ask\index.ts-342-    });
supabase/functions\ai-ask\index.ts-343-    return jsonResponse(responsePayload, 200, corsHeaders(req));
--
supabase/functions\ai-ask\index.ts:408:      unknown: true,
supabase/functions\ai-ask\index.ts-409-      escalate_to_human: false,
supabase/functions\ai-ask\index.ts-410-      escalation_reason: null,
--
supabase/functions\ai-ask\index.ts:422:      unknown: true,
supabase/functions\ai-ask\index.ts-423-    });
supabase/functions\ai-ask\index.ts-424-    return jsonResponse(responsePayload, 200, corsHeaders(req));
--
supabase/functions\ai-ask\index.ts:454:      unknown: true,
supabase/functions\ai-ask\index.ts-455-      questions: null,
supabase/functions\ai-ask\index.ts-456-      confidence: 0,
--
supabase/functions\ai-ask\index.ts:485:      unknown: true,
supabase/functions\ai-ask\index.ts-486-      escalate_to_human: true,
supabase/functions\ai-ask\index.ts-487-      escalation_reason: responsePayload.escalation_reason,
--
supabase/functions\ai-strategy-generate\index.ts:40:    unknown: true,
supabase/functions\ai-strategy-generate\index.ts-41-    missing_fields: gate.missing_fields,
supabase/functions\ai-strategy-generate\index.ts-42-    questions: gate.questions,
--
supabase/functions\ai-strategy-generate\index.ts:256:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-257-    });
supabase/functions\ai-strategy-generate\index.ts-258-    await safeInsertAiRun(supabase, {
--
supabase/functions\ai-strategy-generate\index.ts:268:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-269-      citations: emptySources(),
supabase/functions\ai-strategy-generate\index.ts-270-      metadata: {
--
supabase/functions\ai-strategy-generate\index.ts:325:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-326-      citations: emptySources(),
supabase/functions\ai-strategy-generate\index.ts-327-      metadata: { code: "AGENCY_BRAIN_INCOMPLETE" },
--
supabase/functions\ai-strategy-generate\index.ts:366:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-367-    });
supabase/functions\ai-strategy-generate\index.ts-368-    await safeInsertAiRun(supabase, {
--
supabase/functions\ai-strategy-generate\index.ts:487:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-488-    });
supabase/functions\ai-strategy-generate\index.ts-489-    await safeInsertAiRun(supabase, {
--
supabase/functions\ai-strategy-generate\index.ts:499:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-500-      citations: emptySources(),
supabase/functions\ai-strategy-generate\index.ts-501-      metadata: { code: "BRAIN_INCOMPLETE", missing_fields: ["memory_context"] },
--
supabase/functions\ai-strategy-generate\index.ts:535:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-536-      citations: emptySources(),
supabase/functions\ai-strategy-generate\index.ts-537-      metadata: { code: "AGENCY_BRAIN_INCOMPLETE" },
--
supabase/functions\ai-strategy-generate\index.ts:603:      unknown: true,
supabase/functions\ai-strategy-generate\index.ts-604-      citations: emptySources(),
supabase/functions\ai-strategy-generate\index.ts-605-      metadata: { code: "AGENCY_BRAIN_INCOMPLETE" },
--
supabase/functions\_shared\agency-admin-general-ai.ts:641:            unknown: true,
supabase/functions\_shared\agency-admin-general-ai.ts-642-            statePatch: buildFallbackStrategicPatch({
supabase/functions\_shared\agency-admin-general-ai.ts-643-              playbook: playbook ?? "core_offer",
--
supabase/functions\_shared\ai-rep-chat.ts:50:      unknown: true,
supabase/functions\_shared\ai-rep-chat.ts-51-      used_sections,
supabase/functions\_shared\ai-rep-chat.ts-52-      assistant_message: `UNKNOWN\n\n${missing.question}`,
--
supabase/functions\_shared\ai.ts:244:      unknown: true,
supabase/functions\_shared\ai.ts-245-      costUsd: 0,
supabase/functions\_shared\ai.ts-246-      errorCode: rateError.code,
--
supabase/functions\_shared\ai.ts:266:      unknown: true,
supabase/functions\_shared\ai.ts-267-      costUsd: 0,
supabase/functions\_shared\ai.ts-268-      errorCode: budgetError.code,
--
supabase/functions\_shared\ai.ts:339:      unknown: true,
supabase/functions\_shared\ai.ts-340-      costUsd: 0,
supabase/functions\_shared\ai.ts-341-      errorCode: "provider_error",
--
supabase/functions\_shared\ai.ts:360:      yield { type: "done", result: { text: blocked.assistant_message, unknown: true, error: blocked.error?.code } };
supabase/functions\_shared\ai.ts-361-    })();
supabase/functions\_shared\ai.ts-362-  }
--
supabase/functions\_shared\ai.ts:382:      unknown: true,
supabase/functions\_shared\ai.ts-383-      costUsd: 0,
supabase/functions\_shared\ai.ts-384-      errorCode: rateError.code,
--
supabase/functions\_shared\ai.ts:387:      yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: rateError.code } };
supabase/functions\_shared\ai.ts-388-    })();
supabase/functions\_shared\ai.ts-389-  }
--
supabase/functions\_shared\ai.ts:406:      unknown: true,
supabase/functions\_shared\ai.ts-407-      costUsd: 0,
supabase/functions\_shared\ai.ts-408-      errorCode: budgetError.code,
--
supabase/functions\_shared\ai.ts:411:      yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: budgetError.code } };
supabase/functions\_shared\ai.ts-412-    })();
supabase/functions\_shared\ai.ts-413-  }
```

### Usage log patterns (`logUsage` / `ai_usage_logs`)

```text
supabase/functions\ai-documents-ingest\index.ts:257:  await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-documents-ingest\index.ts-258-    agency_id: agencyId,
supabase/functions\ai-documents-ingest\index.ts-259-    client_id: clientId ?? null,
--
supabase/functions\ai-retrieve-context\index.ts:143:  await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-retrieve-context\index.ts-144-    agency_id: agencyId,
supabase/functions\ai-retrieve-context\index.ts-145-    client_id: clientId ?? null,
--
supabase/functions\ai-seed-default-brain-pack\index.ts:84:      await supabase.from("ai_usage_logs").insert(
supabase/functions\ai-seed-default-brain-pack\index.ts-85-        buildDefaultBrainPackUsageLog({
supabase/functions\ai-seed-default-brain-pack\index.ts-86-          agencyId,
--
supabase/functions\ai-strategy-generate\index.ts:247:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-strategy-generate\index.ts-248-      agency_id: agencyId,
supabase/functions\ai-strategy-generate\index.ts-249-      client_id: clientId,
--
supabase/functions\ai-strategy-generate\index.ts:357:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-strategy-generate\index.ts-358-      agency_id: agencyId,
supabase/functions\ai-strategy-generate\index.ts-359-      client_id: clientId,
--
supabase/functions\ai-strategy-generate\index.ts:478:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-strategy-generate\index.ts-479-      agency_id: agencyId,
supabase/functions\ai-strategy-generate\index.ts-480-      client_id: clientId,
--
supabase/functions\ai-strategy-generate\index.ts:858:  await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-strategy-generate\index.ts-859-    agency_id: agencyId,
supabase/functions\ai-strategy-generate\index.ts-860-    client_id: clientId,
--
supabase/functions\ai-rep-chat\index.ts:129:  await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-rep-chat\index.ts-130-    agency_id: clientRow.agency_id,
supabase/functions\ai-rep-chat\index.ts-131-    client_id: clientId,
--
supabase/functions\ai-brain-ingest\index.ts:416:  await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-brain-ingest\index.ts-417-    agency_id: agencyId,
supabase/functions\ai-brain-ingest\index.ts-418-    client_id: clientId ?? null,
--
supabase/functions\generate-ai-content\index.ts:7:import { logUsage } from "../../../src/ai/logging.ts";
supabase/functions\generate-ai-content\index.ts-8-import { calculateCost, incrementBudget } from "../_shared/budgets.ts";
supabase/functions\generate-ai-content\index.ts-9-import { getEndpointGuardResponse } from "../_shared/endpoint-guard.ts";
--
supabase/functions\generate-ai-content\index.ts:241:    await logUsage(supabaseClient, {
supabase/functions\generate-ai-content\index.ts-242-      taskType: TaskType.CONTENT_IDEAS,
supabase/functions\generate-ai-content\index.ts-243-      endpoint: "generate-ai-content",
--
supabase/functions\ai-ask\index.ts:332:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-ask\index.ts-333-      agency_id: agencyId,
supabase/functions\ai-ask\index.ts-334-      client_id: clientId ?? null,
--
supabase/functions\ai-ask\index.ts:413:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-ask\index.ts-414-      agency_id: agencyId,
supabase/functions\ai-ask\index.ts-415-      client_id: clientId ?? null,
--
supabase/functions\ai-seed-default-brain-pack-admin\index.ts:105:    await supabase.from("ai_usage_logs").insert({
supabase/functions\ai-seed-default-brain-pack-admin\index.ts-106-      agency_id: agencyId,
supabase/functions\ai-seed-default-brain-pack-admin\index.ts-107-      client_id: null,
--
supabase/functions\_shared\ai.ts:2:import { logUsage } from "../../../src/ai/logging.ts";
supabase/functions\_shared\ai.ts-3-import type { ChatMessage } from "../../../src/ai/providers/types.ts";
supabase/functions\_shared\ai.ts-4-import type { OutputSchema } from "../../../src/ai/schema.ts";
--
supabase/functions\_shared\ai.ts:168:    await logUsage(opts.supabase, {
supabase/functions\_shared\ai.ts-169-      taskType: opts.taskType,
supabase/functions\_shared\ai.ts-170-      endpoint,
--
supabase/functions\_shared\lockdown.ts:31:    await supabase.from("ai_usage_logs").insert({
supabase/functions\_shared\lockdown.ts-32-      agency_id: agencyId,
supabase/functions\_shared\lockdown.ts-33-      client_id: clientId ?? null,
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:18:    ai_usage_logs: [],
supabase/functions\_shared\__tests__\ai-guards.test.ts-19-    ai_rate_limits: [],
supabase/functions\_shared\__tests__\ai-guards.test.ts-20-    ai_budgets: [],
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:59:      if (table === "ai_usage_logs") {
supabase/functions\_shared\__tests__\ai-guards.test.ts-60-        return {
supabase/functions\_shared\__tests__\ai-guards.test.ts-61-          insert: async (payload: any) => {
supabase/functions\_shared\__tests__\ai-guards.test.ts:62:            inserts.ai_usage_logs.push(payload);
supabase/functions\_shared\__tests__\ai-guards.test.ts-63-            return { data: null, error: null };
supabase/functions\_shared\__tests__\ai-guards.test.ts-64-          },
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:119:    expect(inserts.ai_usage_logs.length).toBe(1);
supabase/functions\_shared\__tests__\ai-guards.test.ts-120-  });
supabase/functions\_shared\__tests__\ai-guards.test.ts-121-
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:138:    expect(inserts.ai_usage_logs.length).toBe(1);
supabase/functions\_shared\__tests__\ai-guards.test.ts-139-  });
supabase/functions\_shared\__tests__\ai-guards.test.ts-140-
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:165:    expect(inserts.ai_usage_logs.length).toBe(1);
supabase/functions\_shared\__tests__\ai-guards.test.ts-166-
supabase/functions\_shared\__tests__\ai-guards.test.ts-167-    inserts.ai_runs.length = 0;
supabase/functions\_shared\__tests__\ai-guards.test.ts:168:    inserts.ai_usage_logs.length = 0;
supabase/functions\_shared\__tests__\ai-guards.test.ts-169-
supabase/functions\_shared\__tests__\ai-guards.test.ts-170-    runMock.mockRejectedValueOnce(new Error("boom"));
--
supabase/functions\_shared\__tests__\ai-guards.test.ts:181:    expect(inserts.ai_usage_logs.length).toBe(1);
supabase/functions\_shared\__tests__\ai-guards.test.ts-182-  });
supabase/functions\_shared\__tests__\ai-guards.test.ts-183-});
```

### Strategy generation error/return patterns

```text
supabase/functions/ai-strategy-generate\index.ts:142:    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-143-  }
--
supabase/functions/ai-strategy-generate\index.ts:162:    return jsonResponse({ error: "client_id is required", code: "MISSING_CLIENT_ID" }, 400, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-163-  }
--
supabase/functions/ai-strategy-generate\index.ts:172:    return jsonResponse({ error: "Client not found", code: "CLIENT_NOT_FOUND" }, 404, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-173-  }
--
supabase/functions/ai-strategy-generate\index.ts:189:      return jsonResponse({ error: "No admin user available for job execution" }, 403, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-190-    }
--
supabase/functions/ai-strategy-generate\index.ts:194:      return jsonResponse({ error: "Missing Authorization header" }, 401, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-195-    }
--
supabase/functions/ai-strategy-generate\index.ts:201:      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-202-    }
--
supabase/functions/ai-strategy-generate\index.ts:212:      return jsonResponse({ error: "Forbidden", code: "FORBIDDEN" }, 403, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-213-    }
--
supabase/functions/ai-strategy-generate\index.ts:241:    return jsonResponse({ error: "Client brain not found", code: "CLIENT_BRAIN_MISSING" }, 400, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-242-  }
--
supabase/functions/ai-strategy-generate\index.ts:304:    return jsonResponse({ error: "Failed to check agency brain readiness", code: "RAG_FAILURE" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-305-  }
--
supabase/functions/ai-strategy-generate\index.ts:415:    return jsonResponse({ error: "Embedding failed", code: "RAG_FAILURE" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-416-  }
--
supabase/functions/ai-strategy-generate\index.ts:468:    return jsonResponse({ error: "Failed to retrieve context", code: "RAG_FAILURE" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-469-  }
--
supabase/functions/ai-strategy-generate\index.ts:655:    return jsonResponse({ error: "Failed to generate strategy", code }, status, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-656-  }
--
supabase/functions/ai-strategy-generate\index.ts:679:    return jsonResponse({ error: "Strategy JSON invalid", code: "STRATEGY_SCHEMA_INVALID" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-680-  }
--
supabase/functions/ai-strategy-generate\index.ts:783:    return jsonResponse({ error: "Failed to save strategy snapshot", code: "PERSISTENCE_ERROR" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-784-  }
--
supabase/functions/ai-strategy-generate\index.ts:833:    return jsonResponse({ error: "Citation validation failed", code: "CITATION_VALIDATION_FAILED" }, 500, corsHeaders(req));
supabase/functions/ai-strategy-generate\index.ts-834-  }
```

## Verification SQL/Commands
```bash
# Find unknown patterns
rg -n "unknown: true" supabase/functions -S

# Find logging usage
rg -n "ai_usage_logs|ai_runs" supabase/functions -S

# Check frontend strategy hooks
rg -n "ai-strategy-generate" src/hooks -S
```

```sql
-- Confirm ai_runs metadata is populated
SELECT id, created_at, success, unknown, metadata
FROM ai_runs
ORDER BY created_at DESC
LIMIT 50;

-- Confirm ai_usage_logs exist
SELECT endpoint, created_at, unknown
FROM ai_usage_logs
ORDER BY created_at DESC
LIMIT 50;
```

## Problems Found
1. Error contract is not fully standardized across endpoints; some return `unknown: true` with missing fields while others return 4xx/5xx without a consistent `code`/`deep_link` schema.
2. Without a uniform approach, frontend code must implement per-endpoint decoding logic, which increases the chance of silent failures.

## Recommendations
1. Adopt and enforce a shared error contract across all AI endpoints:
   - Always include `code`
   - Include `deep_link` when user action is required
   - Include `message` for user-visible text
2. Ensure `ai_runs` is written for every attempt on all critical endpoints (not only strategy generation).
3. Build a small frontend helper to parse Supabase function errors and surface consistent toasts/actions.
