import { describe, expect, it } from "vitest";
import { CircuitBreaker } from "../../../src/ai/providers/utils.ts";

describe("CircuitBreaker integration", () => {
  it("opens at >=50% error rate and probes half-open every 30s", () => {
    let now = 0;
    const breaker = new CircuitBreaker({
      windowMs: 5 * 60 * 1000,
      errorRateToOpen: 0.5,
      halfOpenIntervalMs: 30 * 1000,
      now: () => now,
    });

    for (let i = 0; i < 4; i += 1) breaker.recordSuccess();
    for (let i = 0; i < 4; i += 1) breaker.recordFailure();

    expect(breaker.getState()).toBe("open");
    expect(breaker.canRequest()).toBe(false);

    now += 30 * 1000;
    expect(breaker.canRequest()).toBe(true);
    expect(breaker.canRequest()).toBe(false);

    breaker.recordSuccess();
    expect(breaker.getState()).toBe("closed");
    expect(breaker.canRequest()).toBe(true);
  });
});
