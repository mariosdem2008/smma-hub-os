import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import StrategyHubTab from "@/components/client-tabs/StrategyHubTab";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/strategy-os/StrategyOSContext", () => ({
  StrategyOSProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/strategy-os/status/useStrategyStatus", () => ({
  useStrategyStatus: () => ({
    completedCount: 0,
    totalCount: 6,
    blockers: [],
    perModule: {
      positioning: { status: "not_started", blockers: [] },
      pillars: { status: "not_started", blockers: [] },
      campaign_plan: { status: "not_started", blockers: [] },
      weekly_plan: { status: "not_started", blockers: [] },
      channel_adaptations: { status: "not_started", blockers: [] },
      rules_constraints: { status: "not_started", blockers: [] },
    },
    recommendedNextModuleId: "positioning",
  }),
}));

vi.mock("@/components/strategy-os/modules/positioning/PositioningModule", () => ({
  PositioningModule: () => <div>Positioning Module</div>,
}));
vi.mock("@/components/strategy-os/modules/pillars/PillarsModule", () => ({
  PillarsModule: () => <div>Pillars Module</div>,
}));
vi.mock("@/components/strategy-os/modules/campaign-plan/CampaignPlanModule", () => ({
  CampaignPlanModule: () => <div>Campaign Plan Module</div>,
}));
vi.mock("@/components/strategy-os/modules/weekly-plan/WeeklyPlanModule", () => ({
  WeeklyPlanModule: () => <div>Weekly Plan Module</div>,
}));
vi.mock("@/components/strategy-os/modules/channel-adaptations/ChannelAdaptationsModule", () => ({
  ChannelAdaptationsModule: () => <div>Channel Adaptations Module</div>,
}));
vi.mock("@/components/strategy-os/modules/rules-constraints/RulesConstraintsModule", () => ({
  RulesConstraintsModule: () => <div>Rules Constraints Module</div>,
}));

const renderStrategyHub = () =>
  render(
    <MemoryRouter initialEntries={[`${window.location.pathname}${window.location.search}`]}>
      <StrategyHubTab clientId="client-1" agencyId="agency-1" />
    </MemoryRouter>,
  );

describe("StrategyHubTab Strategy OS v3", () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("renders the 6 module labels", () => {
    renderStrategyHub();

    expect(screen.getAllByText("Positioning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pillars").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Campaign plan (monthly)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekly plan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Channel adaptations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rules/Constraints").length).toBeGreaterThan(0);
  });

  it("keeps the panel hidden by default and toggles it", async () => {
    renderStrategyHub();

    expect(screen.queryByText("AI assistant coming soon")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Panel" }));
    expect(screen.getByText("AI assistant coming soon")).toBeInTheDocument();
  });

  it("selects weekly module from deep link", () => {
    window.history.pushState({}, "", "/?strategy_module=weekly");
    renderStrategyHub();

    expect(screen.getByTestId("strategy-module-title")).toHaveTextContent("Weekly plan");
  });
});
