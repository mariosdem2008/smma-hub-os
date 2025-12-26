import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

import Welcome from "@/pages/Welcome";
import CreateAgencyStub from "@/pages/CreateAgencyStub";

const mockRpc = vi.fn();
const mockInvoke = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    functions: {
      invoke: (...args: any[]) => mockInvoke(...args),
    },
    from: () => ({
      upsert: (...args: any[]) => mockUpsert(...args),
    }),
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
    mockUpsert.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("welcome -> create-agency -> dashboard", async () => {
    const user = userEvent.setup();

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "create_agency_with_admin") {
        return Promise.resolve({ data: "agency-1", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockInvoke.mockImplementation((fnName: string, args: any) => {
      if (fnName === "ai-brains-agency" && args?.body?.action === "create") {
        return Promise.resolve({ data: { brain: { id: "brain-1" } }, error: null });
      }
      if (fnName === "ai-brains-agency" && args?.body?.action === "update") {
        return Promise.resolve({ data: { brain: { id: "brain-1" } }, error: null });
      }
      if (fnName === "ai-brains-agency" && args?.body?.action === "lock") {
        return Promise.resolve({ data: { brain: { id: "brain-1" } }, error: null });
      }
      if (fnName === "ai-brain-ingest") {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    });

    mockUpsert.mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route path="/welcome" element={<><LocationDisplay /><Welcome /></>} />
          <Route path="/create-agency" element={<><LocationDisplay /><CreateAgencyStub /></>} />
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Create an agency" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/create-agency"));

    await user.type(screen.getByLabelText("Agency name"), "Acme Social");
    await user.type(screen.getByLabelText("Website (optional)"), "https://acme.test");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Select the services you offer (add custom if needed).");
    await user.click(screen.getByText("Paid social"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Who do you work best with? Select industries and add custom.");
    await user.click(screen.getByText("E-commerce"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Define your “do / don’t” tone rules for outputs.");
    await user.type(screen.getByLabelText("Do"), "Direct, concise.");
    await user.type(screen.getByLabelText("Don’t"), "No guarantees.");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("When should the system escalate uncertainty or risk?");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await screen.findByText("Add forbidden claims/topics (press Add to create a chip).");
    await user.type(screen.getByPlaceholderText("e.g., guaranteed results"), "Guaranteed results");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Finish & Go to Dashboard" }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/dashboard"));
    expect(window.localStorage.getItem("activeAgencyId")).toBe("agency-1");
    expect(window.sessionStorage.getItem("postCreateAgencyCta")).toBeNull();
  });
});
