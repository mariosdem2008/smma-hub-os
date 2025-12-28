/**
 * Brain Resolver
 *
 * Runtime context resolution for AI tasks.
 * Loads required brain modules, validates required fields,
 * and triggers on-demand calibration when fields are missing.
 *
 * CRITICAL INVARIANT: Only approved brain documents are used at runtime.
 */

import { TaskType } from "./taskTypes.ts";
import {
  type ModuleRequirement,
  getTaskModules,
  getRequiredModules,
  taskRequiresBrain,
} from "./taskToModuleMap.ts";
import type { BrainModule } from "@/lib/ai/brainModules";

type MinimalSupabase = {
  from: (table: string) => any;
};

/**
 * Resolved brain context for AI consumption
 */
export interface ResolvedBrainContext {
  /** Module name → content mapping */
  modules: Record<string, Record<string, unknown>>;
  /** Whether all required fields are present */
  complete: boolean;
  /** Missing field details if incomplete */
  missing: MissingFieldInfo[];
  /** Source metadata */
  meta: {
    resolvedAt: string;
    moduleCount: number;
    agencyId: string;
  };
}

/**
 * Information about a missing required field
 */
export interface MissingFieldInfo {
  /** The brain module */
  module: BrainModule;
  /** The field path (dot notation) */
  fieldPath: string;
  /** Human-readable description */
  description: string;
  /** Suggested calibration question */
  calibrationQuestion?: string;
}

/**
 * Calibration requirement when fields are missing
 */
export interface CalibrationRequirement {
  /** Whether calibration is needed */
  needed: boolean;
  /** Missing fields that need calibration */
  missingFields: MissingFieldInfo[];
  /** Suggested questions (max 3) */
  questions: string[];
  /** The modules that need attention */
  modules: BrainModule[];
}

/**
 * Result of context resolution
 */
export type ResolveResult =
  | { status: "ready"; context: ResolvedBrainContext }
  | { status: "calibration_needed"; calibration: CalibrationRequirement }
  | { status: "error"; error: string };

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value is "populated" (non-empty)
 */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return true; // numbers, booleans are considered populated
}

/**
 * Generate a calibration question for a missing field
 */
function generateCalibrationQuestion(
  module: BrainModule,
  fieldPath: string
): string {
  const questionMap: Record<string, Record<string, string>> = {
    bootstrap: {
      agency_name: "What is your agency's name?",
      services:
        "What services does your agency offer? (e.g., Social Media Management, Content Creation)",
      target_industries:
        "What industries do your clients typically come from?",
      geographic_focus: "What geographic regions do you serve?",
    },
    tone_voice: {
      voice_attributes:
        "How would you describe your brand voice? (e.g., Professional, Friendly, Bold)",
      vocabulary_preferences:
        "Are there specific words or phrases you prefer to use or avoid?",
      writing_guidelines:
        "What writing style guidelines should the AI follow?",
    },
    rep_policy: {
      boundaries:
        "What topics or claims should the AI avoid? (e.g., pricing promises, competitor mentions)",
      escalation_triggers:
        "What situations should be escalated to a human team member?",
      response_limits:
        "Are there any limitations on how the AI should respond?",
    },
    sop_strategy: {
      content_pillars:
        "What are your main content pillars or themes? (e.g., Educational, Behind-the-scenes, Testimonials)",
      posting_cadence: "How frequently do you typically post content?",
      platform_priorities: "Which social platforms are most important for you?",
    },
    sop_scripting: {
      script_structures:
        "What script formats do you prefer? (e.g., Hook-Story-Offer, Problem-Solution)",
      video_styles: "What video styles resonate with your clients?",
    },
    faq_objections: {
      faqs: "What are the most common questions your clients ask?",
      objections: "What objections do you frequently encounter from prospects?",
    },
    offer_stack: {
      core_offers: "What are your main service packages or offerings?",
      pricing_model: "How is your pricing structured?",
    },
    quality_bar: {
      quality_criteria:
        "What quality standards should content meet before approval?",
    },
    ai_permissions: {
      allowed_actions:
        "What actions should the AI be allowed to take autonomously?",
    },
  };

  const moduleQuestions = questionMap[module];
  if (moduleQuestions && moduleQuestions[fieldPath]) {
    return moduleQuestions[fieldPath];
  }

  // Fallback generic question
  const readableField = fieldPath.replace(/_/g, " ").toLowerCase();
  return `Please provide information about: ${readableField}`;
}

/**
 * Fetch approved brain documents for an agency
 */
