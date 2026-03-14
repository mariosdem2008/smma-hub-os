import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import AgencyAiAdmin from "@/pages/ai/AgencyAiAdmin";

const inserts: Array<{ table: string; payload: any }> = [];
const threads: any[] = [];
const messagesByThread: Record<string, any[]> = {};

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: any[]) => invokeMock(...args),
    },
    from: (table: string) => {
      const state: { filters: Record<string, any> } = { filters: {} };
      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          state.filters[col] = val;
          return builder;
        },
        order: async () => {
          if (table === "agency_ai_chat_threads") {
            return { data: threads, error: null };
          }
          if (table === "agency_ai_chat_messages") {
            const threadId = state.filters.thread_id;
            return { data: messagesByThread[threadId] ?? [], error: null };
          }
          return { data: [], error: null };
        },
        insert: (payload: any) => {
          inserts.push({ table, payload });
          if (table === "agency_ai_chat_threads") {
            const created = {
              id: `thread-${inserts.length}`,
              title: payload.title ?? "New chat",
              created_at: new Date().toISOString(),
              kind: payload.kind ?? "general",
            };
            threads.unshift(created);
            return {
              select: () => ({
                single: async () => ({ data: created, error: null }),
              }),
            };
          }
          return {
            select: () => ({
              single: async () => ({ data: { id: "msg-1" }, error: null }),
            }),
          };
        },
      };
      return builder;
    },
  },
}));

vi.mock("@/hooks/useRole", () => ({
  useRole: () => ({ isAdmin: true, loading: false }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/active-agency", () => ({
  getActiveAgencyId: () => "agency-1",
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("AgencyAiAdmin", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    inserts.length = 0;
    threads.length = 0;
    for (const key of Object.keys(messagesByThread)) delete messagesByThread[key];
    invokeMock.mockResolvedValue({ data: { assistant_message: "Hello" }, error: null });
    (globalThis as any).__SMMAHUB_STREAMING_DISABLED__ = true;
  });

  it("creates a general thread when clicking New chat", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AgencyAiAdmin />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "New chat" }));

    expect(inserts.some((i) => i.table === "agency_ai_chat_threads" && i.payload.kind === "general")).toBe(true);
  });

  it("creates a single setup thread from Start Setup", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AgencyAiAdmin />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "Start Setup" }));

    await waitFor(() => {
      expect(inserts.some((i) => i.table === "agency_ai_chat_threads" && i.payload.kind === "setup")).toBe(true);
    });

    const setupButton = (await screen.findAllByText("Setup (Guided)"))[0]?.closest("button");
    expect(setupButton).toBeTruthy();
    await user.click(setupButton as HTMLElement);

    const setupCreates = inserts.filter((i) => i.table === "agency_ai_chat_threads" && i.payload.kind === "setup");
    expect(setupCreates.length).toBe(1);
  });

  it("sends suggestion user_message when clicked", async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValueOnce({
      data: {
        assistant_message: "Pick a next action.",
        suggestions: [
          { id: "audit", label: "Audit onboarding", user_message: "Audit client onboarding and highlight friction." },
        ],
      },
      error: null,
    });
    invokeMock.mockResolvedValueOnce({ data: { assistant_message: "Got it." }, error: null });

    render(
      <MemoryRouter>
        <AgencyAiAdmin />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "New chat" }));
    await user.type(screen.getByPlaceholderText("Message the agency AI"), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const suggestionButton = await screen.findByRole("button", { name: "Audit onboarding" });
    await user.click(suggestionButton);

    await waitFor(() => {
      const lastCall = invokeMock.mock.calls.at(-1);
      expect(lastCall?.[1]?.body?.message).toBe("Audit client onboarding and highlight friction.");
    });
  });

  it("renders the shared workflow blocker when agency AI activation is required", async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: {
        message: "Blocked",
        context: {
          json: async () => ({
            code: "AGENT_ACTIVATION_REQUIRED",
            error: "Agency admin AI requires internal assist rollout.",
            deep_link: "/agency/ai-setup/readiness/preview/operator",
            required_mode: "internal_assist_only",
            unlock_state: "ready",
            activation_mode: "preview_only",
            missing_certification_scenarios: ["workflow_execution_certification"],
          }),
        },
      },
    });

    render(
      <MemoryRouter>
        <AgencyAiAdmin />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "New chat" }));
    await user.type(screen.getByPlaceholderText("Message the agency AI"), "Help me review ops blockers");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(
      screen.getByText("This AI workflow cannot be used live until the agency certifies this agent behavior."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open AI Setup" })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/operator",
    );
    expect(screen.getByText("Required rollout mode:")).toBeInTheDocument();
  });
});
