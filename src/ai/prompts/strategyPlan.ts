import type { ChatMessage } from "../providers/types.ts";

type PromptArgs = {
  agencyBrain: Record<string, unknown>;
  clientBrain: Record<string, unknown>;
  context: string;
  instruction?: string;
};

export function buildStrategyPlanPrompt(args: PromptArgs): ChatMessage[] {
  const systemPrompt =
    "You are a strategy assistant. Use only the provided brains and context. If critical info is missing, make conservative assumptions and list them. Never output markdown outside the `document.markdown` field.";
  const instruction = args.instruction?.trim()
    ? `\n\nInstruction:\n${args.instruction.trim()}`
    : "";

  const schemaGuide = `Return STRICT JSON only (no code fences) with EXACT keys and types.
Top-level:
{
  "modules": {
    "positioning": PositioningModule,
    "pillars": PillarsModule,
    "campaign_plan": CampaignPlanModule,
    "weekly_plan": WeeklyPlanModule,
    "channel_adaptations": ChannelAdaptationsModule,
    "rules_constraints": RulesConstraintsModule
  },
  "document": { "markdown": string },
  "decisions"?: Decision[],
  "tasks"?: Task[]
}

Evidence fields REQUIRED inside EVERY module:
- "facts_used": string[]
- "assumptions": string[]
- "open_questions": string[] (max 5)
- "confidence_0_100": number (0-100)

PositioningModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "sentence": { "target": string, "category": string, "differentiator": string, "benefit": string },
  "finalSentence": string,
  "proofPoints": { "id": string, "claim": string, "evidence": string, "confidence": 1|2|3|4|5 }[],
  "differentiators": { "id": string, "rank": number, "approvedPhrasing": string, "bannedPhrasing": string[] }[],
  "boundaries": { "allowedPromises": string[], "riskyPromises": string[], "forbiddenPromises": string[] },
  "decisions": { "sentenceLocked": boolean, "differentiatorsLocked": boolean },
  (evidence fields...)
}

PillarsModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "pillars": {
    "id": string,
    "name": string,
    "coveragePercent": number (0-100),
    "purpose": "reach"|"authority"|"leads"|"proof",
    "coreMessage": string,
    "contentTypes": string[],
    "bannedAngles": string[],
    "kpis": string[],
    "examples": string[]
  }[],
  "proofInventory": { "id": string, "title": string, "pillarIds": string[], "url"?: string }[],
  "decisions": { "pillarNamesLocked": boolean, "coverageLocked": boolean, "bannedAnglesLocked": boolean },
  (evidence fields...)
}

CampaignPlanModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "selectedMonth": string,
  "campaigns": {
    "id": string,
    "name": string,
    "goal": string,
    "offer": string,
    "cta": string,
    "icp": string,
    "pillarIds": string[],
    "angle": string,
    "assets": { "name": string, "completed": boolean }[],
    "kpiTargets": { [kpi: string]: number },
    "startDate": string (YYYY-MM-DD),
    "endDate": string (YYYY-MM-DD),
    "status": "planned"|"active"|"completed"|"cancelled"
  }[],
  "stopDoing": string[],
  "decisions": { "monthlyOffersLocked": boolean, "activeCampaignsLocked": boolean },
  (evidence fields...)
}

WeeklyPlanModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "selectedWeek": string,
  "weeklyFocus": { "objective": string, "primaryCampaignId": string, "priorityPillarIds": string[], "kpiFocus": string[] },
  "cadenceMatrix": { [platform: string]: number },
  "productionChecklist": { "id": string, "type": "script"|"shoot"|"edit"|"approval", "title": string, "owner": string, "dueDate": string (YYYY-MM-DD), "completed": boolean }[],
  "weeklyReview": { "wins": string[], "losses": string[], "changesNextWeek": string[] },
  "decisions": { "objectiveLocked": boolean, "cadenceLocked": boolean },
  (evidence fields...)
}

ChannelAdaptationsModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "channels": {
    "id": string,
    "platform": "instagram"|"tiktok"|"linkedin"|"facebook"|"youtube"|"youtube_shorts"|"google_business_profile"|"pinterest"|"x",
    "enabled": boolean,
    "role": string,
    "formats": string[],
    "hookRules": string[],
    "ctaRules": string[],
    "visualRules": string[],
    "cadence": string,
    "dos": string[],
    "donts": string[],
    "examples": string[]
  }[],
  "translationTable": { "coreMessage": string, "variants": { [platform: string]: string } }[],
  "defaultGuidance"?: string,
  "decisions": { "ctasLocked": boolean, "rulesLocked": boolean },
  (evidence fields...)
}

RulesConstraintsModule:
{
  "meta"?: { "source"?: string, "generated_at"?: string },
  "claimsPolicy": { "id": string, "claim": string, "status": "allowed"|"proof_required"|"forbidden", "proofLink"?: string }[],
  "bannedWords": string[],
  "requiredDisclaimers": string[],
  "approvalTriggers": { "id": string, "condition": string, "action": string }[],
  "decisions": { "forbiddenClaimsLocked": boolean, "bannedTermsLocked": boolean },
  (evidence fields...)
}

Decision:
{ "module": "positioning"|"pillars"|"campaign_plan"|"weekly_plan"|"channel_adaptations"|"rules_constraints", "decision_key": string, "value"?: any|null, "locked"?: boolean }

Task:
{ "module"?: "positioning"|"pillars"|"campaign_plan"|"weekly_plan"|"channel_adaptations"|"rules_constraints", "title": string, "description"?: string, "priority"?: "low"|"medium"|"high"|"urgent", "period_key"?: string, "slug"?: string, "dedupe_key"?: string }

Rules:
- Never omit any required fields. Use empty arrays/strings if needed.
- IDs can be simple strings like "p1", "c1".
- If the Context includes "CurrentMonth: YYYY-MM", set modules.campaign_plan.selectedMonth to that EXACT value and ensure at least one campaign has startDate within that month (YYYY-MM-DD starting with selectedMonth). Do not use placeholders like "Current Month-01".
- If the Context includes "CurrentIsoWeek: YYYY-Www", set modules.weekly_plan.selectedWeek to that EXACT value. Use real ISO dates (YYYY-MM-DD) for all dueDate values.
- Avoid placeholder tokens like "[KEYWORD]". If a DM keyword is unknown, write "DM keyword" and add an open question asking for the exact keyword.
- Treat conversion_path codes as internal (e.g., "visit_store" means "visit the studio/location" for service businesses). Avoid the word "store" unless the business is explicitly retail.
- Do not use "guaranteed" / "guarantee" language in fitness/health contexts unless explicitly allowed in constraints.
- If you include numeric KPI targets without a provided baseline, you MUST list them under assumptions and include an open question requesting the baseline.
- Ensure ` + "`document.markdown`" + ` is a full readable strategy in markdown.`;

  const userPrompt = `Agency Brain:\n${JSON.stringify(args.agencyBrain)}\n\nClient Brain:\n${JSON.stringify(
    args.clientBrain,
  )}\n\nContext:\n${args.context}${instruction}\n\n${schemaGuide}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
