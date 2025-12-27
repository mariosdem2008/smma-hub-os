import { getEnvVar } from "../utils.ts"
import type { GenerateParams, GenerateResult } from "./types.ts"
import { CircuitBreaker, fetchWithRetry, fetchWithTimeout } from "./utils.ts"

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];
const circuitBreaker = new CircuitBreaker();

function getApiKey() {
  return getEnvVar("ANTHROPIC_API_KEY");
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

function toAnthropicMessages(messages: GenerateParams["messages"]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
}

function extractSystemPrompt(messages: GenerateParams["messages"]) {
  const system = messages.find((m) => m.role === "system");
  return system?.content ?? undefined;
}

export async function generate(params: GenerateParams): Promise<GenerateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetchWithPolicy(`${ANTHROPIC_BASE_URL}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      system: extractSystemPrompt(params.messages),
      messages: toAnthropicMessages(params.messages),
      temperature: params.temperature,
      max_tokens: params.max_tokens ?? 512,
      top_p: params.top_p,
    }),
  }, params.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Anthropic error: ${json?.error?.message ?? response.statusText}`);
  }

  const content = Array.isArray(json?.content) ? json.content.map((c: any) => c.text).join("") : "";

  return {
    text: content,
    usage: {
      inputTokens: json?.usage?.input_tokens ?? undefined,
      outputTokens: json?.usage?.output_tokens ?? undefined,
    },
    raw: json,
  };
}
