import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionChipTray } from "../SuggestionChipTray";

describe("SuggestionChipTray", () => {
  it("supports autofill action", async () => {
    const onAutofill = vi.fn();
    const user = userEvent.setup();

    render(
      <SuggestionChipTray
        suggestions={["Our niche is SaaS.", "Our core offer is retainer management."]}
        onAutofill={onAutofill}
      />
    );

    await user.click(screen.getByRole("button", { name: /Our niche is SaaS\./i }));
    expect(onAutofill).toHaveBeenCalledWith("Our niche is SaaS.");
  });
});
