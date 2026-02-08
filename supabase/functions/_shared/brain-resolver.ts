/**
 * Brain Resolver (Server-side)
 *
 * Runtime context resolution for AI tasks on the server.
 * Loads required brain modules, validates required fields,
 * and triggers on-demand calibration when fields are missing.
 */

import {
  type BrainModule,
  BRAIN_MODULES,
  fetchApprovedBrainDocuments,
  type BrainDocument,
} from "./brain-documents.ts";

type MinimalSupabase = {
  from: (table: string) => any;
};

/**
 * Task types (mirrored from client)
 */
export const TaskTypes = {
  CHAT_GENERAL: "CHAT_GENERAL",
  CHAT_ADMIN_ONBOARDING: "CHAT_ADMIN_ONBOARDING",
  AGENCY_ADMIN_SETUP_GUIDED_V2: "AGENCY_ADMIN_SETUP_GUIDED_V2",
  AGENCY_ADMIN_GENERAL_CHAT: "AGENCY_ADMIN_GENERAL_CHAT",
  AGENCY_ADMIN_SETUP_EXTRACT: "AGENCY_ADMIN_SETUP_EXTRACT",
  CLIENT_PORTAL_QA: "CLIENT_PORTAL_QA",
  SUMMARIZE: "SUMMARIZE",
  EXTRACT_STRUCTURED: "EXTRACT_STRUCTURED",
  CLASSIFY_INTENT: "CLASSIFY_INTENT",
  PLANNER: "PLANNER",
  STRATEGY_PLAN: "STRATEGY_PLAN",
  CONTENT_IDEAS: "CONTENT_IDEAS",
  SCRIPT_WRITING: "SCRIPT_WRITING",
  TOOL_EXECUTION: "TOOL_EXECUTION",
  EMBED_TEXT: "EMBED_TEXT",
} as const;

export type TaskType = (typeof TaskTypes)[keyof typeof TaskTypes];

/**
 * Module requirement for a task
 */
export interface ModuleRequirement {
  module: BrainModule;
  required: boolean;
  fieldPaths: string[];
}

/**
 * Task to brain module requirements mapping
 */
const TASK_MODULE_MAP: Record<TaskType, ModuleRequirement[]> = {
  [TaskTypes.CHAT_GENERAL]: [],
  [TaskTypes.CHAT_ADMIN_ONBOARDING]: [
    { module: "bootstrap", required: true, fieldPaths: ["agency_name"] },
  ],
  [TaskTypes.AGENCY_ADMIN_SETUP_GUIDED_V2]: [
    { module: "bootstrap", required: true, fieldPaths: ["agency_name", "services", "target_industries"] },
    { module: "offer_stack", required: true, fieldPaths: ["core_offers"] },
    { module: "tone_voice", required: true, fieldPaths: ["voice_attributes"] },
    { module: "sop_strategy", required: true, fieldPaths: ["content_pillars"] },
    { module: "rep_policy", required: true, fieldPaths: ["boundaries"] },
    { module: "faq_objections", required: true, fieldPaths: ["faqs"] },
  ],
  [TaskTypes.AGENCY_ADMIN_GENERAL_CHAT]: [
    { module: "bootstrap", required: true, fieldPaths: ["agency_name", "services"] },
    { module: "tone_voice", required: false, fieldPaths: [] },
    { module: "rep_policy", required: false, fieldPaths: [] },
  ],
  [TaskTypes.AGENCY_ADMIN_SETUP_EXTRACT]: [
    { module: "bootstrap", required: false, fieldPaths: [] },
  ],
  [TaskTypes.CLIENT_PORTAL_QA]: [
    { module: "faq_objections", required: true, fieldPaths: ["faqs"] },
    { module: "rep_policy", required: true, fieldPaths: ["boundaries"] },
  ],
  [TaskTypes.SUMMARIZE]: [],
  [TaskTypes.EXTRACT_STRUCTURED]: [],
  [TaskTypes.CLASSIFY_INTENT]: [],
  [TaskTypes.PLANNER]: [],
  [TaskTypes.STRATEGY_PLAN]: [
    { module: "bootstrap", required: true, fieldPaths: ["agency_name", "services", "target_industries"] },
    { module: "tone_voice", required: true, fieldPaths: ["voice_attributes"] },
    { module: "sop_strategy", required: true, fieldPaths: ["content_pillars"] },
    { module: "offer_stack", required: false, fieldPaths: [] },
  ],
  [TaskTypes.CONTENT_IDEAS]: [
    { module: "bootstrap", required: true, fieldPaths: ["services"] },
    { module: "tone_voice", required: true, fieldPaths: ["voice_attributes"] },
    { module: "sop_strategy", required: false, fieldPaths: ["content_pillars"] },
  ],
  [TaskTypes.SCRIPT_WRITING]: [
    { module: "tone_voice", required: true, fieldPaths: ["voice_attributes", "vocabulary_preferences"] },
    { module: "sop_scripting", required: true, fieldPaths: ["script_structures"] },
    { module: "bootstrap", required: false, fieldPaths: [] },
  ],
  [TaskTypes.TOOL_EXECUTION]: [],
  [TaskTypes.EMBED_TEXT]: [],
};

