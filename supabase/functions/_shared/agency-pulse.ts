export type AgencyPulseSignalType =
  | "blocker"
  | "flagged_content"
  | "strategy_missing"
  | "strategy_stale"
  | "approval_stalled"
  | "report_due";

export type AgencyPulseSeverity = "high" | "med" | "low";
export type AgencyPulseAgent = "grading" | "blocker" | "strategy" | "reporting";
export type AgencyPulseOwner = "agency" | "client" | "owner";

export type AgencyPulseClient = {
  id: string;
  name?: string | null;
  status?: string | null;
};

export type AgencyPulseBlocker = {
  code?: string | null;
  severity?: AgencyPulseSeverity | string | null;
  title?: string | null;
  detail?: string | null;
  owner?: AgencyPulseOwner | string | null;
  recommended_next_action?: string | null;
  deep_link?: string | null;
  signal_source?: string | null;
};

export type AgencyPulseBlockerSnapshot = {
  client_id?: string | null;
  delivery_state?: "on_track" | "at_risk" | "blocked" | string | null;
  blockers?: AgencyPulseBlocker[] | null;
  counts?: Record<string, unknown> | null;
  scanned_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AgencyPulseGrading = {
  id?: string | null;
  client_id?: string | null;
  content_type?: string | null;
  surface?: string | null;
  score?: number | null;
  accepted?: boolean | null;
  hard_violations?: unknown[] | null;
  soft_issues?: unknown[] | null;
  created_at?: string | null;
};

export type AgencyPulseStrategyState = {
  client_id?: string | null;
  onboarding_complete?: boolean | null;
  onboarding_completed_at?: string | null;
  onboarding_updated_at?: string | null;
  has_approved_strategy?: boolean | null;
  approved_strategy_count?: number | null;
  approved_module_count?: number | null;
  approved_artifact_count?: number | null;
  approved_strategy_at?: string | null;
  latest_strategy_updated_at?: string | null;
};

export type AgencyPulseReportState = {
  client_id?: string | null;
  current_period?: string | null;
  current_period_report_generated?: boolean | null;
  latest_report_month?: string | null;
  latest_report_generated_at?: string | null;
};

export type AgencyPulseAttentionItem = {
  client_id: string;
  client_name: string;
  signal_type: AgencyPulseSignalType;
  severity: AgencyPulseSeverity;
  title: string;
  detail: string;
  responsible_agent: AgencyPulseAgent;
  owner: AgencyPulseOwner;
  recommended_action: string;
  deep_link: string;
};

export type AgencyPulseSummary = {
  clients_total: number;
  on_track: number;
  at_risk: number;
  blocked: number;
};

export type AgencyPulseOutput = {
  summary: AgencyPulseSummary;
  attention: AgencyPulseAttentionItem[];
  counts_by_type: Record<AgencyPulseSignalType, number>;
  counts_by_owner: Record<AgencyPulseOwner, number>;
};

export type BuildAgencyPulseInput = {
  clients?: AgencyPulseClient[] | null;
  blockerSnapshots?: AgencyPulseBlockerSnapshot[] | null;
  gradings?: AgencyPulseGrading[] | null;
  strategyStates?: AgencyPulseStrategyState[] | null;
  reportStates?: AgencyPulseReportState[] | null;
  now?: Date | string | number | null;
  strategyStaleDays?: number;
  recentGradingDays?: number;
};

type Candidate = {
  item: AgencyPulseAttentionItem;
  recencyMs: number;
};

type ClientPulseState = "on_track" | "at_risk" | "blocked";

const DEFAULT_STRATEGY_STALE_DAYS = 45;
const DEFAULT_RECENT_GRADING_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function emptyCountsByType(): Record<AgencyPulseSignalType, number> {
  return {
    blocker: 0,
    flagged_content: 0,
    strategy_missing: 0,
    strategy_stale: 0,
    approval_stalled: 0,
    report_due: 0,
  };
}

function emptyCountsByOwner(): Record<AgencyPulseOwner, number> {
  return {
    agency: 0,
    client: 0,
    owner: 0,
  };
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function parseDateMs(value: unknown): number {
  if (!value) return 0;
  const date = new Date(String(value));
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function nowDate(input: BuildAgencyPulseInput["now"]) {
  if (input == null) return new Date();
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function severityRank(severity: AgencyPulseSeverity) {
  if (severity === "high") return 3;
  if (severity === "med") return 2;
  return 1;
}

function normalizeSeverity(value: unknown): AgencyPulseSeverity {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === "critical" || normalized === "urgent" || normalized === "high") return "high";
  if (normalized === "medium" || normalized === "med") return "med";
  return "low";
}

function normalizeOwner(value: unknown): AgencyPulseOwner {
  const normalized = cleanString(value).toLowerCase();
  if (normalized === "client") return "client";
  if (normalized === "owner") return "owner";
  return "agency";
}

function clientFallbackName(clientId: string) {
  return `Client ${clientId.slice(0, 8)}`;
}

function clientLink(clientId: string, tab: string, focus?: string) {
  const params = new URLSearchParams({ tab });
  if (focus) params.set("focus", focus);
  return `/clients/${clientId}?${params.toString()}`;
}

function latestByClient<T extends { client_id?: string | null }>(
  rows: T[] | null | undefined,
  dateKeys: Array<keyof T>,
) {
  const latest = new Map<string, T>();
  for (const row of rows ?? []) {
    const clientId = cleanString(row.client_id);
    if (!clientId) continue;
    const current = latest.get(clientId);
    if (!current) {
      latest.set(clientId, row);
      continue;
    }
    const rowTime = Math.max(...dateKeys.map((key) => parseDateMs(row[key])));
    const currentTime = Math.max(...dateKeys.map((key) => parseDateMs(current[key])));
    if (rowTime >= currentTime) latest.set(clientId, row);
  }
  return latest;
}

function hasApprovedStrategy(state: AgencyPulseStrategyState) {
  if (typeof state.has_approved_strategy === "boolean") return state.has_approved_strategy;
  return (
    Number(state.approved_strategy_count ?? 0) +
      Number(state.approved_module_count ?? 0) +
      Number(state.approved_artifact_count ?? 0) >
    0
  );
}

function latestStrategyActivityMs(state: AgencyPulseStrategyState) {
  return Math.max(parseDateMs(state.approved_strategy_at), parseDateMs(state.latest_strategy_updated_at));
}

function signalTypeForBlocker(blocker: AgencyPulseBlocker): AgencyPulseSignalType {
  const code = cleanString(blocker.code).toLowerCase();
  const source = cleanString(blocker.signal_source).toLowerCase();
  if (code === "approval_stalled" || source.includes("client_review")) return "approval_stalled";
  return "blocker";
}

function compareCandidates(a: Candidate, b: Candidate) {
  const severityDelta = severityRank(b.item.severity) - severityRank(a.item.severity);
  if (severityDelta !== 0) return severityDelta;
  const recencyDelta = b.recencyMs - a.recencyMs;
  if (recencyDelta !== 0) return recencyDelta;
  return `${a.item.client_name}:${a.item.title}`.localeCompare(`${b.item.client_name}:${b.item.title}`);
}

function updateSummaryState(current: ClientPulseState, next: ClientPulseState): ClientPulseState {
  if (current === "blocked" || next === "blocked") return "blocked";
  if (current === "at_risk" || next === "at_risk") return "at_risk";
  return "on_track";
}

function topBlocker(blockers: AgencyPulseBlocker[]) {
  return [...blockers].sort((a, b) => {
    const severityDelta = severityRank(normalizeSeverity(b.severity)) - severityRank(normalizeSeverity(a.severity));
    if (severityDelta !== 0) return severityDelta;
    return cleanString(a.title).localeCompare(cleanString(b.title));
  })[0];
}

export function buildAgencyPulse(input: BuildAgencyPulseInput): AgencyPulseOutput {
  const now = nowDate(input.now);
  const strategyStaleMs = Math.max(1, input.strategyStaleDays ?? DEFAULT_STRATEGY_STALE_DAYS) * DAY_MS;
  const gradingRecentMs = Math.max(1, input.recentGradingDays ?? DEFAULT_RECENT_GRADING_DAYS) * DAY_MS;

  const clients = (input.clients ?? []).filter((client) => cleanString(client.id));
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const clientStates = new Map<string, ClientPulseState>(clients.map((client) => [client.id, "on_track"]));
  const candidates: Candidate[] = [];

  const pushCandidate = (candidate: Candidate) => {
    if (!clientById.has(candidate.item.client_id)) return;
    candidates.push(candidate);
  };

  const latestBlockers = latestByClient(input.blockerSnapshots, ["scanned_at", "updated_at", "created_at"]);
  for (const [clientId, snapshot] of latestBlockers) {
    if (!clientById.has(clientId)) continue;
    const blockers = Array.isArray(snapshot.blockers) ? snapshot.blockers : [];
    const top = topBlocker(blockers);
    const deliveryState = cleanString(snapshot.delivery_state).toLowerCase();
    if (deliveryState === "blocked" || normalizeSeverity(top?.severity) === "high") {
      clientStates.set(clientId, updateSummaryState(clientStates.get(clientId) ?? "on_track", "blocked"));
    } else if (deliveryState === "at_risk" || blockers.length > 0) {
      clientStates.set(clientId, updateSummaryState(clientStates.get(clientId) ?? "on_track", "at_risk"));
    }
    if (!top) continue;

    const client = clientById.get(clientId)!;
    const signalType = signalTypeForBlocker(top);
    const severity = normalizeSeverity(top.severity);
    pushCandidate({
      recencyMs: parseDateMs(snapshot.scanned_at) || parseDateMs(snapshot.updated_at) || parseDateMs(snapshot.created_at),
      item: {
        client_id: clientId,
        client_name: cleanString(client.name) || clientFallbackName(clientId),
        signal_type: signalType,
        severity,
        title: cleanString(top.title) || (signalType === "approval_stalled" ? "Client approval is stalled" : "Delivery blocker detected"),
        detail: cleanString(top.detail) || "A blocker scan found work that needs attention.",
        responsible_agent: "blocker",
        owner: normalizeOwner(top.owner),
        recommended_action:
          cleanString(top.recommended_next_action) || "Open the client workspace and clear the blocker.",
        deep_link: cleanString(top.deep_link) || clientLink(clientId, "overview"),
      },
    });
  }

  const recentCutoff = now.getTime() - gradingRecentMs;
  const gradingsByClient = latestByClient(
    (input.gradings ?? []).filter((grading) => {
      const clientId = cleanString(grading.client_id);
      if (!clientId || !clientById.has(clientId)) return false;
      const createdAt = parseDateMs(grading.created_at);
      if (createdAt && createdAt < recentCutoff) return false;
      const hardCount = Array.isArray(grading.hard_violations) ? grading.hard_violations.length : 0;
      return grading.accepted === false || hardCount > 0;
    }),
    ["created_at"],
  );

  for (const [clientId, grading] of gradingsByClient) {
    const client = clientById.get(clientId)!;
    const hardCount = Array.isArray(grading.hard_violations) ? grading.hard_violations.length : 0;
    const severity: AgencyPulseSeverity = hardCount > 0 ? "high" : "med";
    pushCandidate({
      recencyMs: parseDateMs(grading.created_at),
      item: {
        client_id: clientId,
        client_name: cleanString(client.name) || clientFallbackName(clientId),
        signal_type: "flagged_content",
        severity,
        title: "Flagged content needs review",
        detail:
          hardCount > 0
            ? `${hardCount} hard governance violation(s) found on ${cleanString(grading.surface) || "an AI output"}.`
            : `A ${cleanString(grading.content_type) || "content"} grading was rejected and needs human review.`,
        responsible_agent: "grading",
        owner: "agency",
        recommended_action: "Review the flagged output, fix governance issues, and rerun grading before publishing.",
        deep_link: clientLink(clientId, "pipeline", "grading"),
      },
    });
  }

  const strategyByClient = latestByClient(input.strategyStates, [
    "latest_strategy_updated_at",
    "approved_strategy_at",
    "onboarding_updated_at",
    "onboarding_completed_at",
  ]);
  for (const [clientId, state] of strategyByClient) {
    if (!clientById.has(clientId)) continue;
    const client = clientById.get(clientId)!;
    const clientName = cleanString(client.name) || clientFallbackName(clientId);
    const approved = hasApprovedStrategy(state);
    const onboardingComplete = state.onboarding_complete === true;

    if (onboardingComplete && !approved) {
      pushCandidate({
        recencyMs: parseDateMs(state.onboarding_completed_at) || parseDateMs(state.onboarding_updated_at),
        item: {
          client_id: clientId,
          client_name: clientName,
          signal_type: "strategy_missing",
          severity: "high",
          title: "Approved strategy is missing",
          detail: "Onboarding is complete, but no approved strategy plan or module is available for execution.",
          responsible_agent: "strategy",
          owner: "agency",
          recommended_action: "Approve or regenerate the strategy before downstream content and execution work continues.",
          deep_link: clientLink(clientId, "strategy", "approval"),
        },
      });
      continue;
    }

    const approvedAt = parseDateMs(state.approved_strategy_at);
    const latestActivity = latestStrategyActivityMs(state);
    if (approved && approvedAt > 0 && now.getTime() - approvedAt > strategyStaleMs && now.getTime() - latestActivity > strategyStaleMs) {
      pushCandidate({
        recencyMs: approvedAt,
        item: {
          client_id: clientId,
          client_name: clientName,
          signal_type: "strategy_stale",
          severity: "med",
          title: "Strategy may be stale",
          detail: `The approved strategy is older than ${Math.round(strategyStaleMs / DAY_MS)} days with no recent refresh activity.`,
          responsible_agent: "strategy",
          owner: "agency",
          recommended_action: "Review the strategy against current performance and refresh the plan if assumptions changed.",
          deep_link: clientLink(clientId, "strategy", "refresh"),
        },
      });
    }
  }

  const reportByClient = latestByClient(input.reportStates, ["latest_report_generated_at"]);
  for (const client of clients) {
    const clientId = client.id;
    const report = reportByClient.get(clientId);
    if (report?.current_period_report_generated === true) continue;

    pushCandidate({
      recencyMs: parseDateMs(report?.latest_report_generated_at),
      item: {
        client_id: clientId,
        client_name: cleanString(client.name) || clientFallbackName(clientId),
        signal_type: "report_due",
        severity: "low",
        title: "Monthly report is due",
        detail: report?.latest_report_month
          ? `No report has been generated for ${cleanString(report.current_period) || "the current period"}. Latest report: ${report.latest_report_month}.`
          : `No report has been generated for ${cleanString(report?.current_period) || "the current period"}.`,
        responsible_agent: "reporting",
        owner: "agency",
        recommended_action: "Generate and review the current monthly report before the client check-in.",
        deep_link: clientLink(clientId, "reports"),
      },
    });
  }

  const selectedByClient = new Map<string, Candidate>();
  for (const candidate of [...candidates].sort(compareCandidates)) {
    if (selectedByClient.has(candidate.item.client_id)) continue;
    selectedByClient.set(candidate.item.client_id, candidate);
  }

  const selected = [...selectedByClient.values()].sort(compareCandidates);
  for (const candidate of selected) {
    const clientId = candidate.item.client_id;
    const type = candidate.item.signal_type;
    const current = clientStates.get(clientId) ?? "on_track";
    if ((type === "blocker" || type === "approval_stalled") && candidate.item.severity === "high") {
      clientStates.set(clientId, updateSummaryState(current, "blocked"));
    } else if (current === "on_track") {
      clientStates.set(clientId, "at_risk");
    }
  }

  const countsByType = emptyCountsByType();
  const countsByOwner = emptyCountsByOwner();
  for (const candidate of selected) {
    countsByType[candidate.item.signal_type] += 1;
    countsByOwner[candidate.item.owner] += 1;
  }

  const states = [...clientStates.values()];
  const blocked = states.filter((state) => state === "blocked").length;
  const atRisk = states.filter((state) => state === "at_risk").length;

  return {
    summary: {
      clients_total: clients.length,
      on_track: Math.max(0, clients.length - blocked - atRisk),
      at_risk: atRisk,
      blocked,
    },
    attention: selected.map((candidate) => candidate.item),
    counts_by_type: countsByType,
    counts_by_owner: countsByOwner,
  };
}
