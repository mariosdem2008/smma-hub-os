import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AgencyAiSetupV2Overview from "@/pages/agency/AgencyAiSetupV2Overview";
import AgencyAiSetupV2Start from "@/pages/agency/AgencyAiSetupV2Start";
import AgencyAiSetupV2Section from "@/pages/agency/AgencyAiSetupV2Section";
import AgencyAiSetupV2Imports from "@/pages/agency/AgencyAiSetupV2Imports";
import AgencyAiSetupV2Foundations from "@/pages/agency/AgencyAiSetupV2Foundations";
import AgencyAiSetupV2Modules from "@/pages/agency/AgencyAiSetupV2Modules";
import AgencyAiSetupV2ModuleDetail from "@/pages/agency/AgencyAiSetupV2ModuleDetail";
import AgencyAiSetupV2Guardrails from "@/pages/agency/AgencyAiSetupV2Guardrails";
import AgencyAiSetupV2Workflow from "@/pages/agency/AgencyAiSetupV2Workflow";
import AgencyAiSetupV2Activate from "@/pages/agency/AgencyAiSetupV2Activate";
import AgencyAiSetupV2Readiness from "@/pages/agency/AgencyAiSetupV2Readiness";
import AgencyAiSetupV2ReadinessPreview from "@/pages/agency/AgencyAiSetupV2ReadinessPreview";
import AgencyAiSetupV2Activation from "@/pages/agency/AgencyAiSetupV2Activation";
import AgencyAiSetupV2ControlCenter from "@/pages/agency/AgencyAiSetupV2ControlCenter";
import type { NavigateFunction } from "react-router-dom";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

