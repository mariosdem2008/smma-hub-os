import { getEnvVar } from "../utils.ts"
import type { EmbedParams, EmbedResult, GenerateParams, GenerateResult, GenerateStreamResult } from "./types.ts"
import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts"

// Base URL is overridable so local/offline testing can target an
// OpenAI-compatible server (e.g. Ollama at http://localhost:11434/v1)
// without touching production keys or paid providers.
const OPENAI_BASE_URL = getEnvVar("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const EMBED_TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
const circuitBreaker = new CircuitBreaker();

function getApiKey() {
  return getEnvVar("OPENAI_API_KEY");
}

function readFlag(name: string, defaultValue = false) {
  const value = getEnvVar(name);
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true";
}

function timeoutsEnabled() {
  return readFlag("AI_PROVIDER_TIMEOUTS", false);
}

function retriesEnabled() {
  const retriesFlag = getEnvVar("AI_PROVIDER_RETRIES");
  if (retriesFlag === undefined) return timeoutsEnabled();
  return retriesFlag.toLowerCase() === "true";
}

function circuitBreakerEnabled() {
  return readFlag("AI_CIRCUIT_BREAKER", false);
}

async function fetchWithPolicy(
  url: string,
  init: RequestInit,
  options: { timeoutMs: number; stream?: boolean },
): Promise<Response> {
  if (!timeoutsEnabled()) {
    return fetch(url, init);
  }

  if (circuitBreakerEnabled() && !circuitBreaker.canRequest()) {
    const error = new Error("AI provider circuit breaker open") as Error & { code?: string };
    error.code = "CIRCUIT_OPEN";
    throw error;
  }

  try {
    const response = options.stream || !retriesEnabled()
      ? await fetchWithTimeout(url, init, options.timeoutMs)
      : await fetchWithRetry(url, init, {
          retries: 3,
          backoffMs: RETRY_BACKOFF_MS,
          timeoutMs: options.timeoutMs,
        });

    if (circuitBreakerEnabled()) {
      if (response.ok) {
        circuitBreaker.recordSuccess();
      } else {
        circuitBreaker.recordFailure();
      }
    }

    return response;
  } catch (error) {
    if (circuitBreakerEnabled()) {
      circuitBreaker.recordFailure();
    }
    throw error;
  }
}

function extractTextFromChatCompletions(json: any): { text: string; model?: string } {
  return { text: json?.choices?.[0]?.message?.content ?? "", model: json?.model };
}

function extractUsageFromChatCompletions(json: any): { inputTokens?: number; outputTokens?: number } | undefined {
  const inputTokens = json?.usage?.prompt_tokens;
  const outputTokens = json?.usage?.completion_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

function extractTextFromResponses(json: any): string {
  if (typeof json?.output_text === "string") return json.output_text;

  const output = json?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        const text = part?.text;
        if (typeof text === "string" && text.length > 0) return text;
      }
    }
  }

  return "";
}

function extractUsageFromResponses(json: any): { inputTokens?: number; outputTokens?: number } | undefined {
  const inputTokens = json?.usage?.input_tokens;
  const outputTokens = json?.usage?.output_tokens;
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return { inputTokens, outputTokens };
}

function isLikelyResponsesModel(model: string) {
  // Heuristic: newer model families are often exposed via the Responses API.
  const normalized = model.toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

function shouldOmitTemperature(model: string) {
  const normalized = model.toLowerCase();
  // Some newer models either do not support temperature or only allow the default behavior.
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

function shouldOmitTopP(model: string) {
  const normalized = model.toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

async function* streamSse(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      idx = buffer.indexOf("\n\n");

      for (const line of chunk.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === "[DONE]") return;
        yield data;
      }
    }
  }
}

