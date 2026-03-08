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
    expect(screen.getByText("Please enter valid URL values.")).toBeInTheDocument();
  });

  it("keeps percent guided rows in sync with external value updates", () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <AdaptiveInputField
        expects="percent"
        fieldPath="agency.primary_client_languages"
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    rerender(
      <AdaptiveInputField
        expects="percent"
        fieldPath="agency.primary_client_languages"
        value={"English, 70%\nGreek, 30%"}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByDisplayValue("English")).toBeInTheDocument();
    expect(screen.getByDisplayValue("70")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Greek")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByText("Total: 100%")).toBeInTheDocument();
  });
});
