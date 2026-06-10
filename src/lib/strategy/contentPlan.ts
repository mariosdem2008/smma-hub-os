import type {
  Campaign,
  CampaignPlanContent,
  ChannelAdaptationsContent,
  ChannelConfig,
  Pillar,
  PillarsContent,
  RulesConstraintsContent,
  StrategyModule,
} from "./types";

export type ContentPlanStatus = "planned";
export type ContentBriefStatus = "draft";

export interface ContentPlanItemDraft {
  dedupeKey: string;
  weekIndex: number;
  sequenceIndex: number;
  windowStart: string;
  windowEnd: string;
  scheduledFor: string;
  pillarId: string;
  pillarName: string;
  pillarCoveragePercent: number;
  channel: string;
  calendarPlatform: string | null;
  contentType: string;
  workingTitle: string;
  hook: string;
  cta: string;
  status: ContentPlanStatus;
  campaignId: string | null;
  campaignName: string | null;
  sourceModules: StrategyModule[];
}

export interface ContentBriefDraft {
  briefKey: string;
  planItemDedupeKey: string;
  angle: string;
  keyMessage: string;
  proofToUse: string;
  formatSpec: string;
  dos: string[];
  donts: string[];
  status: ContentBriefStatus;
}

export interface StrategyExecutionBridgeDraft {
  planItems: ContentPlanItemDraft[];
  contentBriefs: ContentBriefDraft[];
}

interface BuildStrategyExecutionBridgeDraftArgs {
  modules: Partial<{
    pillars: PillarsContent;
    campaign_plan: CampaignPlanContent;
    channel_adaptations: ChannelAdaptationsContent;
    rules_constraints: RulesConstraintsContent;
  }>;
  startDate?: Date | string;
  weeks?: number;
  itemsPerWeek?: number;
  briefWeeks?: number;
}

interface AllocatedPillar {
  pillar: Pillar;
  targetCount: number;
  usedCount: number;
  sourceIndex: number;
}

const DEFAULT_CONTENT_TYPES = ["Short-form video", "Carousel", "Story"];
const SUPPORTED_CALENDAR_PLATFORMS = new Set(["instagram", "facebook", "linkedin", "tiktok", "youtube"]);
const SLOT_WEEKDAYS = [1, 3, 5, 2, 4, 6, 0];
const SLOT_HOURS_UTC = [15, 16, 14, 17, 13, 18, 12];

function compactStrings(values: Array<unknown>, limit = 12): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(input: Date | string | undefined): Date {
  const raw = input ? new Date(input) : new Date();
  return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function normalizeCalendarPlatform(platform: string | undefined): string | null {
  if (!platform) return null;
  const normalized = platform.toLowerCase().trim();
  if (SUPPORTED_CALENDAR_PLATFORMS.has(normalized)) return normalized;
  if (normalized === "youtube_shorts") return "youtube";
  return null;
}

function fallbackPillar(): Pillar {
  return {
    id: "pillar-1",
    name: "Authority",
    coveragePercent: 100,
    purpose: "authority",
    coreMessage: "Build trust with practical expertise.",
    contentTypes: DEFAULT_CONTENT_TYPES,
    bannedAngles: [],
    kpis: ["Reach", "Leads"],
    examples: [],
  };
}

function getPillars(pillarsContent: PillarsContent | undefined): Pillar[] {
  const pillars = (pillarsContent?.pillars ?? []).filter((pillar) => pillar.id && pillar.name);
  return pillars.length ? pillars : [fallbackPillar()];
}

function allocatePillarCounts(pillars: Pillar[], totalItems: number): AllocatedPillar[] {
  const rawTotal = pillars.reduce((sum, pillar) => sum + Math.max(0, Number(pillar.coveragePercent) || 0), 0);
  const weighted = pillars.map((pillar, sourceIndex) => {
    const weight = rawTotal > 0 ? Math.max(0, Number(pillar.coveragePercent) || 0) / rawTotal : 1 / pillars.length;
    const exact = weight * totalItems;
    return {
      pillar,
      sourceIndex,
      exact,
      targetCount: Math.floor(exact),
      usedCount: 0,
    };
  });

  let assigned = weighted.reduce((sum, row) => sum + row.targetCount, 0);
  for (const row of [...weighted].sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.sourceIndex - b.sourceIndex)) {
    if (assigned >= totalItems) break;
    row.targetCount += 1;
    assigned += 1;
  }

  for (const row of [...weighted].sort((a, b) => (a.exact % 1) - (b.exact % 1) || b.sourceIndex - a.sourceIndex)) {
    if (assigned <= totalItems) break;
    if (row.targetCount === 0) continue;
    row.targetCount -= 1;
    assigned -= 1;
  }

  return weighted;
}

