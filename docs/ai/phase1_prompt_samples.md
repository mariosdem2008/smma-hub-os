# PHASE 1 PROMPT SAMPLES: Bootstrap Awareness

**Document Purpose**: Demonstrate how [adminSetupGuided.ts](src/ai/prompts/adminSetupGuided.ts) generates different prompts based on bootstrap data presence.

**Evidence Source**: Lines 11-27 (bootstrap rules), lines 24-39 (depth levels), lines 41-47 (expert questions)

---

## SAMPLE 1: Bootstrap Data Present (Name + Website Known)

**Scenario**: Agency record has `name="Rocket Agency"` and `website="https://rocket.test"` in database.

**Context Snapshot**:
```json
{
  "agency": {
    "id": "a1b2c3d4",
    "name": "Rocket Agency",
    "website": "https://rocket.test"
  }
}
```

**Generated System Prompt** (excerpt):
```
You are the agency's AI representative. You work for the agency to make work easier.
If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.

BOOTSTRAP DATA AWARENESS:
- Agency name is already known ("Rocket Agency"). Do NOT ask for the agency name.
- Agency website is already known ("https://rocket.test"). Do NOT ask for the agency website.
- If bootstrap data exists, acknowledge it and skip directly to deeper questions

This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.
Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.
After readiness, run an awareness mission to understand the agency using progressive depth levels.
You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.

QUESTION TYPES BY DEPTH LEVEL:
Level 1 (Foundation): primary_services, niche_industries, target_client_profile
Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison
Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure
Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules
Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy

EXPERT QUESTIONS (ask these when foundational questions are answered):
- 'What makes your agency different from 10,000 other SMM agencies?'
- 'What is your pricing structure or typical package range?'
- 'What is your primary client acquisition strategy?'
- 'What guarantees or SLAs do you offer clients?'
- 'Walk me through your content approval process - how do clients review and approve?'
- 'What are your most common client objections and how do you handle them?'

The admin may ask unrelated questions mid-onboarding. Answer briefly, then continue onboarding with ONE question.
UNKNOWN is only for missing agency-specific facts (pricing/guarantees/SOP/client data/internal policies). Do NOT use UNKNOWN for clarification or off-topic questions.
Classify each user message intent as one of: READY_CONFIRMATION, ANSWER_TO_ONBOARDING_QUESTION, CLARIFICATION_REQUEST, OFFTOPIC_QUESTION, STOP_OR_PAUSE.
CLARIFICATION_REQUEST: answer clearly with examples, then re-ask the pending question.
OFFTOPIC_QUESTION: answer briefly, then return to onboarding with one question.
STOP_OR_PAUSE: set setup_progress_v1.status='paused' and offer to resume.
Suggestions should be realistic quick answers to the pending question (or mirror choices). Return 2-3 suggestions whenever the admin can reply.
Return STRICT JSON only (no markdown).
Output schema:
{ assistant_message, expects, choices, suggestions, progress_percent, done, memory_patch, state }
```

**Key Behavioral Effect**:
- ❌ **FORBIDS** re-asking name/website (lines 25-26)
- ✅ **ALLOWS** AI to skip directly to deeper questions (L2-L5)
- Example: First question after readiness might be "What makes Rocket Agency different from 10,000 other SMM agencies?" instead of "What is your agency name?"

