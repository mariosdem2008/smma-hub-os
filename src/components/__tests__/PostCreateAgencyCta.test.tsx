import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { PostCreateAgencyCta } from "@/components/PostCreateAgencyCta";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe("PostCreateAgencyCta", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("shows CTA for admin when setup incomplete and routes to AI Setup", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <>
                <LocationDisplay />
                <PostCreateAgencyCta isAdmin aiSetupComplete={false} />
              </>
            }
          />
          <Route path="/agency/ai-setup" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Finish AI Setup")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open AI Setup" }));
    expect(screen.getByTestId("location").textContent).toBe("/agency/ai-setup");
  });

  it("hides CTA for non-admin", () => {
    render(
      <MemoryRouter>
        <PostCreateAgencyCta isAdmin={false} aiSetupComplete={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Finish AI Setup")).toBeNull();
  });
});
