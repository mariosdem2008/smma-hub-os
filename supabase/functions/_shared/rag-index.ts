import { embedText, embedTextShadowGemini } from "./embeddings.ts";

function readEnv(name: string) {
  if (typeof Deno !== "undefined") {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

export type RagIndexProvider = "openai" | "gemini";

export function getRagIndexProvider(): RagIndexProvider {
  const raw = (readEnv("RAG_INDEX_PROVIDER") ?? "openai").trim().toLowerCase();
  return raw === "gemini" ? "gemini" : "openai";
}

export async function embedQueryForRag(opts: { query: string }) {
  const provider = getRagIndexProvider();
  if (provider === "gemini") {
    const embedding = await embedTextShadowGemini(opts.query);
    return { provider, embedding };
  }

  const embeddingModel = readEnv("EMBEDDING_MODEL_ID") ?? "text-embedding-3-small";
  const embedding = await embedText(opts.query, "", embeddingModel);
  return { provider, embedding };
}

export function getMatchRpcName(opts: { scoped: boolean }) {
  const provider = getRagIndexProvider();
  if (provider === "gemini") {
    return opts.scoped ? "match_ai_embeddings_shadow_gemini_scoped" : "match_ai_embeddings_shadow_gemini";
  }
  return opts.scoped ? "match_ai_embeddings_scoped" : "match_ai_embeddings";
}

