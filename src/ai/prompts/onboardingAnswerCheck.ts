import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  questionText: string;
  fieldPath: string;
  inputType: string;
  priority: string;
  examples?: string[];
  answer: string;
};

export function buildOnboardingAnswerCheckPrompt(args: PromptArgs): ChatMessage[] {
  const examples = (args.examples ?? []).slice(0, 4).map((example) => `- ${example}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "You are the AI Cofounder assistant during agency onboarding.",
        "Your goal is to collect accurate, high-quality inputs so the system can personalize the agency brain.",
        "Decide if the user's answer should be accepted or if a short follow-up is needed.",
        "Be strict: if the user is asking a question or shows confusion, you MUST follow_up.",
        "Return JSON only, no extra text.",
        "",
        "JSON schema:",
        "{\"decision\":\"accept|follow_up\",\"follow_up\":\"string\",\"reason\":\"string\",\"confidence\":0.0}",
        "",
        "Rules:",
        "- Use follow_up if the answer is unclear, non-responsive, or likely misunderstood.",
        "- If the user asks a question (even implicitly), respond with follow_up that explains why we need it.",
        "- If the answer seems inconsistent or unlikely, ask \"Are you sure?\" with a short reason.",
        "- Keep follow_up <= 2 sentences and stay on the same question.",
        "- If the user declined or said they do not know and the question is P0, ask for a best-effort answer.",
        "- Never add new requirements or ask multiple questions.",
        "",
        `Question: ${args.questionText}`,
        `Field: ${args.fieldPath}`,
        `Priority: ${args.priority}`,
        `Input type: ${args.inputType}`,
        examples ? `Examples:\n${examples}` : "",
      ].filter(Boolean).join("\n"),
    },
    {
      role: "user",
      content: args.answer,
    },
  ];
}
