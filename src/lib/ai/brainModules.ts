/**
 * Brain Module Types and Utilities
 *
 * Defines the modular brain document system for Agency Brain.
 * Each module represents a distinct knowledge category that can be
 * independently versioned, edited, and approved.
 */

/**
 * Brain module types - matches PostgreSQL brain_module enum
 */
export const BRAIN_MODULES = [
  "bootstrap",
  "rep_policy",
  "sop_strategy",
  "sop_scripting",
  "tone_voice",
  "faq_objections",
  "ai_permissions",
  "offer_stack",
  "quality_bar",
] as const;

export type BrainModule = (typeof BRAIN_MODULES)[number];

/**
 * Brain document status - matches PostgreSQL brain_document_status enum
 */
export const BRAIN_DOCUMENT_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "archived",
] as const;

export type BrainDocumentStatus = (typeof BRAIN_DOCUMENT_STATUSES)[number];

/**
 * Brain document source - matches PostgreSQL brain_document_source enum
 */
export const BRAIN_DOCUMENT_SOURCES = [
  "onboarding",
  "chat",
  "manual",
  "ai_proposed",
] as const;

export type BrainDocumentSource = (typeof BRAIN_DOCUMENT_SOURCES)[number];

/**
 * Human-readable labels for brain modules
 */
export const BRAIN_MODULE_LABELS: Record<BrainModule, string> = {
  bootstrap: "Bootstrap Profile",
  rep_policy: "Rep Policy",
  sop_strategy: "Strategy SOP",
  sop_scripting: "Scripting SOP",
  tone_voice: "Tone & Voice",
  faq_objections: "FAQ & Objections",
  ai_permissions: "AI Permissions",
  offer_stack: "Offer Stack",
  quality_bar: "Quality Bar",
};

/**
 * Descriptions for brain modules (used in UI)
 */
export const BRAIN_MODULE_DESCRIPTIONS: Record<BrainModule, string> = {
  bootstrap:
    "Core agency identity from onboarding - name, niche, services, audience basics. Mostly read-only.",
  rep_policy:
    "AI persona, boundaries, escalation rules, claims policy, and forbidden actions.",
  sop_strategy:
    "Standard operating procedures for strategy development, pillars, and planning.",
  sop_scripting:
    "Standard operating procedures for content scripting, hooks, and CTA templates.",
  tone_voice:
    "Voice rules, adjectives, banned words, and writing style guidelines.",
  faq_objections:
    "Approved Q&A pairs the AI can reuse when answering common questions.",
  ai_permissions:
    "Access scopes for what data AI may read and what actions it may perform.",
  offer_stack:
    "Core offer positioning, pricing tiers, and unique value propositions.",
  quality_bar:
    "Quality standards, review criteria, and acceptance thresholds.",
};

/**
 * Icons for brain modules (using Lucide icon names)
 */
export const BRAIN_MODULE_ICONS: Record<BrainModule, string> = {
  bootstrap: "Building2",
  rep_policy: "Shield",
  sop_strategy: "Target",
  sop_scripting: "FileText",
  tone_voice: "MessageSquare",
  faq_objections: "HelpCircle",
  ai_permissions: "Key",
  offer_stack: "DollarSign",
  quality_bar: "Star",
};

/**
 * Default display order for brain modules in UI
 */
export const BRAIN_MODULE_ORDER: BrainModule[] = [
  "bootstrap",
  "rep_policy",
  "sop_strategy",
  "sop_scripting",
  "tone_voice",
  "faq_objections",
  "ai_permissions",
  "offer_stack",
  "quality_bar",
];

/**
 * Modules that are primarily read-only (populated from onboarding)
 */
export const READ_ONLY_MODULES: BrainModule[] = ["bootstrap"];

/**
 * Modules that require explicit approval before use
 */
export const APPROVAL_REQUIRED_MODULES: BrainModule[] = [
  "rep_policy",
  "sop_strategy",
  "sop_scripting",
  "tone_voice",
  "faq_objections",
  "ai_permissions",
];

/**
 * Check if a module is read-only
 */
export function isReadOnlyModule(module: BrainModule): boolean {
  return READ_ONLY_MODULES.includes(module);
}

/**
 * Check if a module requires approval
 */
export function requiresApproval(module: BrainModule): boolean {
  return APPROVAL_REQUIRED_MODULES.includes(module);
}

/**
 * Validate that a string is a valid brain module
 */
export function isValidBrainModule(value: string): value is BrainModule {
  return BRAIN_MODULES.includes(value as BrainModule);
}

/**
 * Validate that a string is a valid brain document status
 */
export function isValidBrainDocumentStatus(
  value: string
): value is BrainDocumentStatus {
  return BRAIN_DOCUMENT_STATUSES.includes(value as BrainDocumentStatus);
}

/**
 * Validate that a string is a valid brain document source
 */
export function isValidBrainDocumentSource(
  value: string
): value is BrainDocumentSource {
  return BRAIN_DOCUMENT_SOURCES.includes(value as BrainDocumentSource);
}
