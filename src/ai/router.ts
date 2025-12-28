import { getAgencyBrainContext, getClientBrainContext } from "./brains/index.ts"
import { logUsage } from "./logging.ts"
import { resolveTaskModel, getTaskConfig } from "./taskRegistry.ts"
import { TaskType } from "./taskTypes.ts"
import { nowMs } from "./utils.ts"
import { providers as defaultProviders } from "./providers/index.ts"
import { createBrainResolver, type CalibrationRequirement, type ResolvedBrainContext } from "./brainResolver.ts"
import type { ChatMessage, GenerateResult } from "./providers/types.ts"
import type { OutputSchema } from "./schema.ts"

type MinimalSupabase = {
  from: (table: string) => any;
};

export type AiContext = {
  agencyId?: string;
  clientId?: string;
  userId?: string;
  role?: string;
  plan?: string;
  environment?: "dev" | "prod";
  supabase?: MinimalSupabase | null;
};

export type AiRunOptions = {
  taskType: TaskType;
  input?: string;
  messages?: ChatMessage[];
  context: AiContext;
  metadata?: Record<string, unknown>;
  outputSchema?: OutputSchema<unknown>;
};

export type AiRunResult = {
  text: string;
  output?: unknown;
  unknown?: boolean;
  error?: string | null;
  raw?: unknown;
  rawText?: string;
  schemaOk?: boolean;
  usage?: GenerateResult["usage"];
  meta?: {
    provider: string;
    model: string;
  };
  /** Present when on-demand calibration is needed */
  calibrationNeeded?: CalibrationRequirement;
  /** Resolved brain context used for the request */
  resolvedContext?: ResolvedBrainContext;
};

export type AiStreamChunk =
  | { type: "delta"; text: string }
  | { type: "done"; result: AiRunResult };

type ProviderMap = typeof defaultProviders;

type RouterDeps = {
  providers?: ProviderMap;
  now?: () => number;
  /** Enable brain resolver for on-demand calibration */
  useBrainResolver?: boolean;
};

function extractJson(text: string) {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
  const rawJson = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(rawJson);
}

function buildUnknownResponse(taskType: TaskType, reason: string) {
  const config = getTaskConfig(taskType);
  if (config?.buildUnknown) {
    return config.buildUnknown({ reason });
  }
  return { answer: "UNKNOWN", unknown: true, questions: ["What additional context is required?"], confidence: 0 };
}

function shouldReturnUnknown(contextMissing: boolean, safetyMode: "strict_unknown" | "normal") {
  return contextMissing && safetyMode === "strict_unknown";
}

function getTimeoutMs(taskType: TaskType) {
  switch (taskType) {
    case TaskType.EMBED_TEXT:
      return 10_000;
    case TaskType.STRATEGY_PLAN:
    case TaskType.CLIENT_PORTAL_QA:
      return 60_000;
    case TaskType.SUMMARIZE:
      return 45_000;
    case TaskType.CHAT_GENERAL:
    case TaskType.CONTENT_IDEAS:
      return 30_000;
    default:
      return 30_000;
  }
}

async function generateWithRetry(opts: {
  provider: { generate: (params: any) => Promise<GenerateResult> };
  params: any;
  schema?: OutputSchema<unknown>;
  taskType: TaskType;
}): Promise<{
  text: string;
  output?: unknown;
  raw?: unknown;
  rawText?: string;
  schemaOk?: boolean;
  usage?: GenerateResult["usage"];
  model?: string;
}> {
  const first = await opts.provider.generate(opts.params);
  if (!opts.schema) {
    return { text: first.text, raw: first.raw, rawText: first.text, schemaOk: true, usage: first.usage, model: first.model };
  }

  try {
    const parsed = extractJson(first.text);
    const validated = opts.schema.validate(parsed);
    if (validated.ok) {
      return {
        text: first.text,
        output: validated.data,
        raw: first.raw,
        rawText: first.text,
        schemaOk: true,
        usage: first.usage,
        model: first.model,
      };
    }
  } catch {
    // fall through to repair
  }

  const repairMessages = [
    ...opts.params.messages,
    {
      role: "system",
      content: `Repair the response. Return only valid JSON matching schema: ${opts.schema.name}. No markdown.`,
    },
  ];

  const retry = await opts.provider.generate({ ...opts.params, messages: repairMessages });
  try {
    const parsed = extractJson(retry.text);
    const validated = opts.schema.validate(parsed);
    if (validated.ok) {
      return {
        text: retry.text,
        output: validated.data,
        raw: retry.raw,
        rawText: retry.text,
        schemaOk: true,
        usage: retry.usage,
        model: retry.model,
      };
    }
  } catch {
    return {
      text: "UNKNOWN",
      output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
      raw: retry.raw,
      rawText: retry.text,
      schemaOk: false,
      usage: retry.usage,
      model: retry.model,
    };
  }

  return {
    text: "UNKNOWN",
    output: buildUnknownResponse(opts.taskType, "schema_repair_failed"),
    raw: retry.raw,
    rawText: retry.text,
    schemaOk: false,
    usage: retry.usage,
    model: retry.model,
  };
}

