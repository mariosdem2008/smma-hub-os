import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClientDetail from "@/pages/ClientDetail";
import {
  getClientBrainStatus,
  getClientById,
  getClientBrandingPrimaryColor,
} from "@/data";
import { useOnboardingProfile } from "@/hooks/useOnboardingProfile";
import { useAgencyMemberOptions, useClientEnrichmentQueue, useClientExecutionTasks, useClientOperationEvents, useClientOperationsChecklist, useClientOperationsSetup } from "@/hooks/useClientOperations";

vi.mock("@/data", () => ({
  getClientBrainStatus: vi.fn(),
  getClientById: vi.fn(),
  getClientBrandingPrimaryColor: vi.fn(),
}));

vi.mock("@/hooks/useOnboardingProfile", () => ({
  useOnboardingProfile: vi.fn(),
}));

vi.mock("@/hooks/useClientOperations", () => ({
  useClientOperationsSetup: vi.fn(),
  useClientOperationsChecklist: vi.fn(),
  useClientEnrichmentQueue: vi.fn(),
  useClientExecutionTasks: vi.fn(),
  useClientOperationEvents: vi.fn(),
  useAgencyMemberOptions: vi.fn(),
}));

vi.mock("@/hooks/useClientBlockers", () => ({
  useClientBlockers: () => ({ data: null, isLoading: false }),
  useScanClientBlockers: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/usePullToRefresh", () => ({
  usePullToRefresh: () => ({ isRefreshing: false, pullDistance: 0 }),
}));

vi.mock("@/hooks/useClientFonts", () => ({
  useClientFonts: () => {},
}));

vi.mock("@/lib/haptics", () => ({
  hapticSelection: () => {},
}));

vi.mock("@/components/ClientHeader", () => ({
  default: () => <div>ClientHeader</div>,
}));

vi.mock("@/components/client-tabs/OverviewTab", () => ({
  default: () => <div>OverviewTab</div>,
}));
vi.mock("@/components/client-tabs/AnalyticsTab", () => ({
  default: () => <div>AnalyticsTab</div>,
}));
vi.mock("@/components/client-tabs/BrandIdentityTab", () => ({
  default: () => <div>BrandIdentityTab</div>,
}));
vi.mock("@/components/SocialProfilesTab", () => ({
  default: () => <div>SocialProfilesTab</div>,
}));
vi.mock("@/components/client-tabs/PipelineTab", () => ({
  default: () => <div>PipelineTab</div>,
}));
vi.mock("@/components/client-tabs/CalendarTab", () => ({
  default: () => <div>CalendarTab</div>,
}));
vi.mock("@/components/client-tabs/ClientUploadsTab", () => ({
  default: () => <div>ClientUploadsTab</div>,
}));
vi.mock("@/components/client-tabs/ClientPortalTab", () => ({
  ClientPortalTab: () => <div>ClientPortalTab</div>,
}));
vi.mock("@/components/client-tabs/LibraryTab", () => ({
  default: () => <div>LibraryTab</div>,
}));
vi.mock("@/components/client-tabs/TasksTab", () => ({
  default: () => <div>TasksTab</div>,
}));
vi.mock("@/components/client-tabs/ReportsTab", () => ({
  default: () => <div>ReportsTab</div>,
}));
vi.mock("@/components/client-tabs/AdsTab", () => ({
  default: () => <div>AdsTab</div>,
}));
vi.mock("@/components/client-tabs/StrategyHubTab", () => ({
  default: () => <div>StrategyHubTab</div>,
}));

