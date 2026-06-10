import { ai, type AiContext, type AiRunResult } from "../../../src/ai/router.ts";
import { TaskType } from "../../../src/ai/taskTypes.ts";

export type GovernanceLayer = "compliance" | "client" | "agency" | "offer" | "channel" | "workflow";

export type GradingHardViolation = {
  code: string;
  message: string;
  evidence: string;
};

export type GradingSoftIssue = {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
};

export type GradingResult = {
  accepted: boolean;
  score: number;
  hard_violations: GradingHardViolation[];
  soft_issues: GradingSoftIssue[];
  requires_human_approval: boolean;
  suggested_revision?: string;
};

export type GovernanceRule = {
  value: string;
  source: GovernanceLayer;
  message?: string;
  appliesTo?: string[];
};

export type ComposedGovernance = {
  bannedClaims: GovernanceRule[];
  requiredDisclaimers: GovernanceRule[];
  restrictedTopics: GovernanceRule[];
  forbiddenWords: GovernanceRule[];
  toneRules: string[];
  qualityBar: string[];
  clientContext: string;
  acceptanceThreshold: number;
  sourceOrder: GovernanceLayer[];
};

export type GovernanceLayerInput = Record<string, unknown> | Array<unknown> | null | undefined;

export type GovernanceInput =
  | ComposedGovernance
  | Partial<Record<GovernanceLayer, GovernanceLayerInput>>
  | GovernanceLayerInput;

type AiRunner = (options: {
  taskType: TaskType;
  input?: string;
  context: AiContext;
  metadata?: Record<string, unknown>;
}) => Promise<AiRunResult>;

const GOVERNANCE_ORDER: GovernanceLayer[] = ["compliance", "client", "agency", "offer", "channel", "workflow"];
const DEFAULT_ACCEPTANCE_THRESHOLD = 70;
const MAX_CONTEXT_CHARS = 4_000;

const BANNED_CLAIM_KEYS = [
  "banned_claims",
  "bannedClaims",
  "forbidden_claims",
  "forbiddenClaims",
  "forbidden_promises",
  "forbiddenPromises",
  "disallowed_claims",
  "disallowedClaims",
  "blocked_claims",
  "blockedClaims",
  "claims_to_avoid",
  "claimsToAvoid",
  "bannedPhrasing",
];

const REQUIRED_DISCLAIMER_KEYS = [
  "required_disclaimers",
  "requiredDisclaimers",
  "required_disclaimer",
  "requiredDisclaimer",
  "disclaimers_required",
  "disclaimersRequired",
  "mandatory_disclaimers",
  "mandatoryDisclaimers",
];

const RESTRICTED_TOPIC_KEYS = [
  "restricted_topics",
  "restrictedTopics",
  "taboo_topics",
  "tabooTopics",
  "blocked_topics",
  "blockedTopics",
  "topics_to_avoid",
  "topicsToAvoid",
];

const FORBIDDEN_WORD_KEYS = [
  "forbidden_words",
  "forbiddenWords",
  "banned_words",
  "bannedWords",
  "banned_terms",
  "bannedTerms",
  "forbidden_terms",
  "forbiddenTerms",
];

const TONE_KEYS = [
  "tone",
  "tone_rules",
  "toneRules",
  "voice_tone",
  "voiceTone",
  "adjectives",
  "writing_rules",
  "writingRules",
  "preferred_vocab",
  "preferredVocab",
  "style_rules",
  "styleRules",
];

const QUALITY_KEYS = [
  "quality_bar",
  "qualityBar",
  "quality_standard",
  "qualityStandard",
  "quality_standards",
  "qualityStandards",
  "quality_checklist",
  "qualityChecklist",
  "grading_rubric",
  "gradingRubric",
];

const GENERIC_FILLER_PATTERNS = [
  /\bboost your business\b/i,
  /\bgrow your brand\b/i,
  /\belevate your brand\b/i,
  /\btake (?:it|your business|your brand) to the next level\b/i,
  /\bunlock (?:your )?(?:full )?potential\b/i,
  /\bdrive results\b/i,
  /\bstand out from the crowd\b/i,
  /\bgame[- ]changer\b/i,
  /\bmaximize (?:your )?(?:success|growth)\b/i,
];

const UNSUPPORTED_PERFORMANCE_PATTERN =
  /\b(?:\d+(?:\.\d+)?\s?%|[2-9]x|10x|double|triple|skyrocket|explode|guarantee|guaranteed|always|never)\b/i;

