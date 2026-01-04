import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import StrategyHubTab from "@/components/client-tabs/StrategyHubTab";

const { useStrategyDocumentsMock } = vi.hoisted(() => ({
  useStrategyDocumentsMock: vi.fn(() => ({
    data: [
      {
        id: "doc-1",
        agency_id: "agency-1",
        client_id: "client-1",
        content_markdown: "# Strategy\n\n## Executive summary\n\nSummary.",
        content_html: null,
        source: "ai",
        is_active: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        generated_by_user_id: null,
        model: null,
        generation_instruction: null,
        derived_from_hash: null,
        file_path: null,
        file_name: null,
      },
      {
        id: "doc-2",
        agency_id: "agency-1",
        client_id: "client-1",
        content_markdown: "# Strategy\n\n## Executive summary\n\nOlder.",
        content_html: null,
        source: "upload",
        is_active: false,
        created_at: "2023-12-01T00:00:00Z",
        updated_at: "2023-12-01T00:00:00Z",
        generated_by_user_id: null,
        model: null,
        generation_instruction: null,
        derived_from_hash: null,
        file_path: null,
        file_name: null,
      },
    ],
  })),
}));

const mockGenerate = vi.fn(async () => ({ document: null }));
const mockActivate = vi.fn(async () => ({}));

vi.mock("@/components/strategy-os/StrategyOSV3", () => ({
  default: () => <div>Details View</div>,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/useStrategyDocuments", () => ({
  useStrategyDocuments: useStrategyDocumentsMock,
  useGenerateStrategyDocument: () => ({
    mutateAsync: mockGenerate,
    isPending: false,
  }),
  useUploadStrategyDocument: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useActivateStrategyDocument: () => ({
    mutateAsync: mockActivate,
  }),
}));

vi.mock("@/hooks/useStrategies", () => ({
  useStrategies: () => ({
    data: [{ id: "strategy-1", updated_at: "2024-01-02T00:00:00Z" }],
  }),
}));

vi.mock("@/hooks/useStrategyModules", () => ({
  useStrategyModules: () => ({
    data: [{ module: "positioning", updated_at: "2024-01-03T00:00:00Z" }],
  }),
}));

const renderStrategyHub = (entry = "/") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <StrategyHubTab clientId="client-1" agencyId="agency-1" />
    </MemoryRouter>,
  );

describe("StrategyHubTab Strategy Knowledge Center", () => {
  afterEach(() => {
    cleanup();
    mockGenerate.mockClear();
    mockActivate.mockClear();
    useStrategyDocumentsMock.mockClear();
  });

  it("defaults to the document view", () => {
    renderStrategyHub();
    expect(screen.getByText("Strategy Knowledge Center")).toBeInTheDocument();
    expect(screen.getByText("Strategy Document")).toBeInTheDocument();
  });

  it("shows generate strategy CTA when no document exists", () => {
    useStrategyDocumentsMock.mockReturnValueOnce({ data: [] });
    renderStrategyHub();
    expect(screen.getAllByRole("button", { name: "Generate Strategy" })).toHaveLength(1);
  });

  it("opens details view and returns to document view", async () => {
    renderStrategyHub();
    await userEvent.click(screen.getByRole("button", { name: "Strategy details" }));
    expect(screen.getByText("Details View")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back to document" }));
    expect(screen.getByText("Strategy Document")).toBeInTheDocument();
  });

  it("activates history entries", async () => {
    renderStrategyHub();
    await userEvent.click(screen.getByRole("button", { name: "History" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Set active" })[0]);
    expect(mockActivate).toHaveBeenCalled();
  });

  it("regenerates strategy document with instruction", async () => {
    renderStrategyHub();
    const instructionInput = screen.getByPlaceholderText("Add instruction (max 200 chars)");
    await userEvent.type(instructionInput, "Refresh the weekly plan section.");
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(mockGenerate).toHaveBeenCalledWith({
      clientId: "client-1",
      instruction: "Refresh the weekly plan section.",
    });
  });

  it("removes the Continue CTA copy", () => {
    renderStrategyHub();
    expect(screen.queryByText(/Continue:/i)).not.toBeInTheDocument();
  });

  it("shows out of date indicator in details mode", () => {
    renderStrategyHub("/?strategy_view=details");
    expect(screen.getByText("Document out of date")).toBeInTheDocument();
  });
});
