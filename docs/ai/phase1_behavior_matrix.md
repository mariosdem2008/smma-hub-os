# PHASE 1 BEHAVIOR MATRIX: FLAG OFF vs FLAG ON

**Document Purpose**: Compare behavior between AI_GUIDED_SETUP_ORCHESTRATION=false (OFF) and AI_GUIDED_SETUP_ORCHESTRATION=true (ON) across 10 critical scenarios.

**Evidence Source**: [agency-admin-setup.ts](supabase/functions/_shared/agency-admin-setup.ts#L1226-L1251)

---

## SCENARIO 1: Normal Answer Flow (Happy Path)

**Context**: Admin provides valid answer to onboarding question. No errors.

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Fallback Computation** | Line 1226: `upcoming = getNextQuestion(answeredKeys)` | Line 1226: `upcoming = getNextQuestion(answeredKeys)` ✅ SAME |
| **Orchestrator Called** | ❌ NO - Line 1227 check fails, skip 1228-1250 | ✅ YES - Line 1229: `selectNextAdminSetupQuestion()` |
| **Question Source** | Hardcoded selector (SETUP_QUESTIONS array sequential) | Orchestrator AI decision (based on depth/missing fields) |
| **Question Used** | `upcoming` (from fallback) | `upcoming` (overridden by orchestrator if valid) |
| **User-Visible Behavior** | Next question from hardcoded sequence | Next question chosen by AI (may skip/reorder) |
| **Test Evidence** | Lines 172-199 (test verifies orchestrator NOT called) | Lines 201-232 (test verifies orchestrator called exactly once) |

**Conclusion**: Both paths compute fallback first. OFF uses it directly. ON uses orchestrator result if valid, fallback if invalid.

---

## SCENARIO 2: Orchestrator Returns Invalid Output

**Context**: FLAG ON. Orchestrator returns malformed data (missing `question` field).

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Orchestrator Called** | ❌ N/A (flag OFF skips orchestrator entirely) | ✅ YES |
| **Validation Check** | N/A | Line 1236: `if (selection?.question)` → FAILS |
| **Fallback Used** | Always uses hardcoded | ✅ YES - Line 1238-1242: keeps preemptive fallback |
| **Warning Logged** | No | ✅ YES - Line 1239: `console.warn("guided_setup_orchestrator_invalid_output")` |
| **User-Visible Behavior** | Normal hardcoded sequence | Normal hardcoded sequence (graceful degradation) |
| **Crash Risk** | None | None (preemptive fallback prevents crash) |

**Conclusion**: ON path falls back gracefully to hardcoded selector. User sees no difference from OFF path.

---

## SCENARIO 3: Orchestrator Throws Exception

**Context**: FLAG ON. Orchestrator AI call fails (timeout, network error, AI service down).

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Orchestrator Called** | ❌ N/A | ✅ YES - Line 1229 |
| **Exception Caught** | N/A | ✅ YES - Line 1244: `catch (error)` |
| **Fallback Used** | Always uses hardcoded | ✅ YES - Line 1245-1250: keeps preemptive fallback |
| **Warning Logged** | No | ✅ YES - Line 1245: `console.warn("guided_setup_orchestrator_failed")` |
| **User-Visible Behavior** | Normal hardcoded sequence | Normal hardcoded sequence (graceful degradation) |
| **Crash Risk** | None | None (try/catch + preemptive fallback) |
| **Test Coverage** | ✅ TESTED (line 195) | 🚨 **GAP 2** - Orchestrator error paths not tested |

**Conclusion**: ON path handles exceptions gracefully. Test gap identified: need to verify fallback works on error.

---

## SCENARIO 4: First Turn (Bootstrap Prefill)

**Context**: First message in conversation. Agency name/website already in DB.

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Bootstrap Prefill** | ✅ YES - Lines 720-735: snapshot built BEFORE first-turn check | ✅ YES - Lines 720-735: snapshot built BEFORE first-turn check ✅ SAME |
| **Timing** | Snapshot → Line 737: early return intro | Snapshot → Line 737: early return intro ✅ SAME |
| **Prompt Awareness** | N/A (intro message, no prompt yet) | N/A (intro message, no prompt yet) |
| **Orchestrator Called** | ❌ NO (early return at line 737) | ❌ NO (early return at line 737) ✅ SAME |
| **User-Visible Behavior** | Intro message: "Are you ready to start?" | Intro message: "Are you ready to start?" ✅ SAME |

**Conclusion**: Both paths identical on first turn. Bootstrap prefill happens regardless of flag. No orchestrator called (early return).

---

## SCENARIO 5: Agency Name/Website Missing (Null Bootstrap Data)

**Context**: Admin provides answer. Agency record has null name/website in DB.

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Bootstrap Prefill** | ✅ YES - Lines 720-735: snapshot built with null values | ✅ YES - Lines 720-735: snapshot built with null values ✅ SAME |
| **Safe Access** | `contextSnapshot?.agency?.name ?? null` (no crash) | `contextSnapshot?.agency?.name ?? null` (no crash) ✅ SAME |
| **Prompt Rule** | "Agency name is missing. You MAY ask for the agency name if needed." | "Agency name is missing. You MAY ask for the agency name if needed." ✅ SAME |
| **Orchestrator Aware** | N/A (hardcoded always asks name first) | ✅ YES - Orchestrator sees "missing" rule, may prioritize name question |
| **User-Visible Behavior** | Asks for name (hardcoded sequence) | Asks for name (AI decision, likely first) |
| **Test Evidence** | Lines 266-298 (null handling verified) | Lines 266-298 (null handling verified) |

**Conclusion**: Both paths handle null safely. Prompt rules identical. ON path may intelligently prioritize missing bootstrap fields.

---

## SCENARIO 6: All Questions Answered (Done State)

**Context**: Admin has answered all required questions. Setup complete.

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Fallback Computation** | Line 1226: `getNextQuestion()` returns `null` (no more questions) | Line 1226: `getNextQuestion()` returns `null` (no more questions) ✅ SAME |
| **Orchestrator Called** | ❌ NO | ✅ YES - Line 1229 (but result irrelevant) |
| **Done Detection** | Line 1320: `if (!upcoming)` → done message | Line 1320: `if (!upcoming)` → done message ✅ SAME |
| **User-Visible Behavior** | Completion message | Completion message ✅ SAME |

**Conclusion**: Both paths converge to done state. ON path may call orchestrator unnecessarily (optimization opportunity).

---

## SCENARIO 7: Mid-Setup Clarification Question

**Context**: Admin asks "What do you mean by niche?" instead of answering.

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Intent Classification** | Line 813: `intent = "CLARIFICATION_REQUEST"` | Line 813: `intent = "CLARIFICATION_REQUEST"` ✅ SAME |
| **Flow Path** | Lines 1126+: NOT "ANSWER_TO_ONBOARDING_QUESTION" → different handler | Lines 1126+: NOT "ANSWER_TO_ONBOARDING_QUESTION" → different handler ✅ SAME |
| **Orchestrator Called** | ❌ NO (only called in answer flow) | ❌ NO (only called in answer flow) ✅ SAME |
| **User-Visible Behavior** | Answer clarification, re-ask pending question | Answer clarification, re-ask pending question ✅ SAME |

**Conclusion**: Both paths identical for non-answer intents. Orchestrator only runs in answer flow.

---

## SCENARIO 8: Orchestrator Suggests Expert Question (L5 Depth)

**Context**: FLAG ON. Admin has answered L1-L3 questions. Orchestrator suggests L5 expert question (skip L4).

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Fallback Question** | Line 1226: Next hardcoded question (L4: voice_adjectives) | Line 1226: Next hardcoded question (L4: voice_adjectives) ✅ SAME |
| **Orchestrator Suggestion** | N/A | Line 1229: Returns L5 question (faq_seed_top10) from registry |
| **Validation** | N/A | Line 1236: `selection.question` exists → VALID |
| **Question Used** | L4 (hardcoded) | L5 (orchestrator override) ❌ DIFFERENT |
| **User-Visible Behavior** | Sequential depth progression | Intelligent depth skipping ❌ DIFFERENT |

**Conclusion**: This is the PRIMARY BEHAVIOR DIFFERENCE. OFF is sequential. ON can skip/reorder based on AI reasoning.

---

## SCENARIO 9: DB Failure (Agency Brain Fetch Error)

**Context**: Database query for agency brain fails (timeout, connection error).

| Aspect | FLAG OFF | FLAG ON |
|--------|----------|---------|
| **Error Handling** | Line 700: `upsertAgencyBrain()` wrapped in try/catch | Line 700: `upsertAgencyBrain()` wrapped in try/catch ✅ SAME |
| **Fallback Behavior** | Returns error response (500) | Returns error response (500) ✅ SAME |
| **Orchestrator Called** | ❌ NO (error occurs before flow reaches line 1227) | ❌ NO (error occurs before flow reaches line 1227) ✅ SAME |
| **User-Visible Behavior** | Error message | Error message ✅ SAME |
| **Test Coverage** | 🚨 **GAP 3** - DB failure paths not tested | 🚨 **GAP 3** - DB failure paths not tested |

**Conclusion**: Both paths handle DB errors identically. Test gap: need to verify error handling code works.

---

## SCENARIO 10: Concurrent Requests (Flag State Consistency)

**Context**: Two admins use setup simultaneously. Flag toggled mid-session.

| Aspect | FLAG OFF → ON (during session) | FLAG ON → OFF (during session) |
|--------|-------------------------------|-------------------------------|
| **Flag Check Timing** | Line 1227: checked EVERY turn (not cached) | Line 1227: checked EVERY turn (not cached) |
| **State Persistence** | Env var read per request | Env var read per request |
| **Behavior Consistency** | ⚠️ May change mid-session (OFF → ON) | ⚠️ May change mid-session (ON → OFF) |
| **Risk** | User A sees hardcoded, User B sees AI-driven (if flag changed between requests) | User A sees AI-driven, User B sees hardcoded (if flag changed between requests) |
| **Mitigation** | Feature flag should be deploy-time config (restart required) | Feature flag should be deploy-time config (restart required) |

**Conclusion**: Flag is checked per-request, not per-session. This is a deployment config, not a runtime toggle. Document this.

---

## SUMMARY: OFF vs ON BEHAVIOR

| Scenario | Behavior Identical? | Key Difference |
|----------|---------------------|----------------|
| 1. Normal Answer Flow | ❌ NO | OFF: Hardcoded sequence. ON: AI-driven selection |
| 2. Invalid Orchestrator Output | ✅ YES | Both use fallback (ON degrades gracefully) |
| 3. Orchestrator Exception | ✅ YES | Both use fallback (ON degrades gracefully) |
| 4. First Turn Bootstrap | ✅ YES | Both build snapshot, return intro |
| 5. Null Bootstrap Data | ✅ YES | Both handle null safely, same prompt rules |
| 6. All Questions Answered | ✅ YES | Both return done message |
| 7. Clarification Question | ✅ YES | Both answer and re-ask (no orchestrator) |
| 8. Expert Question Skip | ❌ NO | OFF: Sequential. ON: Depth skipping |
| 9. DB Failure | ✅ YES | Both return error response |
| 10. Flag Toggle Mid-Session | ⚠️ RISK | Flag is per-request, not cached (should be deploy-time) |

**Core Behavior Difference**: OFF path is deterministic (hardcoded sequence). ON path is adaptive (AI-driven based on context). Both degrade gracefully to hardcoded on failure.

---

## TEST COVERAGE ASSESSMENT

| Scenario | Test Coverage | Strength | Gap |
|----------|---------------|----------|-----|
| 1. Normal Answer (OFF) | ✅ YES (lines 172-199) | STRONG | None |
| 1. Normal Answer (ON) | ✅ YES (lines 201-232) | STRONG | None |
| 2. Invalid Output | ⚠️ PARTIAL | WEAK | Need explicit test for invalid schema |
| 3. Exception | 🚨 NO | NONE | **GAP 2**: Orchestrator error paths not tested |
| 4. First Turn Bootstrap | ✅ YES (lines 234-264) | STRONG | None |
| 5. Null Bootstrap | ✅ YES (lines 266-298) | STRONG | None |
| 6. Done State | ⚠️ IMPLIED | WEAK | Not explicitly tested |
| 7. Clarification | ⚠️ IMPLIED | WEAK | Not explicitly tested |
| 8. Expert Question Skip | ⚠️ IMPLIED | WEAK | Tests verify orchestrator called, but not depth logic |
| 9. DB Failure | 🚨 NO | NONE | **GAP 3**: DB failure paths not tested |
| 10. Flag Toggle | 🚨 NO | NONE | No test for mid-session flag changes |

**Overall Test Strength**: 5/10 scenarios have STRONG coverage. 3 critical gaps identified.

---

## RISK ASSESSMENT BY SCENARIO

| Scenario | Severity | Likelihood | Risk Level | Mitigation |
|----------|----------|------------|------------|------------|
| 1. Normal Flow | Low | N/A | ✅ LOW | Well-tested, working as designed |
| 2. Invalid Output | Medium | Low | ⚠️ MEDIUM | Add explicit test (GAP 1 mitigation) |
| 3. Exception | High | Medium | 🚨 HIGH | Add error path test (GAP 2) |
| 4. First Turn | Low | N/A | ✅ LOW | Well-tested |
| 5. Null Bootstrap | Low | Low | ✅ LOW | Well-tested, graceful handling |
| 6. Done State | Low | N/A | ✅ LOW | Simple logic, low risk |
| 7. Clarification | Low | N/A | ✅ LOW | Different code path, low risk |
| 8. Expert Skip | Low | N/A | ✅ LOW | AI decision, acceptable variation |
| 9. DB Failure | High | Low | 🚨 HIGH | Add DB failure test (GAP 3) |
| 10. Flag Toggle | Medium | Low | ⚠️ MEDIUM | Document as deploy-time config |

**Highest Risks**: Scenario 3 (orchestrator exception) and Scenario 9 (DB failure). Both have untested error paths.

---

## RECOMMENDED ACTIONS

### Immediate (Before Production)
1. Add test for orchestrator exception fallback (Scenario 3)
2. Add test for DB failure error handling (Scenario 9)
3. Document feature flag as deploy-time config (Scenario 10)

### Short-Term (Next Sprint)
4. Add explicit test for invalid orchestrator output (Scenario 2)
5. Add test for done state detection (Scenario 6)
6. Add production metrics for orchestrator success/failure rates

### Long-Term (Future Enhancement)
7. Consider caching flag value per-session (avoid mid-session changes)
8. Add E2E test covering full OFF and ON flows end-to-end
9. Add integration test for expert question depth logic

---

**End of Behavior Matrix**
