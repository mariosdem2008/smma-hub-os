import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const maybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com" },
    loading: false,
  }),
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
  it("redirects to onboarding when incomplete", async () => {
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
});
