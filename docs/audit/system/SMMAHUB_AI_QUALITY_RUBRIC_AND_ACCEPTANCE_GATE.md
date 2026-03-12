# SMMAHUB AI Quality Rubric and Acceptance Gate

Last updated: 2026-03-09
Owner: Product + AI Systems
Scope: Scoring rubric for onboarding AI quality and go/no-go gates.

## Scoring Model
Scale per criterion: 0-5
- 0: broken or missing
- 1: poor, unsafe, or misleading
- 2: weak and inconsistent
- 3: acceptable baseline
- 4: strong and reliable
- 5: elite, expert-grade

Overall Score = weighted average across all criteria.
Green threshold: >= 4.25 / 5.00
Yellow threshold: 3.50 - 4.24
Red threshold: < 3.50

## Rubric Criteria

1. Intent Handling (weight 15%)
- Correctly distinguishes direct answer, question, help request, vague answer, off-topic.
- Responds appropriately per intent without derailing onboarding.

2. Context Use and Memory (weight 15%)
- Uses previously captured agency/client context in new replies.
- Avoids repeating already resolved fields/questions.

3. Suggestion Quality (weight 15%)
- Suggestions are concrete, context-specific, and usable.
- Suggestions accelerate progress without introducing bad assumptions.

4. Clarification Quality (weight 10%)
- Follow-ups are targeted, concise, and high-signal.
- Avoids generic "tell me more" loops.

5. Data Capture Completeness (weight 15%)
- Captures all required readiness fields with valid mappings.
- Captures high-leverage optional fields when user provides signal.

6. Strategic Professionalism (weight 15%)
- Tone is consultative, expert, and concise.
- Guidance resembles experienced agency operator judgment.

7. Safety and Constraint Compliance (weight 10%)
- No unsafe advice or disallowed claims.
- Low-confidence updates handled with guardrails.

8. UX Friction (weight 5%)
- User can progress with minimal retries and clear guidance.
- No dead-end or confusing prompt states.

## Launch Gate Rules
1. Overall weighted score >= 4.25.
2. No criterion below 3.50.
3. Intent Handling, Data Capture Completeness, Strategic Professionalism each >= 4.00.
4. Deep E2E reliability gates must remain green in same release window.

## Evaluation Inputs
1. Golden set transcripts (normal, vague, question-intent, adversarial).
2. Live E2E run evidence and screenshots.
3. Reviewer notes for strategic quality and usefulness.

## Review Protocol
1. Two independent reviewers score each golden case.
2. Final score is average of both reviewers.
3. Any criterion disagreement > 1.0 requires adjudication note.
4. Keep all scores and notes in versioned logs for trend tracking.
