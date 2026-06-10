// Local-model smoke test: drives the SaaS's OpenAI-compatible provider
// against a locally running Ollama server, so internal agents can be
// exercised with NO paid provider and NO production API keys.
//
// Usage (PowerShell):
//   $env:OPENAI_BASE_URL="http://localhost:11434/v1"
//   $env:OPENAI_API_KEY="ollama"
//   deno run --allow-net --allow-env scripts/local-ai-smoke.ts qwen2.5-coder:1.5b
//
// Exit code 0 = the provider successfully reached the local model.

import { generate } from "../src/ai/providers/openai.ts";

const model = Deno.args[0] ?? "qwen2.5-coder:1.5b";

if (!Deno.env.get("OPENAI_BASE_URL")) {
  Deno.env.set("OPENAI_BASE_URL", "http://localhost:11434/v1");
}
if (!Deno.env.get("OPENAI_API_KEY")) {
  Deno.env.set("OPENAI_API_KEY", "ollama");
}

console.log(`[smoke] base_url=${Deno.env.get("OPENAI_BASE_URL")} model=${model}`);

try {
  const result = await generate({
    model,
    messages: [
      { role: "system", content: "You are a terse assistant. Answer in one short sentence." },
      { role: "user", content: "Name one channel an SMMA agency uses for a fitness studio client." },
    ],
    temperature: 0.2,
    max_tokens: 256,
  } as any);

  const text = (result.text ?? "").trim();
  if (!text) {
    console.error("[smoke] FAIL: empty response from local model");
    Deno.exit(1);
  }
  console.log(`[smoke] OK model=${result.model}`);
  console.log(`[smoke] reply: ${text}`);
  Deno.exit(0);
} catch (err) {
  console.error(`[smoke] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  Deno.exit(1);
}
