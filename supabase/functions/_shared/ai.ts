import { ai } from "../../../src/ai/router.ts";
import { logUsage } from "../../../src/ai/logging.ts";
import type { ChatMessage } from "../../../src/ai/providers/types.ts";
import type { OutputSchema } from "../../../src/ai/schema.ts";
import { getTaskConfig } from "../../../src/ai/taskRegistry.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { calculateCost, checkBudget, incrementBudget } from "./budgets.ts";

type RunAiTaskInput = {
  task_type: TaskType;
  mode?: "dev" | "prod";
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
  outputSchema?: OutputSchema<unknown>;
  supabase?: any;
};

type MinimalSupabase = {
  from: (table: string) => any;
  rpc?: (fn: string, args?: Record<string, unknown>) => Promise<{ data?: any; error?: any }>;
};

type AiGuardError = {
  code: "AI_BUDGET_EXCEEDED" | "AI_RATE_LIMIT";
  message: string;
};

const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_MONTHLY_BUDGET = 50;

function resolveMode(mode?: "dev" | "prod") {
  if (mode === "dev" || mode === "prod") return mode;
  const envMode = typeof Deno !== "undefined" ? Deno.env.get("AI_MODE") : undefined;
  return envMode === "prod" ? "prod" : "dev";
}

function utcDayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function utcMonthString(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function buildBlockedResult(error: AiGuardError) {
  return {
    assistant_message: "UNKNOWN",
    json: null,
    usage: undefined,
    rawText: "",
    schemaOk: false,
    meta: { provider: "none", model: "blocked" },
    error,
  };
}

async function enforceRateLimit(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  userId: string;
  dayKey: string;
}): Promise<AiGuardError | null> {
  const { supabase, agencyId, userId, dayKey } = opts;
  const { data: rateRow } = await supabase
    .from("ai_rate_limits")
    .select("id, used_count, limit_per_day")
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .eq("day_yyyy_mm_dd", dayKey)
    .maybeSingle();

  if (!rateRow) {
    await supabase.from("ai_rate_limits").insert({
      agency_id: agencyId,
      user_id: userId,
      day_yyyy_mm_dd: dayKey,
      limit_per_day: DEFAULT_DAILY_LIMIT,
      used_count: 1,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
    return null;
  }

  if (rateRow.used_count >= rateRow.limit_per_day) {
    return {
      code: "AI_RATE_LIMIT",
      message: "Daily rate limit reached. Please try again after 00:00 UTC.",
    };
  }

  await supabase
    .from("ai_rate_limits")
    .update({ used_count: rateRow.used_count + 1 })
    .eq("agency_id", agencyId)
    .eq("user_id", userId)
    .eq("day_yyyy_mm_dd", dayKey);

  return null;
}

async function enforceBudget(opts: {
  supabase: MinimalSupabase;
  agencyId: string;
  monthKey: string;
}): Promise<AiGuardError | null> {
  const { supabase, agencyId, monthKey } = opts;
  let budgetSnapshot = await checkBudget(supabase, agencyId, monthKey);
  if (!budgetSnapshot.budgetId) {
    await supabase.from("ai_budgets").insert({
      agency_id: agencyId,
      month_yyyy_mm: monthKey,
      budget_usd: DEFAULT_MONTHLY_BUDGET,
      spent_usd: 0,
      hard_stop: true,
      reset_day: 1,
      reset_time_utc: "00:00",
      reset_timezone: "UTC",
    });
    budgetSnapshot = await checkBudget(supabase, agencyId, monthKey);
  }

  if (!budgetSnapshot.allowed && budgetSnapshot.hardStop) {
    return {
      code: "AI_BUDGET_EXCEEDED",
      message: "Monthly AI budget exceeded.",
    };
  }

  return null;
}

async function logAiRunAndUsage(opts: {
  supabase: MinimalSupabase | null | undefined;
  taskType: TaskType;
  agencyId?: string;
  clientId?: string;
  userId?: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  success: boolean;
  unknown: boolean;
  costUsd: number;
  errorCode?: string | null;
}) {
  if (!opts.supabase) return;
  const taskConfig = getTaskConfig(opts.taskType);
  const endpoint = taskConfig?.usageEndpoint ?? "unknown";

  try {
    await logUsage(opts.supabase, {
      taskType: opts.taskType,
      endpoint,
      provider: opts.provider,
      model: opts.model,
      agencyId: opts.agencyId,
      clientId: opts.clientId,
      latencyMs: opts.latencyMs,
      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
      unknown: opts.unknown,
      success: opts.success,
      errorCode: opts.errorCode ?? null,
    });

    await opts.supabase.from("ai_runs").insert({
      agency_id: opts.agencyId ?? null,
      client_id: opts.clientId ?? null,
      user_id: opts.userId ?? null,
      prompt_id: null,
      prompt_version: null,
      model: opts.model,
      tokens_in: opts.tokensIn,
      tokens_out: opts.tokensOut,
      cost_usd: opts.costUsd,
      latency_ms: opts.latencyMs,
      success: opts.success,
      citations: {},
      unknown: opts.unknown,
      escalate_to_human: false,
      escalation_reason: null,
      metadata: {
        task_type: opts.taskType,
        endpoint,
        error_code: opts.errorCode ?? null,
      },
    });
  } catch (error) {
    console.error("ai_run_logging_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function runAiTask(input: RunAiTaskInput) {
  const startTime = Date.now();
  const supabase = input.supabase as MinimalSupabase | undefined;
  const agencyId = input.tenant.agency_id;
  const userId = input.tenant.user_id;
  const clientId = input.tenant.client_id;

  if (!supabase || !agencyId || !userId) {
    return buildBlockedResult({
      code: "AI_RATE_LIMIT",
      message: "Missing AI enforcement context.",
    });
  }

  const dayKey = utcDayString();
  const monthKey = utcMonthString();

  const rateError = await enforceRateLimit({ supabase, agencyId, userId, dayKey });
  if (rateError) {
    const latencyMs = Date.now() - startTime;
    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider: "none",
      model: "blocked",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      success: false,
      unknown: true,
      costUsd: 0,
      errorCode: rateError.code,
    });
    return buildBlockedResult(rateError);
  }

  const budgetError = await enforceBudget({ supabase, agencyId, monthKey });
  if (budgetError) {
    const latencyMs = Date.now() - startTime;
    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider: "none",
      model: "blocked",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      success: false,
      unknown: true,
      costUsd: 0,
      errorCode: budgetError.code,
    });
    return buildBlockedResult(budgetError);
  }

  try {
    const result = await ai.run({
      taskType: input.task_type,
      input: input.input?.message ?? "",
      messages: input.context?.messages,
      context: {
        agencyId,
        clientId,
        userId,
        environment: resolveMode(input.mode),
        supabase: input.supabase,
        skipUsageLog: true,
      },
      metadata: input.metadata,
      outputSchema: input.outputSchema,
    });

    const latencyMs = Date.now() - startTime;
    const provider = result.meta?.provider ?? "unknown";
    const model = result.meta?.model ?? "unknown";
    const tokensIn = result.usage?.inputTokens ?? 0;
    const tokensOut = result.usage?.outputTokens ?? 0;
    const unknown = result.unknown ?? result.text.startsWith("UNKNOWN");
    const costUsd = calculateCost(provider, model, tokensIn, tokensOut) || 0;

    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider,
      model,
      tokensIn,
      tokensOut,
      latencyMs,
      success: true,
      unknown,
      costUsd,
      errorCode: null,
    });

    await incrementBudget(supabase, agencyId, monthKey, costUsd, false);

    return {
      assistant_message: result.text,
      json: result.output,
      usage: result.usage,
      rawText: result.rawText,
      schemaOk: result.schemaOk,
      meta: result.meta,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider: "unknown",
      model: "unknown",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      success: false,
      unknown: true,
      costUsd: 0,
      errorCode: "provider_error",
    });
    throw error;
  }
}

