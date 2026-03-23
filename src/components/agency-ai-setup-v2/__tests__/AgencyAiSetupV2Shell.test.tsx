import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AgencyAiSetupV2Shell } from "@/components/agency-ai-setup-v2/AgencyAiSetupV2Shell";

afterEach(() => {
  cleanup();
});

function renderShell(pathname: string, guidedMode: boolean, guidedStepIndex = -1) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="*"
          element={
            <AgencyAiSetupV2Shell
              agencyName="SMMAHUB Agency"
              readinessLabel="Needs Definition"
              guidedMode={guidedMode}
              currentPath={pathname}
              guidedStepIndex={guidedStepIndex}
            />
          }
        >
          <Route path="*" element={<div>Shell Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgencyAiSetupV2Shell", () => {
  it("renders the guided Strategy-first journey instead of the full stage map", () => {
    renderShell("/agency/ai-setup/foundations", true, 2);

    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();
    expect(screen.getAllByText("Review Your Foundations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approve Key Modules").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /switch to advanced setup/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Control Center")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy")).not.toBeInTheDocument();
  });

  it("renders the full setup stage map in advanced mode", () => {
    renderShell("/agency/ai-setup/control-center", false);

    expect(screen.getByText("Agency AI Setup V2")).toBeInTheDocument();
    expect(screen.getAllByText("Control Center").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Legacy").length).toBeGreaterThan(0);
    expect(screen.queryByText("Strategy-first journey")).not.toBeInTheDocument();
  });
});
