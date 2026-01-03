import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ClientTabEmptyState from "../shared/ClientTabEmptyState";
import { FolderOpen } from "lucide-react";

describe("ClientTabEmptyState", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders title correctly", () => {
    render(
      <ClientTabEmptyState
        title="No files yet"
        description="Upload files to get started"
      />
    );

    expect(screen.getByText("No files yet")).toBeInTheDocument();
    expect(screen.getByText("Upload files to get started")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <ClientTabEmptyState
        title="No files"
        icon={<FolderOpen data-testid="empty-icon" className="h-12 w-12" />}
      />
    );

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });

  it("renders primary action CTA and triggers onClick", () => {
    const mockOnClick = vi.fn();

    render(
      <ClientTabEmptyState
        title="No files yet"
        primaryAction={{
          label: "Upload Files",
          onClick: mockOnClick,
        }}
      />
    );

    const button = screen.getByRole("button", { name: "Upload Files" });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("renders secondary action when provided", () => {
    const mockPrimary = vi.fn();
    const mockSecondary = vi.fn();

    render(
      <ClientTabEmptyState
        title="No items"
        primaryAction={{
          label: "Create New",
          onClick: mockPrimary,
        }}
        secondaryAction={{
          label: "Learn More",
          onClick: mockSecondary,
        }}
      />
    );

    expect(screen.getByRole("button", { name: "Create New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn More" })).toBeInTheDocument();
  });

  it("does not render buttons when no actions provided", () => {
    render(
      <ClientTabEmptyState
        title="Empty State"
        description="No actions available"
      />
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
