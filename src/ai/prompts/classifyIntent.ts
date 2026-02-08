import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  input: string;
};

export function buildClassifyIntentPrompt(args: PromptArgs): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Classify the user's intent into CHAT or EXECUTE.",
        "Return JSON: {\"mode\":\"CHAT|EXECUTE\",\"confidence\":0.0,\"intent\":\"optional\"}.",
        "Use higher confidence (>= 0.90) when intent is unambiguous.",
        "",
        "Examples:",
        "Input: \"Summarize Client A onboarding notes.\" -> {\"mode\":\"CHAT\",\"confidence\":0.93}",
        "Input: \"Explain the latest campaign results for Client B.\" -> {\"mode\":\"CHAT\",\"confidence\":0.92}",
        "Input: \"What are the top objections for Client C?\" -> {\"mode\":\"CHAT\",\"confidence\":0.91}",
        "Input: \"Give a brief recap of Client D goals.\" -> {\"mode\":\"CHAT\",\"confidence\":0.91}",
        "Input: \"Summarize the Q2 performance for Client E.\" -> {\"mode\":\"CHAT\",\"confidence\":0.92}",
        "Input: \"List the last three updates for Client F.\" -> {\"mode\":\"CHAT\",\"confidence\":0.90}",
        "Input: \"Explain why Client G churned.\" -> {\"mode\":\"CHAT\",\"confidence\":0.90}",
        "Input: \"Provide a quick status overview for Client H.\" -> {\"mode\":\"CHAT\",\"confidence\":0.91}",
        "Input: \"What did we learn from Client I onboarding?\" -> {\"mode\":\"CHAT\",\"confidence\":0.90}",
        "Input: \"Summarize the latest strategy draft for Client J.\" -> {\"mode\":\"CHAT\",\"confidence\":0.92}",
        "Input: \"Create a new task for Client K kickoff.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.93}",
        "Input: \"Update Client L record with new email.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.94}",
        "Input: \"Trigger email sequence for Client M.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.93}",
        "Input: \"Generate Q4 strategy plan for Client N.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.92}",
        "Input: \"Propose memory write for Client O.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.91}",
        "Input: \"Fetch campaign performance for Client P.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.92}",
        "Input: \"Create a task and assign it to Sam for Client Q.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.91}",
        "Input: \"Update Client R status to onboarding complete.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.91}",
        "Input: \"Start the compliance check for Client S.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.90}",
        "Input: \"Kick off a strategy report for Client T.\" -> {\"mode\":\"EXECUTE\",\"confidence\":0.92}",
      ].join("\n"),
    },
    { role: "user", content: args.input },
  ];
}
