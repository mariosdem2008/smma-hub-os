export type UnknownGateResult = {
  usable: boolean;
  missing_fields: string[];
  questions: string[];
};

const REQUIRED_FIELDS = [
  "brand_basics.name",
  "offer_details.products_services",
  "audience.problems",
  "pillars",
  "goals",
];

const REQUIRED_GROUPS = [
  {
    key: "constraints.banned_claims_or_taboo_topics",
    paths: ["constraints.banned_claims", "constraints.taboo_topics"],
  },
];

const QUESTION_MAP: Record<string, string> = {
  "brand_basics.name": "What is the exact client brand name?",
  "offer_details.products_services": "What products or services should strategy focus on?",
  "audience.problems": "What are the top audience problems or pains to address?",
  "pillars": "What 3-6 content pillars should we anchor the strategy on?",
  "constraints.banned_claims_or_taboo_topics": "Are there any banned claims or topics to avoid?",
  "goals": "What are the primary goals for the next 90 days?",
};

function getPathValue(source: Record<string, any>, path: string) {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), source);
}

function isFilled(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (value && typeof value === "object") return Object.values(value).some(isFilled);
  return false;
}

export function evaluateClientBrainForStrategy(brain: Record<string, any>): UnknownGateResult {
  const missing = REQUIRED_FIELDS.filter((path) => !isFilled(getPathValue(brain, path)));
  REQUIRED_GROUPS.forEach((group) => {
    const groupFilled = group.paths.some((path) => isFilled(getPathValue(brain, path)));
    if (!groupFilled) {
      missing.push(group.key);
    }
  });
  const questions = missing.map((field) => QUESTION_MAP[field]).filter(Boolean);

  return {
    usable: missing.length === 0,
    missing_fields: missing,
    questions: questions.slice(0, 3),
  };
}
