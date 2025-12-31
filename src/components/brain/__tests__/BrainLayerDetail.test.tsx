import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

// Mock hooks
vi.mock("@/hooks/useBrainDocuments", () => ({
  useBrainDocuments: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
  useApproveBrainDocument: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
}));

vi.mock("@/hooks/useAgency", () => ({
  useAgency: vi.fn(() => ({
    agencyId: "test-agency-id",
    agency: { id: "test-agency-id", name: "Test Agency" },
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
    expect(content).toContain("# Rep Policy");
    expect(content).toContain("AI Assistant Identity");
  });

  it("returns markdown content for strategy_sop module (sop_strategy)", () => {
    const content = getExampleContent("sop_strategy");
    expect(content).toBeDefined();
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain("# Strategy SOP");
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
