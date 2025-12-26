import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { PostCreateAgencyCta } from "@/components/PostCreateAgencyCta";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("PostCreateAgencyCta", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("shows admin CTA and routes to /ai/admin", async () => {
    sessionStorage.setItem("postCreateAgencyCta", "1");
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <>
                <LocationDisplay />
                <PostCreateAgencyCta isAdmin />
              </>
            }
          />
          <Route path="/ai/admin" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Open Agency AI Setup (Admin)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open Agency AI Setup (Admin)" }));
    expect(screen.getByTestId("location").textContent).toBe("/ai/admin");
    expect(sessionStorage.getItem("postCreateAgencyCta")).toBeNull();
  });
});

