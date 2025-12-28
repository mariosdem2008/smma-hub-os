# SETUP GUIDED: MIGRATION TO CONVERSATIONAL ARCHITECTURE

**Date**: 2025-12-28
**Scope**: Strategic plan for upgrading adminSetupGuided to conversational AI
**Owner**: Engineering Team
**Timeline**: 3-6 months (3 phases)
**Status**: Planning - Awaiting Approval

---

## EXECUTIVE SUMMARY

This document outlines a comprehensive migration plan to transform the adminSetupGuided workflow from a **rigid 12-question state machine** into a **flexible, conversational AI system** that adapts to agency-specific needs.

### The Vision

**Current Experience** (State Machine):
```
AI: "What are your primary services? List 3-6."
User: "SMM mainly, but we also do ads. Can you explain what you mean by pricing structure first?"
AI: "I couldn't parse that response. Let's continue: What are your primary services?"
```

**Future Experience** (Conversational AI):
```
AI: "What are your primary services?"
User: "SMM mainly, but we also do ads. Can you explain what you mean by pricing structure first?"
AI: "Great! I've noted SMM and ads as your services.

Regarding pricing - I'm asking if you charge per service (e.g., $2k/mo for SMM),
per package (Bronze/Silver/Gold), or custom per client. This helps me understand
your business model.

While you're thinking about pricing, would you like to add any other services
besides SMM and ads? Or shall we move on?"
```

---

## WHY MIGRATE?

### Current Problems (See [setup_guided_analysis_2025.md](./setup_guided_analysis_2025.md))

1. **60% Completion Rate**: 4 out of 10 users abandon mid-onboarding
2. **User Frustration**: Cannot fix mistakes, unclear error messages, irrelevant questions
3. **Rigidity**: All agencies get all 12 questions regardless of relevance
4. **Development Bottleneck**: Adding questions requires code deployment

### Business Impact

| Metric | Current | After Migration | Improvement |
|--------|---------|-----------------|-------------|
| Completion Rate | 60% | 85% | +42% |
| Time to Complete | 8 min | 4 min | -50% |
| Questions Asked | 12 | 7-9 | -25% |
| User Satisfaction | 6.5/10 | 8.5/10 | +31% |
| Support Tickets | ~15/week | ~5/week | -67% |

**Revenue Impact**: Assuming 100 new agencies/month, 60% → 85% completion = **+25 agencies onboarded/month** = ~$50k-100k additional MRR (assuming $2k-4k average agency MRR).

---

## MIGRATION STRATEGY: 3 PHASES

### Phase 1: Foundation (Weeks 1-2) ✅ **SAFE - NO BREAKING CHANGES**

**Goal**: Quick wins to reduce immediate pain without changing architecture

**Implementation**:
1. **Structured Inputs** (Week 1)
   - Replace free text with multiselect/dropdown for simple fields
   - Services: Multiselect (SMM, Ads, Content, Video, Design, Strategy)
   - Niche: Dropdown with "Other" (E-commerce, SaaS, Local Services, Fitness, etc.)
   - Voice: Tag selector (Professional, Friendly, Bold, Creative, Data-driven)

2. **Conversation Repair** (Week 1)
   - Add "Edit" button next to completed questions
   - Store edit history in `setup_progress_v1.edit_history`
   - Allow users to go back and modify previous answers

3. **Improved Error Messages** (Week 2)
   - Parse validation failures and provide specific feedback
   - Example: "I found 1 service, but we need 3-6. Can you list 2 more?"
   - Add validation rules to question definitions

**Deliverables**:
- [ ] Structured input components (React)
- [ ] Edit functionality (client + server)
- [ ] Validation framework with specific error messages
- [ ] Tests for all new features

**Success Criteria**:
- ✅ AI extraction calls reduced by 40% (5/12 questions use structured input)
- ✅ User testing shows ≥80% can successfully fix mistakes
- ✅ Error re-entry cycles reduced by ≥50%

**Risk**: Low (additive changes, no breaking changes)

