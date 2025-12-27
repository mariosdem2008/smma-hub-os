import { ai } from "../../../src/ai/router.ts";
import { objectSchema } from "../../../src/ai/schema.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";
import { EXPERT_QUESTION_REGISTRY } from "./agency-admin-setup-expert-questions.ts";
import { SETUP_QUESTIONS, type SetupQuestion } from "./agency-admin-setup-questions.ts";

type OrchestratorOutput = {
  id: string;
  question: string;
  depthLevel: 1 | 2 | 3 | 4 | 5;
  requiredFields: string[];
  rationale: string;
};

const ORCHESTRATOR_SCHEMA = objectSchema("admin_setup_orchestrator_selection", [
  "id",
  "question",
  "depthLevel",
  "requiredFields",
  "rationale",
]);

function readEnvFlag(name: string) {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name);
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

function getAiMode() {
  const env = readEnvFlag("AI_MODE");
  return env === "dev" ? "dev" : "prod";
}

function getDepthPreference(missingFields: string[]) {
  for (const level of [1, 2, 3, 4, 5] as const) {
    const hasMissing = EXPERT_QUESTION_REGISTRY.some((entry) =>
      entry.depthLevel === level && entry.requiredFields.some((field) => missingFields.includes(field)),
    );
    if (hasMissing) return level;
  }
  return 5;
}

export function buildAdminSetupOrchestratorPrompt(args: {
  contextSnapshot?: Record<string, unknown> | null;
  knownFields: string[];
  missingFields: string[];
  depthPreference: number;
  registry?: typeof EXPERT_QUESTION_REGISTRY;
  retrievedSnippets?: string[];
}) {
  const agency = (args.contextSnapshot?.agency ?? {}) as Record<string, unknown>;
  const agencyName = typeof agency.name === "string" ? agency.name : null;
  const agencyWebsite = typeof agency.website === "string" ? agency.website : null;

  const lines = [
    "BOOTSTRAP_SUMMARY:",
    `- agency_name: ${agencyName ?? "null"}`,
    `- agency_website: ${agencyWebsite ?? "null"}`,
    "",
    "KNOWN_FIELDS_JSON:",
    JSON.stringify(args.knownFields),
    "",
    "MISSING_FIELDS_JSON:",
    JSON.stringify(args.missingFields),
    "",
    "DEPTH_LEVEL_PREFERENCE:",
    String(args.depthPreference),
    "",
    "CANDIDATE_QUESTIONS_JSON:",
    JSON.stringify(args.registry ?? EXPERT_QUESTION_REGISTRY),
  ];

  if (args.retrievedSnippets && args.retrievedSnippets.length > 0) {
    lines.push("", "RETRIEVED_SNIPPETS:");
    lines.push(JSON.stringify(args.retrievedSnippets));
  }

  lines.push(
    "",
    "Return JSON only with keys:",
    '{ "id", "question", "depthLevel", "requiredFields", "rationale" }',
    "Rules:",
    "- id must match a candidate registry id",
    "- question must be a single, direct question",
    "- depthLevel must be 1-5 and should match the selected registry entry",
    "- requiredFields must be copied from the selected registry entry",
  );

  return lines.join("\n");
}

function isValidOutput(output: OrchestratorOutput, registryEntry: (typeof EXPERT_QUESTION_REGISTRY)[number]) {
  if (!output || typeof output !== "object") return false;
  if (typeof output.id !== "string" || output.id.trim().length === 0) return false;
  if (typeof output.question !== "string" || output.question.trim().length === 0) return false;
  if (![1, 2, 3, 4, 5].includes(output.depthLevel)) return false;
  if (!Array.isArray(output.requiredFields) || output.requiredFields.length === 0) return false;
  if (output.requiredFields.some((field) => typeof field !== "string" || field.trim().length === 0)) return false;
  if (output.id !== registryEntry.id) return false;
  if (output.depthLevel !== registryEntry.depthLevel && ![1, 2, 3, 4, 5].includes(output.depthLevel)) return false;
  return true;
}

function findSetupQuestionFromOutput(output: OrchestratorOutput, registryEntry: (typeof EXPERT_QUESTION_REGISTRY)[number]) {
  const byQuestion = SETUP_QUESTIONS.find(
    (q) => q.question_text.toLowerCase() === output.question.trim().toLowerCase(),
  );
  if (byQuestion) return byQuestion;
  const byField = SETUP_QUESTIONS.find((q) => registryEntry.requiredFields.includes(q.target_path));
  if (byField) return byField;
  return null;
}

export async function selectNextAdminSetupQuestion(args: {
  supabase: any;
  agencyId: string;
  userId: string;
  answeredKeys: Set<string>;
  contextSnapshot?: Record<string, unknown> | null;
  retrievedSnippets?: string[];
}): Promise<{ question: SetupQuestion; registryId: string } | null> {
  const knownFields = SETUP_QUESTIONS.filter((q) => args.answeredKeys.has(q.key)).map((q) => q.target_path);
  const missingFields = SETUP_QUESTIONS.filter((q) => !args.answeredKeys.has(q.key)).map((q) => q.target_path);
  const depthPreference = getDepthPreference(missingFields);
  const promptText = buildAdminSetupOrchestratorPrompt({
    contextSnapshot: args.contextSnapshot,
    knownFields,
    missingFields,
    depthPreference,
    registry: EXPERT_QUESTION_REGISTRY,
    retrievedSnippets: args.retrievedSnippets,
  });

  const result = await ai.run({
    taskType: TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2,
    messages: [
      {
        role: "system",
        content: "You select the next admin setup question. Return JSON only, no markdown.",
      },
      {
        role: "user",
        content: promptText,
      },
    ],
    outputSchema: ORCHESTRATOR_SCHEMA,
    context: {
      agencyId: args.agencyId,
      userId: args.userId,
      environment: getAiMode(),
      supabase: args.supabase,
    },
    metadata: {
      task: "admin_setup_orchestrator",
      depth_preference: depthPreference,
      known_fields: knownFields,
      missing_fields: missingFields,
    },
  });

  const output = (result.output ?? null) as OrchestratorOutput | null;
  if (!output) return null;
  const registryEntry = EXPERT_QUESTION_REGISTRY.find((entry) => entry.id === output.id);
  if (!registryEntry) return null;
  if (!isValidOutput(output, registryEntry)) return null;
  const matched = findSetupQuestionFromOutput(output, registryEntry);
  if (!matched) return null;

  return {
    question: matched,
    registryId: registryEntry.id,
  };
}