function pickNextPillar(allocations: AllocatedPillar[]): Pillar {
  const available = allocations.filter((row) => row.usedCount < row.targetCount);
  const pool = available.length ? available : allocations;
  const selected = [...pool].sort((a, b) => {
    const aRatio = a.targetCount > 0 ? a.usedCount / a.targetCount : Number.POSITIVE_INFINITY;
    const bRatio = b.targetCount > 0 ? b.usedCount / b.targetCount : Number.POSITIVE_INFINITY;
    return aRatio - bRatio || a.sourceIndex - b.sourceIndex;
  })[0];
  selected.usedCount += 1;
  return selected.pillar;
}

function getEnabledChannels(channelContent: ChannelAdaptationsContent | undefined): ChannelConfig[] {
  const enabled = (channelContent?.channels ?? []).filter((channel) => channel.enabled);
  if (enabled.length) return enabled;
  const channels = channelContent?.channels ?? [];
  if (channels.length) return channels.slice(0, 1);
  return [
    {
      id: "instagram",
      platform: "instagram",
      enabled: true,
      role: "Primary distribution channel.",
      formats: DEFAULT_CONTENT_TYPES,
      hookRules: [],
      ctaRules: [],
      visualRules: [],
      cadence: "3x/week",
      dos: [],
      donts: [],
      examples: [],
    },
  ];
}

function getApprovedCtas(campaigns: Campaign[], channels: ChannelConfig[]): string[] {
  return compactStrings([
    ...campaigns.map((campaign) => campaign.cta),
    ...channels.flatMap((channel) => channel.ctaRules ?? []),
  ], 16);
}

function pickCampaign(campaigns: Campaign[], pillarId: string, slot: number): Campaign | null {
  if (!campaigns.length) return null;
  const matching = campaigns.filter((campaign) => (campaign.pillarIds ?? []).includes(pillarId));
  const pool = matching.length ? matching : campaigns;
  return pool[slot % pool.length] ?? null;
}

function buildScheduledFor(windowStart: Date, sequenceIndex: number): string {
  const weekday = SLOT_WEEKDAYS[(sequenceIndex - 1) % SLOT_WEEKDAYS.length];
  const hour = SLOT_HOURS_UTC[(sequenceIndex - 1) % SLOT_HOURS_UTC.length];
  const scheduled = addDays(windowStart, weekday);
  scheduled.setUTCHours(hour, 0, 0, 0);
  return scheduled.toISOString();
}

function pickContentType(pillar: Pillar, channel: ChannelConfig, slot: number): string {
  const types = compactStrings([...(pillar.contentTypes ?? []), ...(channel.formats ?? []), ...DEFAULT_CONTENT_TYPES]);
  return types[slot % types.length] ?? DEFAULT_CONTENT_TYPES[0];
}

function buildHook(pillar: Pillar, channel: ChannelConfig, campaign: Campaign | null, slot: number): string {
  const hookRule = compactStrings(channel.hookRules ?? [])[slot % Math.max(1, compactStrings(channel.hookRules ?? []).length)];
  if (hookRule) return `${hookRule}: ${pillar.name}`;
  if (campaign?.angle) return `${campaign.angle}: ${pillar.name}`;
  return `${pillar.name}: ${pillar.coreMessage}`;
}

function findProofForPillar(pillarsContent: PillarsContent | undefined, pillarId: string): string {
  const proof = (pillarsContent?.proofInventory ?? []).find((item) => (item.pillarIds ?? []).includes(pillarId));
  return proof?.title || proof?.url || "Use approved proof inventory for this pillar.";
}

