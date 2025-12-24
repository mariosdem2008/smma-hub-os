import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClientDetail from "@/pages/ClientDetail";
import {
  getClientBrainStatus,
  getClientById,
  getClientBrandingPrimaryColor,
} from "@/data";

vi.mock("@/data", () => ({
  getClientBrainStatus: vi.fn(),
  getClientById: vi.fn(),
  getClientBrandingPrimaryColor: vi.fn(),
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
  });

  it("blocks access when client is unusable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: false });
    renderClientDetail("/clients/client-1");

    expect(await screen.findByText("AI Client Onboarding required")).toBeInTheDocument();
  });

  it("allows access when client is usable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: true });
    renderClientDetail("/clients/client-1");

    expect(await screen.findByText("Strategy")).toBeInTheDocument();
    expect(screen.queryByText("AI Client Onboarding required")).not.toBeInTheDocument();
  });

  it("blocks deep link access when client is unusable", async () => {
    vi.mocked(getClientBrainStatus).mockResolvedValue({ usable: false });
    renderClientDetail("/clients/client-1?tab=strategy");

    expect(await screen.findByText("AI Client Onboarding required")).toBeInTheDocument();
  });
});
