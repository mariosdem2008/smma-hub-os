import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiRepChatTab from "@/components/client-tabs/AiRepChatTab";

const getSessionMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => getSessionMock(...args),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

describe("AiRepChatTab", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("shows AI setup CTA when an agency session is blocked by activation/certification", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "agency-token" } },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 412,
      text: async () =>
        JSON.stringify({
          code: "AGENT_ACTIVATION_REQUIRED",
          error: "client facing agent requires certification before operational usage.",
          deep_link: "/agency/ai-setup/readiness/preview/client_facing",
          required_mode: "operational",
          unlock_state: "operational",
          activation_mode: "operational",
          missing_certification_scenarios: ["client_response_certification"],
        }),
    } as Response);

    render(
      <MemoryRouter>
        <AiRepChatTab clientId="client-1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Message the AI Representative..."), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(screen.getByText("This AI workflow cannot be used live until the agency certifies this agent behavior.")).toBeInTheDocument();
    expect(screen.getByText("The current setup is missing the required certification for this workflow.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open AI Setup" })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/client_facing",
    );
  });

  it("shows portal-safe fallback when there is no agency session", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 412,
      text: async () =>
        JSON.stringify({
          code: "AGENT_ACTIVATION_REQUIRED",
          error: "client facing agent requires certification before operational usage.",
          deep_link: "/agency/ai-setup/readiness/preview/client_facing",
          required_mode: "operational",
          unlock_state: "operational",
          activation_mode: "operational",
          missing_certification_scenarios: ["client_response_certification"],
        }),
    } as Response);

    render(
      <MemoryRouter>
        <AiRepChatTab clientId="client-1" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Message the AI Representative..."), {
      target: { value: "hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Contact your agency team" })).toBeDisabled();
    });
    expect(
      screen.getByText("Your agency needs to certify this AI workflow before it can be used in the client portal."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open AI Setup" })).not.toBeInTheDocument();
  });
});
