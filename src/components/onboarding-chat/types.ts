export type ChatRole = "assistant" | "user";

export type OnboardingChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  json?: Record<string, unknown> | null;
};

export type OnboardingTurnResponse = {
  v: string;
  trace_id: string;
  onboarding_status: {
    id: string;
    status: "not_started" | "in_progress" | "complete" | "blocked";
    scope: "agency" | "client";
    last_step_id: string | null;
    started_at: string | null;
    completed_at: string | null;
  };
  assistant_message: string;
  expects: string;
  suggestions: string[];
  question_id?: string;
  field_path?: string;
  priority?: "P0" | "P1" | "P2";
  input_type?: "text" | "list" | "numeric" | "percent" | "tz_lang";
  can_skip?: boolean;
  progress?: {
    required_complete: boolean;
    current_index: number;
    total_required: number;
  };
  unknown: boolean;
  unknown_reason?: string;
  brain_snapshot: Record<string, unknown>;
  state: {
    module: string;
    resolver_state: "ready" | "calibration_needed" | "unknown";
    missing_fields?: string[];
  };
  idempotent_replay?: boolean;
};