async function fetchApprovedDocuments(
  supabase: MinimalSupabase,
  agencyId: string
): Promise<{ module: BrainModule; content: Record<string, unknown> }[]> {
  const res = await supabase
    .from("brain_documents")
    .select("module, content_json")
    .eq("agency_id", agencyId)
    .eq("status", "approved");

  if (res?.error) {
    throw new Error(res.error.message ?? "Failed to fetch brain documents");
  }

  return (res?.data ?? []).map((doc: any) => ({
    module: doc.module as BrainModule,
    content: doc.content_json as Record<string, unknown>,
  }));
}

/**
 * Validate required fields in a module
 */
function validateModuleFields(
  moduleContent: Record<string, unknown> | null,
  requirement: ModuleRequirement
): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = [];

  if (!moduleContent) {
    // If no field paths specified, the module itself is the requirement
    if (requirement.fieldPaths.length === 0) {
      missing.push({
        module: requirement.module,
        fieldPath: "",
        description: `Module ${requirement.module} is not configured`,
        calibrationQuestion: `Let's configure your ${requirement.module.replace(/_/g, " ")} settings.`,
      });
    } else {
      // All specified fields are missing
      for (const fieldPath of requirement.fieldPaths) {
        missing.push({
          module: requirement.module,
          fieldPath,
          description: `Field ${fieldPath} is not configured`,
          calibrationQuestion: generateCalibrationQuestion(
            requirement.module,
            fieldPath
          ),
        });
      }
    }
    return missing;
  }

  // Check each required field path
  for (const fieldPath of requirement.fieldPaths) {
    const value = getNestedValue(moduleContent, fieldPath);
    if (!isPopulated(value)) {
      missing.push({
        module: requirement.module,
        fieldPath,
        description: `Field ${fieldPath} is empty or not configured`,
        calibrationQuestion: generateCalibrationQuestion(
          requirement.module,
          fieldPath
        ),
      });
    }
  }

  return missing;
}

/**
 * Create a Brain Resolver instance
 */
export function createBrainResolver(supabase: MinimalSupabase) {
  /**
   * Resolve context for a specific task
   *
   * @param taskType - The task being executed
   * @param agencyId - The agency ID
   * @returns Resolved context or calibration requirement
   */
  async function resolveContext(
    taskType: TaskType,
    agencyId: string
  ): Promise<ResolveResult> {
    // Check if task needs brain at all
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
      // Fetch approved documents
      const documents = await fetchApprovedDocuments(supabase, agencyId);
      const documentMap = new Map<BrainModule, Record<string, unknown>>();
      for (const doc of documents) {
        documentMap.set(doc.module, doc.content);
      }

      // Get required modules for this task
      const requirements = getTaskModules(taskType);
      const requiredOnly = getRequiredModules(taskType);

      // Check for missing fields in required modules
      const allMissing: MissingFieldInfo[] = [];
      for (const req of requiredOnly) {
        const content = documentMap.get(req.module) ?? null;
        const missing = validateModuleFields(content, req);
        allMissing.push(...missing);
      }

      // If there are missing required fields, trigger calibration
      if (allMissing.length > 0) {
        // Generate calibration questions (max 3)
        const questions = allMissing
          .slice(0, 3)
          .map((m) => m.calibrationQuestion)
          .filter((q): q is string => !!q);

        const uniqueModules = [
          ...new Set(allMissing.map((m) => m.module)),
        ] as BrainModule[];

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

      // Build the resolved context with all available modules
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
        error:
          error instanceof Error ? error.message : "Failed to resolve context",
      };
    }
  }

  /**
   * Get a flat brain context (legacy format) from resolved modules
   * Useful for backward compatibility with existing prompts
   */
  function flattenContext(
    resolved: ResolvedBrainContext
  ): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    for (const [module, content] of Object.entries(resolved.modules)) {
      // Merge module content into flat structure
      for (const [key, value] of Object.entries(content)) {
        flat[`${module}_${key}`] = value;
      }
      // Also store the full module
      flat[module] = content;
    }

    return flat;
  }

  /**
   * Check if calibration is needed for a task without loading full context
   */
  async function checkCalibrationNeeded(
    taskType: TaskType,
    agencyId: string
  ): Promise<boolean> {
    const result = await resolveContext(taskType, agencyId);
    return result.status === "calibration_needed";
  }

  /**
   * Get missing modules for a task
   */
  async function getMissingModules(
    taskType: TaskType,
    agencyId: string
  ): Promise<BrainModule[]> {
    const result = await resolveContext(taskType, agencyId);
    if (result.status === "calibration_needed") {
      return result.calibration.modules;
    }
    return [];
  }

  return {
    resolveContext,
    flattenContext,
    checkCalibrationNeeded,
    getMissingModules,
  };
}

/**
 * Type for the resolver instance
 */
export type BrainResolver = ReturnType<typeof createBrainResolver>;