const saveFoundationsMutateAsync = vi.fn();
const saveGuardrailsMutateAsync = vi.fn();
const saveWorkflowMutateAsync = vi.fn();
const saveModuleMutateAsync = vi.fn();
const createSimulationMutateAsync = vi.fn();
const activateAgentMutateAsync = vi.fn();
const persistCheckpointMutateAsync = vi.fn();
const importContextMutateAsync = vi.fn();
const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock as NavigateFunction,
  };
});

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
    mutateAsync: saveFoundationsMutateAsync,
    isPending: false,
  }),
  useSaveAgencyAiSetupGuardrailsV2: () => ({
    mutateAsync: saveGuardrailsMutateAsync,
    isPending: false,
  }),
  useSaveAgencyAiSetupWorkflowV2: () => ({
    mutateAsync: saveWorkflowMutateAsync,
    isPending: false,
  }),
  usePersistAgencyAiSetupCheckpointV2: () => ({
    mutate: vi.fn(),
    mutateAsync: persistCheckpointMutateAsync,
    isPending: false,
  }),
  useImportAgencyAiSetupContextV2: () => ({
    mutateAsync: importContextMutateAsync,
    isPending: false,
  }),
  useSelectAgencyAiSetupStrategyTemplateV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRunAgencyAiSetupReadinessReviewV2: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useActivateAgencyAgentClassV2: () => ({
    mutate: vi.fn(),
    mutateAsync: activateAgentMutateAsync,
    isPending: false,
  }),
  useAgencyAiSetupSimulationsV2: () => ({
    data: [],
    isLoading: false,
  }),
  useCreateAgencyAiSetupSimulationV2: () => ({
    mutate: vi.fn(),
    mutateAsync: createSimulationMutateAsync,
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
    mutateAsync: saveModuleMutateAsync,
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
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    saveFoundationsMutateAsync.mockReset();
    saveGuardrailsMutateAsync.mockReset();
    saveWorkflowMutateAsync.mockReset();
    saveModuleMutateAsync.mockReset();
    createSimulationMutateAsync.mockReset();
    activateAgentMutateAsync.mockReset();
    persistCheckpointMutateAsync.mockReset();
    importContextMutateAsync.mockReset();
    navigateMock.mockReset();

    vi.mocked(useAgencyAiSetupResolvedState).mockReturnValue({
      status: {
        current_stage: "imports",
        last_active_at: "2026-03-14T08:00:00.000Z",
        meta_json: {
          guided_strategy_template_key: "local_service",
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
          checkpoints: {
            imports: {
              milestoneLabel: "Latest checkpoint: Local Service Growth draft baseline",
              reliableNow: "Strategy AI can draft a first positioning baseline for SMMAHUB Agency around Service businesses.",
              stillWeak: "Your niche positioning still needs confirmation or tightening.",
              nextAction: "Open foundations next and tighten the Strategy AI baseline one decision at a time.",
              updatedNote: "Updated from the latest local service growth import pass.",
              updated_at: "2026-03-14T08:50:00.000Z",
            },
            foundations: {
              milestoneLabel: "Latest checkpoint: Guided Draft",
              reliableNow: "Strategy AI can draft a usable internal baseline from the imported evidence.",
              stillWeak: "Quality bar proof is still thin.",
              nextAction: "Tighten the quality bar module and rerun the strategy preview.",
              updatedNote: "Updated from the latest strategy ai coaching pass.",
              updated_at: "2026-03-14T09:15:00.000Z",
            },
            guardrails: {
              milestoneLabel: "Latest checkpoint: Operational With Review",
              reliableNow: "Creator AI has a usable safety and quality baseline.",
              stillWeak: "Claims policy still needs stronger examples.",
              nextAction: "Run the creator preview before activation.",
              updatedNote: "Updated from the latest creator AI coaching pass.",
              updated_at: "2026-03-14T09:30:00.000Z",
            },
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
        {
          agent_class: "strategy",
          unlock_state: "blocked",
          blocked_reasons: ["Core modules not approved"],
          required_modules: ["agency_identity", "offer_strategy", "quality_bar", "approval_matrix"],
        },
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
    expect(screen.getByText("Latest Strategy AI preview")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reopen strategy ai preview/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy",
    );
    expect(screen.getAllByRole("link", { name: /See trust path/i }).length).toBeGreaterThan(0);
  });

  it("renders the guided first-run strategy setup entry", () => {
    vi.mocked(useAgencyAiSetupResolvedState).mockReturnValue({
      status: {
        current_stage: "overview",
        last_active_at: "2026-03-14T08:00:00.000Z",
        meta_json: {
          guided_strategy_template_key: "local_service",
          checkpoints: {
            foundations: {
              milestoneLabel: "Latest checkpoint: Guided Draft",
              reliableNow: "Strategy AI can draft a usable internal baseline from the imported evidence.",
              stillWeak: "Quality bar proof is still thin.",
              nextAction: "Tighten the quality bar module and rerun the strategy preview.",
              updatedNote: "Updated from the latest strategy ai coaching pass.",
              updated_at: "2026-03-14T09:15:00.000Z",
            },
          },
        },
      },
      readiness: {
        knowledge_coverage: 0,
        process_definition: 0,
        quality_definition: 0,
        compliance_safety: 0,
        approval_governance: 0,
        evidence_strength: 0,
        overall_label: "Not Started",
        critical_blockers: ["Import agency context"],
      },
      unlocks: [
        { agent_class: "strategy", unlock_state: "blocked", blocked_reasons: ["No setup evidence yet"] },
      ],
      certificationsByAgentClass: {},
      certifications: [],
      isLoading: false,
    } as any);

    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/start"]}>
        <Routes>
          <Route path="/agency/ai-setup/start" element={<AgencyAiSetupV2Start />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Enable Strategy AI First")).toBeInTheDocument();
    expect(screen.getByText(/Start with one useful capability, not the whole AI system/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue guided setup/i })).toHaveAttribute("href", "/agency/ai-setup/imports");
    expect(screen.getByRole("link", { name: /open full setup control plane/i })).toHaveAttribute("href", "/agency/ai-setup?mode=advanced");
    expect(screen.getByText("Latest Strategy AI checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Pick the closest starting template")).toBeInTheDocument();
    expect(screen.getAllByText("Local Service Growth").length).toBeGreaterThan(0);
  });

  it("shows an immediate strategy draft payoff on the imports step", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/imports"]}>
        <Routes>
          <Route path="/agency/ai-setup/imports" element={<AgencyAiSetupV2Imports />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("What Strategy AI will draft from these imports")).toBeInTheDocument();
    expect(screen.getAllByText(/Strategy AI can draft a first positioning baseline/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Approved documents will seed rules, examples, and anti-patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Import this context, then review the foundations draft/i)).toBeInTheDocument();
    expect(screen.getByText("What kind of agency are you?")).toBeInTheDocument();
    expect(screen.getByText("Imports checkpoint")).toBeInTheDocument();
  });

  it("renders foundations coaching and checkpoint flow", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/foundations"]}>
        <Routes>
          <Route path="/agency/ai-setup/foundations" element={<AgencyAiSetupV2Foundations />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Who you serve").length).toBeGreaterThan(0);
    expect(screen.getAllByText("What you sell").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /strengthen this for me/i }).length).toBeGreaterThan(0);
    expect(screen.getByText("Foundations checkpoint")).toBeInTheDocument();
    expect(screen.getByText("Current template:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open key modules/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/modules",
    );
  });

  it("shows the full foundations review on one page", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/foundations"]}>
        <Routes>
          <Route path="/agency/ai-setup/foundations" element={<AgencyAiSetupV2Foundations />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Niche focus")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary services")).toBeInTheDocument();
    expect(screen.getByLabelText("Agency summary")).toBeInTheDocument();
    expect(screen.getByText("How you position")).toBeInTheDocument();
  });

  it("shows a quick strategy coaching preview after foundations save", async () => {
    saveFoundationsMutateAsync.mockResolvedValue({
      meta: {},
      derived: {
        knowledge_coverage: 64,
        process_definition: 56,
        quality_definition: 58,
        compliance_safety: 52,
        approval_governance: 54,
        evidence_strength: 61,
        overall_label: "Guided Draft",
        critical_blockers: [],
        unlocks: [
          {
            agent_class: "strategy",
            unlock_state: "preview_only",
            blocked_reasons: ["Core modules not approved"],
          },
        ],
      },
    });
    createSimulationMutateAsync.mockResolvedValue({
      id: "sim-quick-strategy",
      agency_id: "agency-1",
      agent_class: "strategy",
      input_snapshot_json: {},
      output_snapshot_json: {
        summary: "Strategy AI is usable as an internal draft assistant, but positioning is still too generic.",
        findings: ["Tighten the agency positioning before certification."],
        recommended_next_action: "Approve the core positioning modules next.",
        dimension_scores: {
          process_adherence: 72,
          quality_bar_fit: 63,
        },
      },
      evaluation_json: {},
      result: "warn",
      created_by: "user-1",
      created_at: "2026-03-14T12:00:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/foundations"]}>
        <Routes>
          <Route path="/agency/ai-setup/foundations" element={<AgencyAiSetupV2Foundations />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /looks good/i }));

    await waitFor(() => {
      expect(createSimulationMutateAsync).toHaveBeenCalled();
    });
    expect(persistCheckpointMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "foundations",
        checkpoint: expect.objectContaining({
          milestoneLabel: "Latest checkpoint: Guided Draft",
          updatedNote: "Updated from the latest strategy ai coaching pass.",
        }),
      }),
    );

    expect(screen.getByText("Quick Strategy AI coaching preview")).toBeInTheDocument();
    expect(screen.getAllByText(/usable as an internal draft assistant/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approve the core positioning modules next/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /open full readiness preview/i })).toHaveAttribute(
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
    expect(screen.getAllByText("Minimum Strategy AI proof").length).toBeGreaterThan(0);
    expect(screen.getByText(/1\/4 minimum modules approved/i)).toBeInTheDocument();
    expect(screen.getByText("Agency Identity")).toBeInTheDocument();
    expect(screen.getAllByText("Quality Bar").length).toBeGreaterThan(0);
    expect(screen.getByText("Still needed before trusted approval")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open next required module/i })).toHaveAttribute("href", "/agency/ai-setup/modules/offer_strategy");
    expect(screen.getByRole("button", { name: /advanced modules/i })).toBeInTheDocument();
    expect(screen.getByText("Minimum Strategy AI proof checkpoint")).toBeInTheDocument();
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

    expect(screen.getByText(/review the draft below, tighten anything that feels generic/i)).toBeInTheDocument();
    expect(screen.getByText("Suggested draft from current setup evidence")).toBeInTheDocument();
    expect(screen.getAllByText("Minimum Strategy AI proof").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /apply suggested draft/i })).toBeInTheDocument();
    expect(screen.getByText("Proof requirements for trusted approval")).toBeInTheDocument();
    expect(screen.getByText(/what's still needed/i)).toBeInTheDocument();
    expect(screen.getAllByText("Review the draft").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /approve module/i })).toBeInTheDocument();
  });

  it("guides minimum Strategy AI modules through a smaller proof sequence", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/modules/quality_bar"]}>
        <Routes>
          <Route path="/agency/ai-setup/modules/:moduleKey" element={<AgencyAiSetupV2ModuleDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Minimum Strategy AI proof flow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review the draft").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Definition")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /step 2 tighten rules and examples/i }));
    expect(screen.getByLabelText("Rules")).toBeInTheDocument();
    expect(screen.getByLabelText("Examples")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /step 3 add proof and submit/i }));
    expect(screen.getByText(/supporting proof/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve module/i })).toBeInTheDocument();
  });

  it("returns the user to Strategy preview after saving a module from the preview fix loop", async () => {
    saveModuleMutateAsync.mockResolvedValue(undefined);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/agency/ai-setup/modules/offer_strategy",
            search: "?returnTo=%2Fagency%2Fai-setup%2Freadiness%2Fpreview%2Fstrategy",
          } as any,
        ]}
      >
        <Routes>
          <Route path="/agency/ai-setup/modules/:moduleKey" element={<AgencyAiSetupV2ModuleDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Suggested draft from current setup evidence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(saveModuleMutateAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/agency/ai-setup/readiness/preview/strategy");
    });
  });

  it("renders guardrails setup form", () => {
    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/guardrails"]}>
        <Routes>
          <Route path="/agency/ai-setup/guardrails" element={<AgencyAiSetupV2Guardrails />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Set Your Guardrails")).toBeInTheDocument();
    expect(screen.getByLabelText("Quality review standard")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /use starter guardrails/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /strengthen this for me/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/this page should read like real review rules/i)).toBeInTheDocument();
    expect(screen.getByText("Guardrails checkpoint")).toBeInTheDocument();
    expect(screen.getAllByText("Latest checkpoint: Operational With Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/creator ai has a usable safety and quality baseline/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /continue to activation/i })).toHaveAttribute("href", "/agency/ai-setup/activate");
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
    expect(screen.getByText("Lifecycle coaching")).toBeInTheDocument();
    expect(screen.getByText("Approval coaching")).toBeInTheDocument();
    expect(screen.getByText("Escalation coaching")).toBeInTheDocument();
    expect(screen.getByText("Workflow notes coaching")).toBeInTheDocument();
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
    expect(screen.getByText("First Strategy AI check")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /run first strategy ai check/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy",
    );
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
    expect(screen.getByText("First activation goal")).toBeInTheDocument();
    expect(screen.getByText("Internal Assist Only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open strategy preview/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy",
    );
    expect(screen.getAllByRole("button", { name: /activate/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open readiness preview/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Current trust is outdated because setup evidence changed after certification/i)).toBeInTheDocument();
    expect(screen.getAllByText(/strategy readiness certification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Needs revalidation/i).length).toBeGreaterThan(0);
  });

  it("blocks guided activation until the preview runs and passes", async () => {
    createSimulationMutateAsync.mockResolvedValue({
      id: "sim-guided-fail",
      agency_id: "agency-1",
      agent_class: "strategy",
      result: "fail",
      output_snapshot_json: {
        summary: "Strategy readiness certification failed. The current setup should not be treated as expert-ready for this agent class yet.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/agency/ai-setup/activate"]}>
        <Routes>
          <Route path="/agency/ai-setup/activate" element={<AgencyAiSetupV2Activate />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Run the Strategy AI preview first before turning it on./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activate strategy ai/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /run strategy preview/i }));

    await waitFor(() => {
      expect(createSimulationMutateAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/Fix the setup issues it found before activating internal assist./i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /activate strategy ai/i })).toBeDisabled();
    expect(activateAgentMutateAsync).not.toHaveBeenCalled();
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
    expect(screen.getByText("Run your first Strategy AI preview")).toBeInTheDocument();
    expect(screen.getByText("Preview scenarios")).toBeInTheDocument();
    expect(screen.getByText("What Strategy AI must prove next")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run first strategy ai preview/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open advanced readiness view/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/readiness/preview/strategy?view=advanced",
    );
    expect(screen.getByRole("link", { name: /fix offer strategy now/i })).toHaveAttribute(
      "href",
      "/agency/ai-setup/modules/offer_strategy?returnTo=%2Fagency%2Fai-setup%2Freadiness%2Fpreview%2Fstrategy",
    );
    expect(screen.getByText("What looks weak right now")).toBeInTheDocument();
    expect(screen.getByText("Exact proof gaps blocking trust")).toBeInTheDocument();
    expect(screen.getAllByText(/Quality Bar/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/strategy readiness certification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /run scenario/i }).length).toBeGreaterThan(0);
  });

  it("keeps the advanced readiness framing when explicitly requested", () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/agency/ai-setup/readiness/preview/strategy",
            search: "?view=advanced",
          } as any,
        ]}
      >
        <Routes>
          <Route path="/agency/ai-setup/readiness/preview/:agentClass" element={<AgencyAiSetupV2ReadinessPreview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Certification scenarios")).toBeInTheDocument();
    expect(screen.getByText("Trust path for this capability")).toBeInTheDocument();
    expect(screen.queryByText("Run your first Strategy AI preview")).not.toBeInTheDocument();
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
