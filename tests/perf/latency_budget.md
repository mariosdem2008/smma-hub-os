# Latency Budget (p50/p95)

Target: p95 <= 2.5s total

Stages
- Router: p50 150ms, p95 250ms
- Planner: p50 200ms, p95 350ms
- Executor: p50 300ms, p95 550ms
- Tools: p50 400ms, p95 650ms
- RAG: p50 300ms, p95 350ms
- Memory: p50 150ms, p95 200ms
- Logging: p50 50ms, p95 150ms

Total p95 budget: 2.5s
