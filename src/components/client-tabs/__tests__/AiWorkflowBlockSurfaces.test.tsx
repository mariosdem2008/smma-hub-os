import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import AnalyticsTab from "@/components/client-tabs/AnalyticsTab";
import PipelineTab from "@/components/client-tabs/PipelineTab";
import TasksTab from "@/components/client-tabs/TasksTab";

const { toastSpy, mutateAsyncMock, MockAiAssistantError } = vi.hoisted(() => {
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
    toastSpy: vi.fn(),
    mutateAsyncMock: vi.fn(),
    MockAiAssistantError: HoistedAiAssistantError,
  };
});

function buildAssistantActivationError(overrides?: Partial<MockAiAssistantError>) {
  const error = new MockAiAssistantError("Workflow blocked by agency AI rollout.");
  error.code = "AGENT_ACTIVATION_REQUIRED";
  error.deepLink = "/agency/ai-setup/readiness/preview/operator";
  error.requiredMode = "internal_assist_only";
  error.unlockState = "ready";
  error.activationMode = "preview_only";
  error.missingCertificationScenarios = ["workflow_execution_certification"];
  Object.assign(error, overrides);
  return error;
}

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock("@/hooks/useAiAssistant", () => ({
  useAiAssistant: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  AiAssistantError: MockAiAssistantError,
}));

vi.mock("@/hooks/useClientAnalytics", () => ({
  useClientAnalytics: () => ({
    data: { postsThisMonth: 0, totalFollowers: 0 },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useTopPosts", () => ({
  useTopPosts: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useWorstPosts", () => ({
  useWorstPosts: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useProfileTrends", () => ({
  useProfileTrends: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/useSyncSocialMetrics", () => ({
  useSyncSocialMetrics: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useRole", () => ({
  useRole: () => ({
    isOwner: true,
    isAdmin: true,
    isManager: true,
    canCreateContent: true,
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/components/pipeline/ProjectCard", () => ({
  default: () => <div>ProjectCard</div>,
}));

vi.mock("@/components/pipeline/ProjectEditor", () => ({
  default: () => null,
}));

vi.mock("@/components/pipeline/BulkUploadModal", () => ({
  default: () => null,
}));

vi.mock("@/components/pipeline/SchedulingModal", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useActivityLog", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/components/client-tabs/shared/ClientTabEmptyState", () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const buildRows = (table: string) => {
    if (table === "profiles") return [{ timezone: "UTC" }];
    return [];
  };

  const createBuilder = (table: string) => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      in: async () => ({ data: buildRows(table), error: null }),
      order: async () => ({ data: buildRows(table), error: null }),
      single: async () => ({ data: buildRows(table)[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: buildRows(table)[0] ?? null, error: null }),
      update: () => builder,
      delete: () => builder,
      insert: async () => ({ data: null, error: null }),
    };
    return builder;
  };

  return {
    supabase: {
      from: (table: string) => createBuilder(table),
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      },
      functions: {
        invoke: vi.fn(async () => ({ data: null, error: null })),
      },
      channel: () => ({
        on: function () {
          return this;
        },
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
      removeChannel: vi.fn(),
    },
  };
});

describe("Shared AI workflow blocker surfaces", () => {
  afterEach(() => {
    cleanup();
    mutateAsyncMock.mockReset();
    toastSpy.mockReset();
  });

  beforeEach(() => {
    mutateAsyncMock.mockRejectedValue(buildAssistantActivationError());
  });

  it("shows the blocker in AnalyticsTab", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AnalyticsTab clientId="client-1" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "AI Anomaly Summary" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(
      screen.getByText("This AI workflow cannot be used live until the agency certifies this agent behavior."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open AI Setup" })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/operator",
    );
  });

  it("shows the blocker in PipelineTab", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <PipelineTab clientId="client-1" agencyId="agency-1" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "AI Bottleneck Summary" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(screen.getByText("Required rollout mode:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open AI Setup" })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/operator",
    );
  });

  it("shows the blocker in TasksTab", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TasksTab clientId="client-1" agencyId="agency-1" />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "AI Prioritize Tasks" }));

    expect(await screen.findByText("Certification required")).toBeInTheDocument();
    expect(screen.getByText("The current setup is missing the required certification for this workflow.")).toBeInTheDocument();
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalled();
    });
  });
});
