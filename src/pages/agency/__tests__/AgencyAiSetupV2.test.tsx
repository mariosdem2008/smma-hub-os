import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AgencyAiSetupV2Overview from "@/pages/agency/AgencyAiSetupV2Overview";
import AgencyAiSetupV2Section from "@/pages/agency/AgencyAiSetupV2Section";
import AgencyAiSetupV2Foundations from "@/pages/agency/AgencyAiSetupV2Foundations";
import AgencyAiSetupV2Modules from "@/pages/agency/AgencyAiSetupV2Modules";
import AgencyAiSetupV2ModuleDetail from "@/pages/agency/AgencyAiSetupV2ModuleDetail";
import AgencyAiSetupV2Guardrails from "@/pages/agency/AgencyAiSetupV2Guardrails";
import AgencyAiSetupV2Workflow from "@/pages/agency/AgencyAiSetupV2Workflow";
import AgencyAiSetupV2Readiness from "@/pages/agency/AgencyAiSetupV2Readiness";
import AgencyAiSetupV2ReadinessPreview from "@/pages/agency/AgencyAiSetupV2ReadinessPreview";
import AgencyAiSetupV2Activation from "@/pages/agency/AgencyAiSetupV2Activation";
import AgencyAiSetupV2ControlCenter from "@/pages/agency/AgencyAiSetupV2ControlCenter";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

vi.mock("@/hooks/useAgency", () => ({
  useAgency: () => ({ agencyId: "agency-1" }),
}));

vi.mock("@/hooks/useAgencyData", () => ({
  useAgencyData: () => ({
    agency: {
      name: "SMMAHUB Agency",
      niche: "Service businesses",
    },
  }),
}));

