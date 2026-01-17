import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BrainLayerDetail from "@/pages/agency/BrainLayerDetail";
import { BrainModuleCard } from "@/components/brain/BrainModuleCard";
import type { BrainDocument } from "@/lib/ai/brainDocuments";
import { getExampleContent, getExamplePreview } from "@/lib/brain/examples";

// Mock window.matchMedia for jsdom
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

// Mock hooks
let mockDocuments: BrainDocument[] = [];
let mockTotalBrainDocsCount = 0;
const seedDefaultBrainPackMock = vi.fn();
let seedIsPending = false;
let mockMissingRagModules: string[] = [];

vi.mock("@/hooks/useBrainDocuments", () => ({
  useBrainDocuments: vi.fn(() => ({
    data: mockDocuments,
    isLoading: false,
    error: null,
  })),
  useApproveBrainDocument: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useArchiveBrainDocument: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("@/hooks/useBrainDocumentsCount", () => ({
  useBrainDocumentsTotalCount: vi.fn(() => ({
    data: mockTotalBrainDocsCount,
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useSeedDefaultBrainPack", () => ({
  useSeedDefaultBrainPack: vi.fn(() => ({
    mutateAsync: seedDefaultBrainPackMock,
    isPending: seedIsPending,
  })),
}));

vi.mock("@/hooks/useDefaultBrainPackIngestionHealth", () => ({
  useDefaultBrainPackIngestionHealth: vi.fn(() => ({
    data: { approvedModules: [], missingModules: mockMissingRagModules },
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/hooks/useAgency", () => ({
  useAgency: vi.fn(() => ({
    agencyId: "test-agency-id",
  })),
}));

vi.mock("@/hooks/useAgencyData", () => ({
  useAgencyData: vi.fn(() => ({
    agency: {
      id: "test-agency-id",
      name: "Test Agency",
      website: "https://test.example",
      niche: "General",
      user_id: "test-user-id",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    isLoading: false,
    error: null,
    bootstrapDefaults: {
      agency_name: "Test Agency",
      website: "https://test.example",
      niche: "General",
    },
  })),
}));

vi.mock("@/hooks/useBrainDocumentUpload", () => ({
  useBrainDocumentUpload: vi.fn(() => ({
    uploadAndAnalyze: vi.fn(),
    isUploading: false,
    error: null,
  })),
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement, { route = "/" } = {}) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/agency/brain/:layer" element={ui} />
          <Route path="/agency/brain" element={<div>Brain Overview</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("BrainLayerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocuments = [];
    mockTotalBrainDocsCount = 0;
    seedIsPending = false;
    mockMissingRagModules = [];
  });

  describe("routing", () => {
    it("renders the correct layer page for rep_policy", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        // Use getAllByText since label appears in both breadcrumb and title
        const elements = screen.getAllByText("Rep Policy");
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it("renders the correct layer page for strategy_sop", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/strategy_sop",
      });

      await waitFor(() => {
        const elements = screen.getAllByText("Strategy SOP");
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it("renders the correct layer page for tone_voice", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/tone_voice",
      });

      await waitFor(() => {
        const elements = screen.getAllByText("Tone & Voice");
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("empty state", () => {
    it("shows inline empty state when no documents exist", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        // Inline empty state shows "No content yet" message
        const elements = screen.getAllByText(/No content yet/i);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    const makeDoc = (module: BrainDocument["module"], id: string): BrainDocument => ({
      id,
      agency_id: "test-agency-id",
      module,
      title: "Test Doc",
      content_json: {},
      status: "approved",
      version: 1,
      approved_at: "2024-01-01T00:00:00Z",
      approved_by: "user-1",
      parent_version_id: null,
      source: "manual",
      created_by: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    it("shows Create/Repair Default Brain Pack button when agency has 1 non-default doc", async () => {
      mockDocuments = [makeDoc("tone_voice", "doc-1")];
      mockTotalBrainDocsCount = 1;

      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        const buttons = screen.getAllByRole("button", { name: /Create\/Repair Default Brain Pack/i });
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it("hides Create/Repair Default Brain Pack button when agency has all 3 default modules", async () => {
      mockDocuments = [
        makeDoc("bootstrap", "doc-bootstrap"),
        makeDoc("rep_policy", "doc-rep"),
        makeDoc("quality_bar", "doc-quality"),
      ];
      mockTotalBrainDocsCount = 3;

      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        expect(screen.queryAllByRole("button", { name: /Create\/Repair Default Brain Pack/i })).toHaveLength(0);
      });
    });

    it("hides Create/Repair Default Brain Pack button after seeding (defaults now present)", async () => {
      mockDocuments = [makeDoc("tone_voice", "doc-1")];
      mockTotalBrainDocsCount = 1;
      seedDefaultBrainPackMock.mockResolvedValueOnce({
        seeded: true,
        repaired: false,
        inserted_count: 3,
        document_ids: ["doc-1", "doc-2", "doc-3"],
        ingested_count: 3,
        failed_ids: [],
      });

      const { unmount } = renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      const button = (await screen.findAllByRole("button", { name: /Create\/Repair Default Brain Pack/i }))[0];
      const user = userEvent.setup();
      await user.click(button);
      expect(seedDefaultBrainPackMock).toHaveBeenCalledTimes(1);
      expect(seedDefaultBrainPackMock).toHaveBeenCalledWith({ agencyId: "test-agency-id", mode: "seed_or_repair" });

      // Simulate refreshed state after query invalidation
      mockTotalBrainDocsCount = 3;
      mockDocuments = [
        makeDoc("bootstrap", "doc-bootstrap"),
        makeDoc("rep_policy", "doc-rep"),
        makeDoc("quality_bar", "doc-quality"),
      ];

      unmount();
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        expect(screen.queryAllByRole("button", { name: /Create\/Repair Default Brain Pack/i })).toHaveLength(0);
      });
    });

    it("hides ingestion health banner when defaults are healthy", async () => {
      mockDocuments = [makeDoc("bootstrap", "doc-bootstrap")];
      mockMissingRagModules = [];
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        expect(screen.queryByText(/AI indexing missing for some defaults/i)).not.toBeInTheDocument();
      });
    });

    it("shows ingestion health banner when defaults missing in RAG and retry calls ingest-only", async () => {
      mockDocuments = [makeDoc("bootstrap", "doc-bootstrap")];
      mockMissingRagModules = ["bootstrap"];
      seedDefaultBrainPackMock.mockResolvedValueOnce({
        seeded: false,
        repaired: false,
        inserted_count: 0,
        document_ids: [],
        ingested_count: 1,
        failed_ids: [],
      });

      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      const user = userEvent.setup();
      const retryButton = await screen.findByRole("button", { name: /Retry ingest/i });
      await user.click(retryButton);

      expect(seedDefaultBrainPackMock).toHaveBeenCalledWith({ agencyId: "test-agency-id", mode: "ingest_only" });
    });

    it("shows upload and configure options in empty state", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        const uploadElements = screen.getAllByText("Upload/Write Document");
        const configureElements = screen.getAllByText("Configure");
        expect(uploadElements.length).toBeGreaterThan(0);
        expect(configureElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("breadcrumbs", () => {
    it("shows breadcrumb navigation", async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: "/agency/brain/rep_policy",
      });

      await waitFor(() => {
        // Multiple elements may exist due to modals
        const agencyBrainElements = screen.getAllByText("Agency Brain");
        expect(agencyBrainElements.length).toBeGreaterThan(0);
        // Multiple elements with Rep Policy is expected
        const repPolicyElements = screen.getAllByText("Rep Policy");
        expect(repPolicyElements.length).toBeGreaterThanOrEqual(2); // breadcrumb + title
      });
    });
  });
});

describe("BrainModuleCard navigation", () => {
  const mockDocument: BrainDocument = {
    id: "doc-1",
    agency_id: "agency-1",
    module: "rep_policy",
    title: "Rep Policy",
    content_json: { ai_name: "Test AI" },
    status: "approved",
    version: 1,
    approved_at: "2024-01-01T00:00:00Z",
    approved_by: "user-1",
    parent_version_id: null,
    source: "manual",
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  const renderCardWithRouter = () => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <BrainModuleCard
            module="rep_policy"
            document={mockDocument}
          />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it("renders module card with correct title", () => {
    renderCardWithRouter();
    // Use getAllByText since the card renders title in multiple places potentially
    const elements = screen.getAllByText("Rep Policy");
    expect(elements.length).toBeGreaterThan(0);
  });

  it("shows active status badge for approved document", () => {
    renderCardWithRouter();
    // Multiple elements may exist due to re-renders
    const elements = screen.getAllByText("Active");
    expect(elements.length).toBeGreaterThan(0);
  });

  it("card has clickable styling", () => {
    const { container } = renderCardWithRouter();
    // Find the card element with cursor-pointer class
    const card = container.querySelector(".cursor-pointer");
    expect(card).toBeInTheDocument();
  });
});

describe("layer URL mapping", () => {
  const layerMappings = [
    { param: "bootstrap_profile", label: "Bootstrap Profile" },
    { param: "rep_policy", label: "Rep Policy" },
    { param: "strategy_sop", label: "Strategy SOP" },
    { param: "scripting_sop", label: "Scripting SOP" },
    { param: "tone_voice", label: "Tone & Voice" },
    { param: "faq_objections", label: "FAQ & Objections" },
    { param: "ai_permissions", label: "AI Permissions" },
    { param: "offer_stack", label: "Offer Stack" },
    { param: "quality_bar", label: "Quality Bar" },
  ];

  layerMappings.forEach(({ param, label }) => {
    it(`maps ${param} URL param to ${label} module`, async () => {
      renderWithProviders(<BrainLayerDetail />, {
        route: `/agency/brain/${param}`,
      });

      await waitFor(() => {
        // Use getAllByText since label appears in multiple places
        const elements = screen.getAllByText(label);
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("example doc mapping", () => {
  it("returns markdown content for rep_policy module", () => {
    const content = getExampleContent("rep_policy");
    expect(content).toBeDefined();
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain("# Communication Style");
    expect(content).toContain("AI Assistant Identity");
  });

  it("returns markdown content for strategy_sop module (sop_strategy)", () => {
    const content = getExampleContent("sop_strategy");
    expect(content).toBeDefined();
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain("# Strategy Playbook");
    expect(content).toContain("Content Pillars");
  });

  it("returns markdown content for all 9 modules", () => {
    const modules = [
      "bootstrap",
      "rep_policy",
      "sop_strategy",
      "sop_scripting",
      "tone_voice",
      "faq_objections",
      "ai_permissions",
      "offer_stack",
      "quality_bar",
    ];

    modules.forEach((module) => {
      const content = getExampleContent(module);
      expect(content).toBeDefined();
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(50);
      // All markdown files should start with a heading
      expect(content.trim()).toMatch(/^#\s+/);
    });
  });

  it("getExamplePreview returns truncated content", () => {
    const fullContent = getExampleContent("rep_policy");
    const preview = getExamplePreview("rep_policy", 5);

    expect(preview.split("\n").length).toBeLessThanOrEqual(5);
    expect(preview.length).toBeLessThan(fullContent.length);
  });
});