export function createAiRouter(deps: RouterDeps = {}) {
  const providers = deps.providers ?? defaultProviders;
  const now = deps.now ?? nowMs;
  const useBrainResolver = deps.useBrainResolver ?? false;

  async function run(options: AiRunOptions): Promise<AiRunResult> {
    const start = now();
    const taskConfig = getTaskConfig(options.taskType);
    if (!taskConfig) {
      return { text: "UNKNOWN", unknown: true, error: "Unknown task type" };
    }

    const context = options.context ?? {};
    const supabase = context.supabase ?? null;
    const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
      (taskConfig.requires.client && !context.clientId);

    if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
      const latencyMs = now() - start;
      await logUsage(supabase, {
        taskType: options.taskType,
        endpoint: taskConfig.usageEndpoint,
        provider: "none",
        model: "context-missing",
        agencyId: context.agencyId,
        clientId: context.clientId,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        unknown: true,
        success: true,
        errorCode: "context_missing",
      });
      return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "context_missing"), unknown: true };
    }

    let agencyBrain: Record<string, unknown> | null = null;
    let clientBrain: Record<string, unknown> | null = null;
    let resolvedContext: ResolvedBrainContext | undefined;

    // Use Brain Resolver when enabled (v2 modular documents)
    if (useBrainResolver && context.agencyId && supabase) {
      const resolver = createBrainResolver(supabase);
      const resolveResult = await resolver.resolveContext(options.taskType, context.agencyId);

      if (resolveResult.status === "calibration_needed") {
        // Return early with calibration requirement - caller handles on-demand calibration
        return {
          text: "",
          calibrationNeeded: resolveResult.calibration,
          unknown: false,
        };
      }

      if (resolveResult.status === "error") {
        return {
          text: "UNKNOWN",
          output: buildUnknownResponse(options.taskType, "brain_resolver_error"),
          unknown: true,
          error: resolveResult.error,
        };
      }

      // Use resolved context
      resolvedContext = resolveResult.context;
      agencyBrain = resolver.flattenContext(resolveResult.context);
    } else if (taskConfig.requires.agency && context.agencyId && supabase) {
      // Legacy: use monolithic brain_json
      const res = await getAgencyBrainContext(supabase, context.agencyId);
      agencyBrain = res.data;
      if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
        return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "agency_brain_missing"), unknown: true };
      }
    }

    if (taskConfig.requires.client && context.clientId && supabase) {
      const res = await getClientBrainContext(supabase, context.clientId);
      clientBrain = res.data;
      if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
        return { text: "UNKNOWN", output: buildUnknownResponse(options.taskType, "client_brain_missing"), unknown: true };
      }
    }

    const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
    const overrideModel = options.metadata?.modelOverride as string | undefined;
    const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
    const provider = providers[modelConfig.provider];
    if (!provider) {
      return { text: "UNKNOWN", unknown: true, error: "Provider not available" };
    }

    if (taskConfig.outputMode === "embedding") {
      if (!("embed" in provider)) {
        return { text: "UNKNOWN", unknown: true, error: "Embedding not supported" };
      }
      const embeddingResult = await (provider as any).embed({
        model: modelConfig.model,
        input: options.input ?? "",
        timeoutMs: getTimeoutMs(options.taskType),
      });
      const latencyMs = now() - start;
      await logUsage(supabase, {
        taskType: options.taskType,
        endpoint: taskConfig.usageEndpoint,
        provider: modelConfig.provider,
        model: modelConfig.model,
        agencyId: context.agencyId,
        clientId: context.clientId,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        unknown: false,
        success: true,
        errorCode: null,
      });
      return {
        text: "",
        output: embeddingResult.embedding,
        raw: embeddingResult.raw,
        meta: { provider: modelConfig.provider, model: modelConfig.model },
      };
    }

    const promptBuilder = taskConfig.promptBuilder;
    const messages = options.messages ?? (promptBuilder
      ? promptBuilder({
          input: options.input,
          metadata: options.metadata,
          brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
        })
      : []);

    const schema = options.outputSchema ?? taskConfig.schema;
    const result = await generateWithRetry({
      provider: provider as any,
      params: {
        model: modelConfig.model,
        messages,
        temperature: modelConfig.params?.temperature,
        max_tokens: modelConfig.params?.max_tokens,
        top_p: modelConfig.params?.top_p,
        timeoutMs: getTimeoutMs(options.taskType),
      },
      schema,
      taskType: options.taskType,
    });

    const latencyMs = now() - start;
    const runtimeModel = result.model ?? modelConfig.model;
    await logUsage(supabase, {
      taskType: options.taskType,
      endpoint: taskConfig.usageEndpoint,
      provider: modelConfig.provider,
      model: runtimeModel,
      agencyId: context.agencyId,
      clientId: context.clientId,
      latencyMs,
      tokensIn: result.usage?.inputTokens,
      tokensOut: result.usage?.outputTokens,
      unknown: result.text.startsWith("UNKNOWN"),
      success: true,
      errorCode: null,
    });

    return {
      text: result.text,
      output: result.output,
      raw: result.raw,
      rawText: result.rawText,
      schemaOk: result.schemaOk,
      usage: result.usage,
      unknown: result.text.startsWith("UNKNOWN"),
      meta: { provider: modelConfig.provider, model: runtimeModel },
      resolvedContext,
    };
  }

  async function* runStream(options: AiRunOptions): AsyncGenerator<AiStreamChunk> {
    const start = now();
    const taskConfig = getTaskConfig(options.taskType);
    if (!taskConfig) {
      yield { type: "done", result: { text: "UNKNOWN", unknown: true, error: "Unknown task type" } };
      return;
    }

    const context = options.context ?? {};
    const supabase = context.supabase ?? null;
    const contextMissing = (taskConfig.requires.agency && !context.agencyId) ||
      (taskConfig.requires.client && !context.clientId);

    if (shouldReturnUnknown(contextMissing, taskConfig.safetyMode)) {
      const latencyMs = now() - start;
      await logUsage(supabase, {
        taskType: options.taskType,
        endpoint: taskConfig.usageEndpoint,
        provider: "none",
        model: "context-missing",
        agencyId: context.agencyId,
        clientId: context.clientId,
        latencyMs,
        tokensIn: 0,
        tokensOut: 0,
        unknown: true,
        success: true,
        errorCode: "context_missing",
      });
      const unknownResult: AiRunResult = {
        text: "UNKNOWN",
        output: buildUnknownResponse(options.taskType, "context_missing"),
        unknown: true,
      };
      yield { type: "delta", text: unknownResult.text };
      yield { type: "done", result: unknownResult };
      return;
    }

    let agencyBrain: Record<string, unknown> | null = null;
    let clientBrain: Record<string, unknown> | null = null;
    if (taskConfig.requires.agency && context.agencyId && supabase) {
      const res = await getAgencyBrainContext(supabase, context.agencyId);
      agencyBrain = res.data;
      if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
        const unknownResult: AiRunResult = {
          text: "UNKNOWN",
          output: buildUnknownResponse(options.taskType, "agency_brain_missing"),
          unknown: true,
        };
        yield { type: "delta", text: unknownResult.text };
        yield { type: "done", result: unknownResult };
        return;
      }
    }
    if (taskConfig.requires.client && context.clientId && supabase) {
      const res = await getClientBrainContext(supabase, context.clientId);
      clientBrain = res.data;
      if (!res.data && shouldReturnUnknown(true, taskConfig.safetyMode)) {
        const unknownResult: AiRunResult = {
          text: "UNKNOWN",
          output: buildUnknownResponse(options.taskType, "client_brain_missing"),
          unknown: true,
        };
        yield { type: "delta", text: unknownResult.text };
        yield { type: "done", result: unknownResult };
        return;
      }
    }

    if (taskConfig.outputMode !== "freeform") {
      const result = await run(options);
      yield { type: "delta", text: result.text };
      yield { type: "done", result };
      return;
    }

    const modelConfigBase = resolveTaskModel(options.taskType, context.environment);
    const overrideModel = options.metadata?.modelOverride as string | undefined;
    const modelConfig = overrideModel ? { ...modelConfigBase, model: overrideModel } : modelConfigBase;
    const provider = providers[modelConfig.provider];
    if (!provider || !("generateStream" in provider)) {
      const result = await run(options);
      yield { type: "delta", text: result.text };
      yield { type: "done", result };
      return;
    }

    const promptBuilder = taskConfig.promptBuilder;
    const messages = options.messages ?? (promptBuilder
      ? promptBuilder({
          input: options.input,
          metadata: options.metadata,
          brains: { agency: agencyBrain ?? undefined, client: clientBrain ?? undefined },
        })
      : []);

    const params = {
      model: modelConfig.model,
      messages,
      temperature: modelConfig.params?.temperature,
      max_tokens: modelConfig.params?.max_tokens,
      top_p: modelConfig.params?.top_p,
      timeoutMs: getTimeoutMs(options.taskType),
    };

    let text = "";
    for await (const chunk of (provider as any).generateStream(params)) {
      if (chunk?.delta) {
        text += chunk.delta;
        yield { type: "delta", text: chunk.delta };
      }
    }

    const latencyMs = now() - start;
    await logUsage(supabase, {
      taskType: options.taskType,
      endpoint: taskConfig.usageEndpoint,
      provider: modelConfig.provider,
      model: modelConfig.model,
      agencyId: context.agencyId,
      clientId: context.clientId,
      latencyMs,
      tokensIn: 0,
      tokensOut: 0,
      unknown: text.startsWith("UNKNOWN"),
      success: true,
      errorCode: null,
    });

    const result: AiRunResult = {
      text,
      output: undefined,
      raw: undefined,
      unknown: text.startsWith("UNKNOWN"),
      meta: { provider: modelConfig.provider, model: modelConfig.model },
    };

    yield { type: "done", result };
  }

  return { run, runStream };
}

export const ai = createAiRouter();
