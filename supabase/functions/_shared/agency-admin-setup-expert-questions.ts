export type ExpertQuestion = {
  id: string;
  depthLevel: 1 | 2 | 3 | 4 | 5;
  intent: string;
  requiredFields: string[];
  exampleQuestion: string;
};

export const EXPERT_QUESTION_REGISTRY: ExpertQuestion[] = [
  {
    id: "offers_primary_services",
    depthLevel: 1,
    intent: "offers",
    requiredFields: ["setup_profile_v1.agency.primary_services"],
    exampleQuestion: "What are your top 3-6 services or offers today?",
  },
  {
    id: "icp_target_client_profile",
    depthLevel: 1,
    intent: "ideal_customer_profile",
    requiredFields: ["setup_profile_v1.agency.target_client_profile"],
    exampleQuestion: "Describe your ideal client size and budget range.",
  },
  {
    id: "positioning_unique_differentiators",
    depthLevel: 2,
    intent: "positioning",
    requiredFields: ["setup_profile_v1.agency.core_offer_outcome"],
    exampleQuestion: "What makes your agency different from competitors in your space?",
  },
  {
    id: "competitors_comparison",
    depthLevel: 2,
    intent: "competitors",
    requiredFields: ["setup_profile_v1.agency.niche_industries"],
    exampleQuestion: "Which competitors do prospects compare you against most often?",
  },
  {
    id: "pricing_structure",
    depthLevel: 3,
    intent: "pricing",
    requiredFields: ["setup_profile_v1.agency.pricing_structure"],
    exampleQuestion: "What is your pricing structure or typical package range?",
  },
  {
    id: "deliverables_standard",
    depthLevel: 3,
    intent: "deliverables",
    requiredFields: ["setup_profile_v1.agency.deliverables_standard"],
    exampleQuestion: "What are your standard monthly deliverables?",
  },
  {
    id: "workflow_stages",
    depthLevel: 3,
    intent: "workflow",
    requiredFields: ["setup_profile_v1.agency.workflow_stages"],
    exampleQuestion: "Walk me through your workflow from kickoff to delivery.",
  },
  {
    id: "brand_voice_tone",
    depthLevel: 4,
    intent: "tone",
    requiredFields: ["setup_profile_v1.brand.voice_adjectives"],
    exampleQuestion: "Which adjectives best describe your brand voice?",
  },
  {
    id: "ai_boundaries",
    depthLevel: 4,
    intent: "boundaries",
    requiredFields: ["setup_profile_v1.ai.boundaries"],
    exampleQuestion: "What can the AI decide vs what must it ask you to approve?",
  },
  {
    id: "escalation_rules",
    depthLevel: 4,
    intent: "escalation",
    requiredFields: ["setup_profile_v1.ai.escalation_rules"],
    exampleQuestion: "When should the AI say UNKNOWN or escalate to a human?",
  },
  {
    id: "faq_seed_top10",
    depthLevel: 5,
    intent: "faq",
    requiredFields: ["faq_v1"],
    exampleQuestion: "List your top FAQs with short answers (5-10).",
  },
  {
    id: "acquisition_strategy",
    depthLevel: 5,
    intent: "acquisition_strategy",
    requiredFields: ["setup_profile_v1.agency.acquisition_strategy"],
    exampleQuestion: "What is your primary client acquisition strategy today?",
  },
  {
    id: "proof_case_studies",
    depthLevel: 5,
    intent: "proof",
    requiredFields: ["setup_profile_v1.agency.case_studies"],
    exampleQuestion: "What proof or case studies should we reference when selling?",
  },
];
