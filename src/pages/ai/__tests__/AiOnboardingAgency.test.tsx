import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AiOnboardingAgency from "@/pages/ai/AiOnboardingAgency";

const invokeMock = vi.fn();
let authState: {
  session: { access_token: string; expires_at?: number } | null;
  user: { id: string; email: string } | null;
  loading: boolean;
} = {
  session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 },
  user: { id: "user-1", email: "user@example.com" },
  loading: false,
};

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

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
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

function makeCompleteResponse(overrides: Record<string, unknown> = {}) {
  return makeResponse({
    onboarding_status: {
      id: "status-1",
      status: "complete",
      scope: "agency",
      last_step_id: "identity",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    },
    progress: {
      required_complete: true,
      current_index: 6,
      total_required: 6,
    },
    ...overrides,
  });
}

describe("AiOnboardingAgency", () => {
  beforeEach(() => {
    localStorage.clear();
    invokeMock.mockReset();
    authState = {
      session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      user: { id: "user-1", email: "user@example.com" },
      loading: false,
    };
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

  it("redirects to auth when user is not logged in", async () => {
    authState = { session: null, user: null, loading: false };

    render(
      <MemoryRouter initialEntries={["/ai/onboarding/agency"]}>
        <Routes>
          <Route path="/ai/onboarding/agency" element={<AiOnboardingAgency />} />
          <Route path="/auth" element={<div>Auth Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Auth Page")).toBeInTheDocument();
    await waitFor(() => expect(invokeMock).not.toHaveBeenCalled());
  });

  it("shows review and activates workspace when onboarding is complete", async () => {
    invokeMock.mockResolvedValue({ data: makeCompleteResponse(), error: null });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/ai/onboarding/agency"]}>
        <Routes>
          <Route path="/ai/onboarding/agency" element={<AiOnboardingAgency />} />
          <Route path="/agency/welcome-ai" element={<div>Agency Welcome AI</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Core onboarding complete")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Activate Agency Workspace" }));
    expect(await screen.findByText("Agency Welcome AI", {}, { timeout: 2500 })).toBeInTheDocument();
  }, 10000);

  it("shows fallback suggestions for autofill when API suggestions are empty", async () => {
    invokeMock.mockResolvedValue({
      data: makeResponse({
        suggestions: [],
        field_path: "agency.name",
      }),
      error: null,
    });
    render(
      <MemoryRouter>
        <AiOnboardingAgency />
      </MemoryRouter>,
    );

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Tap to autofill")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bootstrap Agency/i })).toBeInTheDocument();
  });
});
