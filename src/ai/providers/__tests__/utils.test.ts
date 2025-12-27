import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry, fetchWithTimeout } from "../utils.ts";

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("aborts after timeout", async () => {
    const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      })
    );

    const originalFetch = globalThis.fetch;
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;

    const promise = fetchWithTimeout("https://example.com", {}, 50);
    const expectation = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(60);
    await expectation;

    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  });
});

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries up to 3 attempts", async () => {
    const responses = [
      new Response("retry", { status: 503 }),
      new Response("retry", { status: 503 }),
      new Response("ok", { status: 200 }),
    ];
    const fetchMock = vi.fn(() => Promise.resolve(responses.shift() as Response));

    const originalFetch = globalThis.fetch;
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;

    const promise = fetchWithRetry("https://example.com", {}, {
      retries: 3,
      backoffMs: [1000, 2000, 4000],
      jitterMs: (base) => base,
    });

    await vi.advanceTimersByTimeAsync(3000);
    const response = await promise;
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  });

  it("uses backoff 1s/2s/4s with jitter", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("retry", { status: 503 })));
    const originalFetch = globalThis.fetch;
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;

    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await fetchWithRetry("https://example.com", {}, {
      retries: 3,
      backoffMs: [1000, 2000, 4000],
      jitterMs: (base) => base + 200,
      sleepFn,
    }).catch(() => undefined);

    expect(sleepFn).toHaveBeenCalledWith(1200);
    expect(sleepFn).toHaveBeenCalledWith(2200);

    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  });

  it("retries only on timeout/429/503", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response("bad", { status: 500 })));
    const originalFetch = globalThis.fetch;
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;

    const response = await fetchWithRetry("https://example.com", {}, {
      retries: 3,
      backoffMs: [1000, 2000, 4000],
      jitterMs: (base) => base,
    });

    expect(response.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
  });
});
