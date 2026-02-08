export type OnboardingModuleKey =
  | "bootstrap"
  | "positioning"
  | "offer_stack"
  | "operations"
  | "ai_persona"
  | "rep_policy"
  | "voice"
  | "persona";

export type OnboardingModuleSpec = {
  key: OnboardingModuleKey;
  required: boolean;
  requiredPaths: string[];
};

export type OnboardingProgress = {
  currentModule: OnboardingModuleKey;
  requiredComplete: boolean;
  completedModules: OnboardingModuleKey[];
  missingByModule: Record<OnboardingModuleKey, string[]>;
};

export const ONBOARDING_MODULE_SPECS: OnboardingModuleSpec[] = [
  {
    key: "bootstrap",
    required: true,
    requiredPaths: [
      "bootstrap.agency_name",
      "bootstrap.locale",
      "bootstrap.team_size",
      "bootstrap.active_clients",
      "bootstrap.target_industries",
      "bootstrap.services",
    ],
  },
  {
    key: "positioning",
    required: true,
    requiredPaths: ["positioning.icp_best", "positioning.differentiators"],
  },
  {
    key: "offer_stack",
    required: true,
    requiredPaths: ["offer_stack.core_offer_high_margin", "offer_stack.core_offers", "offer_stack.pricing_model"],
  },
  {
    key: "operations",
    required: false,
    requiredPaths: ["operations.content_pillars", "rep_policy.boundaries"],
  },
  {
    key: "ai_persona",
    required: false,
    requiredPaths: ["ai_persona.name", "ai_persona.role_title", "ai_persona.traits", "ai_persona.writing_style"],
  },
];

