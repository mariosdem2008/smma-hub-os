import type { BrainModule } from "@/lib/ai/brainModules";

export type ModuleCategory = "core" | "templates" | "advanced";

export interface ModuleConfig {
  name: string;
  description: string;
  category: ModuleCategory;
  isDefault: boolean; // true for bootstrap, rep_policy, quality_bar
}

export const MODULE_CONFIG: Record<BrainModule, ModuleConfig> = {
  bootstrap: {
    name: "Agency Profile",
    description: "Tell the AI about your agency: name, niche, services, and target audience",
    category: "core",
    isDefault: true,
  },
  rep_policy: {
    name: "Communication Style",
    description: "How should the AI talk to clients? Persona, tone, and response guidelines",
    category: "core",
    isDefault: true,
  },
  quality_bar: {
    name: "Quality Standards",
    description: "What level of quality and accuracy do you expect from responses?",
    category: "core",
    isDefault: true,
  },
  faq_objections: {
    name: "FAQs & Common Questions",
    description: "Pre-written answers to questions your clients frequently ask",
    category: "templates",
    isDefault: false,
  },
  tone_voice: {
    name: "Tone Guidelines",
    description: "Detailed voice, style, and personality rules for the AI",
    category: "templates",
    isDefault: false,
  },
  sop_scripting: {
    name: "Script Templates",
    description: "Ready-to-use response scripts for common scenarios",
    category: "templates",
    isDefault: false,
  },
  sop_strategy: {
    name: "Strategy Playbook",
    description: "Strategic guidelines and standard operating procedures",
    category: "templates",
    isDefault: false,
  },
  ai_permissions: {
    name: "AI Permissions & Boundaries",
    description: "Define what the AI can and cannot do on your behalf",
    category: "advanced",
    isDefault: false,
  },
  offer_stack: {
    name: "Offer Configuration",
    description: "Your services, packages, and pricing information",
    category: "advanced",
    isDefault: false,
  },
};

export const CATEGORY_ORDER: ModuleCategory[] = ["core", "templates", "advanced"];

export const CATEGORY_LABELS: Record<ModuleCategory, { title: string; description: string }> = {
  core: {
    title: "Core Setup",
    description: "Required for your AI to function properly",
  },
  templates: {
    title: "Response Templates",
    description: "Optional pre-written content for common situations",
  },
  advanced: {
    title: "Advanced Settings",
    description: "Fine-tune AI behavior and permissions",
  },
};

