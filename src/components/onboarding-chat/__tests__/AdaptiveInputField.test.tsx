import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdaptiveInputField } from "../AdaptiveInputField";

describe("AdaptiveInputField", () => {
  it("blocks submit for invalid url expects mode", async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AdaptiveInputField
        expects="url"
        value="not-a-url"
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid URL.")).toBeInTheDocument();
  });
});
