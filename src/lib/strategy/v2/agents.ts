import type {
  AgencyOperatingModuleV2,
  ClientOperatingBriefV2,
  StrategyArtifactEnvelopeV2,
  StrategyDiagnosisBody,
  StrategyRecommendationBody,
} from "./contracts";

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeAgencyOperatingModuleFromBrainDocument(document: Record<string, unknown>): AgencyOperatingModuleV2 {
  const content = ((document.content_json as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const title = typeof document.title === "string" ? document.title : typeof content.title === "string" ? content.title : String(document.module ?? "Module");
  const definition =
    (typeof content.definition === "string" && content.definition.trim()) ||
    (typeof content.summary === "string" && content.summary.trim()) ||
    `Approved operating guidance for ${String(document.module ?? "module")}.`;

  const rules = Array.isArray(content.rules)
    ? (content.rules as Array<Record<string, unknown>>).map((rule, index) => ({
        id: String(rule.id ?? `rule_${index + 1}`),
        statement: String(rule.statement ?? rule.text ?? rule.title ?? "Rule"),
        when: Array.isArray(rule.when) ? rule.when.map((item) => String(item)) : undefined,
        because: typeof rule.because === "string" ? rule.because : undefined,
      }))
    : [
        {
          id: "rule_1",
          statement:
            typeof content.text === "string" && content.text.trim()
              ? content.text.trim().slice(0, 240)
              : `${title} should be followed as approved agency guidance.`,
        },
      ];

  const examples = Array.isArray(content.examples)
    ? (content.examples as Array<Record<string, unknown>>).map((example, index) => ({
        id: String(example.id ?? `ex_${index + 1}`),
        title: String(example.title ?? `Example ${index + 1}`),
        summary: String(example.summary ?? example.text ?? example.description ?? "Approved example."),
      }))
    : [];

  const antiPatterns = Array.isArray(content.anti_patterns)
    ? (content.anti_patterns as Array<Record<string, unknown>>).map((item, index) => ({
        id: String(item.id ?? `ap_${index + 1}`),
        statement: String(item.statement ?? item.text ?? "Avoid this pattern."),
      }))
    : [];

  const edgeCases = Array.isArray(content.edge_cases)
    ? (content.edge_cases as Array<Record<string, unknown>>).map((item, index) => ({
        id: String(item.id ?? `edge_${index + 1}`),
        condition: String(item.condition ?? item.when ?? "Edge case"),
        guidance: String(item.guidance ?? item.action ?? "Apply team review."),
      }))
    : [];

  return {
    module_key: String(document.module ?? "unknown"),
    title,
    definition,
    rules,
    examples,
    anti_patterns: antiPatterns,
    edge_cases: edgeCases,
    downstream_usage: Array.isArray(content.downstream_usage)
      ? content.downstream_usage.map((item) => String(item))
      : ["strategy_readiness_agent", "diagnosis_agent", "strategy_architect_agent"],
    approval: {
      owner_role: "agency_owner",
      required: true,
      status: String(document.status ?? "approved") as any,
    },
    evidence_sources: [
      {
        type: "brain_document",
        ref_id: String(document.id ?? ""),
        label: title,
      },
    ],
    confidence: Number.isFinite(content.confidence) ? Number(content.confidence) : 85,
    last_reviewed_at: typeof document.updated_at === "string" ? document.updated_at : undefined,
  };
}

export function evaluateDiagnosisArtifact(artifact: StrategyArtifactEnvelopeV2<StrategyDiagnosisBody>) {
  const findings: Array<{ level: "warn" | "fail"; message: string }> = [];
  if (!nonEmptyString(artifact.body.current_state_summary)) findings.push({ level: "fail", message: "Diagnosis is missing current_state_summary." });
  if (!artifact.body.business_objective_tree.length) findings.push({ level: "fail", message: "Diagnosis is missing business_objective_tree." });
  if (!artifact.body.channel_fit.length) findings.push({ level: "warn", message: "Diagnosis did not identify any channel fit." });
  if (!artifact.body.top_opportunities.length) findings.push({ level: "warn", message: "Diagnosis did not identify opportunities." });
  return {
    result: findings.some((item) => item.level === "fail") ? "fail" as const : findings.length ? "warn" as const : "pass" as const,
    score: Math.max(0, 100 - findings.length * 15),
    findings,
  };
}

export function evaluateRecommendationArtifact(artifact: StrategyArtifactEnvelopeV2<StrategyRecommendationBody>) {
  const findings: Array<{ level: "warn" | "fail"; message: string }> = [];
  if (!nonEmptyString(artifact.body.strategic_direction)) findings.push({ level: "fail", message: "Recommendation is missing strategic_direction." });
  if (!nonEmptyString(artifact.body.chosen_offer_priority?.primary_offer)) findings.push({ level: "fail", message: "Recommendation is missing chosen primary offer." });
  if (!nonEmptyString(artifact.body.chosen_funnel?.path)) findings.push({ level: "fail", message: "Recommendation is missing chosen funnel path." });
  if (!artifact.body.channel_priorities.length) findings.push({ level: "warn", message: "Recommendation did not assign any channel priorities." });
  if (!artifact.body.decision_rationale.length) findings.push({ level: "warn", message: "Recommendation did not include decision rationale." });
  return {
    result: findings.some((item) => item.level === "fail") ? "fail" as const : findings.length ? "warn" as const : "pass" as const,
    score: Math.max(0, 100 - findings.length * 15),
    findings,
  };
}

export function buildStrategyPlanArtifact(args: {
  briefVersion: number;
  agencyModuleVersions: Record<string, number>;
  summary: string;
  markdown: string;
  assumptions: string[];
  openQuestions: string[];
  citations: Array<Record<string, unknown>>;
  confidence: number;
  modules: Record<string, unknown>;
}) {
  return {
    artifact_meta: {
      artifact_type: "strategy_plan_v2" as const,
      version: 1,
      brief_version: args.briefVersion,
      agency_module_versions: args.agencyModuleVersions,
    },
    summary: args.summary,
    body: {
      modules: args.modules,
    },
    assumptions: args.assumptions,
    open_questions: args.openQuestions,
    citations: args.citations,
    confidence: args.confidence,
    markdown: args.markdown,
  };
}

export function buildDefaultDiagnosisInputSummary(brief: ClientOperatingBriefV2, modules: AgencyOperatingModuleV2[]) {
  return {
    brief,
    agency_context: modules.map((module) => ({
      module_key: module.module_key,
      title: module.title,
      definition: module.definition,
      key_rules: module.rules.slice(0, 5),
      anti_patterns: module.anti_patterns.slice(0, 5),
    })),
  };
}
