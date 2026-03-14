import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import { ClientRightPanel } from "@/components/client-detail/ClientRightPanel";

const { mutateAsyncMock, MockAiAssistantError, toastErrorMock } = vi.hoisted(() => {
  class HoistedAiAssistantError extends Error {
    code?: string;
    missing?: string[];
    deepLink?: string;
    requiredMode?: string;
    unlockState?: string;
    activationMode?: string;
    missingCertificationScenarios?: string[];
  }

  return {
    mutateAsyncMock: vi.fn(),
    MockAiAssistantError: HoistedAiAssistantError,
    toastErrorMock: vi.fn(),
  };
});

function buildActivationError() {
  const error = new MockAiAssistantError("Client assistant requires certification.");
  error.code = "AGENT_ACTIVATION_REQUIRED";
  error.deepLink = "/agency/ai-setup/readiness/preview/strategy";
  error.requiredMode = "internal_assist_only";
  error.unlockState = "ready";
  error.activationMode = "preview_only";
  error.missingCertificationScenarios = ["strategy_readiness_certification"];
  return error;
}

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

vi.mock("@/hooks/useAiAssistant", () => ({
  useAiAssistant: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  AiAssistantError: MockAiAssistantError,
}));

vi.mock("@/hooks/useStrategies", () => ({
  useStrategies: () => ({
    data: [{ id: "strategy-1" }],
  }),
}));

vi.mock("@/hooks/useStrategyHistory", () => ({
  useStrategyHistory: () => ({
    data: [],
    isLoading: false,
  }),
  groupHistoryByDate: () => new Map(),
  useAddHistoryEvent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useStrategyTasks", () => ({
  useStrategyTasks: () => ({
    data: [],
    isLoading: false,
  }),
  getTaskCounts: () => ({ todo: 0, in_progress: 0, completed: 0 }),
  useUpdateTaskStatus: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useStrategyModules", () => ({
  useStrategyModules: () => ({
    data: [],
  }),
  useUpdateModuleContent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/lib/strategy/constants", () => ({
  HISTORY_EVENT_LABELS: {},
  getModuleDefinition: () => null,
  TASK_PRIORITY_CONFIG: {},
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("ClientRightPanel", () => {
  afterEach(() => {
    cleanup();
    mutateAsyncMock.mockReset();
    toastErrorMock.mockReset();
  });

  beforeEach(() => {
    mutateAsyncMock.mockRejectedValue(buildActivationError());
  });

  it("shows the shared blocker notice when the client assistant is activation-blocked on load", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <MemoryRouter>
        <ClientRightPanel open onOpenChange={onOpenChange} clientId="client-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(
      screen.getByText("This AI workflow cannot be used live until the agency certifies this agent behavior."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open AI Setup" })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy",
    );
    expect(screen.getByRole("link", { name: "Open client onboarding" })).toHaveAttribute(
      "href",
      "/onboarding/client/client-1",
    );

    const callsBeforeRetry = mutateAsyncMock.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutateAsyncMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });
});
