import { describe, it, expect } from "vitest";
import { buildAdminGeneralChatPrompt } from "../prompts/adminGeneralChat.ts";
import { loadPromptText } from "../promptRegistry.ts";

describe("admin general chat prompt mapping", () => {
  it("loads deterministic playbook prompt files", () => {
    const playbooks = [
      { playbook: "core_offer", file: "admin_chat/playbooks/offer_core_offer_v1.md" },
      { playbook: "strategy", file: "admin_chat/playbooks/strategy_v1.md" },
      { playbook: "copywriting", file: "admin_chat/playbooks/copywriting_v1.md" },
    ] as const;

    for (const entry of playbooks) {
      const messages = buildAdminGeneralChatPrompt({
        contextSnapshot: {},
        conversation: "",
        latestUserMessage: "hello",
        outputMode: "strategic",
        contextBlob: {},
        playbook: entry.playbook,
      });
      const system = messages.find((msg) => msg.role === "system")?.content ?? "";
      const expected = loadPromptText(entry.file).trim();
      expect(system).toContain(expected);
    }
  });
});