---

### Phase 2: Optimization (Weeks 3-6) ⚠️ **MODERATE - FLOW CHANGES**

**Goal**: Make the flow smarter and more relevant

**Implementation**:

#### 2.1 Question Branching (Week 3)

**Add dependencies to questions**:
```typescript
{
  key: "agency.pricing_structure",
  question_text: "What's your typical pricing structure?",
  dependencies: {
    required_if: [
      {field: "agency.primary_services", includes: ["Ads", "Strategy"]}
    ],
    skip_if: [
      {field: "agency.team_size", lessThan: 3}  // Solo/small agencies often don't have formal pricing
    ]
  }
}
```

**Impact**:
- Reduce average questions from 12 to 7-9
- Skip irrelevant questions (e.g., workflow stages for 2-person agencies)

**Code Changes**:
- Extend `SetupQuestion` type with `dependencies` field
- Update `getNextQuestion()` to evaluate dependencies
- Mark skipped questions as "not_applicable" in progress

---

#### 2.2 Conversation Summarization (Week 4)

**Problem**: 16-message context window loses history

**Solution**:
```typescript
if (messages.length > 16) {
  const oldMessages = messages.slice(0, messages.length - 16);
  const summary = await runAiTask({
    task_type: TaskType.SUMMARIZE,
    input: oldMessages.map(m => m.content).join("\n"),
    systemPrompt: "Summarize key points: services, niche, pricing, workflow mentioned."
  });
  setup_progress_v1.conversation_summary = summary;
}

// In AI context building:
const context = [
  setup_progress_v1.conversation_summary,
  ...messages.slice(-16)
].join("\n\n");
```

**Impact**:
- Maintain context in long sessions (>16 messages)
- Enable "earlier you mentioned..." references

---

#### 2.3 Admin Dashboard for Questions (Week 5-6)

**Problem**: Non-engineering team cannot iterate questions

**Solution**: Build admin UI for question management

**Features**:
- CRUD interface for SETUP_QUESTIONS
- Version management (draft vs active)
- A/B testing (50% users get version A, 50% get version B)
- Metrics dashboard (completion rate, avg time per question)

**Database Schema**:
```sql
CREATE TABLE agency_setup_question_templates (
  id uuid PRIMARY KEY,
  key text NOT NULL,
  question_text text NOT NULL,
  expects text NOT NULL,  -- "text" | "multiselect" | "dropdown" | "tags"
  target_path text NOT NULL,
  dependencies jsonb,
  validation jsonb,
  examples jsonb,
  suggestions jsonb,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',  -- "draft" | "active" | "archived"
  ab_test_group text,  -- "control" | "variant_a" | "variant_b"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE agency_setup_question_metrics (
  id uuid PRIMARY KEY,
  question_id uuid REFERENCES agency_setup_question_templates(id),
  completed_count int DEFAULT 0,
  skipped_count int DEFAULT 0,
  avg_time_seconds float,
  avg_retry_count float,
  user_feedback_score float,  -- 1-5 rating
  created_at timestamptz DEFAULT now()
);
```

**Impact**:
- Product team can iterate questions without engineering
- Data-driven question optimization via metrics

**Deliverables**:
- [ ] Database schema
- [ ] Admin UI for question management
- [ ] A/B testing framework
- [ ] Metrics collection and dashboard

**Risk**: Medium (requires new database tables, migration from hardcoded questions)

---

### Phase 3: Conversational Architecture (Weeks 7-18) 🔥 **HIGH - MAJOR REFACTOR**

**Goal**: Replace state machine with context-aware conversational AI

**This is the big leap** - fundamentally changing how the system works.

---

#### 3A: Hybrid Mode (Weeks 7-10) 🧪 **EXPERIMENTAL**

**Strategy**: Test conversational AI for **low-risk scenarios** first, keep deterministic for core flow.

**Conversational AI Use Cases**:
1. **Offtopic Questions** (already partially implemented)
2. **Clarification Requests**
3. **Multi-Intent Utterances**