export function buildStrategyExecutionBridgeDraft({
  modules,
  startDate,
  weeks = 12,
  itemsPerWeek = 3,
  briefWeeks = 3,
}: BuildStrategyExecutionBridgeDraftArgs): StrategyExecutionBridgeDraft {
  const safeWeeks = Math.max(1, Math.min(13, Math.floor(weeks)));
  const safeItemsPerWeek = Math.max(1, Math.min(7, Math.floor(itemsPerWeek)));
  const totalItems = safeWeeks * safeItemsPerWeek;
  const start = startOfUtcDay(startDate);
  const pillars = getPillars(modules.pillars);
  const campaigns = modules.campaign_plan?.campaigns ?? [];
  const channels = getEnabledChannels(modules.channel_adaptations);
  const ctas = getApprovedCtas(campaigns, channels);
  const fallbackCta = ctas[0] ?? "";
  const allocations = allocatePillarCounts(pillars, totalItems);
  const planItems: ContentPlanItemDraft[] = [];

  for (let weekIndex = 1; weekIndex <= safeWeeks; weekIndex += 1) {
    const windowStart = addDays(start, (weekIndex - 1) * 7);
    const windowEnd = addDays(windowStart, 6);

    for (let sequenceIndex = 1; sequenceIndex <= safeItemsPerWeek; sequenceIndex += 1) {
      const globalIndex = (weekIndex - 1) * safeItemsPerWeek + (sequenceIndex - 1);
      const pillar = pickNextPillar(allocations);
      const channel = channels[globalIndex % channels.length];
      const campaign = pickCampaign(campaigns, pillar.id, globalIndex);
      const contentType = pickContentType(pillar, channel, globalIndex);
      const cta = ctas[globalIndex % Math.max(1, ctas.length)] ?? fallbackCta;
      const hook = buildHook(pillar, channel, campaign, globalIndex);
      const workingTitle = compactStrings([
        `${pillar.name}: ${campaign?.name ?? pillar.coreMessage}`,
        `${contentType} for ${pillar.name}`,
      ])[0];
      const dedupeKey = `week-${String(weekIndex).padStart(2, "0")}:slot-${String(sequenceIndex).padStart(2, "0")}`;

      planItems.push({
        dedupeKey,
        weekIndex,
        sequenceIndex,
        windowStart: toDateOnly(windowStart),
        windowEnd: toDateOnly(windowEnd),
        scheduledFor: buildScheduledFor(windowStart, sequenceIndex),
        pillarId: pillar.id,
        pillarName: pillar.name,
        pillarCoveragePercent: Math.max(0, Number(pillar.coveragePercent) || 0),
        channel: channel.platform,
        calendarPlatform: normalizeCalendarPlatform(channel.platform),
        contentType,
        workingTitle,
        hook,
        cta,
        status: "planned",
        campaignId: campaign?.id ?? null,
        campaignName: campaign?.name ?? null,
        sourceModules: ["pillars", "campaign_plan", "channel_adaptations", "rules_constraints"],
      });
    }
  }

  const rules = modules.rules_constraints;
  const ruleDos = compactStrings([
    ...(rules?.claimsPolicy ?? [])
      .filter((claim) => claim.status === "allowed" || claim.status === "proof_required")
      .map((claim) => claim.status === "proof_required" ? `Use proof for: ${claim.claim}` : claim.claim),
    ...(rules?.requiredDisclaimers ?? []).map((item) => `Include disclaimer: ${item}`),
  ], 6);
  const ruleDonts = compactStrings([
    ...(rules?.bannedWords ?? []),
    ...(rules?.claimsPolicy ?? []).filter((claim) => claim.status === "forbidden").map((claim) => claim.claim),
    ...(rules?.approvalTriggers ?? []).map((trigger) => `Do not bypass approval trigger: ${trigger.condition}`),
  ], 8);

  const contentBriefs = planItems
    .filter((item) => item.weekIndex <= briefWeeks)
    .map((item): ContentBriefDraft => {
      const pillar = pillars.find((candidate) => candidate.id === item.pillarId) ?? pillars[0];
      const channel = channels.find((candidate) => candidate.platform === item.channel) ?? channels[0];
      const campaign = campaigns.find((candidate) => candidate.id === item.campaignId) ?? null;
      return {
        briefKey: `brief:${item.dedupeKey}`,
        planItemDedupeKey: item.dedupeKey,
        angle: campaign?.angle || `${pillar.purpose} angle for ${pillar.name}`,
        keyMessage: pillar.coreMessage,
        proofToUse: findProofForPillar(modules.pillars, pillar.id),
        formatSpec: compactStrings([
          `${item.contentType} on ${item.channel}`,
          ...(channel.visualRules ?? []),
          ...(channel.formats ?? []),
        ], 4).join(" | "),
        dos: compactStrings([...(channel.dos ?? []), ...ruleDos], 8),
        donts: compactStrings([...(channel.donts ?? []), ...(pillar.bannedAngles ?? []), ...ruleDonts], 10),
        status: "draft",
      };
    });

  return { planItems, contentBriefs };
}

export function summarizePillarCoverage(planItems: ContentPlanItemDraft[]): Record<string, number> {
  return planItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.pillarId] = (counts[item.pillarId] ?? 0) + 1;
    return counts;
  }, {});
}