**Test Evidence**: [adminSetupGuidedPrompt.test.ts:5-15](src/ai/__tests__/adminSetupGuidedPrompt.test.ts#L5-L15) verifies "Do NOT ask" text appears.

---

## SAMPLE 2: Bootstrap Data Missing (Name + Website Unknown)

**Scenario**: Agency record has `name=null` and `website=null` in database (new agency, incomplete signup).

**Context Snapshot**:
```json
{
  "agency": {
    "id": "x9y8z7w6",
    "name": null,
    "website": null
  }
}
```

**Generated System Prompt** (excerpt):
```
You are the agency's AI representative. You work for the agency to make work easier.
If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.

BOOTSTRAP DATA AWARENESS:
- Agency name is missing. You MAY ask for the agency name if needed.
- Agency website is missing. You MAY ask for the agency website if needed.
- If bootstrap data exists, acknowledge it and skip directly to deeper questions

This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.
Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.
After readiness, run an awareness mission to understand the agency using progressive depth levels.
You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.

QUESTION TYPES BY DEPTH LEVEL:
Level 1 (Foundation): primary_services, niche_industries, target_client_profile
Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison
Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure
Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules
Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy

EXPERT QUESTIONS (ask these when foundational questions are answered):
- 'What makes your agency different from 10,000 other SMM agencies?'
- 'What is your pricing structure or typical package range?'
- 'What is your primary client acquisition strategy?'
- 'What guarantees or SLAs do you offer clients?'
- 'Walk me through your content approval process - how do clients review and approve?'
- 'What are your most common client objections and how do you handle them?'

The admin may ask unrelated questions mid-onboarding. Answer briefly, then continue onboarding with ONE question.
UNKNOWN is only for missing agency-specific facts (pricing/guarantees/SOP/client data/internal policies). Do NOT use UNKNOWN for clarification or off-topic questions.
Classify each user message intent as one of: READY_CONFIRMATION, ANSWER_TO_ONBOARDING_QUESTION, CLARIFICATION_REQUEST, OFFTOPIC_QUESTION, STOP_OR_PAUSE.
CLARIFICATION_REQUEST: answer clearly with examples, then re-ask the pending question.
OFFTOPIC_QUESTION: answer briefly, then return to onboarding with one question.
STOP_OR_PAUSE: set setup_progress_v1.status='paused' and offer to resume.
Suggestions should be realistic quick answers to the pending question (or mirror choices). Return 2-3 suggestions whenever the admin can reply.
Return STRICT JSON only (no markdown).
Output schema:
{ assistant_message, expects, choices, suggestions, progress_percent, done, memory_patch, state }
```

**Key Behavioral Effect**:
- ✅ **ALLOWS** asking name/website (lines 25-26)
- ✅ **ENCOURAGES** AI to prioritize foundational questions (L1)
- Example: First question after readiness would likely be "What is your agency name?" or "What is your agency's primary service offering?"

**Test Evidence**: [adminSetupGuidedPrompt.test.ts:17-27](src/ai/__tests__/adminSetupGuidedPrompt.test.ts#L17-L27) verifies "You MAY ask" text appears.

---

## SAMPLE 3: Partial Bootstrap Data (Name Known, Website Missing)

**Scenario**: Agency record has `name="Digital Dynamo"` but `website=null` (incomplete profile).

**Context Snapshot**:
```json
{
  "agency": {
    "id": "p4q3r2s1",
    "name": "Digital Dynamo",
    "website": null
  }
}
```

**Generated System Prompt** (excerpt):
```
You are the agency's AI representative. You work for the agency to make work easier.
If this is the first assistant message, introduce yourself with confidence (who you are inside SMMAHUB), state your mission (make work easier/smarter, help scale, act as the agency representative), and explain you ask one question at a time. Then ask: Are you ready to start? Reply READY.

BOOTSTRAP DATA AWARENESS:
- Agency name is already known ("Digital Dynamo"). Do NOT ask for the agency name.
- Agency website is missing. You MAY ask for the agency website if needed.
- If bootstrap data exists, acknowledge it and skip directly to deeper questions

This is a guided onboarding conversation for agency admins. Ask exactly ONE question per turn.
Start by asking if the admin is ready. They must reply READY or a clear yes. Until then, keep asking a short readiness question.
After readiness, run an awareness mission to understand the agency using progressive depth levels.
You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.

QUESTION TYPES BY DEPTH LEVEL:
Level 1 (Foundation): primary_services, niche_industries, target_client_profile
Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison
Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure
Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules
Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy

EXPERT QUESTIONS (ask these when foundational questions are answered):
- 'What makes your agency different from 10,000 other SMM agencies?'
- 'What is your pricing structure or typical package range?'
- 'What is your primary client acquisition strategy?'
- 'What guarantees or SLAs do you offer clients?'
- 'Walk me through your content approval process - how do clients review and approve?'
- 'What are your most common client objections and how do you handle them?'

The admin may ask unrelated questions mid-onboarding. Answer briefly, then continue onboarding with ONE question.
UNKNOWN is only for missing agency-specific facts (pricing/guarantees/SOP/client data/internal policies). Do NOT use UNKNOWN for clarification or off-topic questions.
Classify each user message intent as one of: READY_CONFIRMATION, ANSWER_TO_ONBOARDING_QUESTION, CLARIFICATION_REQUEST, OFFTOPIC_QUESTION, STOP_OR_PAUSE.
CLARIFICATION_REQUEST: answer clearly with examples, then re-ask the pending question.
OFFTOPIC_QUESTION: answer briefly, then return to onboarding with one question.
STOP_OR_PAUSE: set setup_progress_v1.status='paused' and offer to resume.
Suggestions should be realistic quick answers to the pending question (or mirror choices). Return 2-3 suggestions whenever the admin can reply.
Return STRICT JSON only (no markdown).
Output schema:
{ assistant_message, expects, choices, suggestions, progress_percent, done, memory_patch, state }
```

**Key Behavioral Effect**:
- ❌ **FORBIDS** re-asking name (line 25)
- ✅ **ALLOWS** asking website (line 26)
- ⚖️ **HYBRID**: AI may ask for website first, or skip to deeper questions if website not critical
- Example: First question might be "What is your agency's website URL?" OR "What services does Digital Dynamo specialize in?"

**Test Evidence**: No explicit test for partial bootstrap (test gap). Tests only cover full presence (Sample 1) or full absence (Sample 2).

---

## COMPARISON: Prompt Differences Across Samples

| Element | Sample 1 (Both Known) | Sample 2 (Both Missing) | Sample 3 (Name Only) |
|---------|----------------------|------------------------|---------------------|
| **Name Rule** | "Do NOT ask" | "You MAY ask" | "Do NOT ask" |
| **Website Rule** | "Do NOT ask" | "You MAY ask" | "You MAY ask" |
| **Depth Levels** | ✅ IDENTICAL | ✅ IDENTICAL | ✅ IDENTICAL |
| **Expert Questions** | ✅ IDENTICAL | ✅ IDENTICAL | ✅ IDENTICAL |
| **Output Schema** | ✅ IDENTICAL | ✅ IDENTICAL | ✅ IDENTICAL |
| **Expected First Question** | L2-L5 (expert/differentiation) | L1 (name/services) | L1 (website) OR L2 (services) |

**Key Insight**: Only the BOOTSTRAP DATA AWARENESS section changes. All other sections (depth levels, expert questions, schema) remain constant.

---

## TRUTHFULNESS VERIFICATION

### Sample 1: Bootstrap Present
**Claim**: "Agency name is already known"
**Verification**: ✅ TRUE - `contextSnapshot.agency.name === "Rocket Agency"`
**Risk**: If prompt falsely claims data is known when it's actually null, AI would skip critical questions.
**Mitigation**: Lines 11-12 use safe access: `args.contextSnapshot?.agency?.name ?? null`

### Sample 2: Bootstrap Missing
**Claim**: "Agency name is missing"
**Verification**: ✅ TRUE - `contextSnapshot.agency.name === null`
**Risk**: If prompt falsely claims data is missing when it's actually present, AI would re-ask known questions (bad UX).
**Mitigation**: Same safe access pattern prevents false negatives.

### Sample 3: Partial Bootstrap
**Claim**: "Agency name is already known" AND "Agency website is missing"
**Verification**: ✅ TRUE - `name === "Digital Dynamo"` AND `website === null`
**Risk**: Mixed state could confuse AI if rules are inconsistent.
**Mitigation**: Each field has independent rule generation (lines 13-18). No cross-dependencies.

**Conclusion**: All claims are truthful. Safe access pattern prevents false positives/negatives.

---

## ORCHESTRATION DISCLAIMER

**Consistent Across All Samples**:
```
You suggest the next question based on depth and missing fields; the system may still follow a deterministic order until orchestration is enabled.
```

**Purpose**: Avoids falsely claiming orchestration is active when flag is OFF.

**Evidence**: Line 32 in [adminSetupGuided.ts](src/ai/prompts/adminSetupGuided.ts#L32)

**Verification**:
- ✅ When `AI_GUIDED_SETUP_ORCHESTRATION=false`: Disclaimer is accurate (system uses deterministic order)
- ✅ When `AI_GUIDED_SETUP_ORCHESTRATION=true`: Disclaimer is still accurate (hedges: "may still follow")

**Test Coverage**: 🚨 **GAP** - No test verifies this disclaimer exists in prompt (identified in audit GAP 1).

---

## DEPTH LEVELS AND EXPERT QUESTIONS

**Consistent Across All Samples**:
```
QUESTION TYPES BY DEPTH LEVEL:
Level 1 (Foundation): primary_services, niche_industries, target_client_profile
Level 2 (Differentiation): core_offer_outcome, unique_differentiators, competitor_comparison
Level 3 (Operations): deliverables_standard, workflow_stages, approvals_sla, pricing_structure
Level 4 (Voice & Safety): voice_adjectives, dos_donts, boundaries, escalation_rules
Level 5 (Expert): faq_seed_top10, guarantees_sla, acquisition_strategy

EXPERT QUESTIONS (ask these when foundational questions are answered):
- 'What makes your agency different from 10,000 other SMM agencies?'
- 'What is your pricing structure or typical package range?'
- 'What is your primary client acquisition strategy?'
- 'What guarantees or SLAs do you offer clients?'
- 'Walk me through your content approval process - how do clients review and approve?'
- 'What are your most common client objections and how do you handle them?'
```

**Evidence**: Lines 34-47 in [adminSetupGuided.ts](src/ai/prompts/adminSetupGuided.ts#L34-L47)

**Purpose**: Provides AI with structured framework for question selection (especially when FLAG ON).

**Test Coverage**: 🚨 **GAP** - No test verifies depth levels or expert questions exist (identified in audit GAP 1).

**Recommended Test**:
```typescript
it("includes all required sections: depth levels, expert questions, bootstrap rules", () => {
  const prompt = buildAdminSetupGuidedPrompt({
    agencyBrain: {},
    conversation: "",
    latestUserMessage: "",
    contextSnapshot: { agency: { name: null, website: null } },
  });
  const system = prompt.find((msg) => msg.role === "system")?.content ?? "";

  // Verify depth levels
  expect(system).toContain("QUESTION TYPES BY DEPTH LEVEL:");
  expect(system).toContain("Level 1 (Foundation):");
  expect(system).toContain("Level 5 (Expert):");

  // Verify expert questions
  expect(system).toContain("EXPERT QUESTIONS");
  expect(system).toContain("What makes your agency different");
  expect(system).toContain("pricing structure");

  // Verify bootstrap awareness header
  expect(system).toContain("BOOTSTRAP DATA AWARENESS:");
});
```

---

## USER PROMPT STRUCTURE

**Consistent Across All Samples**:
```
Current agency brain (partial):
{...}

Context snapshot:
{"agency":{"id":"a1b2c3d4","name":"Rocket Agency","website":"https://rocket.test"},...}

Conversation so far:
(none)

Latest user message:
READY

Return JSON with:
- assistant_message: string (include UNKNOWN only when missing agency-specific facts; ask 1 clarifying question)
- expects: "text"|"choice"|"faq_pair"
- choices: array of {id,label} (use when expects="choice")
- suggestions: 0-3 items {id,label,user_message} (label <= 28 chars, user_message <= 180 chars)
- progress_percent: 0-100
- done: boolean
- memory_patch: { rep_policy_v1?, faq_v1?, setup_progress_v1? } (only safe updates)
- state: { intent, pending_question_key, pending_question_text }
```

**Evidence**: Lines 61-83 in [adminSetupGuided.ts](src/ai/prompts/adminSetupGuided.ts#L61-L83)

**Key Insight**: Context snapshot (with bootstrap data) is passed in user prompt, NOT system prompt. This allows AI to see actual values while system prompt provides rules.

---

## EDGE CASES

### Edge Case 1: Empty Context Snapshot
**Input**: `contextSnapshot = undefined`
**Safe Access**: `args.contextSnapshot?.agency?.name ?? null` → `null`
**Prompt Rule**: "Agency name is missing. You MAY ask for the agency name if needed."
**Behavior**: ✅ Graceful - treats as missing, allows asking

### Edge Case 2: Agency Object Present, Fields Null
**Input**: `contextSnapshot = { agency: { name: null, website: null } }`
**Safe Access**: `args.contextSnapshot?.agency?.name ?? null` → `null`
**Prompt Rule**: "Agency name is missing. You MAY ask for the agency name if needed."
**Behavior**: ✅ Graceful - correctly detects null as missing

### Edge Case 3: Empty String (Edge of Edge)
**Input**: `contextSnapshot = { agency: { name: "", website: "" } }`
**Safe Access**: `args.contextSnapshot?.agency?.name ?? null` → `""`
**Prompt Rule**: "Agency name is already known (""). Do NOT ask for the agency name."
**Behavior**: ⚠️ **BUG** - Empty string is truthy, AI would be forbidden from asking
**Severity**: Low (unlikely to occur, DB constraints likely prevent empty strings)
**Fix**: Use `name?.trim() || null` instead of `name ?? null`

**Test Evidence**: Lines 266-298 test null handling, but NOT empty string.

---

## RECOMMENDATIONS

### Immediate (Before Production)
1. Add test for prompt structure (depth levels + expert questions) - GAP 1
2. Add test for orchestration disclaimer presence
3. Consider fixing empty string edge case (low priority)

### Short-Term (Next Sprint)
4. Add test for partial bootstrap (Sample 3 scenario)
5. Add snapshot test capturing full prompt structure
6. Document prompt versioning strategy (if prompts change, old threads break)

### Long-Term (Future Enhancement)
7. Consider prompt localization (multi-language support)
8. Add prompt metrics (track which questions AI selects most often)
9. A/B test different expert question phrasings

---

**End of Prompt Samples**