**Example Implementation**:

**Current (Deterministic)**:
```typescript
if (intent === "CLARIFICATION_REQUEST") {
  return buildClarificationForQuestion(pendingText, pendingQuestion?.examples);
}
```

**New (Conversational AI)**:
```typescript
if (intent === "CLARIFICATION_REQUEST" || intent === "MULTI_INTENT") {
  const aiResponse = await runAiTask({
    task_type: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
    mode: "conversational",
    metadata: {
      conversation: buildConversationText(messages),
      contextSnapshot: snapshot,
      agencyBrain: brain,
      pending_question: pendingQuestion,
      user_message: opts.message
    }
  });

  // AI returns:
  // {
  //   assistant_message: "...",
  //   actions: [
  //     {type: "extract_value", field: "services", value: ["SMM", "Ads"]},
  //     {type: "ask_clarification", about: "pricing"},
  //     {type: "hold_context", partial_answer: {services: ["SMM", "Ads"]}}
  //   ],
  //   next_question_suggestion: "pricing_structure"
  // }

  // Execute actions
  for (const action of aiResponse.actions) {
    await executeAction(action, brain, opts);
  }

  return {
    assistant_message: aiResponse.assistant_message,
    expects: aiResponse.expects ?? "text",
    // ...
  };
}
```

**Action Executor** (similar to tool executor):
```typescript
async function executeAction(action: SetupAction, brain: Brain, opts: SetupOpts) {
  switch (action.type) {
    case "extract_value":
      return await extractAndStoreToBrain(action.field, action.value, brain);

    case "ask_clarification":
      return {pending_clarification: action.about};

    case "hold_context":
      return await storePartialAnswer(action.partial_answer, opts.sessionId);

    case "suggest_next_topic":
      return {suggested_topics: action.topics};

    default:
      console.warn("unknown_action_type", action.type);
  }
}
```

**Validation Strategy**:
1. Run in shadow mode for 2 weeks (log AI responses, but use deterministic)
2. Compare AI vs deterministic responses, measure quality
3. Enable for 10% of users (A/B test)
4. Gradually increase to 100% if quality ≥95%

**Success Criteria**:
- ✅ AI response quality ≥95% (human evaluation of 100 sample conversations)
- ✅ Multi-intent handling works ≥80% of time
- ✅ No increase in extraction errors
- ✅ User satisfaction ≥7.5/10

**Risk Mitigation**:
- Shadow mode testing before production
- Feature flag for instant rollback
- Human evaluation of AI quality
- Gradual rollout (10% → 50% → 100%)

---

#### 3B: Full Conversational (Weeks 11-14) 🚀 **HIGH RISK**

**Strategy**: Replace ALL deterministic handlers with AI generation.

**Architecture Shift**:

**Before (State Machine)**:
```
User Message
  ↓
Classify Intent (rule-based)
  ↓
Route to Handler (deterministic)
  ├─ READY_CONFIRMATION → buildReadyResponse()
  ├─ ANSWER_TO_ONBOARDING_QUESTION → extractAnswer() + getNextQuestion()
  ├─ CLARIFICATION_REQUEST → buildClarification()
  └─ OFFTOPIC_QUESTION → runAdminGeneralChatAi()
```

**After (Conversational)**:
```
User Message
  ↓
AI Generates Response + Actions
  ↓
Execute Actions (extract, store, suggest)
  ↓
Update Conversation State
```

