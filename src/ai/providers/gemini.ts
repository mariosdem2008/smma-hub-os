import { getEnvVar } from "../utils.ts";
import type { EmbedParams, EmbedResult, GenerateParams, GenerateResult } from "./types.ts";
import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
const circuitBreaker = new CircuitBreaker();

function getApiKey() {
  return getEnvVar("GEMINI_API_KEY");
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

async function fetchWithPolicy(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (!timeoutsEnabled()) {
    return fetch(url, init);
  }

  if (circuitBreakerEnabled() && !circuitBreaker.canRequest()) {
    const error = new Error("AI provider circuit breaker open") as Error & { code?: string };
    error.code = "CIRCUIT_OPEN";
    throw error;
  }

  try {
    const response = retriesEnabled()
      ? await fetchWithRetry(url, init, {
          retries: 3,
          backoffMs: RETRY_BACKOFF_MS,
          timeoutMs,
        })
      : await fetchWithTimeout(url, init, timeoutMs);

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

function normalizeModelName(model: string) {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function extractSystemPrompt(messages: GenerateParams["messages"]) {
  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content.trim()).filter(Boolean);
  if (systemMessages.length === 0) return undefined;
  return systemMessages.join("\n\n");
}

function toGeminiContents(messages: GenerateParams["messages"]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

function extractText(json: any) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("");
}

function extractUsage(json: any): GenerateResult["usage"] {
  const promptTokens = json?.usageMetadata?.promptTokenCount;
  const outputTokens = json?.usageMetadata?.candidatesTokenCount;
  if (typeof promptTokens !== "number" && typeof outputTokens !== "number") return undefined;
  return {
    inputTokens: typeof promptTokens === "number" ? promptTokens : undefined,
    outputTokens: typeof outputTokens === "number" ? outputTokens : undefined,
  };
}

function extractEmbedding(json: any): number[] {
  const values = json?.embedding?.values;
  if (!Array.isArray(values)) return [];
  return values.filter((v: unknown): v is number => typeof v === "number");
}

function padOrTrim(embedding: number[], targetDim?: number): number[] {
  if (!targetDim || targetDim <= 0) return embedding;
  if (embedding.length === targetDim) return embedding;
  if (embedding.length > targetDim) return embedding.slice(0, targetDim);
  return [...embedding, ...Array(targetDim - embedding.length).fill(0)];
}

async function callGemini(params: GenerateParams, opts: { responseMimeType?: string }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const systemPrompt = extractSystemPrompt(params.messages);
  const contents = toGeminiContents(params.messages);
  const generationConfig: Record<string, unknown> = {};
  if (typeof params.temperature === "number") generationConfig.temperature = params.temperature;
  if (typeof params.top_p === "number") generationConfig.topP = params.top_p;
  if (typeof params.max_tokens === "number") generationConfig.maxOutputTokens = params.max_tokens;
  if (opts.responseMimeType) generationConfig.response_mime_type = opts.responseMimeType;

  const body: Record<string, unknown> = {
    contents,
    generationConfig,
  };
  if (systemPrompt) {
    body.systemInstruction = { role: "system", parts: [{ text: systemPrompt }] };
  }

  const response = await fetchWithPolicy(
    `${GEMINI_BASE_URL}/${normalizeModelName(params.model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message ?? response.statusText;
    throw new Error(`Gemini error: ${message}`);
  }

  return json;
}

async function callGeminiEmbedding(params: EmbedParams) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const body: Record<string, unknown> = {
    content: {
      parts: [{ text: params.input }],
    },
  };
  if (typeof params.outputDimensionality === "number") {
    body.outputDimensionality = params.outputDimensionality;
  }

  const response = await fetchWithPolicy(
    `${GEMINI_BASE_URL}/${normalizeModelName(params.model)}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    params.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message ?? response.statusText;
    throw new Error(`Gemini embedding error: ${message}`);
  }

  return json;
}

export async function generateText(params: GenerateParams): Promise<GenerateResult> {
  const json = await callGemini(params, {});
  return {
    text: extractText(json),
    model: json?.model ?? params.model,
    usage: extractUsage(json),
    raw: json,
  };
}

export async function generateJson(params: GenerateParams): Promise<GenerateResult> {
  const json = await callGemini(params, { responseMimeType: "application/json" });
  const text = extractText(json);
  try {
    JSON.parse(text);
  } catch (error) {
    const err = new Error("Gemini JSON parse error") as Error & { code?: string };
    err.code = "INVALID_JSON";
    throw err;
  }
  return {
    text,
    model: json?.model ?? params.model,
    usage: extractUsage(json),
    raw: json,
  };
}

export async function generate(params: GenerateParams): Promise<GenerateResult> {
  return generateText(params);
}

export async function embed(params: EmbedParams): Promise<EmbedResult> {
  const json = await callGeminiEmbedding(params);
  const embedding = extractEmbedding(json);
  if (embedding.length === 0) {
    throw new Error("Gemini embedding API response missing embedding");
  }

  return {
    embedding: padOrTrim(embedding, params.outputDimensionality),
    raw: json,
  };
}