export async function runAiTaskStream(input: RunAiTaskInput) {
  const startTime = Date.now();
  const supabase = input.supabase as MinimalSupabase | undefined;
  const agencyId = input.tenant.agency_id;
  const userId = input.tenant.user_id;
  const clientId = input.tenant.client_id;

  if (!supabase || !agencyId || !userId) {
    const blocked = buildBlockedResult({
      code: "AI_RATE_LIMIT",
      message: "Missing AI enforcement context.",
    });
    return (async function* () {
      yield { type: "done", result: { text: blocked.assistant_message, unknown: true, error: blocked.error?.code } };
    })();
  }

  const dayKey = utcDayString();
  const monthKey = utcMonthString();

  const rateError = await enforceRateLimit({ supabase, agencyId, userId, dayKey });
  if (rateError) {
    const latencyMs = Date.now() - startTime;
    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider: "none",
      model: "blocked",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      success: false,
      unknown: true,
      costUsd: 0,
      errorCode: rateError.code,
    });
    return (async function* () {
      yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: rateError.code } };
    })();
  }

  const budgetError = await enforceBudget({ supabase, agencyId, monthKey });
  if (budgetError) {
    const latencyMs = Date.now() - startTime;
    await logAiRunAndUsage({
      supabase,
      taskType: input.task_type,
      agencyId,
      clientId,
      userId,
      provider: "none",
      model: "blocked",
      tokensIn: 0,
      tokensOut: 0,
      latencyMs,
      success: false,
      unknown: true,
      costUsd: 0,
      errorCode: budgetError.code,
    });
    return (async function* () {
      yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: budgetError.code } };
    })();
  }

  const stream = ai.runStream({
    taskType: input.task_type,
    input: input.input?.message ?? "",
    messages: input.context?.messages,
    context: {
      agencyId,
      clientId,
      userId,
      environment: resolveMode(input.mode),
      supabase: input.supabase,
      skipUsageLog: true,
    },
    metadata: input.metadata,
    outputSchema: input.outputSchema,
  });

  return (async function* () {
    for await (const chunk of stream) {
      if (chunk.type === "done") {
        const latencyMs = Date.now() - startTime;
        const result = chunk.result;
        const provider = result.meta?.provider ?? "unknown";
        const model = result.meta?.model ?? "unknown";
        const unknown = result.unknown ?? result.text.startsWith("UNKNOWN");
        await logAiRunAndUsage({
          supabase,
          taskType: input.task_type,
          agencyId,
          clientId,
          userId,
          provider,
          model,
          tokensIn: 0,
          tokensOut: 0,
          latencyMs,
          success: true,
          unknown,
          costUsd: 0,
          errorCode: null,
        });
        await incrementBudget(supabase, agencyId, monthKey, 0, false);
      }
      yield chunk;
    }
  })();
}
