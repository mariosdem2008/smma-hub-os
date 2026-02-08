export type PlanStep = {
  stepId: string;
  toolId: string;
  input: Record<string, unknown>;
  dependsOn?: string[];
};

export type Plan = {
  planId: string;
  taskType: string;
  steps: PlanStep[];
};

export type ExecutorContext = {
  agencyId: string;
  clientId?: string | null;
  userId?: string | null;
};

export type ToolExecutor = (step: PlanStep) => Promise<{ success: boolean; result?: unknown; error?: string }>;

export type CheckpointWriter = (input: {
  planId: string;
  stepId: string;
  status: "pending" | "running" | "completed" | "failed";
  context: ExecutorContext;
  payload?: Record<string, unknown> | null;
}) => Promise<void>;

function canRun(step: PlanStep, completed: Set<string>) {
  const deps = step.dependsOn ?? [];
  return deps.every((dep) => completed.has(dep));
}

export async function runDurablePlan(opts: {
  plan: Plan;
  context: ExecutorContext;
  executeTool: ToolExecutor;
  writeCheckpoint?: CheckpointWriter;
}) {
  const completed = new Set<string>();
  const results: Record<string, unknown> = {};

  for (const step of opts.plan.steps) {
    if (!canRun(step, completed)) {
      return { success: false, error: "dependency_missing", results };
    }

    if (opts.writeCheckpoint) {
      await opts.writeCheckpoint({
        planId: opts.plan.planId,
        stepId: step.stepId,
        status: "running",
        context: opts.context,
      });
    }

    const outcome = await opts.executeTool(step);
    if (!outcome.success) {
      if (opts.writeCheckpoint) {
        await opts.writeCheckpoint({
          planId: opts.plan.planId,
          stepId: step.stepId,
          status: "failed",
          context: opts.context,
          payload: { error: outcome.error ?? "tool_failed" },
        });
      }
      return { success: false, error: outcome.error ?? "tool_failed", results };
    }

    results[step.stepId] = outcome.result ?? null;
    completed.add(step.stepId);

    if (opts.writeCheckpoint) {
      await opts.writeCheckpoint({
        planId: opts.plan.planId,
        stepId: step.stepId,
        status: "completed",
        context: opts.context,
        payload: { result: outcome.result ?? null },
      });
    }
  }

  return { success: true, results };
}
