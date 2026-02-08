/**
 * Minimal HTTP load test runner (no dependencies).
 *
 * Notes:
 * - Intended for Phase 1 p95 evidence gathering in staging.
 * - Requires a target that can be invoked safely and repeatedly.
 * - This script does NOT handle auth flows; pass headers explicitly.
 */

type Summary = {
  target: {
    url: string;
    method: string;
    requests: number;
    concurrency: number;
    timeout_ms: number;
  };
  results: {
    ok: number;
    failed: number;
    success_rate: number;
    p50_ms: number;
    p90_ms: number;
    p95_ms: number;
    p99_ms: number;
    mean_ms: number;
    min_ms: number;
    max_ms: number;
  };
};

function mustEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return value;
}

function parseJsonEnv(name: string): any {
  const raw = process.env[name];
  if (!raw) return null;
  return JSON.parse(raw);
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const clamped = Math.max(0, Math.min(1, pct));
  const idx = Math.floor(clamped * (sorted.length - 1));
  return sorted[idx] ?? 0;
}

async function timedFetch(opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  timeoutMs: number;
}): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
    const ms = Date.now() - started;
    // Consume body so we measure more realistic end-to-end time.
    await res.text().catch(() => {});
    return { ok: res.ok, status: res.status, ms };
  } catch (err) {
    const ms = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, ms, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const url = mustEnv("LOADTEST_URL");
  const method = (process.env.LOADTEST_METHOD ?? "POST").toUpperCase();
  const concurrency = Math.max(1, Math.floor(readNumberEnv("LOADTEST_CONCURRENCY", 10)));
  const requests = Math.max(1, Math.floor(readNumberEnv("LOADTEST_REQUESTS", 200)));
  const timeoutMs = Math.max(250, Math.floor(readNumberEnv("LOADTEST_TIMEOUT_MS", 15000)));
  const warmup = Math.max(0, Math.floor(readNumberEnv("LOADTEST_WARMUP_REQUESTS", 25)));

  const expectedP95Ms = readNumberEnv("LOADTEST_EXPECT_P95_MS", 2500);
  const expectedSuccessRate = readNumberEnv("LOADTEST_EXPECT_SUCCESS_RATE", 0.95);

  const headersJson = parseJsonEnv("LOADTEST_HEADERS_JSON") ?? {};
  const bodyJson = parseJsonEnv("LOADTEST_BODY_JSON");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...headersJson,
  };
  const body = bodyJson === null || bodyJson === undefined ? undefined : JSON.stringify(bodyJson);

  // Warmup (single-threaded) to reduce cold-start noise.
  for (let i = 0; i < warmup; i += 1) {
    await timedFetch({ url, method, headers, body, timeoutMs });
  }

  const latencies: number[] = [];
  let ok = 0;
  let failed = 0;

  let next = 0;
  const worker = async () => {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= requests) return;
      const res = await timedFetch({ url, method, headers, body, timeoutMs });
      latencies.push(res.ms);
      if (res.ok) ok += 1;
      else failed += 1;
    }
  };

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = latencies.length > 0 ? sum / latencies.length : 0;
  const successRate = requests > 0 ? ok / requests : 0;

  const summary: Summary = {
    target: { url, method, requests, concurrency, timeout_ms: timeoutMs },
    results: {
      ok,
      failed,
      success_rate: Number(successRate.toFixed(4)),
      p50_ms: percentile(sorted, 0.5),
      p90_ms: percentile(sorted, 0.9),
      p95_ms: percentile(sorted, 0.95),
      p99_ms: percentile(sorted, 0.99),
      mean_ms: Math.round(mean),
      min_ms: sorted[0] ?? 0,
      max_ms: sorted[sorted.length - 1] ?? 0,
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.results.p95_ms > expectedP95Ms || successRate < expectedSuccessRate) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