**New AI Prompt** (use `buildAdminSetupGuidedPrompt` that's currently unused):

```typescript
export function buildAdminSetupGuidedPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt = [
    "You are the agency's AI representative guiding setup.",
    "You have access to conversation context, brain memory, and answered questions.",
    "",
    "CONVERSATION PRINCIPLES:",
    "1. Be adaptive - if user asks multiple things, handle all of them",
    "2. Be forgiving - extract partial answers and ask for missing parts",
    "3. Be contextual - reference previous answers when relevant",
    "4. Be efficient - skip questions if you already have the info",
    "",
    "OUTPUT FORMAT:",
    "Return JSON with:",
    "- assistant_message: Your conversational response",
    "- actions: Array of actions to execute (extract_value, ask_clarification, etc.)",
    "- conversation_state: Current state (answered_fields, partial_answers, followups)",
    "- next_question_suggestion: Which question to ask next (optional)",
    "",
    "AVAILABLE ACTIONS:",
    "- extract_value: {type: 'extract_value', field: 'services', value: ['SMM', 'Ads']}",
    "- ask_clarification: {type: 'ask_clarification', about: 'pricing_structure'}",
    "- hold_context: {type: 'hold_context', partial_answer: {...}}",
    "- suggest_next_topic: {type: 'suggest_next_topic', topics: ['guarantees', 'workflow']}",
    "- mark_complete: {type: 'mark_complete', fields: ['services', 'niche']}",
    "",
    "CONTEXT:",
    `Known fields: ${JSON.stringify(args.knownFields ?? [])}`,
    `Missing fields: ${JSON.stringify(args.missingFields ?? [])}`,
    `Brain snapshot: ${JSON.stringify(args.agencyBrain ?? {})}`,
  ].join("\n");

  const userPrompt = [
    "Conversation so far:",
    args.conversation || "(none)",
    "",
    "Latest user message:",
    args.latestUserMessage || "(none)",
    "",
    "Generate your response and actions."
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
```

**Example Conversation**:

```
User: "My services are SMM and ads, but can you explain pricing structure first?"

AI Response:
{
  "assistant_message": "Perfect! I've noted SMM and ads as your primary services.\n\nRegarding pricing structure - I'm asking if you charge per service (e.g., $2k/mo for SMM), per package (Bronze/Silver/Gold tiers), or custom per client. This helps me understand your business model and create better client-facing content.\n\nWhile you're thinking about that, would you like to add any other services besides SMM and ads?",

  "actions": [
    {
      "type": "extract_value",
      "field": "agency.primary_services",
      "value": ["SMM", "Ads"]
    },
    {
      "type": "hold_context",
      "partial_answer": {
        "services": ["SMM", "Ads"],
        "clarification_requested": "pricing_structure"
      }
    },
    {
      "type": "ask_clarification",
      "about": "pricing_structure",
      "examples": ["per-service", "package-tiers", "custom"]
    }
  ],

  "conversation_state": {
    "answered_fields": ["services"],  // Partial
    "partial_answers": {
      "services": ["SMM", "Ads"]  // Not complete yet (needs 3-6)
    },
    "followup_needed": ["services_complete", "pricing_structure"],
    "clarification_active": "pricing_structure"
  },

  "next_question_suggestion": "pricing_structure"  // After clarification
}
```

**Benefits**:
- ✅ Multi-intent handling ("services AND pricing question")
- ✅ Partial answer extraction (got 2/6 services)
- ✅ Contextual clarification (explains WHY we ask about pricing)
- ✅ User agency (offers to add more services while thinking)

**Code Changes**:
1. **Replace intent classification** with AI response generation
2. **Replace all deterministic handlers** with action executor
3. **Update state tracking** to support conversation_state (not just pending_question)
4. **Implement action executor** (extract_value, ask_clarification, hold_context, etc.)

**Files to Modify**:
- `agency-admin-setup.ts` (major refactor of handleAgencyAdminSetup)
- `adminSetupGuided.ts` (enhance prompt with action schema)
- `agency-admin-setup-orchestrator.ts` (deprecate or repurpose for next_question_suggestion validation)

**Risk Mitigation**:
- Keep Phase 3A (hybrid) running in parallel for 2 weeks
- Deploy to staging with synthetic test conversations
- Human QA team validates 100 test conversations before production
- Feature flag for instant rollback to hybrid mode
- Gradual rollout (5% → 25% → 50% → 100%)

**Success Criteria**:
- ✅ AI response quality ≥95%
- ✅ Action execution accuracy ≥98%
- ✅ Multi-intent handling ≥90%
- ✅ Partial answer preservation ≥95%
- ✅ User satisfaction ≥8/10

---

#### 3C: Session Management (Weeks 15-18) 💾 **INFRASTRUCTURE**

**Goal**: Improve state persistence and recovery

**Problem**: Current state management has 3 disconnected systems (conversation memory, state memory, brain memory).

**Solution**: Unified session-based state

**Database Schema**:

```sql
CREATE TABLE agency_setup_sessions (
  id uuid PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES agencies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  thread_id uuid NOT NULL REFERENCES agency_ai_chat_threads(id),

  -- Status tracking
  status text NOT NULL DEFAULT 'active',  -- "active" | "paused" | "completed" | "abandoned"
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),

  -- Session state
  conversation_state jsonb NOT NULL DEFAULT '{}',  -- Full conversation graph
  partial_answers jsonb NOT NULL DEFAULT '{}',  -- In-progress answers
  conversation_summary text,  -- Compressed history (>16 messages)

  -- Multi-device support
  session_token text NOT NULL UNIQUE,
  device_info jsonb,  -- User agent, IP, etc.

  -- Metrics
  questions_answered int DEFAULT 0,
  questions_skipped int DEFAULT 0,
  total_messages int DEFAULT 0,
  total_ai_calls int DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_agency_setup_sessions_agency ON agency_setup_sessions(agency_id);
CREATE INDEX idx_agency_setup_sessions_status ON agency_setup_sessions(status);
CREATE INDEX idx_agency_setup_sessions_token ON agency_setup_sessions(session_token);
CREATE INDEX idx_agency_setup_sessions_expires ON agency_setup_sessions(expires_at) WHERE status = 'active';

-- Cleanup job
CREATE OR REPLACE FUNCTION abandon_expired_setup_sessions()
RETURNS void AS $$
BEGIN
  UPDATE agency_setup_sessions
  SET status = 'abandoned', updated_at = now()
  WHERE status = 'active'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Run daily
SELECT cron.schedule('abandon-expired-setup-sessions', '0 2 * * *', 'SELECT abandon_expired_setup_sessions()');
```

**Features**:

1. **Partial Answer Autosave**:
   ```typescript
   // Client-side (debounced)
   const [answer, setAnswer] = useState("");

   useEffect(() => {
     const timer = setTimeout(async () => {
       await fetch("/api/sessions/autosave", {
         method: "POST",
         body: JSON.stringify({
           session_id: sessionId,
           partial_answer: { field: "services", value: answer }
         })
       });
     }, 1000);  // Save after 1s of inactivity

     return () => clearTimeout(timer);
   }, [answer]);
   ```

2. **Multi-Device Resume**:
   ```typescript
   // Generate session token on first message
   const sessionToken = generateSecureToken();

   // Store in session
   await supabase
     .from("agency_setup_sessions")
     .insert({
       agency_id: agencyId,
       user_id: userId,
       thread_id: threadId,
       session_token: sessionToken
     });

   // Return to client
   return {
     session_token: sessionToken,
     resume_url: `https://app.smmahub.com/setup?session=${sessionToken}`
   };

   // Resume on different device
   const session = await supabase
     .from("agency_setup_sessions")
     .select("*")
     .eq("session_token", sessionToken)
     .single();

   // Load conversation state and continue
   ```

3. **Context Replay on Resume**:
   ```typescript
   if (session.status === "paused") {
     const replay = {
       assistant_message: [
         "Welcome back! Here's where we left off:",
         "",
         `✓ Services: ${session.conversation_state.answered_fields.services.join(", ")}`,
         `✓ Niche: ${session.conversation_state.answered_fields.niche}`,
         "",
         `We were discussing: ${session.conversation_state.pending_question_text}`,
         "",
         session.partial_answers.current
           ? `You started answering: "${session.partial_answers.current}"`
           : "Would you like to continue?"
       ].join("\n"),
       expects: "text",
       suggestions: [
         {id: "continue", label: "Continue", user_message: session.partial_answers.current ?? "Continue"},
         {id: "restart", label: "Start over", user_message: "Let's start from the beginning"}
       ]
     };
     return replay;
   }
   ```

4. **Session Timeout & Cleanup**:
   ```typescript
   // Auto-abandon after 7 days (via cron job)
   // Send email notification before abandonment
   if (session.expires_at - now() < 1 day) {
     await sendEmail({
       to: user.email,
       subject: "Complete your SMMAHUB setup",
       body: `You started setting up your agency but didn't finish.
              Resume here: ${resumeUrl}
              This link expires in 24 hours.`
     });
   }
   ```

**Benefits**:
- ✅ No lost partial answers
- ✅ Multi-device support (start on mobile, finish on desktop)
- ✅ Better session hygiene (no infinite paused sessions)
- ✅ User re-engagement (email reminders)

**Code Changes**:
- Create `agency_setup_sessions` table
- Replace meta_json state with session table
- Implement autosave on client
- Implement session token generation/validation
- Add context replay on resume

**Risk**: Low (additive feature, doesn't break existing flow)

---

## ROLLOUT STRATEGY

### Feature Flags

```typescript
// Environment variables
AI_SETUP_STRUCTURED_INPUTS=true  // Phase 1.1
AI_SETUP_CONVERSATION_REPAIR=true  // Phase 1.2
AI_SETUP_IMPROVED_ERRORS=true  // Phase 1.3
AI_SETUP_QUESTION_BRANCHING=true  // Phase 2.1
AI_SETUP_SUMMARIZATION=true  // Phase 2.2
AI_SETUP_ADMIN_DASHBOARD=true  // Phase 2.3
AI_SETUP_CONVERSATIONAL_HYBRID=false  // Phase 3A (start disabled)
AI_SETUP_CONVERSATIONAL_FULL=false  // Phase 3B (start disabled)
AI_SETUP_SESSION_MANAGEMENT=false  // Phase 3C (start disabled)

