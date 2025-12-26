import { getEnvVar } from "../utils.ts"
import type { GenerateParams, GenerateResult } from "./types.ts"

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

function getApiKey() {
  return getEnvVar("ANTHROPIC_API_KEY");
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

  const response = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
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
  });

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