/**
 * Missing field information
 */
export interface MissingFieldInfo {
  module: BrainModule;
  fieldPath: string;
  description: string;
  calibrationQuestion?: string;
}

/**
 * Calibration requirement
 */
export interface CalibrationRequirement {
  needed: boolean;
  missingFields: MissingFieldInfo[];
  questions: string[];
  modules: BrainModule[];
}

/**
 * Resolved brain context
 */
export interface ResolvedBrainContext {
  modules: Record<string, Record<string, unknown>>;
  complete: boolean;
  missing: MissingFieldInfo[];
  meta: {
    resolvedAt: string;
    moduleCount: number;
    agencyId: string;
  };
}

/**
 * Resolution result
 */
export type ResolveResult =
  | { status: "ready"; context: ResolvedBrainContext }
  | { status: "calibration_needed"; calibration: CalibrationRequirement }
  | { status: "error"; error: string };

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value is populated
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

/**
 * Generate calibration question for a field
 */
function generateCalibrationQuestion(module: BrainModule, fieldPath: string): string {
  const questionMap: Record<string, Record<string, string>> = {
    bootstrap: {
      agency_name: "What is your agency's name?",
      services: "What services does your agency offer?",
      target_industries: "What industries do your clients typically come from?",
    },
    tone_voice: {
      voice_attributes: "How would you describe your brand voice?",
      vocabulary_preferences: "Are there specific words or phrases you prefer to use or avoid?",
    },
    rep_policy: {
      boundaries: "What topics or claims should the AI avoid?",
      escalation_triggers: "What situations should be escalated to a human?",
    },
    sop_strategy: {
      content_pillars: "What are your main content pillars or themes?",
    },
    sop_scripting: {
      script_structures: "What script formats do you prefer?",
    },
    faq_objections: {
      faqs: "What are the most common questions your clients ask?",
    },
    offer_stack: {
      core_offers: "What are your main service packages?",
    },
    quality_bar: {
      quality_criteria: "What quality standards should content meet?",
    },
    ai_permissions: {
      allowed_actions: "What actions should AI be allowed to take?",
    },
  };

  return questionMap[module]?.[fieldPath] ?? `Please provide: ${fieldPath.replace(/_/g, " ")}`;
}

/**
 * Validate module fields
 */
