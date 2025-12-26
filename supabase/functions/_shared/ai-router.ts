import { ai } from "../../../src/ai/router.ts";
import type { ChatMessage } from "../../../src/ai/providers/types.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

type RunAiTaskInput = {
  task_type: TaskType;
  mode: "dev" | "prod";
  tenant: {
    agency_id?: string;
    user_id?: string;
    client_id?: string;
  };
  context?: {
    thread_id?: string;
    messages?: ChatMessage[];
    agency_brain?: Record<string, unknown>;
    client_brain?: Record<string, unknown>;
  };
  input?: {
    message?: string;
    goal?: string;
  };
  metadata?: Record<string, unknown>;
  supabase?: any;
};

export async function runAiTask(input: RunAiTaskInput) {
  const result = await ai.run({
    taskType: input.task_type,
    input: input.input?.message ?? "",
    messages: input.context?.messages,
    context: {
      agencyId: input.tenant.agency_id,
      clientId: input.tenant.client_id,
      userId: input.tenant.user_id,
      environment: input.mode,
      supabase: input.supabase,
    },
    metadata: input.metadata,
  });

  return {
    assistant_message: result.text,
    json: result.output,
    meta: result.meta,
  };
}

export async function runAiTaskStream(input: RunAiTaskInput) {
  return ai.runStream({
    taskType: input.task_type,
    input: input.input?.message ?? "",
    messages: input.context?.messages,
    context: {
      agencyId: input.tenant.agency_id,
      clientId: input.tenant.client_id,
      userId: input.tenant.user_id,
      environment: input.mode,
      supabase: input.supabase,
    },
    metadata: input.metadata,
  });
}