export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const tryChatCompletions = async (): Promise<GenerateResult> => {
    const body: any = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens,
    };

    if (!shouldOmitTemperature(params.model) && typeof params.temperature === "number") body.temperature = params.temperature;
    if (!shouldOmitTopP(params.model) && typeof params.top_p === "number") body.top_p = params.top_p;

    const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = json?.error?.message ?? response.statusText;
      const error = new Error(`OpenAI chat.completions error: ${message}`) as Error & { status?: number; raw?: unknown };
      error.status = response.status;
      error.raw = json;
      throw error;
    }

    const result = extractTextFromChatCompletions(json);
    return {
      text: result.text,
      model: result.model ?? params.model,
      usage: extractUsageFromChatCompletions(json),
      raw: json,
    };
  };

  const buildResponsesBody = (opts: { stripTemperature?: boolean; stripTopP?: boolean } = {}) => {
    const body: any = {
      model: params.model,
      input: params.messages.map((m) => ({
        role: m.role,
        content: [{ type: "input_text", text: m.content }],
      })),
    };

    const omitTemperature = shouldOmitTemperature(params.model) || opts.stripTemperature;
    const omitTopP = shouldOmitTopP(params.model) || opts.stripTopP;

    if (!omitTemperature && typeof params.temperature === "number") body.temperature = params.temperature;
    if (!omitTopP && typeof params.top_p === "number") body.top_p = params.top_p;
    if (typeof params.max_tokens === "number") body.max_output_tokens = params.max_tokens;

    return body;
  };

  const callResponses = async (body: any): Promise<GenerateResult> => {
    const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = json?.error?.message ?? response.statusText;
      const error = new Error(`OpenAI responses error: ${message}`) as Error & { status?: number; raw?: unknown };
      error.status = response.status;
      error.raw = json;
      throw error;
    }

    return {
      text: extractTextFromResponses(json),
      model: json?.model ?? params.model,
      usage: extractUsageFromResponses(json),
      raw: json,
    };
  };

  const tryResponses = async (): Promise<GenerateResult> => {
    try {
      return await callResponses(buildResponsesBody());
    } catch (error: any) {
      const status = typeof error?.status === "number" ? error.status : undefined;
      const message = typeof error?.message === "string" ? error.message : "";
      const unsupportedTemperature = message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'temperature'");
      const unsupportedTopP = message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'top_p'");

      if (status === 400 && (unsupportedTemperature || unsupportedTopP)) {
        return await callResponses(
          buildResponsesBody({
            stripTemperature: unsupportedTemperature,
            stripTopP: unsupportedTopP,
          }),
        );
      }

      throw error;
    }
  };

  if (isLikelyResponsesModel(params.model)) {
    try {
      return await tryResponses();
    } catch (error) {
      // Fallback to chat completions for accounts/models that still expose it there.
      return await tryChatCompletions().catch((chatError) => {
        const msg = error instanceof Error ? error.message : String(error);
        const msg2 = chatError instanceof Error ? chatError.message : String(chatError);
        throw new Error(`${msg}; ${msg2}`);
      });
    }
  }

  try {
    return await tryChatCompletions();
  } catch (error: any) {
    // If the model isn't available on chat.completions, retry via Responses once.
    const status = typeof error?.status === "number" ? error.status : undefined;
    const message = typeof error?.message === "string" ? error.message : "";
    const unsupportedTemperatureValue =
      status === 400 &&
      message.toLowerCase().includes("unsupported value") &&
      message.toLowerCase().includes("'temperature'");

    if (unsupportedTemperatureValue) {
      // Retry once without temperature/top_p for models that only support defaults.
      const retryParams: GenerateParams = {
        ...params,
        temperature: undefined,
        top_p: undefined,
      };
      return await generate(retryParams);
    }

    const shouldRetryResponses =
      status === 404 ||
      (status === 400 &&
        (message.toLowerCase().includes("does not exist") ||
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("unsupported") ||
          message.toLowerCase().includes("unrecognized")));

    if (!shouldRetryResponses) throw error;
    return await tryResponses();
  }
}

