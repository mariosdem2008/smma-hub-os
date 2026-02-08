/**
 * Task to Brain Module Mapping
 *
 * Maps AI task types to the brain modules they require.
 * Used by the Brain Resolver to load the correct context
 * and detect missing required fields.
 */

import { TaskType } from "./taskTypes.ts";
import type { BrainModule } from "@/lib/ai/brainModules";

/**
 * Module requirement for a task
 */
export interface ModuleRequirement {
  /** The brain module */
  module: BrainModule;
  /** Whether this module is required (vs optional enhancement) */
  required: boolean;
  /** Specific field paths that must be populated (empty = module must exist) */
  fieldPaths: string[];
}

/**
 * Task module mapping entry
 */
export interface TaskModuleMapping {
  taskType: TaskType;
  modules: ModuleRequirement[];
  /** Description of what this task does */
  description?: string;
}

/**
 * Task to brain module requirements mapping
 *
 * Each task specifies which brain modules it needs and which
 * fields within those modules are required for the task to execute.
 */
export const TASK_MODULE_MAP: Record<TaskType, ModuleRequirement[]> = {
  // General chat doesn't need brain context
  [TaskType.CHAT_GENERAL]: [],

  // Admin onboarding - needs bootstrap for context
  [TaskType.CHAT_ADMIN_ONBOARDING]: [
    {
      module: "bootstrap",
      required: true,
      fieldPaths: ["agency_name"],
    },
  ],

  // Guided setup V2 - needs bootstrap foundation
  [TaskType.AGENCY_ADMIN_SETUP_GUIDED_V2]: [
    {
      module: "bootstrap",
      required: true,
      fieldPaths: ["agency_name", "services", "target_industries"],
    },
    {
      module: "offer_stack",
      required: true,
      fieldPaths: ["core_offers"],
    },
    {
      module: "tone_voice",
      required: true,
      fieldPaths: ["voice_attributes"],
    },
    {
      module: "sop_strategy",
      required: true,
      fieldPaths: ["content_pillars"],
    },
    {
      module: "rep_policy",
      required: true,
      fieldPaths: ["boundaries"],
    },
    {
      module: "faq_objections",
      required: true,
      fieldPaths: ["faqs"],
    },
  ],

  // Admin general chat - needs multiple modules for full context
  [TaskType.AGENCY_ADMIN_GENERAL_CHAT]: [
    {
      module: "bootstrap",
      required: true,
      fieldPaths: ["agency_name", "services"],
    },
    {
      module: "tone_voice",
      required: false,
      fieldPaths: [],
    },
    {
      module: "rep_policy",
      required: false,
      fieldPaths: [],
    },
  ],

  // Setup extraction - minimal context needed
  [TaskType.AGENCY_ADMIN_SETUP_EXTRACT]: [
    {
      module: "bootstrap",
      required: false,
      fieldPaths: [],
    },
  ],

  // Client portal QA - needs FAQ and policy
  [TaskType.CLIENT_PORTAL_QA]: [
    {
      module: "faq_objections",
      required: true,
      fieldPaths: ["faqs"],
    },
    {
      module: "rep_policy",
      required: true,
      fieldPaths: ["boundaries"],
    },
  ],

  // Summarize - no brain needed
  [TaskType.SUMMARIZE]: [],

  // Extract structured - no brain needed
  [TaskType.EXTRACT_STRUCTURED]: [],

  // Classify intent - no brain needed
  [TaskType.CLASSIFY_INTENT]: [],

  // Planner - no brain needed
  [TaskType.PLANNER]: [],

  // Strategy plan - needs full context
  [TaskType.STRATEGY_PLAN]: [
    {
      module: "bootstrap",
      required: true,
      fieldPaths: ["agency_name", "services", "target_industries"],
    },
    {
      module: "tone_voice",
      required: true,
      fieldPaths: ["voice_attributes"],
    },
    {
      module: "sop_strategy",
      required: true,
      fieldPaths: ["content_pillars"],
    },
    {
      module: "offer_stack",
      required: false,
      fieldPaths: [],
    },
  ],

  // AI assistant (client detail) - starts with style + quality, requests more on demand
  [TaskType.AI_ASSISTANT]: [
    {
      module: "rep_policy",
      required: true,
      fieldPaths: [],
    },
    {
      module: "quality_bar",
      required: true,
      fieldPaths: [],
    },
  ],

  // Content ideas - needs voice and strategy
  [TaskType.CONTENT_IDEAS]: [
    {
      module: "bootstrap",
      required: true,
      fieldPaths: ["services"],
    },
    {
      module: "tone_voice",
      required: true,
      fieldPaths: ["voice_attributes"],
    },
    {
      module: "sop_strategy",
      required: false,
      fieldPaths: ["content_pillars"],
    },
  ],

  // Script writing - needs detailed voice guidance
  [TaskType.SCRIPT_WRITING]: [
    {
      module: "tone_voice",
      required: true,
      fieldPaths: ["voice_attributes", "vocabulary_preferences"],
    },
    {
      module: "sop_scripting",
      required: true,
      fieldPaths: ["script_structures"],
    },
    {
      module: "bootstrap",
      required: false,
      fieldPaths: [],
    },
  ],

  // Tool execution - minimal context
  [TaskType.TOOL_EXECUTION]: [],

  // Embedding - no brain needed
  [TaskType.EMBED_TEXT]: [],
};

/**
 * Get the required modules for a task type
 */
export function getTaskModules(taskType: TaskType): ModuleRequirement[] {
  return TASK_MODULE_MAP[taskType] ?? [];
}

/**
 * Get only the required (non-optional) modules for a task
 */
export function getRequiredModules(taskType: TaskType): ModuleRequirement[] {
  return getTaskModules(taskType).filter((m) => m.required);
}

/**
 * Check if a task requires any brain context
 */
export function taskRequiresBrain(taskType: TaskType): boolean {
  const modules = getTaskModules(taskType);
  return modules.some((m) => m.required);
}

/**
 * Get all unique modules required across multiple tasks
 */
export function getModulesForTasks(taskTypes: TaskType[]): BrainModule[] {
  const moduleSet = new Set<BrainModule>();
  for (const taskType of taskTypes) {
    for (const req of getTaskModules(taskType)) {
      moduleSet.add(req.module);
    }
  }
  return Array.from(moduleSet);
}

/**
 * Get field paths required for a specific module and task
 */
export function getRequiredFieldPaths(
  taskType: TaskType,
  module: BrainModule
): string[] {
  const moduleReq = getTaskModules(taskType).find((m) => m.module === module);
  return moduleReq?.fieldPaths ?? [];
}
