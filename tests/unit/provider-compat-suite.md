# Provider Compatibility Suite (Phase 1 Stub)

Purpose:
- Validate provider facade compatibility across OpenAI, Gemini, Anthropic.

Matrix:
- generate (text)
- generateJson (schema)
- embed (vector)
- timeouts and retries

TODO:
- Add mock provider and fixtures.
- Mock provider available at `src/ai/providers/mock.ts` (Phase 1 stub).

Coverage (Phase 1):
- OpenAI: generate + embed implemented.
- Gemini: generateText + generateJson + embed implemented.
- Anthropic: generate implemented (no embed).
