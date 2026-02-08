import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiOnboardingAgency from "@/pages/ai/AiOnboardingAgency";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock("@/hooks/useAgency", () => ({
  useAgency: () => ({ agencyId: "agency-1" }),
}));

function makeResponse(overrides: Record<string, unknown> = {}) {
  return {
    v: "1",
    trace_id: "trace-1",
    onboarding_status: {
      id: "status-1",
      status: "in_progress",
      scope: "agency",
      last_step_id: "identity",
      started_at: new Date().toISOString(),
      completed_at: null,
    },
    assistant_message: "Tell me about your agency niche.",
    expects: "text",
    suggestions: ["We serve SaaS founders.", "We help local clinics.", "We focus on B2B startups."],
    progress: {
      required_complete: false,
      current_index: 1,
      total_required: 6,
    },
    unknown: false,
    brain_snapshot: {},
    state: {
      module: "identity",
      resolver_state: "ready",
      missing_fields: [],
    },
    ...overrides,
  };
}

describe("AiOnboardingAgency", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("restores persisted chat session without re-requesting initial prompt", async () => {
    localStorage.setItem(
      "ai_onboarding_chat_agency_agency-1",
      JSON.stringify({
        messages: [{ id: "m1", role: "assistant", text: "Persisted prompt", json: null }],
        draftInput: "Draft value",
        expects: "text",
        suggestions: ["One", "Two", "Three"],
        lastResponse: makeResponse({ assistant_message: "Persisted prompt" }),
      }),
    );
    invokeMock.mockResolvedValue({ data: makeResponse(), error: null });

    render(
      <MemoryRouter>
        <AiOnboardingAgency />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Persisted prompt")).toBeInTheDocument();
    await waitFor(() => expect(invokeMock).not.toHaveBeenCalled());
  });

  it("requests initial onboarding prompt when no saved session exists", async () => {
    invokeMock.mockResolvedValue({ data: makeResponse(), error: null });

    render(
      <MemoryRouter>
        <AiOnboardingAgency />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tell me about your agency niche.")).toBeInTheDocument();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
  });
});