// User-level feature flags (for gradual rollout)
AI_SETUP_CONVERSATIONAL_ROLLOUT_PERCENT=0  // 0-100
```

### Gradual Rollout (Phase 3)

**Week 7-8 (Shadow Mode)**:
- Conversational AI runs in parallel with deterministic
- Logs AI responses for quality evaluation
- No user-facing changes
- 100 conversations manually reviewed

**Week 9 (10% Rollout)**:
- Enable conversational for 10% of new setup sessions
- Monitor error rates, completion rates, user feedback
- Daily review of AI responses

**Week 10 (50% Rollout)**:
- If 10% rollout successful, increase to 50%
- Continue monitoring

**Week 11-14 (100% Rollout)**:
- If 50% rollout successful, increase to 100%
- Deprecate deterministic handlers (keep as fallback)

### Rollback Plan

If any phase shows:
- Completion rate drops >10%
- Error rate increases >20%
- User satisfaction drops >1 point
- Critical bugs discovered

**Immediate Actions**:
1. Set feature flag to false (instant rollback)
2. Investigate root cause
3. Fix issue in staging
4. Retry rollout after validation

---

## SUCCESS METRICS & MONITORING

### Key Performance Indicators (KPIs)

| Phase | Metric | Target | Measurement |
|-------|--------|--------|-------------|
| **Phase 1** | AI Call Reduction | -40% | Count AI extraction calls |
| | Error Recovery | 80% success | User testing |
| | Re-entry Cycles | -50% | Track retry attempts |
| **Phase 2** | Avg Questions | 7-9 (from 12) | Track questions asked |
| | Context Preservation | >16 messages | Test long sessions |
| | Question Iteration | 5 updates/week | Track admin dashboard usage |
| **Phase 3A** | AI Quality | ≥95% | Human evaluation |
| | Multi-Intent | ≥80% | Automated testing |
| | User Satisfaction | ≥7.5/10 | Post-setup survey |
| **Phase 3B** | Completion Rate | ≥85% | Track session completion |
| | Action Accuracy | ≥98% | Validate action execution |
| | Response Time | <2s | Track latency |
| **Phase 3C** | Partial Answer Recovery | ≥95% | Test pause/resume |
| | Multi-Device | 100% | Test resume on different device |

### Monitoring Dashboards

**Real-Time Metrics**:
- Active setup sessions (current)
- Completion rate (last 7 days)
- Avg time to complete (last 7 days)
- Error rate by question (last 24 hours)
- AI response quality score (last 100 conversations)

**Alerts**:
- Completion rate drops >10% (email + Slack)
- Error rate spikes >20% (email + Slack + PagerDuty)
- AI quality score <90% (email + Slack)
- Response time >3s (email)

### A/B Testing Framework

**Phase 2.3 Enables**:
- Test different question phrasings
- Test different question orders
- Test with/without dependencies
- Test structured vs free text inputs

**Example A/B Test**:
```typescript
{
  experiment_id: "services-question-phrasing",
  variants: [
    {
      id: "control",
      question_text: "What are your primary services? List 3-6.",
      rollout_percent: 50
    },
    {
      id: "variant_a",
      question_text: "What services do you offer to clients? (Tell me 3-6)",
      rollout_percent: 50
    }
  ],
  metrics: {
    completion_rate: {},
    avg_time_seconds: {},
    user_feedback_score: {}
  },
  duration_days: 14
}
```

---

## COST ANALYSIS

### Current Costs (Per Complete Onboarding)

| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| AI Extraction Calls | 12 | $0.005 | $0.06 |
| AI Orchestration Calls | 12 | $0.005 | $0.06 |
| Database Operations | ~50 | $0.0001 | $0.005 |
| **Total** | | | **$0.125** |

**Monthly** (100 completions): ~$12.50

---

### Phase 1 Costs (Structured Inputs)

| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| AI Extraction Calls | 7 (down from 12) | $0.005 | $0.035 |
| AI Orchestration Calls | 7 | $0.005 | $0.035 |
| Database Operations | ~50 | $0.0001 | $0.005 |
| **Total** | | | **$0.075** |

**Savings**: $0.05 per completion = **40% cost reduction**
**Monthly** (100 completions): ~$7.50 (**saves $5/month**)

---

### Phase 3B Costs (Full Conversational)

| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| AI Response Generation | 9 (avg questions) | $0.015 | $0.135 |
| AI Action Execution | 9 | $0.005 | $0.045 |
| Database Operations | ~60 | $0.0001 | $0.006 |
| **Total** | | | **$0.186** |

**Increase**: $0.061 per completion = **49% cost increase**
**Monthly** (100 completions): ~$18.60 (**+$11.10/month**)

**BUT**: Higher completion rate (60% → 85%) = **+25 agencies/month**
**Revenue increase**: 25 × $2k (avg MRR) = **+$50k/month**
**ROI**: $50k / $11.10 = **4,505x return on AI investment**

---

## RISK ASSESSMENT

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **AI response quality degradation** | High | Shadow mode testing, human evaluation, gradual rollout |
| **Increased latency** | Medium | Parallel action execution, caching, response streaming |
| **Database migration failures** | Medium | Comprehensive testing, rollback plan, phased migration |
| **Session state corruption** | Medium | Validation, backups, auto-recovery |
| **Cost overruns** | Low | Usage monitoring, budget alerts, cost caps |

### Product Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **User confusion from UX changes** | Medium | In-app tooltips, changelog, support documentation |
| **Completion rate drop during transition** | High | Feature flags for instant rollback, monitoring dashboards |
| **Support ticket increase** | Medium | Proactive communication, in-app help, support training |

### Business Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Delayed timeline** | Medium | Phased approach allows partial benefits, buffer time in estimates |
| **Resource constraints** | Medium | Clear ownership, external help if needed |
| **Stakeholder misalignment** | Low | Regular updates, demos at each phase |

---

## TEAM & RESOURCES

### Required Team

| Role | Allocation | Responsibilities |
|------|------------|------------------|
| **Senior Engineer** | 100% (Weeks 1-18) | Architecture, Phase 3 implementation |
| **Mid-Level Engineer** | 50% (Weeks 1-6) | Phase 1-2 implementation |
| **Product Manager** | 25% (Weeks 1-18) | Requirements, testing, rollout |
| **Designer** | 25% (Weeks 1-6) | Structured input components, admin dashboard |
| **QA Engineer** | 50% (Weeks 7-18) | AI quality evaluation, testing |

### External Dependencies

- **AI Provider (OpenAI/Anthropic)**: Ensure rate limits support increased usage
- **Database**: Ensure Supabase plan supports additional tables and queries
- **Monitoring**: Set up Datadog/Sentry for real-time alerts

---

## TIMELINE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                        MIGRATION TIMELINE                        │
└─────────────────────────────────────────────────────────────────┘

Weeks 1-2:   ████████ Phase 1: Foundation
             ├─ Structured inputs
             ├─ Conversation repair
             └─ Improved error messages

Weeks 3-6:   ████████████████ Phase 2: Optimization
             ├─ Question branching
             ├─ Conversation summarization
             └─ Admin dashboard

Weeks 7-10:  ████████ Phase 3A: Hybrid Conversational
             ├─ Shadow mode testing (Weeks 7-8)
             ├─ 10% rollout (Week 9)
             └─ 50% rollout (Week 10)

Weeks 11-14: ████████ Phase 3B: Full Conversational
             ├─ Staging deployment (Week 11)
             ├─ QA evaluation (Week 12)
             └─ Gradual rollout (Weeks 13-14)

Weeks 15-18: ████████ Phase 3C: Session Management
             ├─ Database migration (Week 15)
             ├─ Autosave implementation (Week 16)
             ├─ Multi-device testing (Week 17)
             └─ Cleanup automation (Week 18)

──────────────────────────────────────────────────────────────────
Total: 18 weeks (~4.5 months)
```

