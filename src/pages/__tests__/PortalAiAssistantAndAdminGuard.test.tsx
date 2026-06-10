import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { PortalAiAssistant } from "@/pages/client-portal/PortalAiAssistant";
import AgencyAiAdmin from "@/pages/ai/AgencyAiAdmin";

const useRoleMock = vi.fn();
const useAuthMock = vi.fn();
const supabaseFromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => supabaseFromMock(...args),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/useRole", () => ({
  useRole: () => useRoleMock(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
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
    useAuthMock.mockReturnValue({ user: { id: "user-1" } });

    supabaseFromMock.mockImplementation((table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: null, error: null }),
        order: async () => ({ data: [], error: null }),
      };

      if (table === "agency_members") {
        query.maybeSingle = async () => ({ data: { agency_id: "agency-1" }, error: null });
      }

      if (table === "agency_ai_chat_messages") {
        query.order = async () => ({ data: [], error: null });
      }

      if (table === "agency_ai_chat_threads") {
        query.order = async () => ({ data: [], error: null });
      }

      return query;
    });
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
    expect(screen.getByText(/Ask me about approvals/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message the AI Assistant...")).toBeInTheDocument();
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
    expect(screen.queryByText("Chats")).not.toBeInTheDocument();
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

    expect(await screen.findByText("Chats")).toBeInTheDocument();
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message the agency AI")).toBeInTheDocument();
  });
});
