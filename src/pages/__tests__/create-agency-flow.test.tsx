import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import Welcome from "@/pages/Welcome";
import CreateAgencyStub from "@/pages/CreateAgencyStub";
import AiOnboardingAgency from "@/pages/ai/AiOnboardingAgency";

const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com" },
    loading: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("create agency onboarding flow", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockInvoke.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("welcome -> create-agency -> ai onboarding", async () => {
    const user = userEvent.setup();

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "create_agency_with_admin") {
        return Promise.resolve({ data: "agency-1", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockInvoke.mockResolvedValue({
      data: {
        v: "2.0.0",
        trace_id: "trace-1",
        onboarding_status: {
          id: "status-1",
          status: "in_progress",
          scope: "agency",
          last_step_id: "bootstrap",
          started_at: null,
          completed_at: null,
        },
        assistant_message: "Welcome to onboarding.",
        expects: "text",
        suggestions: ["Suggestion A", "Suggestion B", "Suggestion C"],
        unknown: false,
        brain_snapshot: {},
        state: {
          module: "bootstrap",
          resolver_state: "ready",
          missing_fields: [],
        },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route path="/welcome" element={<><LocationDisplay /><Welcome /></>} />
          <Route path="/create-agency" element={<><LocationDisplay /><CreateAgencyStub /></>} />
          <Route path="/ai/onboarding/agency" element={<><LocationDisplay /><AiOnboardingAgency /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Create an agency (AI-guided)" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/create-agency"));

    await user.type(screen.getByLabelText("Agency name"), "Acme Social");
    await user.type(screen.getByLabelText("Website (optional)"), "https://acme.test");
    await user.click(screen.getByRole("button", { name: "Continue to AI onboarding" }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/ai/onboarding/agency"));
    expect(window.localStorage.getItem("activeAgencyId")).toBe("agency-1");
    await screen.findByText("Agency Profile Setup");
  });
});