const renderClientDetail = (initialEntry: string) => {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/clients/:clientId" element={<ClientDetail />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe("ClientDetail gate", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(getClientById).mockResolvedValue({
      id: "client-1",
      name: "Client One",
      email: "client@example.com",
      phone: null,
      company: "Client Co",
      status: "active",
      created_at: new Date().toISOString(),
      logo_url: null,
      niche: null,
      website: null,
      brand_colors: null,
      tone_of_voice: null,
      notes: null,
      primary_font: null,
      secondary_font: null,
      agency_id: "agency-1",
    });
    vi.mocked(getClientBrandingPrimaryColor).mockResolvedValue(null);
    vi.mocked(useOnboardingProfile).mockReturnValue({
      data: {
        v5_meta: {
          staged_readiness: {
            state: "strategy_enriched",
            essential_intake: { percent: 100, missing: [] },
            operations_setup: { percent: 100, missing: [] },
            progressive_enrichment: { percent: 100, missing: [] },
          },
        },
      },
    } as ReturnType<typeof useOnboardingProfile>);
    vi.mocked(useClientOperationsSetup).mockReturnValue({
      data: null,
    } as ReturnType<typeof useClientOperationsSetup>);
    vi.mocked(useClientOperationsChecklist).mockReturnValue({
      data: [],
    } as ReturnType<typeof useClientOperationsChecklist>);
    vi.mocked(useClientEnrichmentQueue).mockReturnValue({
      data: [],
    } as ReturnType<typeof useClientEnrichmentQueue>);
    vi.mocked(useClientExecutionTasks).mockReturnValue({
      data: [],
    } as ReturnType<typeof useClientExecutionTasks>);
    vi.mocked(useClientOperationEvents).mockReturnValue({
      data: [],
    } as ReturnType<typeof useClientOperationEvents>);
    vi.mocked(useAgencyMemberOptions).mockReturnValue({
      data: [],
    } as ReturnType<typeof useAgencyMemberOptions>);
  });

  it("blocks access when client is unusable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: false });
    renderClientDetail("/clients/client-1");

    expect(await screen.findByText("Client Setup Incomplete")).toBeInTheDocument();
  });

  it("allows access when client is usable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: true });
    renderClientDetail("/clients/client-1");

    expect(await screen.findByText("Strategy")).toBeInTheDocument();
    expect(screen.queryByText("Client Onboarding Required")).not.toBeInTheDocument();
  });

  it("shows strategy generation handoff status after onboarding completion", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: true });
    renderClientDetail("/clients/client-1?tab=strategy&handoff=strategy_generating");

    expect(await screen.findAllByText("Strategy generation in progress")).toHaveLength(2);
    expect(screen.getByText(/Strategy generation is in progress/i)).toBeInTheDocument();
  });

  it("shows exact execution blockers when operations setup is incomplete", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: true });
    vi.mocked(useOnboardingProfile).mockReturnValue({
      data: {
        v5_meta: {
          staged_readiness: {
            state: "setup_usable",
            essential_intake: { percent: 100, missing: [] },
            operations_setup: {
              percent: 64,
              missing: ["ops_primary_contact", "ops_access_status"],
            },
            progressive_enrichment: { percent: 25, missing: ["brand_voice"] },
          },
        },
      },
    } as ReturnType<typeof useOnboardingProfile>);
    vi.mocked(useClientOperationsSetup).mockReturnValue({
      data: {
        setup_status: "in_progress",
      },
    } as ReturnType<typeof useClientOperationsSetup>);
    vi.mocked(useClientOperationsChecklist).mockReturnValue({
      data: [
        { id: "item-1", status: "done" },
        { id: "item-2", status: "waiting_on_client" },
      ],
    } as ReturnType<typeof useClientOperationsChecklist>);
    vi.mocked(useClientEnrichmentQueue).mockReturnValue({
      data: [{ id: "queue-1" }],
    } as ReturnType<typeof useClientEnrichmentQueue>);
    vi.mocked(useClientExecutionTasks).mockReturnValue({
      data: [
        { id: "task-1", title: "Resolve missing access", priority: "urgent", owner: "client", description: "Waiting on Meta access", source_kind: "enrichment_queue", status: "waiting_on_client" },
      ],
    } as ReturnType<typeof useClientExecutionTasks>);
    vi.mocked(useClientOperationEvents).mockReturnValue({
      data: [
        { id: "event-1", event_kind: "drift_detected", actor_kind: "system", payload: { title: "Strategy drift detected" } },
      ],
    } as ReturnType<typeof useClientOperationEvents>);
    vi.mocked(useAgencyMemberOptions).mockReturnValue({
      data: [],
    } as ReturnType<typeof useAgencyMemberOptions>);
    renderClientDetail("/clients/client-1?tab=strategy");

    expect(await screen.findAllByText("Execution setup incomplete")).toHaveLength(2);
    expect(screen.getByText("Still blocking execution")).toBeInTheDocument();
    expect(screen.getByText("Execution checklist")).toBeInTheDocument();
    expect(screen.getByText("Ops record: in progress")).toBeInTheDocument();
    expect(screen.getByText("Checklist: 1/2")).toBeInTheDocument();
    expect(screen.getByText("Enrichment queue: 1 active")).toBeInTheDocument();
    expect(screen.getByText("Execution tasks: 1 active")).toBeInTheDocument();
    expect(screen.getAllByText("1 urgent").length).toBeGreaterThan(0);
    expect(screen.getByText("Active execution tasks")).toBeInTheDocument();
    expect(screen.getByText("Resolve missing access")).toBeInTheDocument();
    expect(screen.getByText("Recent operational activity")).toBeInTheDocument();
    expect(screen.getByText("Strategy drift detected")).toBeInTheDocument();
    expect(screen.getAllByText("Primary contact").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Access readiness").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Finish operations setup" })).toBeInTheDocument();
  });

  it("blocks deep link access when client is unusable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: false });
    renderClientDetail("/clients/client-1?tab=strategy");

    expect(await screen.findByText("Client Setup Incomplete")).toBeInTheDocument();
  });
});
