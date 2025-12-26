import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import Bootstrap from "@/pages/Bootstrap";
import Welcome from "@/pages/Welcome";

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

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("bootstrap routing", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => cleanup());

  it("non-member with no invites lands on /welcome", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { memberships: [], pending_invites: [], last_agency_id: null },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/bootstrap"]}>
        <Routes>
          <Route path="/bootstrap" element={<Bootstrap />} />
          <Route path="/welcome" element={<><LocationDisplay /><Welcome /></>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/welcome");
    });
    expect(screen.getByText("Are you a member of an existing agency?")).toBeTruthy();
  });

  it("pending invite triggers auto-accept then redirects to dashboard", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        memberships: [],
        pending_invites: [
          {
            invite_id: "inv-1",
            agency_id: "agency-1",
            role: "member",
            email: "user@example.com",
            expires_at: new Date().toISOString(),
            agency_name: "Agency 1",
          },
        ],
        last_agency_id: null,
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={["/bootstrap"]}>
        <Routes>
          <Route path="/bootstrap" element={<Bootstrap />} />
          <Route path="/welcome" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/welcome");
    });
    expect(window.localStorage.getItem("activeAgencyId")).toBeNull();
  });
});
