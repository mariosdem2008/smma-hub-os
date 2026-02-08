import { ai } from "./router.ts";
import { TaskType } from "./taskTypes.ts";
import type { PlanSchemaV1 } from "./schema.ts";

export async function createPlan(opts: {
  input: string;
  intent?: string;
  context?: { agencyId?: string; clientId?: string; userId?: string };
  metadata?: Record<string, unknown>;
}): Promise<PlanSchemaV1 | null> {
  const result = await ai.run({
    taskType: TaskType.PLANNER,
    input: opts.input,
    context: {
      agencyId: opts.context?.agencyId,
      clientId: opts.context?.clientId,
      userId: opts.context?.userId,
      environment: "prod",
      supabase: null,
      skipUsageLog: true,
    },
    metadata: { ...opts.metadata, intent: opts.intent },
  });

  return (result.output as PlanSchemaV1) ?? null;
}