---

## APPROVAL CHECKLIST

Before proceeding with implementation, ensure:

- [ ] **Stakeholder Buy-In**: Product, Engineering, Design aligned on vision
- [ ] **Budget Approval**: AI cost increase (~$11/month) approved
- [ ] **Resource Allocation**: Team members assigned (see Team & Resources)
- [ ] **Success Metrics**: Agreement on KPIs and rollback criteria
- [ ] **Timeline Approval**: 18-week timeline fits roadmap
- [ ] **Risk Acceptance**: Technical and product risks reviewed and accepted

---

## NEXT STEPS

1. **Review this plan** with product, engineering, design teams
2. **Get approval** from leadership on timeline and budget
3. **Assign resources** (engineers, PM, designer, QA)
4. **Create JIRA tickets** for Phase 1 tasks
5. **Schedule kickoff meeting** for Week 1

**Recommended Start Date**: 2 weeks after approval (buffer for team ramp-up)

---

## QUESTIONS & DISCUSSION

**Open Questions**:
1. Should we build Phase 2.3 (admin dashboard) before Phase 3? Or can it wait?
2. What's our tolerance for AI cost increase in Phase 3B?
3. Do we need external QA help for Phase 3, or can we handle internally?
4. Should we hire a conversation designer for Phase 3B prompt optimization?

**Alternatives Considered**:
1. **Incremental improvements only** (Phase 1-2, skip Phase 3)
   - **Pros**: Lower risk, faster delivery
   - **Cons**: Doesn't solve fundamental rigidity, limited upside

2. **Big bang migration** (skip Phase 1-2, go straight to Phase 3)
   - **Pros**: Faster to end goal
   - **Cons**: Higher risk, no incremental value, harder to debug

3. **Hybrid forever** (Phase 3A only, never go full conversational)
   - **Pros**: Balance of flexibility and predictability
   - **Cons**: Complexity of maintaining two systems

**Recommendation**: Proceed with 3-phase plan as outlined (balanced approach)

---

**End of Migration Plan**