function validateModuleFields(
  content: Record<string, unknown> | null,
  req: ModuleRequirement
): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = [];

  if (!content) {
    if (req.fieldPaths.length === 0) {
      missing.push({
        module: req.module,
        fieldPath: "",
        description: `Module ${req.module} is not configured`,
        calibrationQuestion: `Let's configure your ${req.module.replace(/_/g, " ")} settings.`,
      });
    } else {
      for (const fieldPath of req.fieldPaths) {
        missing.push({
          module: req.module,
          fieldPath,
          description: `Field ${fieldPath} is not configured`,
          calibrationQuestion: generateCalibrationQuestion(req.module, fieldPath),
        });
      }
    }
    return missing;
  }

  for (const fieldPath of req.fieldPaths) {
    const value = getNestedValue(content, fieldPath);
    if (!isPopulated(value)) {
      missing.push({
        module: req.module,
        fieldPath,
        description: `Field ${fieldPath} is empty`,
        calibrationQuestion: generateCalibrationQuestion(req.module, fieldPath),
      });
    }
  }

  return missing;
}

/**
 * Get modules required for a task
 */
export function getTaskModules(taskType: TaskType): ModuleRequirement[] {
  return TASK_MODULE_MAP[taskType] ?? [];
}

/**
 * Get only required modules for a task
 */
export function getRequiredModules(taskType: TaskType): ModuleRequirement[] {
  return getTaskModules(taskType).filter((m) => m.required);
}

/**
 * Check if task requires any brain context
 */
export function taskRequiresBrain(taskType: TaskType): boolean {
  return getTaskModules(taskType).some((m) => m.required);
}

/**
 * Resolve brain context for a task
 */
export async function resolveContext(
  supabase: MinimalSupabase,
  taskType: TaskType,
  agencyId: string
): Promise<ResolveResult> {
  if (!taskRequiresBrain(taskType)) {
    return {
      status: "ready",
      context: {
        modules: {},
        complete: true,
        missing: [],
        meta: {
          resolvedAt: new Date().toISOString(),
          moduleCount: 0,
          agencyId,
        },
      },
    };
  }

  try {
    const documents = await fetchApprovedBrainDocuments(supabase, agencyId);
    const documentMap = new Map<BrainModule, Record<string, unknown>>();

    for (const doc of documents) {
      documentMap.set(doc.module, doc.content_json);
    }

    const requirements = getTaskModules(taskType);
    const requiredOnly = getRequiredModules(taskType);

    const allMissing: MissingFieldInfo[] = [];
    for (const req of requiredOnly) {
      const content = documentMap.get(req.module) ?? null;
      const missing = validateModuleFields(content, req);
      allMissing.push(...missing);
    }

    if (allMissing.length > 0) {
      const questions = allMissing
        .slice(0, 3)
        .map((m) => m.calibrationQuestion)
        .filter((q): q is string => !!q);

      const uniqueModules = [...new Set(allMissing.map((m) => m.module))] as BrainModule[];

      return {
        status: "calibration_needed",
        calibration: {
          needed: true,
          missingFields: allMissing,
          questions,
          modules: uniqueModules,
        },
      };
    }

    const modules: Record<string, Record<string, unknown>> = {};
    for (const req of requirements) {
      const content = documentMap.get(req.module);
      if (content) {
        modules[req.module] = content;
      }
    }

    return {
      status: "ready",
      context: {
        modules,
        complete: true,
        missing: [],
        meta: {
          resolvedAt: new Date().toISOString(),
          moduleCount: Object.keys(modules).length,
          agencyId,
        },
      },
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Failed to resolve context",
    };
  }
}

/**
 * Flatten context to legacy format
 */
export function flattenContext(resolved: ResolvedBrainContext): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [module, content] of Object.entries(resolved.modules)) {
    for (const [key, value] of Object.entries(content)) {
      flat[`${module}_${key}`] = value;
    }
    flat[module] = content;
  }

  return flat;
}

/**
 * Quick check if calibration is needed
 */
export async function checkCalibrationNeeded(
  supabase: MinimalSupabase,
  taskType: TaskType,
  agencyId: string
): Promise<boolean> {
  const result = await resolveContext(supabase, taskType, agencyId);
  return result.status === "calibration_needed";
}
