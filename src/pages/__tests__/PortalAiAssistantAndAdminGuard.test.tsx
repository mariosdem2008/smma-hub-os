import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { PortalAiAssistant } from "@/pages/client-portal/PortalAiAssistant";
import AgencyAiAdmin from "@/pages/ai/AgencyAiAdmin";

const useRoleMock = vi.fn();

vi.mock("@/hooks/useRole", () => ({
  useRole: () => useRoleMock(),
}));

vi.mock("@/components/client-tabs/AiRepChatTab", () => ({
  default: ({ clientId }: { clientId: string }) => <div>AiRepChatTab {clientId}</div>,
}));

function OutletContextWrapper({ clientId }: { clientId: string }) {
  return <Outlet context={{ clientId }} />;
}

describe("Client portal AI + admin guard", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  beforeEach(() => {
    useRoleMock.mockReturnValue({ isAdmin: false, loading: false });
  });

  it("renders Client Portal AI Assistant page using clientId from outlet context", async () => {
    render(
      <MemoryRouter initialEntries={["/client/portal/ai-assistant"]}>
        <Routes>
          <Route path="/client/portal" element={<OutletContextWrapper clientId="client-123" />}>
            <Route path="ai-assistant" element={<PortalAiAssistant />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("AI Assistant")).toBeInTheDocument();
    expect(screen.getByText("AiRepChatTab client-123")).toBeInTheDocument();
  });

  it("blocks non-admin access to Agency AI route", async () => {
    useRoleMock.mockReturnValue({ isAdmin: false, loading: false });

    render(
      <MemoryRouter initialEntries={["/ai/admin"]}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/ai/admin" element={<AgencyAiAdmin />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Agency AI")).not.toBeInTheDocument();
  });

  it("allows admin access to Agency AI route", async () => {
    useRoleMock.mockReturnValue({ isAdmin: true, loading: false });

    render(
      <MemoryRouter initialEntries={["/ai/admin"]}>
        <Routes>
          <Route path="/ai/admin" element={<AgencyAiAdmin />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Agency AI")).toBeInTheDocument();
    expect(screen.getByText("Admin-only")).toBeInTheDocument();
  });
});

