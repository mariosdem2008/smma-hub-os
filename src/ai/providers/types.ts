export type ChatMessage = {
  role: "system" | "user" | "assistant" | string;
  content: string;
};

export type GenerateParams = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  timeoutMs?: number;
};

export type GenerateResult = {
  text: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  raw?: unknown;
};

export type GenerateStreamChunk = {
  delta: string;
  raw?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export type GenerateStreamResult = AsyncIterable<GenerateStreamChunk>;

export type EmbedParams = {
  model: string;
  input: string;
  outputDimensionality?: number;
  timeoutMs?: number;
};

export type EmbedResult = {
  embedding: number[];
  raw?: unknown;
};
