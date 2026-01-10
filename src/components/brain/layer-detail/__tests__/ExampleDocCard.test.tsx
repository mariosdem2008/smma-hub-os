import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExampleDocCard } from "@/components/brain/layer-detail/ExampleDocCard";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useAgencyData", () => ({
  useAgencyData: () => ({
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
  }),
}));

describe("ExampleDocCard personalization", () => {
  it("renders the agency name in the bootstrap example", () => {
    render(<ExampleDocCard module="bootstrap" expanded embedded />);
    expect(screen.getAllByText(/Test Agency/i).length).toBeGreaterThan(0);
  });

  it("renders the agency name in the rep_policy example", () => {
    render(<ExampleDocCard module="rep_policy" expanded embedded />);
    expect(screen.getAllByText(/Test Agency/i).length).toBeGreaterThan(0);
  });
});

