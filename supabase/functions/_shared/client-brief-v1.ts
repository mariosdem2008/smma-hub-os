export type ClientBriefV1 = {
  positioning: string;
  offers: { core: string; supporting: string[] };
  audience: { primary: string; pains: string[]; desires: string[] };
  pillars: string[];
  tone_rules: { do: string[]; dont: string[] };
  cta_styles: string[];
  taboo_topics: string[];
};

function splitToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => item.toString()).map((item) => item.trim()).filter(Boolean);
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

function ensureMinList(values: string[], min: number, fallbackPool: string[]) {
  const out = [...values];
  for (const item of fallbackPool) {
    if (out.length >= min) break;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function pickCtas(goals: string[], provided: string[]) {
  const base = clampList(provided, 0, 3);
  if (base.length > 0) return base.slice(0, 3);

  const normalized = goals.map((g) => g.toLowerCase());
  if (normalized.some((g) => g.includes("lead") || g.includes("sales") || g.includes("conversion"))) {
    return ["Book a call", "Get a quote", "DM us"];
  }
  if (normalized.some((g) => g.includes("awareness") || g.includes("reach"))) {
    return ["Follow for updates", "Learn more", "Share this"];
  }
  return ["Learn more", "DM us", "Subscribe"];
}

function toneRulesFromTraits(traits: string[]) {
  const normalized = traits.map((t) => t.toLowerCase());
  const doRules: string[] = [];
  const dontRules: string[] = [];

  if (normalized.includes("professional")) doRules.push("Use clear, professional language");
  if (normalized.includes("friendly")) doRules.push("Write in a warm, approachable voice");
  if (normalized.includes("authoritative")) doRules.push("Back claims with specifics and examples");
  if (normalized.includes("educational")) doRules.push("Teach with simple frameworks and step-by-step tips");
  if (normalized.includes("empathetic")) doRules.push("Acknowledge audience pain points before offering solutions");
  if (normalized.includes("bold")) doRules.push("Lead with confident, direct hooks");
  if (normalized.includes("playful")) doRules.push("Use light humor where appropriate");

  dontRules.push("Don't invent facts or results");
  dontRules.push("Don't use absolute guarantees");

  return {
    do: clampList(doRules, 1, 6, ["Keep messaging clear and consistent"]),
    dont: clampList(dontRules, 2, 6),
  };
}

export function buildClientBriefV1FromV3Answers(rawResponses: Record<string, unknown>): ClientBriefV1 {
  const brand = ((rawResponses.brand as string) ?? "").trim();
  const offersList = splitToList(rawResponses.offers);
  const coreOffer = offersList[0] ?? "";
  const supportingOffers = offersList.slice(1);

  const audienceList = splitToList(rawResponses.audience);
  const primaryAudience = audienceList[0] ?? "";
  const pains = clampList(audienceList, 0, 6);
  const desires = clampList(splitToList(rawResponses.goals), 0, 6);

  const explicitPillars = splitToList(rawResponses.pillars);
  const fallbackPillars = uniq([
    ...splitToList(rawResponses.offers),
    ...splitToList(rawResponses.differentiators),
  ]);
  const pillarSeed = clampList(explicitPillars, 0, 6, fallbackPillars);
  const pillars = ensureMinList(pillarSeed, 3, [
    ...fallbackPillars,
    "Education",
    "Proof",
    "Stories",
    "Behind-the-scenes",
    "Tips",
    "FAQs",
  ]).slice(0, 6);

  const tabooTopics = clampList(
    uniq([
      ...splitToList(rawResponses.banned_claims),
      ...splitToList(rawResponses.taboo_topics),
      ...splitToList(rawResponses.constraints),
    ]).filter((entry) => entry !== "none"),
    1,
    12,
    ["none"],
  );

  const goals = splitToList(rawResponses.goals);
  const ctaStyles = pickCtas(goals, splitToList(rawResponses.cta_styles));

  const toneTraits = splitToList(rawResponses.tone);
  const tone_rules = toneRulesFromTraits(toneTraits);

  const positioningParts = [
    brand ? `${brand}` : "This client",
    coreOffer ? `offers ${coreOffer}` : null,
    primaryAudience ? `for ${primaryAudience}` : null,
  ].filter(Boolean);

  return {
    positioning: positioningParts.join(" ") || "Positioning not provided",
    offers: { core: coreOffer, supporting: supportingOffers },
    audience: { primary: primaryAudience, pains, desires },
    pillars,
    tone_rules,
    cta_styles: ctaStyles,
    taboo_topics: tabooTopics,
  };
}