export async function* generateStream(params: GenerateParams): GenerateStreamResult {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const buildChatBody = (omitTemp = false, omitTopP = false) => {
    const body: any = {
      model: params.model,
      messages: params.messages,
      max_tokens: params.max_tokens,
      stream: true,
    };

    if (!omitTemp && !shouldOmitTemperature(params.model) && typeof params.temperature === "number") {
      body.temperature = params.temperature;
    }
    if (!omitTopP && !shouldOmitTopP(params.model) && typeof params.top_p === "number") {
      body.top_p = params.top_p;
    }

    return body;
  };

  const buildResponsesBody = (omitTemp = false, omitTopP = false) => {
    const body: any = {
      model: params.model,
      input: params.messages.map((m) => ({
        role: m.role,
        content: [{ type: "input_text", text: m.content }],
      })),
      stream: true,
    };

    if (!omitTemp && !shouldOmitTemperature(params.model) && typeof params.temperature === "number") {
      body.temperature = params.temperature;
    }
    if (!omitTopP && !shouldOmitTopP(params.model) && typeof params.top_p === "number") {
      body.top_p = params.top_p;
    }
    if (typeof params.max_tokens === "number") body.max_output_tokens = params.max_tokens;

    return body;
  };

  const streamChatCompletions = async function* (omitTemp = false, omitTopP = false): GenerateStreamResult {
    const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildChatBody(omitTemp, omitTopP)),
    }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS, stream: true });

    const firstText = response.body ? "" : await response.text().catch(() => "");
    if (!response.ok) {
      const json = firstText ? {} : await response.json().catch(() => ({}));
      const message = (json as any)?.error?.message ?? response.statusText;
      const error = new Error(`OpenAI chat.completions error: ${message}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    for await (const data of streamSse(response)) {
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        yield { delta };
      }
    }
  };

  const streamResponses = async function* (omitTemp = false, omitTopP = false): GenerateStreamResult {
    const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildResponsesBody(omitTemp, omitTopP)),
    }, { timeoutMs: params.timeoutMs ?? DEFAULT_TIMEOUT_MS, stream: true });

    const firstText = response.body ? "" : await response.text().catch(() => "");
    if (!response.ok) {
      const json = firstText ? {} : await response.json().catch(() => ({}));
      const message = (json as any)?.error?.message ?? response.statusText;
      const error = new Error(`OpenAI responses error: ${message}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    for await (const data of streamSse(response)) {
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      if (parsed?.type === "response.output_text.delta" && typeof parsed?.delta === "string") {
        yield { delta: parsed.delta };
        continue;
      }

      const output = parsed?.output;
      if (Array.isArray(output)) {
        for (const item of output) {
          const content = item?.content;
          if (!Array.isArray(content)) continue;
          for (const part of content) {
            if (typeof part?.text === "string" && part.text.length > 0) {
              yield { delta: part.text };
            }
          }
        }
      }
    }
  };

  if (isLikelyResponsesModel(params.model)) {
    try {
      yield* streamResponses();
      return;
    } catch (error: any) {
      const status = typeof error?.status === "number" ? error.status : undefined;
      const message = typeof error?.message === "string" ? error.message : "";
      const unsupportedTemp = status === 400 && message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'temperature'");
      const unsupportedTopP = status === 400 && message.toLowerCase().includes("unsupported parameter") && message.toLowerCase().includes("'top_p'");
      if (unsupportedTemp || unsupportedTopP) {
        yield* streamResponses(unsupportedTemp, unsupportedTopP);
        return;
      }
      yield* streamChatCompletions();
      return;
    }
  }

  try {
    yield* streamChatCompletions();
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : undefined;
    const message = typeof error?.message === "string" ? error.message : "";
    const unsupportedTempValue =
      status === 400 && message.toLowerCase().includes("unsupported value") && message.toLowerCase().includes("'temperature'");
    if (unsupportedTempValue) {
      yield* streamChatCompletions(true, true);
      return;
    }

    const shouldRetryResponses =
      status === 404 ||
      (status === 400 &&
        (message.toLowerCase().includes("does not exist") ||
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("unsupported") ||
          message.toLowerCase().includes("unrecognized")));

    if (!shouldRetryResponses) throw error;
    yield* streamResponses();
  }
}

export async function embed(params: EmbedParams): Promise<EmbedResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    model: params.model,
    input: params.input,
  };
  if (typeof params.outputDimensionality === "number") {
    body.dimensions = params.outputDimensionality;
  }

  const response = await fetchWithPolicy(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, { timeoutMs: params.timeoutMs ?? EMBED_TIMEOUT_MS });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`OpenAI error: ${json?.error?.message ?? response.statusText}`);
  }

  return {
    embedding: json?.data?.[0]?.embedding ?? [],
    raw: json,
  };
}
