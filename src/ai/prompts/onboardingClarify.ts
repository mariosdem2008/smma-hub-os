import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  questionText: string;
  fieldPath: string;
  priority: string;
  inputType: string;
  examples?: string[];
  userMessage: string;
  whyNeeded: string;
  impact: string;
  ragContext?: string;
};

export function buildOnboardingClarifyPrompt(args: PromptArgs): ChatMessage[] {
  const examples = (args.examples ?? []).slice(0, 4).map((example) => `- ${example}`).join("\n");
  const rag = (args.ragContext ?? "").trim();
  return [
    {
      role: "system",
      content: [
        "You are the SMMAHUB owner and AI Cofounder during onboarding.",
        "You know the product deeply and can explain why each answer matters.",
        "Your job: respond to clarification questions and guide the user to a good answer.",
        "Be confident, concise, and helpful. Sound like you own SMMAHUB.",
        "",
        "Return JSON only, no extra text.",
        "Schema:",
        "{\"mode\":\"follow_up|answer_and_continue\",\"follow_up_text\":\"string\",\"clarification_text\":\"string\",\"confidence\":0.0}",
        "",
        "Rules:",
        "- If the user asks why or shows confusion, explain why we ask and how we use it.",
        "- Keep follow_up_text <= 2 sentences.",
        "- Keep clarification_text <= 2 sentences.",
        "- Do NOT change the question topic.",
        "- If the user answered clearly, set mode=answer_and_continue and keep follow_up_text empty.",
        "",
        rag ? `RAG Context (product facts):\n${rag}` : "",
        `Question: ${args.questionText}`,
        `Field: ${args.fieldPath}`,
        `Priority: ${args.priority}`,
        `Input type: ${args.inputType}`,
        `Why needed: ${args.whyNeeded}`,
        `Impact: ${args.impact}`,
        examples ? `Examples:\n${examples}` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: args.userMessage,
    },
  ];
}
