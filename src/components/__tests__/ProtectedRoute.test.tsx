import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const maybeSingle = vi.fn();
const mockFrom = vi.fn();
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
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/active-agency", () => ({
  getActiveAgencyId: () => "agency-1",
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function setupSupabase(status: "complete" | "in_progress" | null) {
  maybeSingle.mockResolvedValue({ data: status ? { status } : null, error: null });
  const chain = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle,
          }),
        }),
      }),
    }),
  };
  mockFrom.mockReturnValue(chain);
}

describe("ProtectedRoute onboarding gate", () => {
  it("redirects unauthenticated users to auth", async () => {
    authState = { session: null, user: null, loading: false };

    render(
      <MemoryRouter initialEntries={["/ai/onboarding/agency"]}>
        <Routes>
          <Route
            path="/ai/onboarding/agency"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/auth");
    });
  });

  it("redirects unauthenticated users from welcome to auth", async () => {
    authState = { session: null, user: null, loading: false };

    render(
      <MemoryRouter initialEntries={["/welcome"]}>
        <Routes>
          <Route
            path="/welcome"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/auth");
    });
  });

  it("redirects to onboarding when incomplete", async () => {
    authState = {
      session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      user: { id: "user-1", email: "user@example.com" },
      loading: false,
    };
    setupSupabase("in_progress");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/ai/onboarding/agency" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/ai/onboarding/agency");
    });
  });

  it("allows access when onboarding complete", async () => {
    authState = {
      session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) + 3600 },
      user: { id: "user-1", email: "user@example.com" },
      loading: false,
    };
    setupSupabase("complete");

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/ai/onboarding/agency" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/dashboard");
    });
  });

  it("redirects unauthenticated users from dashboard to auth", async () => {
    authState = { session: null, user: null, loading: false };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/auth");
    });
  });

  it.each(["/bootstrap", "/select-agency", "/create-agency", "/invitations"])(
    "redirects unauthenticated users from %s to auth",
    async (path) => {
      authState = { session: null, user: null, loading: false };

      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path={path}
              element={
                <ProtectedRoute>
                  <LocationDisplay />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        const locations = screen.getAllByTestId("location");
        expect(locations.at(-1)?.textContent).toBe("/auth");
      });
    },
  );

  it("redirects expired session from dashboard to auth", async () => {
    authState = {
      session: { access_token: "token-1", expires_at: Math.floor(Date.now() / 1000) - 3600 },
      user: { id: "user-1", email: "user@example.com" },
      loading: false,
    };

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <LocationDisplay />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      const locations = screen.getAllByTestId("location");
      expect(locations.at(-1)?.textContent).toBe("/auth");
    });
  });
});
