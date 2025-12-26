import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Invitations from "@/pages/Invitations";

const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com" },
    loading: false,
  }),
}));

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastSpy,
  }),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("/invitations", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    toastSpy.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("renders pending invites from RPC", async () => {
    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_my_pending_agency_invites") {
        return Promise.resolve({
          data: [
            {
              invite_id: "inv-1",
              agency_id: "agency-1",
              role: "member",
              email: "user@example.com",
              invited_by: null,
              token: null,
              created_at: new Date().toISOString(),
              expires_at: null,
              agency_name: "Agency One",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/invitations"]}>
        <Routes>
          <Route path="/invitations" element={<Invitations />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Agency One")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("accept redirects to /dashboard when it becomes single-agency member", async () => {
    const user = userEvent.setup();

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_my_pending_agency_invites") {
        return Promise.resolve({
          data: [
            {
              invite_id: "inv-1",
              agency_id: "agency-1",
              role: "member",
              email: "user@example.com",
              invited_by: null,
              token: null,
              created_at: new Date().toISOString(),
              expires_at: null,
              agency_name: "Agency One",
            },
          ],
          error: null,
        });
      }
      if (fnName === "accept_agency_invite") {
        return Promise.resolve({ data: "agency-1", error: null });
      }
      if (fnName === "get_user_agency_bootstrap") {
        return Promise.resolve({
          data: {
            memberships: [{ agency_id: "agency-1", role: "member", agency_name: "Agency One", is_owner: false }],
            pending_invites: [],
            last_agency_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/invitations"]}>
        <Routes>
          <Route path="/invitations" element={<><LocationDisplay /><Invitations /></>} />
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Agency One");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/dashboard");
    });

    expect(window.localStorage.getItem("activeAgencyId")).toBe("agency-1");
  });

  it("accept redirects to /select-agency when user belongs to multiple agencies", async () => {
    const user = userEvent.setup();

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_my_pending_agency_invites") {
        return Promise.resolve({
          data: [
            {
              invite_id: "inv-1",
              agency_id: "agency-1",
              role: "member",
              email: "user@example.com",
              invited_by: null,
              token: null,
              created_at: new Date().toISOString(),
              expires_at: null,
              agency_name: "Agency One",
            },
          ],
          error: null,
        });
      }
      if (fnName === "accept_agency_invite") {
        return Promise.resolve({ data: "agency-1", error: null });
      }
      if (fnName === "get_user_agency_bootstrap") {
        return Promise.resolve({
          data: {
            memberships: [
              { agency_id: "agency-1", role: "member", agency_name: "Agency One", is_owner: false },
              { agency_id: "agency-2", role: "member", agency_name: "Agency Two", is_owner: false },
            ],
            pending_invites: [],
            last_agency_id: null,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/invitations"]}>
        <Routes>
          <Route path="/invitations" element={<><LocationDisplay /><Invitations /></>} />
          <Route path="/select-agency" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Agency One");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/select-agency");
    });
    expect(window.localStorage.getItem("activeAgencyId")).toBe("agency-1");
  });

  it("email mismatch does not redirect and shows error toast", async () => {
    const user = userEvent.setup();

    mockRpc.mockImplementation((fnName: string) => {
      if (fnName === "get_my_pending_agency_invites") {
        return Promise.resolve({
          data: [
            {
              invite_id: "inv-1",
              agency_id: "agency-1",
              role: "member",
              email: "user@example.com",
              invited_by: null,
              token: null,
              created_at: new Date().toISOString(),
              expires_at: null,
              agency_name: "Agency One",
            },
          ],
          error: null,
        });
      }
      if (fnName === "accept_agency_invite") {
        return Promise.resolve({ data: null, error: { message: "email_mismatch" } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(
      <MemoryRouter initialEntries={["/invitations"]}>
        <Routes>
          <Route path="/invitations" element={<><LocationDisplay /><Invitations /></>} />
          <Route path="/dashboard" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("Agency One");
    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
    expect(screen.getByTestId("location").textContent).toBe("/invitations");
  });
});
