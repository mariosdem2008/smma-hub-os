import { describe, it, expect } from "vitest";

import { decideAiRepResponse } from "../../../supabase/functions/_shared/ai-rep-chat";

describe("ai-rep-chat decision", () => {
  it("returns UNKNOWN when brief lacks core offer", () => {
    const brief = {
      positioning: "Acme offers services for founders",
      offers: { core: "", supporting: [] },
      audience: { primary: "Founders", pains: ["time"], desires: ["growth"] },
      pillars: ["A", "B", "C"],
      tone_rules: { do: ["Be clear"], dont: ["No guarantees"] },
      cta_styles: ["Book a call"],
      taboo_topics: ["none"],
    };

    const res = decideAiRepResponse({ brief: brief as any, message: "Help me" });
    expect(res.unknown).toBe(true);
    expect(res.assistant_message.startsWith("UNKNOWN")).toBe(true);
  });

  it("uses client_brief_v1 when present", () => {
    const brief = {
      positioning: "Acme offers onboarding for founders",
      offers: { core: "Onboarding", supporting: ["Consulting"] },
      audience: { primary: "Founders", pains: ["time"], desires: ["growth"] },
      pillars: ["Education", "Stories", "Proof"],
      tone_rules: { do: ["Be clear"], dont: ["No guarantees"] },
      cta_styles: ["Book a call"],
      taboo_topics: ["none"],
    };

    const res = decideAiRepResponse({ brief: brief as any, message: "What should we post?" });
    expect(res.unknown).toBe(false);
    expect(res.used_sections).toContain("client_brief_v1");
  });
});

