import { buildClientBriefV1FromV3Answers, type ClientBriefV1 } from "./client-brief-v1.ts";

function splitToList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => item.toString()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clampList(values: string[], min: number, max: number, fallbacks: string[] = []) {
  const unique = uniq(values);
  const filled = unique.length >= min ? unique : uniq([...unique, ...fallbacks]);
  return filled.slice(0, max);
}

function splitToListNormalized(value: unknown) {
  return splitToList(value).map((item) => item.trim()).filter(Boolean);
}

function ensureMinList(values: string[], min: number, fallbackPool: string[]) {
  const out = [...values];
  for (const item of fallbackPool) {
    if (out.length >= min) break;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

export function mapV3AnswersToClientBrain(
  rawResponses: Record<string, unknown>,
  followupResponses: Record<string, unknown> = {},
  generatedAt: string = new Date().toISOString(),
) {
  const explicitBannedClaims = splitToListNormalized(rawResponses.banned_claims);
  const explicitTabooTopics = splitToListNormalized(rawResponses.taboo_topics);

  const constraints = splitToListNormalized(rawResponses.constraints);
  const filteredConstraints = constraints.filter((entry) => entry !== "none");
  const bannedClaims =
    explicitBannedClaims.length > 0
      ? explicitBannedClaims
      : filteredConstraints.length > 0
        ? filteredConstraints
        : ["No specific content restrictions"];

  const offersList = splitToListNormalized(rawResponses.offers);
  const differentiatorsList = splitToListNormalized(rawResponses.differentiators);

  const explicitPillarNames = splitToListNormalized(rawResponses.pillars);
  const fallbackPillarNames = uniq([
    ...offersList,
    ...differentiatorsList,
  ]).slice(0, 6);
  const pillarSeed = clampList(explicitPillarNames, 0, 6, fallbackPillarNames);
  const pillarNames = ensureMinList(pillarSeed, 3, [
    ...fallbackPillarNames,
    "Education",
    "Proof",
    "Stories",
    "Behind-the-scenes",
    "Tips",
    "FAQs",
  ]).slice(0, 6);

  const bannedClaimsOrTabooTopics = uniq([...bannedClaims, ...explicitTabooTopics]);
  const nonEmptyBannedClaimsOrTabooTopics =
    bannedClaimsOrTabooTopics.length > 0 ? bannedClaimsOrTabooTopics : ["none"];

  const goalsList = splitToListNormalized(rawResponses.goals);
  const audienceList = splitToListNormalized(rawResponses.audience);
  const clientBriefBase = buildClientBriefV1FromV3Answers(rawResponses);
  const clientBrief: ClientBriefV1 = {
    ...clientBriefBase,
    pillars: pillarNames,
    taboo_topics: nonEmptyBannedClaimsOrTabooTopics,
  };

  return {
    brand_basics: {
      name: (rawResponses.brand as string) ?? "",
      website: (rawResponses.website as string) ?? "",
      socials: splitToListNormalized(rawResponses.platforms),
      tone: Array.isArray(rawResponses.tone)
        ? (rawResponses.tone as string[]).join(", ")
        : (rawResponses.tone as string) ?? "",
      differentiators: differentiatorsList,
    },
    offer_details: {
      products_services: offersList,
      pricing_optional: (rawResponses.pricing as string) ?? "",
      usps: splitToListNormalized(rawResponses.cta_styles),
    },
    audience: {
      demographics: audienceList,
      location: [],
      intent: [],
      problems: audienceList,
      objections: [],
    },
    competitors: splitToListNormalized(rawResponses.competitors),
    constraints: {
      banned_claims: bannedClaims,
      legal_constraints: [],
      taboo_topics: explicitTabooTopics,
      banned_claims_or_taboo_topics: nonEmptyBannedClaimsOrTabooTopics,
      dos: [],
      donts: [],
    },
    pillars: pillarNames.map((name) => ({ name, examples: [] })),
    client_brief_v1: clientBrief,
    faq: [],
    assets_links: {
      key_urls: [...splitToList(rawResponses.assets), ...splitToList(rawResponses.assets_upload)],
      guidelines_link: "",
      lead_magnet_optional: (rawResponses.lead_magnet as string) ?? "",
    },
    goals: goalsList,
    metrics: splitToListNormalized(rawResponses.kpis),
    timeline: (rawResponses.timeline as string) ?? "",
    approvals: (rawResponses.approval_cadence as string) ?? "",
    contacts: splitToListNormalized(rawResponses.approver_contact),
    raw_responses: rawResponses,
    followup_responses: followupResponses,
    inference_metadata: {
      source: "onboarding_v3",
      generated_at: generatedAt,
    },
  };
}