function envValue(name: string): string | undefined {
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    return Deno.env.get(name) ?? undefined;
  }
  if (typeof process !== "undefined") {
    return process.env[name];
  }
  return undefined;
}

function normalizeKey(key: string) {
  return key.replace(/[_\-\s]/g, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function splitRuleString(value: string) {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyCompact(value: unknown, maxChars = MAX_CONTEXT_CHARS): string {
  if (typeof value === "string") return value.slice(0, maxChars);
  try {
    return JSON.stringify(value, null, 2).slice(0, maxChars);
  } catch {
    return String(value ?? "").slice(0, maxChars);
  }
}

function valueToRuleInputs(value: unknown): Array<{ value: string; message?: string; appliesTo?: string[] }> {
  if (typeof value === "string") {
    return splitRuleString(value).map((item) => ({ value: item }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => valueToRuleInputs(item));
  }
  if (!isRecord(value)) return [];

  const phrase =
    value.phrase ??
    value.text ??
    value.value ??
    value.claim ??
    value.topic ??
    value.word ??
    value.term ??
    value.required_text ??
    value.requiredText ??
    value.name ??
    value.label;

  const message = typeof value.message === "string" ? value.message : undefined;
  const appliesRaw = value.applies_to ?? value.appliesTo ?? value.content_types ?? value.contentTypes;
  const appliesTo = Array.isArray(appliesRaw)
    ? appliesRaw.map((item) => String(item).trim()).filter(Boolean)
    : typeof appliesRaw === "string"
      ? splitRuleString(appliesRaw)
      : undefined;

  if (typeof phrase === "string" && phrase.trim()) {
    return splitRuleString(phrase).map((item) => ({ value: item, message, appliesTo }));
  }

  return [];
}

function collectMatchingValues(root: unknown, keyNames: string[], maxDepth = 7) {
  const wanted = new Set(keyNames.map(normalizeKey));
  const out: Array<{ value: string; message?: string; appliesTo?: string[] }> = [];

  const visit = (value: unknown, depth: number) => {
    if (depth > maxDepth || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(normalizeKey(key))) {
        out.push(...valueToRuleInputs(child));
      }
      if (isRecord(child) || Array.isArray(child)) visit(child, depth + 1);
    }
  };

  visit(root, 0);
  return out;
}

function collectStrings(root: unknown, keyNames: string[], maxDepth = 7) {
  const wanted = new Set(keyNames.map(normalizeKey));
  const out: string[] = [];

  const visit = (value: unknown, depth: number) => {
    if (depth > maxDepth || value == null) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(normalizeKey(key))) {
        if (typeof child === "string") out.push(...splitRuleString(child));
        else if (Array.isArray(child)) {
          out.push(
            ...child
              .map((item) => (typeof item === "string" ? item : isRecord(item) ? stringifyCompact(item, 400) : ""))
              .filter(Boolean),
          );
        } else if (isRecord(child)) {
          out.push(stringifyCompact(child, 800));
        }
      }
      if (isRecord(child) || Array.isArray(child)) visit(child, depth + 1);
    }
  };

  visit(root, 0);
  return uniqueStrings(out);
}

function hasLayerKeys(value: unknown): value is Partial<Record<GovernanceLayer, GovernanceLayerInput>> {
  if (!isRecord(value)) return false;
  return GOVERNANCE_ORDER.some((layer) => layer in value);
}

function isComposedGovernance(value: unknown): value is ComposedGovernance {
  return (
    isRecord(value) &&
    Array.isArray(value.bannedClaims) &&
    Array.isArray(value.requiredDisclaimers) &&
    Array.isArray(value.restrictedTopics) &&
    Array.isArray(value.forbiddenWords)
  );
}

function addRules(
  target: GovernanceRule[],
  source: GovernanceLayer,
  rawRules: Array<{ value: string; message?: string; appliesTo?: string[] }>,
) {
  const seen = new Set(target.map((rule) => rule.value.toLowerCase()));
  for (const raw of rawRules) {
    const cleaned = raw.value.replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push({ value: cleaned, source, message: raw.message, appliesTo: raw.appliesTo });
  }
}

function getLayerValue(input: GovernanceInput, layer: GovernanceLayer): GovernanceLayerInput {
  if (hasLayerKeys(input)) return input[layer];
  return layer === "agency" ? input as GovernanceLayerInput : undefined;
}

function resolveAcceptanceThreshold(input: GovernanceInput) {
  const raw = hasLayerKeys(input)
    ? GOVERNANCE_ORDER.map((layer) => input[layer])
    : [input as GovernanceLayerInput];
  for (const layerValue of raw) {
    const value = findFirstNumericByKey(layerValue, ["acceptance_threshold", "acceptanceThreshold", "minimum_score", "minimumScore"]);
    if (typeof value === "number" && Number.isFinite(value)) return clampScore(value);
  }
  return DEFAULT_ACCEPTANCE_THRESHOLD;
}

function findFirstNumericByKey(root: unknown, keyNames: string[], maxDepth = 6): number | null {
  const wanted = new Set(keyNames.map(normalizeKey));
  let found: number | null = null;

  const visit = (value: unknown, depth: number) => {
    if (found !== null || depth > maxDepth || value == null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (wanted.has(normalizeKey(key))) {
        const numeric = typeof child === "number" ? child : typeof child === "string" ? Number(child) : Number.NaN;
        if (Number.isFinite(numeric)) {
          found = numeric;
          return;
        }
      }
      if (isRecord(child) || Array.isArray(child)) visit(child, depth + 1);
    }
  };

  visit(root, 0);
  return found;
}

export function composeGovernance(input: GovernanceInput): ComposedGovernance {
  if (isComposedGovernance(input)) return input;

  const composed: ComposedGovernance = {
    bannedClaims: [],
    requiredDisclaimers: [],
    restrictedTopics: [],
    forbiddenWords: [],
    toneRules: [],
    qualityBar: [],
    clientContext: "",
    acceptanceThreshold: resolveAcceptanceThreshold(input),
    sourceOrder: GOVERNANCE_ORDER,
  };

  const contextParts: string[] = [];

  for (const layer of GOVERNANCE_ORDER) {
    const layerValue = getLayerValue(input, layer);
    if (layerValue == null) continue;
    addRules(composed.bannedClaims, layer, collectMatchingValues(layerValue, BANNED_CLAIM_KEYS));
    addRules(composed.requiredDisclaimers, layer, collectMatchingValues(layerValue, REQUIRED_DISCLAIMER_KEYS));
    addRules(composed.restrictedTopics, layer, collectMatchingValues(layerValue, RESTRICTED_TOPIC_KEYS));
    addRules(composed.forbiddenWords, layer, collectMatchingValues(layerValue, FORBIDDEN_WORD_KEYS));
    composed.toneRules.push(...collectStrings(layerValue, TONE_KEYS));
    composed.qualityBar.push(...collectStrings(layerValue, QUALITY_KEYS));

    if (layer === "client") {
      contextParts.push(stringifyCompact(layerValue, 2_000));
    }
  }

  composed.toneRules = uniqueStrings(composed.toneRules).slice(0, 30);
  composed.qualityBar = uniqueStrings(composed.qualityBar).slice(0, 30);
  composed.clientContext = uniqueStrings(contextParts).join("\n\n").slice(0, MAX_CONTEXT_CHARS);
  return composed;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boundaryPattern(value: string) {
  const trimmed = value.trim();
  const escaped = escapeRegex(trimmed).replace(/\s+/g, "\\s+");
  const startsWord = /^[A-Za-z0-9]/.test(trimmed);
  const endsWord = /[A-Za-z0-9]$/.test(trimmed);
  return new RegExp(`${startsWord ? "\\b" : ""}${escaped}${endsWord ? "\\b" : ""}`, "i");
}

function findEvidence(text: string, phrase: string) {
  const match = boundaryPattern(phrase).exec(text);
  if (!match || match.index == null) return null;
  const start = Math.max(0, match.index - 50);
  const end = Math.min(text.length, match.index + match[0].length + 50);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function ruleApplies(rule: GovernanceRule, contentType?: string) {
  if (!rule.appliesTo || rule.appliesTo.length === 0 || !contentType) return true;
  const normalizedContentType = contentType.toLowerCase();
  return rule.appliesTo.some((item) => item.toLowerCase() === normalizedContentType || item === "*");
}

function pushUniqueHard(target: GradingHardViolation[], violation: GradingHardViolation) {
  const key = `${violation.code}:${violation.evidence.toLowerCase()}`;
  if (target.some((item) => `${item.code}:${item.evidence.toLowerCase()}` === key)) return;
  target.push(violation);
}

function pushUniqueSoft(target: GradingSoftIssue[], issue: GradingSoftIssue) {
  const key = `${issue.code}:${issue.message.toLowerCase()}`;
  if (target.some((item) => `${item.code}:${item.message.toLowerCase()}` === key)) return;
  target.push(issue);
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function hasProofCue(text: string) {
  return /\b(?:according to|based on|reported|case study|source|proof|evidence|\[doc\s?\d+\])\b/i.test(text);
}

function deterministicSoftIssues(text: string): { issues: GradingSoftIssue[]; penalty: number } {
  const issues: GradingSoftIssue[] = [];
  let penalty = 0;
  const trimmed = text.trim();

  if (trimmed.length > 0 && trimmed.length < 80) {
    pushUniqueSoft(issues, {
      code: "too_vague",
      message: "The answer is too short to be useful for a client-facing workflow.",
      severity: trimmed.length < 45 ? "high" : "medium",
    });
    penalty += trimmed.length < 45 ? 32 : 18;
  }

  const genericHits = GENERIC_FILLER_PATTERNS.filter((pattern) => pattern.test(trimmed));
  if (genericHits.length > 0) {
    pushUniqueSoft(issues, {
      code: "weak_generic",
      message: "The answer uses generic marketing filler instead of specific, operator-grade guidance.",
      severity: genericHits.length >= 2 ? "high" : "medium",
    });
    // Tier-2 quality bar: a single cliché is a nudge, but 2+ clichés in one
    // piece is shallow filler an expert operator would reject — penalize hard
    // enough to push it below the deterministic acceptance threshold.
    penalty += genericHits.length >= 2 ? 48 : 18;
  }

  if (UNSUPPORTED_PERFORMANCE_PATTERN.test(trimmed) && !hasProofCue(trimmed)) {
    pushUniqueSoft(issues, {
      code: "unsupported_claim",
      message: "The answer includes a performance or absolute claim without visible supporting evidence.",
      severity: "medium",
    });
    penalty += 16;
  }

  return { issues, penalty };
}

export function deterministicGradeAgainstGovernance(args: {
  text: string;
  governance: GovernanceInput;
  contentType?: string;
}): GradingResult {
  const text = String(args.text ?? "");
  const trimmed = text.trim();
  const governance = composeGovernance(args.governance);
  const hard_violations: GradingHardViolation[] = [];
  const soft_issues: GradingSoftIssue[] = [];

  if (!trimmed) {
    hard_violations.push({
      code: "empty_answer",
      message: "The answer is empty.",
      evidence: "",
    });
  }

  for (const rule of governance.bannedClaims) {
    const evidence = findEvidence(text, rule.value);
    if (!evidence) continue;
    pushUniqueHard(hard_violations, {
      code: "banned_claim",
      message: rule.message ?? `${rule.source} banned claim matched: "${rule.value}".`,
      evidence,
    });
  }

  for (const rule of governance.requiredDisclaimers) {
    if (!ruleApplies(rule, args.contentType)) continue;
    if (findEvidence(text, rule.value)) continue;
    pushUniqueHard(hard_violations, {
      code: "missing_required_disclaimer",
      message: rule.message ?? `Required disclaimer is missing: "${rule.value}".`,
      evidence: rule.value,
    });
  }

  for (const rule of governance.restrictedTopics) {
    const evidence = findEvidence(text, rule.value);
    if (!evidence) continue;
    pushUniqueHard(hard_violations, {
      code: "restricted_topic",
      message: rule.message ?? `${rule.source} restricted topic matched: "${rule.value}".`,
      evidence,
    });
  }

  for (const rule of governance.forbiddenWords) {
    const evidence = findEvidence(text, rule.value);
    if (!evidence) continue;
    pushUniqueHard(hard_violations, {
      code: "forbidden_word",
      message: rule.message ?? `${rule.source} forbidden word matched: "${rule.value}".`,
      evidence,
    });
  }

  const deterministicSoft = deterministicSoftIssues(trimmed);
  for (const issue of deterministicSoft.issues) pushUniqueSoft(soft_issues, issue);

  const hardPenalty = hard_violations.length > 0 ? 70 : 0;
  const score = clampScore(100 - hardPenalty - deterministicSoft.penalty);
  const accepted = hard_violations.length === 0 && score >= Math.min(60, governance.acceptanceThreshold);

  return {
    accepted,
    score,
    hard_violations,
    soft_issues,
    requires_human_approval:
      hard_violations.length > 0 ||
      !accepted ||
      soft_issues.some((issue) => issue.severity === "high"),
  };
}

export function summarizeGovernanceForJudge(governanceInput: GovernanceInput) {
  const governance = composeGovernance(governanceInput);
  return {
    source_order: governance.sourceOrder,
    acceptance_threshold: governance.acceptanceThreshold,
    banned_claims: governance.bannedClaims.map((rule) => ({ text: rule.value, source: rule.source })),
    required_disclaimers: governance.requiredDisclaimers.map((rule) => ({
      text: rule.value,
      source: rule.source,
      applies_to: rule.appliesTo ?? [],
    })),
    restricted_topics: governance.restrictedTopics.map((rule) => ({ text: rule.value, source: rule.source })),
    forbidden_words: governance.forbiddenWords.map((rule) => ({ text: rule.value, source: rule.source })),
    tone_rules: governance.toneRules,
    quality_bar: governance.qualityBar,
    client_context: governance.clientContext,
  };
}

function localJudgeConfigured() {
  const baseUrl = envValue("OPENAI_BASE_URL") ?? "";
  const apiKey = envValue("OPENAI_API_KEY") ?? "";
  if (!apiKey.trim() || !baseUrl.trim()) return false;
  return /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])\b/i.test(baseUrl) || /ollama/i.test(baseUrl);
}

function hasExplicitJudgeModelOverride() {
  return Boolean(
    envValue("AI_MODEL__ANSWER_QUALITY_CHECK") ||
      envValue("AI_MODEL__ANSWER_QUALITY_CHECK__dev") ||
      envValue("AI_MODEL__ANSWER_QUALITY_CHECK__prod"),
  );
}

function normalizeJudgeOutput(output: unknown): Pick<GradingResult, "score" | "soft_issues" | "requires_human_approval" | "suggested_revision"> | null {
  if (!isRecord(output)) return null;
  const score = clampScore(Number(output.score));
  const rawIssues = Array.isArray(output.soft_issues) ? output.soft_issues : [];
  const soft_issues: GradingSoftIssue[] = rawIssues.flatMap((issue) => {
    if (!isRecord(issue)) return [];
    const code = typeof issue.code === "string" && issue.code.trim() ? issue.code.trim() : "judge_issue";
    const message = typeof issue.message === "string" && issue.message.trim()
      ? issue.message.trim()
      : "The local judge flagged a quality issue.";
    const severity = issue.severity === "high" || issue.severity === "medium" || issue.severity === "low"
      ? issue.severity
      : "medium";
    return [{ code, message, severity }];
  });
  const suggested_revision = typeof output.suggested_revision === "string" && output.suggested_revision.trim()
    ? output.suggested_revision.trim()
    : undefined;
  return {
    score,
    soft_issues,
    requires_human_approval: output.requires_human_approval === true,
    suggested_revision,
  };
}

export async function gradeAgainstGovernance(args: {
  text: string;
  governance: GovernanceInput;
  contentType?: string;
  surface?: string;
  runLlmJudge?: boolean;
  context?: AiContext;
  aiRunner?: AiRunner;
}): Promise<GradingResult> {
  const deterministic = deterministicGradeAgainstGovernance({
    text: args.text,
    governance: args.governance,
    contentType: args.contentType,
  });
  const governance = composeGovernance(args.governance);

  if (deterministic.hard_violations.length > 0 || args.runLlmJudge === false) {
    return deterministic;
  }

  const runner = args.aiRunner ?? ai.run.bind(ai);
  const canRunJudge = Boolean(args.aiRunner) || localJudgeConfigured();
  if (!canRunJudge) return deterministic;

  try {
    const runOptions = {
      taskType: TaskType.ANSWER_QUALITY_CHECK,
      input: args.text,
      context: {
        ...(args.context ?? {}),
        skipUsageLog: args.context?.skipUsageLog ?? true,
      },
      metadata: {
        contentType: args.contentType ?? "unknown",
        surface: args.surface ?? "unknown",
        governanceSummary: summarizeGovernanceForJudge(governance),
        clientContext: governance.clientContext,
      },
    };
    let llm: AiRunResult;
    try {
      llm = await runner(runOptions);
    } catch (error) {
      if (args.aiRunner || hasExplicitJudgeModelOverride()) throw error;
      llm = await runner({
        ...runOptions,
        metadata: {
          ...runOptions.metadata,
          modelOverride: envValue("AI_GRADER_FALLBACK_MODEL") ?? "qwen2.5-coder:1.5b",
        },
      });
    }

    if (llm.unknown || llm.error || llm.schemaOk === false) return deterministic;

    const judge = normalizeJudgeOutput(llm.output);
    if (!judge) return deterministic;

    const soft_issues = [...deterministic.soft_issues];
    for (const issue of judge.soft_issues) pushUniqueSoft(soft_issues, issue);

    const score = clampScore(Math.min(deterministic.score, judge.score));
    const accepted = deterministic.hard_violations.length === 0 && score >= governance.acceptanceThreshold;
    return {
      accepted,
      score,
      hard_violations: deterministic.hard_violations,
      soft_issues,
      requires_human_approval:
        judge.requires_human_approval ||
        !accepted ||
        soft_issues.some((issue) => issue.severity === "high"),
      suggested_revision: judge.suggested_revision,
    };
  } catch {
    return deterministic;
  }
}

function moduleLayer(moduleKey: string): GovernanceLayer {
  const key = moduleKey.toLowerCase();
  if (key.includes("compliance") || key.includes("guardrail") || key.includes("rule") || key.includes("constraint")) {
    return "compliance";
  }
  if (key.includes("offer")) return "offer";
  if (key.includes("workflow") || key.includes("sop")) return "workflow";
  if (key.includes("channel")) return "channel";
  return "agency";
}

function appendLayer(target: Partial<Record<GovernanceLayer, unknown[]>>, layer: GovernanceLayer, value: unknown) {
  if (value == null) return;
  target[layer] = [...(target[layer] ?? []), value];
}

export async function loadGovernanceForGrading(args: {
  supabase: any;
  agencyId: string;
  clientId?: string | null;
  clientBrainJson?: Record<string, unknown> | null;
}): Promise<ComposedGovernance> {
  const layers: Partial<Record<GovernanceLayer, unknown[]>> = {};

  try {
    const { data } = await args.supabase
      .from("agency_ai_setup_status_v2")
      .select("meta_json")
      .eq("agency_id", args.agencyId)
      .maybeSingle();
    const meta = (data?.meta_json ?? {}) as Record<string, unknown>;
    appendLayer(layers, "compliance", (meta.guardrails as Record<string, unknown> | undefined) ?? {});
    appendLayer(layers, "agency", {
      foundations: meta.foundations ?? {},
      guardrails: meta.guardrails ?? {},
    });
    appendLayer(layers, "offer", (meta.foundations as Record<string, unknown> | undefined)?.offer_stack);
    appendLayer(layers, "workflow", meta.workflow ?? {});
  } catch {
    // Governance must degrade to available deterministic inputs, not fail the caller.
  }

  try {
    const { data } = await args.supabase
      .from("agency_operating_modules_v2")
      .select("module_key, content_json, derived_snapshot_json, status, version")
      .eq("agency_id", args.agencyId)
      .eq("status", "approved")
      .order("version", { ascending: false });
    for (const row of (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>) {
      const key = String(row.module_key ?? "");
      appendLayer(layers, moduleLayer(key), {
        module_key: key,
        content_json: row.content_json ?? {},
        derived_snapshot_json: row.derived_snapshot_json ?? {},
      });
    }
  } catch {
    // Keep deterministic grading available even if optional module reads fail.
  }

  let clientBrain = args.clientBrainJson ?? null;
  if (!clientBrain && args.clientId) {
    try {
      const { data } = await args.supabase
        .from("client_brains")
        .select("brain_json")
        .eq("client_id", args.clientId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      clientBrain = (data?.brain_json as Record<string, unknown> | undefined) ?? null;
    } catch {
      clientBrain = null;
    }
  }
  appendLayer(layers, "client", clientBrain ?? {});

  return composeGovernance(layers as Partial<Record<GovernanceLayer, GovernanceLayerInput>>);
}

export async function persistAiGrading(args: {
  supabase: any;
  agencyId: string;
  clientId?: string | null;
  contentType: string;
  surface: string;
  result: GradingResult;
  createdBy?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { error } = await args.supabase.from("ai_gradings").insert({
      agency_id: args.agencyId,
      client_id: args.clientId ?? null,
      content_type: args.contentType,
      surface: args.surface,
      score: args.result.score,
      accepted: args.result.accepted,
      hard_violations: args.result.hard_violations,
      soft_issues: args.result.soft_issues,
      created_by: args.createdBy ?? null,
    });
    return { ok: !error, error: error?.message ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "ai_grading_insert_failed" };
  }
}