vi.mock("@/hooks/useAgencyAiSetupV2", () => ({
  useAgencyAiSetupResolvedState: vi.fn(),
  useAgencyAiCertificationsV2: () => ({
    data: [],
    isLoading: false,
  }),
  useAgencyAiCertificationEventsV2: () => ({
    data: [],
    isLoading: false,
  }),
  useTouchAgencyAiSetupStatusV2: () => ({
    mutate: vi.fn(),
  }),
  useSaveAgencyAiSetupFoundationsV2: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSaveAgencyAiSetupGuardrailsV2: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSaveAgencyAiSetupWorkflowV2: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRunAgencyAiSetupReadinessReviewV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useActivateAgencyAgentClassV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useAgencyAiSetupSimulationsV2: () => ({
    data: [],
    isLoading: false,
  }),
  useCreateAgencyAiSetupSimulationV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  usePromoteAgencyAiSimulationToCertificationV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRevokeAgencyAiCertificationV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useAgencyOperatingModulesV2", () => ({
  useLatestAgencyOperatingModulesV2: () => ({
    isLoading: false,
    latestByKey: new Map([
      ["agency_identity", { status: "approved", version: 2, confidence: 90, updated_at: "2026-03-14T08:45:00.000Z", content_json: { rules: [{ statement: "Lead with niche clarity" }, { statement: "Stay niche-specific" }], examples: [{ summary: "Boutique fitness positioning" }], anti_patterns: [], edge_cases: [], evidence_sources: [], confidence: 90 } }],
      ["quality_bar", { status: "draft", version: 1, confidence: 45, updated_at: "2026-03-14T10:00:00.000Z", content_json: { title: "Quality Bar", definition: "Reject weak outputs", rules: [{ statement: "Reject vague outputs" }], examples: [], anti_patterns: [], edge_cases: [], evidence_sources: [], confidence: 45, approval: { owner_role: "agency_owner", required: true, status: "draft" }, downstream_usage: ["agency_ai_setup_v2"] } }],
    ]),
  }),
  useEnsureAgencyOperatingModuleDraftV2: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAgencyOperatingModuleReviewsV2: () => ({
    data: [],
  }),
  useReviewAgencyOperatingModuleV2: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSaveAgencyOperatingModuleV2: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/useBrainDocuments", () => ({
  useApprovedBrainDocuments: () => ({
    data: [
      { id: "doc-1", title: "Approved Strategy Notes", module: "offer_strategy" },
      { id: "doc-2", title: "Approved Quality Review Notes", module: "quality_bar" },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useRole", () => ({
  useRole: () => ({ canEditContent: true }),
}));

const { useAgencyAiSetupResolvedState } = await import("@/hooks/useAgencyAiSetupV2");

describe("Agency AI Setup V2 routes", () => {
  beforeEach(() => {
    vi.mocked(useAgencyAiSetupResolvedState).mockReturnValue({
      status: {
        current_stage: "imports",
        last_active_at: "2026-03-14T08:00:00.000Z",
        meta_json: {
          imports: {
            imported_at: "2026-03-14T06:00:00.000Z",
          },
          foundations: {
            updated_at: "2026-03-14T08:00:00.000Z",
          },
          guardrails: {
            updated_at: "2026-03-14T08:30:00.000Z",
          },
          workflow: {
            updated_at: "2026-03-14T09:00:00.000Z",
          },
        },
      },
      readiness: {
        knowledge_coverage: 22,
        process_definition: 10,
        quality_definition: 18,
        compliance_safety: 15,
        approval_governance: 12,
        evidence_strength: 20,
        overall_label: "Needs Definition",
        critical_blockers: ["Import agency context", "Approve core operating modules"],
      },
      unlocks: [
        { agent_class: "strategy", unlock_state: "blocked", blocked_reasons: ["Core modules not approved"] },
        { agent_class: "creator", unlock_state: "blocked", blocked_reasons: ["Guardrails incomplete"] },
        { agent_class: "operator", unlock_state: "blocked", blocked_reasons: ["Workflow incomplete"] },
        { agent_class: "analyst", unlock_state: "preview_only", blocked_reasons: [] },
        { agent_class: "client_facing", unlock_state: "blocked", blocked_reasons: ["Approval governance incomplete"] },
      ],
      certificationsByAgentClass: {
        strategy: { certifiedScenarioKeys: [], requiredScenarioKeys: ["strategy_readiness_certification"], missingScenarioKeys: ["strategy_readiness_certification"] },
        creator: { certifiedScenarioKeys: [], requiredScenarioKeys: ["creator_brief_certification"], missingScenarioKeys: ["creator_brief_certification"] },
        operator: { certifiedScenarioKeys: [], requiredScenarioKeys: ["workflow_execution_certification"], missingScenarioKeys: ["workflow_execution_certification"] },
        analyst: { certifiedScenarioKeys: [], requiredScenarioKeys: ["reporting_certification"], missingScenarioKeys: ["reporting_certification"] },
        client_facing: { certifiedScenarioKeys: [], requiredScenarioKeys: ["client_response_certification"], missingScenarioKeys: ["client_response_certification"] },
      },
      certifications: [
        {
          id: "cert-1",
          agency_id: "agency-1",
          agent_class: "strategy",
          scenario_key: "strategy_readiness_certification",
          scenario_title: "Strategy readiness certification",
          certification_state: "certified",
          latest_simulation_id: "sim-1",
          latest_result: "pass",
          latest_dimension_scores: {},
          latest_findings: [],
          recommended_next_action: null,
          certified_at: "2026-03-14T07:00:00.000Z",
          certified_by: "user-1",
          revoked_at: null,
          revoked_by: null,
          note: null,
          created_at: "2026-03-14T07:00:00.000Z",
          updated_at: "2026-03-14T07:00:00.000Z",
        },
      ],
      isLoading: false,
    } as any);
  });

  it("renders overview readiness summary and continue CTA", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup"]}>
        <Routes>
          <Route path="/agency/ai-setup" element={<AgencyAiSetupV2Overview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Agency AI Setup V2")).toBeInTheDocument();
    expect(screen.getByText("Needs Definition")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue setup/i })).toHaveAttribute("href", "/agency/ai-setup/imports");
    expect(screen.getByText("Critical blockers")).toBeInTheDocument();
    expect(screen.getByText("Strategy AI milestone")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /See trust path/i }).length).toBeGreaterThan(0);
  });

  it("renders foundations coaching and checkpoint flow", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/foundations"]}>
        <Routes>
          <Route path="/agency/ai-setup/foundations" element={<AgencyAiSetupV2Foundations />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /use starter draft/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /strengthen this for me/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("Strategy AI foundations checkpoint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /run a quick strategy ai preview/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy",
    );
  });

  it("renders section placeholder shell", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/workflow"]}>
        <Routes>
          <Route path="/agency/ai-setup/workflow" element={<AgencyAiSetupV2Section stageKey="workflow" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Workflow And Approvals").length).toBeGreaterThan(0);
    expect(screen.getByText(/Phase 1 placeholder/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to readiness/i })).toHaveAttribute("href", "/agency/ai-setup/readiness");
  });

  it("renders modules workspace with approval summary", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/modules"]}>
        <Routes>
          <Route path="/agency/ai-setup/modules" element={<AgencyAiSetupV2Modules />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Operating Modules")).toBeInTheDocument();
    expect(screen.getByText("1/6 approved")).toBeInTheDocument();
    expect(screen.getByText("Agency Identity")).toBeInTheDocument();
    expect(screen.getByText("Quality Bar")).toBeInTheDocument();
    expect(screen.getByText("Still needed before trusted approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to guardrails/i })).toHaveAttribute("href", "/agency/ai-setup/guardrails");
  });

  it("renders module detail proof guidance for a critical module", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/modules/quality_bar"]}>
        <Routes>
          <Route path="/agency/ai-setup/modules/:moduleKey" element={<AgencyAiSetupV2ModuleDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("What good looks like")).toBeInTheDocument();
    expect(screen.getByText("What weak input looks like")).toBeInTheDocument();
    expect(screen.getByText("Suggested draft from current setup evidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply suggested draft/i })).toBeInTheDocument();
    expect(screen.getByText("Proof requirements for trusted approval")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence sources")).toBeInTheDocument();
    expect(screen.getByText("Approval is blocked until the missing proof requirements above are met.")).toBeInTheDocument();
  });

  it("renders guardrails setup form", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/guardrails"]}>
        <Routes>
          <Route path="/agency/ai-setup/guardrails" element={<AgencyAiSetupV2Guardrails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Guardrails")).toBeInTheDocument();
    expect(screen.getByLabelText("Quality review standard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use starter guardrails/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /strengthen this for me/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Nothing written yet\./i).length).toBeGreaterThan(0);
    expect(screen.getByText("Creator and client-facing guardrails checkpoint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to workflow/i })).toHaveAttribute("href", "/agency/ai-setup/workflow");
  });

  it("renders workflow setup form", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/workflow"]}>
        <Routes>
          <Route path="/agency/ai-setup/workflow" element={<AgencyAiSetupV2Workflow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Workflow And Approvals").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Lifecycle stages")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use starter workflow/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /strengthen this for me/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Missing:/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Operator workflow checkpoint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to readiness/i })).toHaveAttribute("href", "/agency/ai-setup/readiness");
  });

  it("renders readiness review screen", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/readiness"]}>
        <Routes>
          <Route path="/agency/ai-setup/readiness" element={<AgencyAiSetupV2Readiness />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Readiness Review")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run readiness review/i })).toBeInTheDocument();
    expect(screen.getByText("Capability trust levels")).toBeInTheDocument();
    expect(screen.getByText("Certification status")).toBeInTheDocument();
    expect(screen.getByText("Trust needs revalidation after recent setup changes")).toBeInTheDocument();
    expect(screen.getAllByText(/Certification stale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/strategy readiness certification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Needs revalidation/i).length).toBeGreaterThan(0);
  });

  it("renders activation screen", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/activation"]}>
        <Routes>
          <Route path="/agency/ai-setup/activation" element={<AgencyAiSetupV2Activation />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Activation")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /activate/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open readiness preview/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Current trust is outdated because setup evidence changed after certification/i)).toBeInTheDocument();
    expect(screen.getAllByText(/strategy readiness certification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Needs revalidation/i).length).toBeGreaterThan(0);
  });

  it("renders readiness preview screen", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/readiness/preview/strategy"]}>
        <Routes>
          <Route path="/agency/ai-setup/readiness/preview/:agentClass" element={<AgencyAiSetupV2ReadinessPreview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("strategy Preview")).toBeInTheDocument();
    expect(screen.getByText("Certification scenarios")).toBeInTheDocument();
    expect(screen.getByText("Trust path for this capability")).toBeInTheDocument();
    expect(screen.getByText("What looks weak right now")).toBeInTheDocument();
    expect(screen.getByText("Exact proof gaps blocking trust")).toBeInTheDocument();
    expect(screen.getAllByText(/Quality Bar/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/strategy readiness certification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /run scenario/i }).length).toBeGreaterThan(0);
  });

  it("renders control center screen", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/control-center"]}>
        <Routes>
          <Route path="/agency/ai-setup/control-center" element={<AgencyAiSetupV2ControlCenter />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Control Center")).toBeInTheDocument();
    expect(screen.getByText("Recent simulations")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /strategy readiness certification/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("Certification records")).toBeInTheDocument();
    expect(screen.getByText("Stale certifications need reruns")).toBeInTheDocument();
    expect(screen.getAllByText(/Needs revalidation/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /run strategy readiness certification/i })).toBeInTheDocument();
  });
});
