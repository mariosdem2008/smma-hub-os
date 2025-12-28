/**
 * Calibration State Machine
 *
 * Server-side idempotent state machine for admin calibration flow.
 * This module fixes the question duplication bug by:
 * 1. Tracking all answered questions in server-side state
 * 2. Generating idempotency tokens to prevent duplicate processing
 * 3. Providing exactly-once semantics for question/answer pairs
 *
 * CRITICAL INVARIANTS:
 * - Same message sent twice = 0 duplicates in brain
 * - Session resume from DB state, not message parsing
 * - No question asked if already answered (skip to next)
 */

import {
  type CalibrationState,
  EMPTY_CALIBRATION_STATE,
  fetchCalibrationState,
  updateCalibrationState,
  generateQuestionHash,
  isQuestionAnswered,
} from "./brain-documents.ts";

type MinimalSupabase = {
  from: (table: string) => any;
};

/**
 * Calibration step result
 */
export type CalibrationStepResult = {
  /** Whether the step was processed (false = duplicate, skipped) */
  processed: boolean;
  /** The updated calibration state */
  state: CalibrationState;
  /** Reason if not processed */
  skipReason?: "duplicate_question" | "already_answered" | "session_complete";
  /** Idempotency token for this step */
  idempotencyToken?: string;
};

/**
 * Question transition request
 */
export interface QuestionTransitionRequest {
  /** The question key being asked */
  questionKey: string;
  /** The question text */
  questionText: string;
  /** Optional expected step (for optimistic locking) */
  expectedStep?: string | null;
}

/**
 * Answer transition request
 */
export interface AnswerTransitionRequest {
  /** The question key being answered */
  questionKey: string;
  /** The answer value (any type) */
  answerValue: unknown;
  /** Idempotency token from the question step */
  idempotencyToken?: string;
}

/**
 * Initialize or resume a calibration session
 * Returns the current state, creating a new session if needed
 */
