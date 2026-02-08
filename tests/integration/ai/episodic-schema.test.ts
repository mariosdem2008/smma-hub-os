import { describe, it, expect } from "vitest";

// Phase 2: episodic memory schema/capture.
// Skipped by default; requires a configured Supabase project with migrations applied.
describe.skip("phase2 episodic memory schema", () => {
  it("ai_memory_items supports thread_id + checkpoint_id + summary", () => {
    // TODO: connect to staging DB and assert columns exist.
    expect(true).toBe(true);
  });

  it("ai_episodic_buffers supports turn buffering per {agency_id, client_id, thread_id}", () => {
    // TODO: connect to staging DB and assert table + unique constraint exist.
    expect(true).toBe(true);
  });
});

