export type StrategyGovernanceTextSection = {
  surface: string;
  text: string;
};

export type StrategyGovernanceTextExtraction = {
  text: string;
  sections: StrategyGovernanceTextSection[];
};

type StrategyOutputLike = {
  modules?: Record<string, any> | null;
  document?: {
    markdown?: unknown;
  } | null;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function pushSection(sections: StrategyGovernanceTextSection[], surface: string, values: unknown[]) {
  const text = values.map(cleanText).filter(Boolean).join("\n");
  if (!text) return;
  sections.push({ surface, text });
}

function recordValues(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).map(cleanText).filter(Boolean);
}

export function extractStrategyGovernanceText(output: StrategyOutputLike): StrategyGovernanceTextExtraction {
  const sections: StrategyGovernanceTextSection[] = [];
  const modules = output?.modules ?? {};
  const positioning = modules.positioning ?? {};
  const pillars = modules.pillars ?? {};
  const campaignPlan = modules.campaign_plan ?? {};
  const channelAdaptations = modules.channel_adaptations ?? {};
  const rulesConstraints = modules.rules_constraints ?? {};

  pushSection(sections, "document.markdown", [output?.document?.markdown]);

  pushSection(sections, "modules.positioning", [
    positioning.finalSentence,
    ...(Array.isArray(positioning.proofPoints) ? positioning.proofPoints.map((point: any) => point?.claim) : []),
    ...(Array.isArray(positioning.differentiators)
      ? positioning.differentiators.map((differentiator: any) => differentiator?.approvedPhrasing)
      : []),
  ]);

  pushSection(sections, "modules.pillars", [
    ...(Array.isArray(pillars.pillars) ? pillars.pillars.map((pillar: any) => pillar?.coreMessage) : []),
  ]);

  pushSection(sections, "modules.campaign_plan", [
    ...(Array.isArray(campaignPlan.campaigns)
      ? campaignPlan.campaigns.flatMap((campaign: any) => [campaign?.name, campaign?.cta, campaign?.angle])
      : []),
  ]);

  pushSection(sections, "modules.channel_adaptations", [
    ...(Array.isArray(channelAdaptations.translationTable)
      ? channelAdaptations.translationTable.flatMap((row: any) => [row?.coreMessage, ...recordValues(row?.variants)])
      : []),
    ...(Array.isArray(channelAdaptations.channels)
      ? channelAdaptations.channels.flatMap((channel: any) => (Array.isArray(channel?.dos) ? channel.dos : []))
      : []),
  ]);

  pushSection(sections, "modules.rules_constraints", [
    ...(Array.isArray(rulesConstraints.claimsPolicy) ? rulesConstraints.claimsPolicy.map((claim: any) => claim?.claim) : []),
  ]);

  return {
    text: sections.map((section) => `[${section.surface}]\n${section.text}`).join("\n\n"),
    sections,
  };
}