const PATH_ALIASES: Record<string, string[]> = {
  "bootstrap.agency_name": [
    "bootstrap.agency_name",
    "identity.name",
    "setup_profile_v1.agency.name",
  ],
  "bootstrap.services": [
    "bootstrap.services",
    "identity.offers",
    "setup_profile_v1.agency.primary_services",
  ],
  "bootstrap.links": ["bootstrap.links", "agency.links", "agency.website", "agency.socials"],
  "bootstrap.locale": ["bootstrap.locale", "agency.locale", "agency.timezone"],
  "bootstrap.team_size": ["bootstrap.team_size", "agency.team_size"],
  "bootstrap.team_roles": ["bootstrap.team_roles", "agency.team_roles"],
  "bootstrap.active_clients": ["bootstrap.active_clients", "agency.active_clients"],
  "bootstrap.client_types": ["bootstrap.client_types", "agency.client_types"],
  "bootstrap.target_industries": [
    "bootstrap.target_industries",
    "identity.niches",
    "setup_profile_v1.agency.niche_industries",
  ],
  "positioning.icp_best": ["positioning.icp_best", "positioning.best_icp"],
  "positioning.icp_worst": ["positioning.icp_worst", "positioning.worst_icp"],
  "positioning.differentiators": ["positioning.differentiators", "positioning.usp"],
  "positioning.proof": ["positioning.proof"],
  "positioning.competitors": ["positioning.competitors"],
  "offer_stack.core_offer_high_margin": ["offer_stack.core_offer_high_margin", "offer_stack.high_margin_offer"],
  "offer_stack.core_offers": ["offer_stack.core_offers", "identity.offers", "setup_profile_v1.agency.primary_services"],
  "offer_stack.pricing_model": ["offer_stack.pricing_model"],
  "offer_stack.price_ranges": ["offer_stack.price_ranges"],
  "offer_stack.add_ons": ["offer_stack.add_ons"],
  "offer_stack.guarantees": ["offer_stack.guarantees"],
  "operations.content_pillars": ["operations.content_pillars", "sop_strategy.content_pillars", "strategy_defaults.pillars", "pillars"],
  "operations.approvals": ["operations.approvals"],
  "operations.turnaround_sla": ["operations.turnaround_sla"],
  "operations.reporting_cadence": ["operations.reporting_cadence"],
  "operations.tools_stack": ["operations.tools_stack"],
  "operations.platforms": ["operations.platforms"],
  "operations.required_assets": ["operations.required_assets"],
  "ai_persona.name": ["ai_persona.name", "persona.assistant_name", "assistant_name"],
  "ai_persona.role_title": ["ai_persona.role_title"],
  "ai_persona.traits": ["ai_persona.traits", "persona.tone_traits", "tone_traits"],
  "ai_persona.writing_style": ["ai_persona.writing_style"],
  "tone_voice.voice_attributes": [
    "tone_voice.voice_attributes",
    "voice_tone.adjectives",
    "setup_profile_v1.brand.voice_adjectives",
  ],
  "rep_policy.boundaries": ["rep_policy.boundaries", "constraints.banned_claims", "constraints.taboo_topics"],
  "faq_objections.faqs": ["faq_objections.faqs", "faq"],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (!isObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let current: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = current[part];
    if (!isObject(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const output = cloneRecord(base);
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = output[key];
    if (isObject(baseValue) && isObject(patchValue)) {
      output[key] = deepMerge(baseValue, patchValue);
      continue;
    }
    output[key] = patchValue;
  }
  return output;
}

function splitToList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function gatherKnownStrings(source: unknown, output: string[] = []): string[] {
  if (source === null || source === undefined) return output;
  if (typeof source === "string") {
    const value = source.trim();
    if (value.length > 0) output.push(value);
    return output;
  }
  if (Array.isArray(source)) {
    for (const item of source) gatherKnownStrings(item, output);
    return output;
  }
  if (isObject(source)) {
    for (const value of Object.values(source)) gatherKnownStrings(value, output);
  }
  return output;
}

function normalizedToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildKnownTokenSet(snapshot: Record<string, unknown>) {
  const tokenSet = new Set<string>();
  const knownValues = gatherKnownStrings(snapshot);
  for (const value of knownValues) {
    const tokens = value.split(/\s+/).map(normalizedToken).filter((token) => token.length >= 4);
    for (const token of tokens) tokenSet.add(token);
  }
  return tokenSet;
}

function keepSuggestionBySnapshot(suggestion: string, knownTokens: Set<string>): boolean {
  if (knownTokens.size === 0) return false;
  const tokens = suggestion
    .split(/\s+/)
    .map(normalizedToken)
    .filter((token) => token.length >= 4);
  return tokens.some((token) => knownTokens.has(token));
}

function normalizeSuggestionValue(value: unknown): string | null {
  if (typeof value === "string") {
    const suggestion = value.trim();
    return suggestion.length > 0 ? suggestion : null;
  }
  if (isObject(value) && typeof value.label === "string") {
    const suggestion = value.label.trim();
    return suggestion.length > 0 ? suggestion : null;
  }
  return null;
}

function getFirstString(snapshot: Record<string, unknown>, path: string): string | null {
  const aliases = PATH_ALIASES[path] ?? [path];
  for (const alias of aliases) {
    const value = getPathValue(snapshot, alias);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function getFirstList(snapshot: Record<string, unknown>, path: string): string[] {
  const aliases = PATH_ALIASES[path] ?? [path];
  for (const alias of aliases) {
    const value = getPathValue(snapshot, alias);
    if (Array.isArray(value)) {
      const list = value.map((item) => String(item).trim()).filter(Boolean);
      if (list.length > 0) return list.slice(0, 5);
    }
    if (typeof value === "string") {
      const list = splitToList(value);
      if (list.length > 0) return list;
    }
  }
  return [];
}

function moduleFallbackSuggestions(
  module: OnboardingModuleKey,
  snapshot: Record<string, unknown>
): string[] {
  const agencyName = getFirstString(snapshot, "bootstrap.agency_name");
  const nicheValues = getFirstList(snapshot, "bootstrap.target_industries");
  const serviceValues = getFirstList(snapshot, "bootstrap.services");
  const voiceValues = getFirstList(snapshot, "tone_voice.voice_attributes");
  const pillarValues = getFirstList(snapshot, "sop_strategy.content_pillars");

  if (module === "bootstrap") {
    return [
      agencyName ? `Our agency name is ${agencyName}.` : "Our agency name is [agency name].",
      serviceValues.length > 0
        ? `Our core services are ${serviceValues.join(", ")}.`
        : "Our core services are [service 1], [service 2].",
      nicheValues.length > 0
        ? `Our main niche is ${nicheValues.join(", ")}.`
        : "Our target niche is [industry].",
      "Keep the response specific to your agency.",
    ];
  }

  if (module === "positioning") {
    return [
      serviceValues.length > 0
        ? `Our highest-margin offer is ${serviceValues[0]}.`
        : "Our highest-margin offer is [offer name].",
      nicheValues.length > 0
        ? `We serve ${nicheValues.join(", ")} clients.`
        : "We serve [target industry] clients.",
      "Our offer is outcome-focused and measurable.",
      "The differentiation is based on delivery quality and speed.",
    ];
  }

  if (module === "voice") {
    return [
      voiceValues.length > 0
        ? `Our brand voice is ${voiceValues.join(", ")}.`
        : "Our brand voice is [tone traits].",
      "Use concise, confident language.",
      "Avoid vague claims and keep examples concrete.",
      "Match tone to the target audience context.",
    ];
  }

  if (module === "operations") {
    return [
      pillarValues.length > 0
        ? `Our key content pillars are ${pillarValues.join(", ")}.`
        : "Our key content pillars are [pillar 1], [pillar 2], [pillar 3].",
      "Escalate compliance-sensitive topics to a human.",
      "Use a clear review and approval boundary.",
      "Tie output quality to concrete acceptance criteria.",
    ];
  }

  return [
    "Set the assistant name you want clients to see.",
    "Pick 3 tone traits that fit your brand.",
    "List top expertise areas the assistant should emphasize.",
    "Keep persona traits specific and consistent.",
  ];
}

export function resolveSnapshotValue(
  snapshot: Record<string, unknown>,
  module: string,
  fieldPath: string
) {
  const key = fieldPath.includes(".") ? fieldPath : `${module}.${fieldPath}`;
  const aliases = PATH_ALIASES[key] ?? [key];
  for (const alias of aliases) {
    const value = getPathValue(snapshot, alias);
    if (isPopulated(value)) return value;
  }
  return undefined;
}

export function mergeDraftSnapshot(
  current: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown> | null | undefined
) {
  if (!current && !patch) return {};
  if (!patch) return cloneRecord((current ?? {}) as Record<string, unknown>);
  return deepMerge((current ?? {}) as Record<string, unknown>, patch);
}

export function applyCalibrationInput(
  snapshot: Record<string, unknown>,
  module: string,
  fieldPath: string,
  userInput: string
) {
  const trimmed = userInput.trim();
  if (!trimmed) return snapshot;

  const key = fieldPath.includes(".") ? fieldPath : `${module}.${fieldPath}`;
  const alias = (PATH_ALIASES[key] ?? [key])[0];
  const listLike = [
    "services",
    "target_industries",
    "core_offers",
    "links",
    "team_roles",
    "client_types",
    "differentiators",
    "proof",
    "competitors",
    "price_ranges",
    "add_ons",
    "guarantees",
    "content_pillars",
    "boundaries",
    "tools_stack",
    "platforms",
    "required_assets",
    "voice_attributes",
    "faqs",
    "traits",
  ];
  const leaf = alias.split(".").at(-1) ?? "";
  const value = listLike.includes(leaf) ? splitToList(trimmed) : trimmed;
  const next = cloneRecord(snapshot);
  setPathValue(next, alias, value);
  return next;
}

export function evaluateOnboardingProgress(snapshot: Record<string, unknown>): OnboardingProgress {
  const missingByModule = {
    bootstrap: [] as string[],
    positioning: [] as string[],
    offer_stack: [] as string[],
    operations: [] as string[],
    ai_persona: [] as string[],
    rep_policy: [] as string[],
    voice: [] as string[],
    persona: [] as string[],
  };

  for (const moduleSpec of ONBOARDING_MODULE_SPECS) {
    for (const path of moduleSpec.requiredPaths) {
      const value = resolveSnapshotValue(snapshot, moduleSpec.key, path);
      if (!isPopulated(value)) {
        missingByModule[moduleSpec.key].push(path);
      }
    }
  }

  const completedModules: OnboardingModuleKey[] = ONBOARDING_MODULE_SPECS
    .filter((moduleSpec) => missingByModule[moduleSpec.key].length === 0)
    .map((moduleSpec) => moduleSpec.key);

  const firstIncompleteRequired = ONBOARDING_MODULE_SPECS.find(
    (moduleSpec) => moduleSpec.required && missingByModule[moduleSpec.key].length > 0
  );

  const requiredComplete = ONBOARDING_MODULE_SPECS
    .filter((moduleSpec) => moduleSpec.required)
    .every((moduleSpec) => missingByModule[moduleSpec.key].length === 0);

  return {
    currentModule: firstIncompleteRequired?.key ?? "persona",
    requiredComplete,
    completedModules,
    missingByModule,
  };
}

export function normalizeOnboardingSuggestions(opts: {
  rawSuggestions?: unknown[];
  module: OnboardingModuleKey;
  fieldPath?: string | null;
  snapshot: Record<string, unknown>;
}) {
  const knownTokens = buildKnownTokenSet(opts.snapshot);
  const filteredRaw = (opts.rawSuggestions ?? [])
    .map(normalizeSuggestionValue)
    .filter((value): value is string => Boolean(value))
    .filter((value) => keepSuggestionBySnapshot(value, knownTokens));

  const fallback = opts.fieldPath
    ? fieldFallbackSuggestions(opts.module, opts.fieldPath, opts.snapshot)
    : moduleFallbackSuggestions(opts.module, opts.snapshot);
  const merged = [...filteredRaw, ...fallback].map((value) => value.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const value of merged) {
    if (!unique.includes(value)) unique.push(value);
  }

  if (unique.length >= 4) return unique.slice(0, 4);
  if (unique.length >= 3) return unique.slice(0, 3);

  const minimal = [...unique];
  while (minimal.length < 3) {
    minimal.push("Please share one concrete detail for this step.");
  }
  return minimal.slice(0, 3);
}

function fieldFallbackSuggestions(
  module: OnboardingModuleKey,
  fieldPath: string,
  snapshot: Record<string, unknown>
): string[] {
  const leaf = fieldPath.split(".").at(-1) ?? fieldPath;
  const agencyName = getFirstString(snapshot, "bootstrap.agency_name");
  const services = getFirstList(snapshot, "bootstrap.services");
  const industries = getFirstList(snapshot, "bootstrap.target_industries");
  const voice = getFirstList(snapshot, "tone_voice.voice_attributes");
  const pillars = getFirstList(snapshot, "sop_strategy.content_pillars");
  const personaName = getFirstString(snapshot, "persona.assistant_name");
  const personaTone = getFirstList(snapshot, "persona.tone_traits");
  const personaExpertise = getFirstList(snapshot, "persona.expertise_traits");

  if (module === "bootstrap" && leaf === "agency_name") {
    return [
      agencyName ? `Our agency name is ${agencyName}.` : "Our agency name is [agency name].",
      "We are called [agency name].",
      "The agency brand is [agency name].",
      "Use our official agency name.",
    ];
  }

  if (module === "bootstrap" && leaf === "services") {
    return [
      services.length > 0 ? `Our core services are ${services.join(", ")}.` : "Our core services are [service 1], [service 2].",
      "We provide [service] for clients.",
      "Primary services include [service].",
      "We focus on [service].",
    ];
  }

  if (module === "bootstrap" && leaf === "target_industries") {
    return [
      industries.length > 0 ? `We serve ${industries.join(", ")} clients.` : "We serve [industry] clients.",
      "Our target niche is [industry].",
      "We focus on [industry] businesses.",
      "Primary niches: [industry].",
    ];
  }

  if (module === "positioning" && leaf === "core_offers") {
    return [
      "Our highest-margin offer is [offer name].",
      "Our flagship offer is [offer name].",
      "Our core offer is [offer name].",
      "Our best-selling package is [offer name].",
    ];
  }

  if (module === "positioning" && leaf === "target_industries") {
    return [
      industries.length > 0 ? `We serve ${industries.join(", ")} clients.` : "We serve [industry] clients.",
      "Our main niche is [industry].",
      "We focus on [industry] companies.",
      "We specialize in [industry].",
    ];
  }

  if (module === "voice" && leaf === "voice_attributes") {
    return [
      voice.length > 0 ? `Our brand voice is ${voice.join(", ")}.` : "Our brand voice is [tone traits].",
      "Use concise, confident language.",
      "Avoid vague claims and keep examples concrete.",
      "Match tone to the target audience context.",
    ];
  }

  if (module === "operations" && leaf === "content_pillars") {
    return [
      pillars.length > 0 ? `Our key content pillars are ${pillars.join(", ")}.` : "Our key content pillars are [pillar 1], [pillar 2], [pillar 3].",
      "Content pillars include [pillar] and [pillar].",
      "We focus content on [pillar].",
      "Our content themes are [pillar].",
    ];
  }

  if (module === "operations" && leaf === "boundaries") {
    return [
      "We avoid legal, medical, or financial claims.",
      "No guarantees of results.",
      "Escalate compliance-sensitive topics to a human.",
      "Do not mention confidential client data.",
    ];
  }

  if (module === "persona" && leaf === "assistant_name") {
    return [
      personaName ? `Call the assistant ${personaName}.` : "Call the assistant [assistant name].",
      "Use the assistant name [assistant name].",
      "Assistant name: [assistant name].",
      "Keep the assistant name friendly and short.",
    ];
  }

  if (module === "persona" && leaf === "tone_traits") {
    return [
      personaTone.length > 0 ? `Tone traits: ${personaTone.join(", ")}.` : "Tone traits: [trait 1], [trait 2], [trait 3].",
      "Use a calm, confident, helpful tone.",
      "Tone traits include [trait].",
      "Keep tone consistent and specific.",
    ];
  }

  if (module === "persona" && leaf === "expertise_traits") {
    return [
      personaExpertise.length > 0
        ? `Expertise traits: ${personaExpertise.join(", ")}.`
        : "Expertise traits: [expertise 1], [expertise 2].",
      "Focus on expertise in [domain].",
      "Prioritize [domain] knowledge.",
      "Expertise should match our target niche.",
    ];
  }

  return moduleFallbackSuggestions(module, snapshot);
}

export function personalizeCalibrationQuestion(
  question: string,
  snapshot: Record<string, unknown>
) {
  const agencyName = getFirstString(snapshot, "bootstrap.agency_name");
  const nicheList = getFirstList(snapshot, "bootstrap.target_industries");
  let nextQuestion = question.trim();
  if (!nextQuestion) {
    nextQuestion = "Please share the missing detail so I can continue onboarding.";
  }
  if (agencyName) {
    nextQuestion = nextQuestion.replace(/your agency/gi, agencyName);
  }
  if (nicheList.length > 0 && !nextQuestion.toLowerCase().includes("niche")) {
    nextQuestion = `${nextQuestion} For context, I have niche data for ${nicheList.join(", ")}.`;
  }
  return nextQuestion;
}

export function buildUnknownTurnPayload(opts: {
  reason: string;
  snapshot: Record<string, unknown>;
  module: OnboardingModuleKey;
}) {
  return {
    assistant_message: "UNKNOWN. I need one more concrete detail before we continue.",
    expects: "text",
    suggestions: normalizeOnboardingSuggestions({
      module: opts.module,
      snapshot: opts.snapshot,
    }),
    unknown: true,
    unknown_reason: opts.reason,
    brain_snapshot: opts.snapshot,
    state: {
      module: opts.module,
      resolver_state: "unknown",
    },
  };
}