export async function initializeCalibrationSession(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<CalibrationState> {
  const currentState = await fetchCalibrationState(supabase, agencyId);

  // If no session exists, create one
  if (!currentState.session_id) {
    const newState: CalibrationState = {
      ...EMPTY_CALIBRATION_STATE,
      session_id: crypto.randomUUID(),
    };
    await updateCalibrationState(supabase, agencyId, newState);
    return newState;
  }

  // If session is complete, optionally start a new one
  if (currentState.completed_at) {
    // For now, return the completed state
    // The caller can decide whether to start a new session
    return currentState;
  }

  return currentState;
}

/**
 * Transition to asking a question (idempotent)
 *
 * INVARIANT: If this question was already asked and not answered,
 * return the same state without modification.
 */
export async function transitionToQuestion(
  supabase: MinimalSupabase,
  agencyId: string,
  request: QuestionTransitionRequest
): Promise<CalibrationStepResult> {
  const state = await fetchCalibrationState(supabase, agencyId);

  // Check if session is complete
  if (state.completed_at) {
    return {
      processed: false,
      state,
      skipReason: "session_complete",
    };
  }

  // Check if this question was already answered
  if (isQuestionAnswered(state, request.questionKey)) {
    return {
      processed: false,
      state,
      skipReason: "already_answered",
    };
  }

  // Generate idempotency token
  const questionHash = generateQuestionHash(
    request.questionKey,
    request.questionText
  );

  // Check for duplicate question (same question being asked again)
  if (
    state.current_step === request.questionKey &&
    state.last_question_hash === questionHash
  ) {
    return {
      processed: false,
      state,
      skipReason: "duplicate_question",
      idempotencyToken: questionHash,
    };
  }

  // Optimistic locking: verify expected step if provided
  if (
    request.expectedStep !== undefined &&
    state.current_step !== request.expectedStep
  ) {
    // State has changed since client's view - return current state
    // This prevents race conditions in concurrent requests
    return {
      processed: false,
      state,
      skipReason: "duplicate_question",
      idempotencyToken: state.last_question_hash ?? undefined,
    };
  }

  // Transition to new question
  const newState: CalibrationState = {
    ...state,
    current_step: request.questionKey,
    last_question_id: crypto.randomUUID(),
    last_question_hash: questionHash,
  };

  await updateCalibrationState(supabase, agencyId, newState);

  return {
    processed: true,
    state: newState,
    idempotencyToken: questionHash,
  };
}

/**
 * Transition to answered state (idempotent)
 *
 * INVARIANT: If this question was already answered,
 * skip without modifying state.
 */
export async function transitionToAnswered(
  supabase: MinimalSupabase,
  agencyId: string,
  request: AnswerTransitionRequest
): Promise<CalibrationStepResult> {
  const state = await fetchCalibrationState(supabase, agencyId);

  // Check if session is complete
  if (state.completed_at) {
    return {
      processed: false,
      state,
      skipReason: "session_complete",
    };
  }

  // CRITICAL IDEMPOTENCY CHECK: If already answered, skip
  if (isQuestionAnswered(state, request.questionKey)) {
    return {
      processed: false,
      state,
      skipReason: "already_answered",
    };
  }

  // Verify idempotency token if provided
  if (
    request.idempotencyToken &&
    state.last_question_hash &&
    request.idempotencyToken !== state.last_question_hash
  ) {
    // Token mismatch - this might be a stale request
    // Still process if the question wasn't answered yet
    console.warn(
      `[CalibrationState] Idempotency token mismatch for ${request.questionKey}. ` +
        `Expected: ${state.last_question_hash}, Got: ${request.idempotencyToken}`
    );
  }

  // Mark question as answered
  const newState: CalibrationState = {
    ...state,
    answered_keys: [...state.answered_keys, request.questionKey],
    current_step: null, // Will be set by next question selection
    last_question_id: null,
    last_question_hash: null,
  };

  await updateCalibrationState(supabase, agencyId, newState);

  return {
    processed: true,
    state: newState,
  };
}

/**
 * Mark calibration as complete
 */
export async function completeCalibration(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<CalibrationState> {
  const state = await fetchCalibrationState(supabase, agencyId);

  if (state.completed_at) {
    return state; // Already complete
  }

  const completedState: CalibrationState = {
    ...state,
    current_step: null,
    last_question_id: null,
    last_question_hash: null,
    completed_at: new Date().toISOString(),
  };

  await updateCalibrationState(supabase, agencyId, completedState);

  return completedState;
}

/**
 * Reset calibration session (start fresh)
 * Use with caution - this clears all progress
 */
export async function resetCalibrationSession(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<CalibrationState> {
  const newState: CalibrationState = {
    ...EMPTY_CALIBRATION_STATE,
    session_id: crypto.randomUUID(),
  };

  await updateCalibrationState(supabase, agencyId, newState);

  return newState;
}

/**
 * Get the next unanswered question key from a list
 * Returns null if all questions are answered
 */
export function getNextUnansweredQuestion(
  state: CalibrationState,
  questionKeys: string[]
): string | null {
  for (const key of questionKeys) {
    if (!isQuestionAnswered(state, key)) {
      return key;
    }
  }
  return null;
}

/**
 * Calculate calibration progress percentage
 */
export function calculateProgress(
  state: CalibrationState,
  totalQuestions: number
): number {
  if (totalQuestions === 0) return 100;
  if (state.completed_at) return 100;

  const answered = state.answered_keys.length;
  return Math.round((answered / totalQuestions) * 100);
}

/**
 * Check if calibration can be resumed (not complete, has session)
 */
export function canResumeCalibration(state: CalibrationState): boolean {
  return !!state.session_id && !state.completed_at;
}

/**
 * Validate that state is consistent
 * Returns list of issues if any
 */
export function validateCalibrationState(
  state: CalibrationState
): string[] {
  const issues: string[] = [];

  // Check for duplicate answered keys
  const uniqueKeys = new Set(state.answered_keys);
  if (uniqueKeys.size !== state.answered_keys.length) {
    issues.push("Duplicate keys in answered_keys array");
  }

  // Check that completed_at is set correctly
  if (state.completed_at && state.current_step) {
    issues.push("completed_at set but current_step is not null");
  }

  // Check session_id exists if there's any progress
  if (state.answered_keys.length > 0 && !state.session_id) {
    issues.push("answered_keys exist but no session_id");
  }

  return issues;
}

/**
 * Debug helper: dump calibration state
 */
export function debugCalibrationState(state: CalibrationState): string {
  return JSON.stringify(
    {
      session_id: state.session_id?.slice(0, 8) + "...",
      current_step: state.current_step,
      answered_count: state.answered_keys.length,
      answered_keys: state.answered_keys,
      has_pending_question: !!state.last_question_id,
      is_complete: !!state.completed_at,
    },
    null,
    2
  );
}
