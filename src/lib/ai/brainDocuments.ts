/**
 * Brain Document Types and Utilities
 *
 * TypeScript types for the versioned brain document system.
 * These types match the PostgreSQL schema in brain_documents_and_calibration_state.sql
 */

import type {
  BrainModule,
  BrainDocumentStatus,
  BrainDocumentSource,
} from "./brainModules";

/**
 * Core brain document record from database
 */
export interface BrainDocument {
  id: string;
  agency_id: string;
  module: BrainModule;
  title: string;
  content_json: BrainDocumentContent;
  status: BrainDocumentStatus;
  version: number;
  approved_at: string | null;
  approved_by: string | null;
  parent_version_id: string | null;
  source: BrainDocumentSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Brain document version record from database
 */
export interface BrainDocumentVersion {
  id: string;
  document_id: string;
  version: number;
  content_json: BrainDocumentContent;
  diff_json: Record<string, unknown> | null;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Generic content type for brain documents
 * Each module has its own content schema
 */
export type BrainDocumentContent = Record<string, unknown>;

/**
 * Content schema for Bootstrap module
 */
export interface BootstrapContent {
  identity: {
    name: string;
    niches: string[];
    offers: string[];
    geo: string[];
    languages: string[];
  };
  icp: {
    industries: string[];
    size: string[];
    personas: string[];
    pains: string[];
    objections: string[];
  };
}

/**
 * Content schema for Rep Policy module
 */
export interface RepPolicyContent {
  ai_name: string;
  persona_description: string;
  boundaries: {
    can_do: string[];
    cannot_do: string[];
    escalation_rule: string;
  };
  claims_policy: {
    allowed_claims: string[];
    forbidden_claims: string[];
  };
  never_say: string[];
  never_do: string[];
  response_sla: string;
  default_cta_style: string[];
}

/**
 * Content schema for SOP Strategy module
 */
export interface SopStrategyContent {
  pillars: string[];
  strategy_process: string[];
  platform_priorities: string[];
  content_frequency: Record<string, string>;
  approval_workflow: string;
  planning_cadence: string;
}

/**
 * Content schema for SOP Scripting module
 */
export interface SopScriptingContent {
  hook_templates: string[];
  cta_templates: string[];
  format_guidelines: Record<string, string>;
  length_guidelines: Record<string, string>;
  revision_rules: string;
  quality_checklist: string[];
}

/**
 * Content schema for Tone & Voice module
 */
export interface ToneVoiceContent {
  adjectives: string[];
  banned_words: string[];
  preferred_vocab: string[];
  writing_rules: string[];
  examples: Array<{
    context: string;
    good: string;
    bad: string;
  }>;
}

/**
 * Content schema for FAQ & Objections module
 */
export interface FaqObjectionsContent {
  faqs: Array<{
    question: string;
    answer: string;
    tags?: string[];
  }>;
  objections: Array<{
    objection: string;
    response: string;
    category?: string;
  }>;
}

/**
 * Content schema for AI Permissions module
 */
export interface AiPermissionsContent {
  read_scopes: {
    client_summary: boolean;
    pipeline: boolean;
    calendar: boolean;
    analytics: boolean;
  };
  write_scopes: {
    create_drafts: boolean;
    propose_brain_updates: boolean;
  };
  safety_scopes: {
    require_external_confirmation: boolean;
    no_guarantee_promises: boolean;
  };
}

/**
 * Content schema for Offer Stack module
 */
export interface OfferStackContent {
  tiers: Array<{
    name: string;
    price: string;
    description: string;
    features: string[];
  }>;
  usps: string[];
  positioning: string;
  target_outcome: string;
}

/**
 * Content schema for Quality Bar module
 */
export interface QualityBarContent {
  review_criteria: string[];
  acceptance_threshold: string;
  revision_limits: number;
  escalation_triggers: string[];
}

/**
 * Map of module to its content type
 */
export interface BrainModuleContentMap {
  bootstrap: BootstrapContent;
  rep_policy: RepPolicyContent;
  sop_strategy: SopStrategyContent;
  sop_scripting: SopScriptingContent;
  tone_voice: ToneVoiceContent;
  faq_objections: FaqObjectionsContent;
  ai_permissions: AiPermissionsContent;
  offer_stack: OfferStackContent;
  quality_bar: QualityBarContent;
}

/**
 * Typed brain document with specific content
 */
export interface TypedBrainDocument<M extends BrainModule>
  extends Omit<BrainDocument, "content_json" | "module"> {
  module: M;
  content_json: BrainModuleContentMap[M];
}

/**
 * Input for creating a brain document draft
 */
export interface CreateBrainDocumentInput {
  agency_id: string;
  module: BrainModule;
  title: string;
  content_json: BrainDocumentContent;
  source?: BrainDocumentSource;
}

/**
 * Input for updating a brain document
 */
export interface UpdateBrainDocumentInput {
  document_id: string;
  content_json: BrainDocumentContent;
  change_summary?: string;
}

/**
 * Result of a brain document operation
 */
export interface BrainDocumentResult {
  success: boolean;
  document?: BrainDocument;
  error?: string;
}

/**
 * Default content templates for each module
 */
export const DEFAULT_CONTENT: BrainModuleContentMap = {
  bootstrap: {
    identity: {
      name: "",
      niches: [],
      offers: [],
      geo: [],
      languages: [],
    },
    icp: {
      industries: [],
      size: [],
      personas: [],
      pains: [],
      objections: [],
    },
  },
  rep_policy: {
    ai_name: "AI Assistant",
    persona_description: "",
    boundaries: {
      can_do: [],
      cannot_do: [],
      escalation_rule: "",
    },
    claims_policy: {
      allowed_claims: [],
      forbidden_claims: [],
    },
    never_say: [],
    never_do: [],
    response_sla: "",
    default_cta_style: [],
  },
  sop_strategy: {
    pillars: [],
    strategy_process: [],
    platform_priorities: [],
    content_frequency: {},
    approval_workflow: "",
    planning_cadence: "",
  },
  sop_scripting: {
    hook_templates: [],
    cta_templates: [],
    format_guidelines: {},
    length_guidelines: {},
    revision_rules: "",
    quality_checklist: [],
  },
  tone_voice: {
    adjectives: [],
    banned_words: [],
    preferred_vocab: [],
    writing_rules: [],
    examples: [],
  },
  faq_objections: {
    faqs: [],
    objections: [],
  },
  ai_permissions: {
    read_scopes: {
      client_summary: true,
      pipeline: true,
      calendar: true,
      analytics: false,
    },
    write_scopes: {
      create_drafts: true,
      propose_brain_updates: true,
    },
    safety_scopes: {
      require_external_confirmation: true,
      no_guarantee_promises: true,
    },
  },
  offer_stack: {
    tiers: [],
    usps: [],
    positioning: "",
    target_outcome: "",
  },
  quality_bar: {
    review_criteria: [],
    acceptance_threshold: "",
    revision_limits: 3,
    escalation_triggers: [],
  },
};

/**
 * Get default content for a module
 */
export function getDefaultContent<M extends BrainModule>(
  module: M
): BrainModuleContentMap[M] {
  return structuredClone(DEFAULT_CONTENT[module]);
}

/**
 * Check if a document is editable (not approved or archived)
 */
export function isDocumentEditable(document: BrainDocument): boolean {
  return document.status === "draft" || document.status === "pending_approval";
}

/**
 * Check if a document can be approved
 */
export function canApproveDocument(document: BrainDocument): boolean {
  return document.status === "draft" || document.status === "pending_approval";
}

/**
 * Get the effective document (approved version) for a module
 * Returns null if no approved document exists
 */
export function getEffectiveDocument(
  documents: BrainDocument[],
  module: BrainModule
): BrainDocument | null {
  return (
    documents.find((d) => d.module === module && d.status === "approved") ??
    null
  );
}

/**
 * Get all documents for a module sorted by status priority
 */
export function getDocumentsForModule(
  documents: BrainDocument[],
  module: BrainModule
): BrainDocument[] {
  const statusOrder: Record<BrainDocumentStatus, number> = {
    approved: 1,
    pending_approval: 2,
    draft: 3,
    archived: 4,
  };

  return documents
    .filter((d) => d.module === module)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
}
