type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

export type RetryOptions = {
  retries: number;
  backoffMs: number[];
  timeoutMs?: number;
  shouldRetry?: (result: { response?: Response; error?: unknown }) => boolean;
  jitterMs?: (baseMs: number) => number;
  sleepFn?: (ms: number) => Promise<void>;
};

export type CircuitBreakerOptions = {
  windowMs?: number;
  errorRateToOpen?: number;
  halfOpenIntervalMs?: number;
  now?: () => number;
};

type CircuitEvent = { ts: number; success: boolean };

export async function fetchWithTimeout(input: FetchInput, init: FetchInit = {}, timeoutMs?: number): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const upstreamSignal = init.signal;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultJitter(baseMs: number) {
  const jitter = Math.floor(Math.random() * 250);
  return baseMs + jitter;
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function fetchWithRetry(input: FetchInput, init: FetchInit = {}, options: RetryOptions): Promise<Response> {
  const retries = Math.max(1, options.retries);
  const shouldRetry = options.shouldRetry ?? ((result: { response?: Response; error?: unknown }) => {
    if (result.response) {
      return result.response.status === 429 || result.response.status === 503;
    }
    return isTimeoutError(result.error);
  });
  const jitterFn = options.jitterMs ?? defaultJitter;
  const sleepFn = options.sleepFn ?? sleep;

  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(input, init, options.timeoutMs);
      if (!shouldRetry({ response })) {
        return response;
      }
      if (attempt >= retries) {
        return response;
      }
    } catch (error) {
      if (!shouldRetry({ error }) || attempt >= retries) {
        throw error;
      }
    }

    const baseDelay = options.backoffMs[Math.min(attempt - 1, options.backoffMs.length - 1)] ?? 0;
    const delay = jitterFn(baseDelay);
    await sleepFn(delay);
  }

  return fetchWithTimeout(input, init, options.timeoutMs);
}

export class CircuitBreaker {
  private readonly windowMs: number;
  private readonly errorRateToOpen: number;
  private readonly halfOpenIntervalMs: number;
  private readonly now: () => number;
  private events: CircuitEvent[] = [];
  private state: "closed" | "open" | "half_open" = "closed";
  private openedAt: number | null = null;
  private lastProbeAt: number | null = null;

  constructor(options: CircuitBreakerOptions = {}) {
    this.windowMs = options.windowMs ?? 5 * 60 * 1000;
    this.errorRateToOpen = options.errorRateToOpen ?? 0.5;
    this.halfOpenIntervalMs = options.halfOpenIntervalMs ?? 30 * 1000;
    this.now = options.now ?? (() => Date.now());
  }

  canRequest(): boolean {
    this.prune();
    const now = this.now();
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (this.openedAt !== null && now - this.openedAt >= this.halfOpenIntervalMs) {
        this.state = "half_open";
        this.lastProbeAt = now;
        return true;
      }
      return false;
    }

    if (this.lastProbeAt === null || now - this.lastProbeAt >= this.halfOpenIntervalMs) {
      this.lastProbeAt = now;
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    this.recordEvent(true);
    if (this.state === "half_open") {
      this.state = "closed";
      this.openedAt = null;
      this.lastProbeAt = null;
    }
  }

  recordFailure(): void {
    this.recordEvent(false);
    if (this.state === "half_open") {
      this.open();
      return;
    }
    if (this.state === "closed" && this.shouldOpen()) {
      this.open();
    }
  }

  getState(): "closed" | "open" | "half_open" {
    return this.state;
  }

  private recordEvent(success: boolean) {
    this.events.push({ ts: this.now(), success });
    this.prune();
  }

  private prune() {
    const cutoff = this.now() - this.windowMs;
    this.events = this.events.filter((event) => event.ts >= cutoff);
  }

  private shouldOpen(): boolean {
    if (this.events.length === 0) return false;
    const failures = this.events.filter((event) => !event.success).length;
    return failures / this.events.length >= this.errorRateToOpen;
  }

  private open() {
    this.state = "open";
    this.openedAt = this.now();
  }
}
