import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageStream } from "../MessageStream";

describe("MessageStream", () => {
  it("renders markdown and JSON snapshot", async () => {
    render(
      <MessageStream
        messages={[
          {
            id: "m1",
            role: "assistant",
            text: "## Welcome\nPlease share your **agency name**.",
            json: { state: { module: "bootstrap" } },
          },
        ]}
      />
    );

    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText(/agency name/i)).toBeInTheDocument();
    expect(screen.getByText("JSON snapshot")).toBeInTheDocument();
  });
});
