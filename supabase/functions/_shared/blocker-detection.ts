export type DeliveryState = "on_track" | "at_risk" | "blocked";
export type BlockerSeverity = "high" | "med" | "low";
export type BlockerOwner = "agency" | "client" | "owner";

export type ClientBlocker = {
  code: string;
  severity: BlockerSeverity;
  title: string;
  detail: string;
  owner: BlockerOwner;
  recommended_next_action: string;
  deep_link: string;
  signal_source: string;
};

export type BlockerDetectionResult = {
  delivery_state: DeliveryState;
  blockers: ClientBlocker[];
  counts: { high: number; med: number; blocked: number };
};

export type BrainStatusSignal = {
  usable?: boolean | null;
  missingFields?: unknown;
  missing_fields?: unknown;
  missingFieldsCount?: number | null;
  missing_fields_count?: number | null;
  status?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
};

export type EnrichmentQueueSignal = {
  id?: string | null;
  title?: string | null;
  prompt?: string | null;
  rationale?: string | null;
  owner?: string | null;
  priority?: string | null;
  stage?: string | null;
  status?: string | null;
  source_kind?: string | null;
  source_key?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExecutionTaskSignal = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  owner?: string | null;
  status?: string | null;
  priority?: string | null;
  source_kind?: string | null;
  task_key?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OperationsSetupSignal = {
  setup_status?: string | null;
  primary_contact_name?: string | null;
  primary_contact_email?: string | null;
  main_approver_name?: string | null;
  approval_sla?: string | null;
  required_access_status?: unknown;
  missing_assets?: unknown;
  updated_at?: string | null;
};

export type ProjectSignal = {
  id?: string | null;
  title?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  scheduled_for?: string | null;
  scheduled_time?: string | null;
  last_moved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StrategySignal = {
  id?: string | null;
  status?: string | null;
  locked_at?: string | null;
  updated_at?: string | null;
};

export type StrategyStateSignal = {
  onboardingComplete?: boolean | null;
  hasApprovedStrategy?: boolean | null;
  approvedStrategyCount?: number | null;
  approvedModuleCount?: number | null;
  approvedArtifactCount?: number | null;
  strategies?: StrategySignal[] | null;
};

export type BlockerDetectionInput = {
  clientId?: string | null;
  brainStatus?: BrainStatusSignal | null;
  enrichmentQueue?: EnrichmentQueueSignal[] | null;
  executionTasks?: ExecutionTaskSignal[] | null;
  operationsSetup?: OperationsSetupSignal | null;
  projects?: ProjectSignal[] | null;
  strategyState?: StrategyStateSignal | null;
  now?: Date | string | number | null;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const APPROVAL_SLA_HOURS = 48;
const PIPELINE_STAGE_THRESHOLDS_DAYS: Record<string, number> = {
  idea: 14,
  scripting: 10,
  production: 7,
  in_production: 7,
  internal_review: 5,
  review: 5,
  approved: 7,
  scheduled: 3,
};

function nowDate(input: BlockerDetectionInput["now"]) {
  const date = input == null ? new Date() : new Date(input);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function elapsedMs(from: unknown, now: Date) {
  const date = parseDate(from);
  if (!date) return 0;
  return Math.max(0, now.getTime() - date.getTime());
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value).map(cleanText).filter(Boolean);
}

function countFromBrainStatus(brainStatus: BrainStatusSignal | null | undefined, missingFields: string[]) {
  const direct = brainStatus?.missingFieldsCount ?? brainStatus?.missing_fields_count;
  if (typeof direct === "number" && Number.isFinite(direct)) return Math.max(0, direct);
  return missingFields.length;
}

function normalizeStage(project: ProjectSignal) {
  return cleanText(project.status || project.pipeline_stage).toLowerCase();
}

function formatFieldLabel(value: string) {
  return value
    .replace(/^q\d+_/, "")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clientLink(clientId: string | null | undefined, tab: string, focus?: string) {
  if (!clientId) return "/clients";
  const params = new URLSearchParams({ tab });
  if (focus) params.set("focus", focus);
  return `/clients/${clientId}?${params.toString()}`;
}

function onboardingLink(clientId: string | null | undefined, stage: string) {
  if (!clientId) return "/clients";
  return `/onboarding/client/${clientId}?stage=${encodeURIComponent(stage)}`;
}

function priorityRank(value: string | null | undefined) {
  switch (cleanText(value).toLowerCase()) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function severityRank(value: BlockerSeverity) {
  if (value === "high") return 3;
  if (value === "med") return 2;
  return 1;
}

function mapOwner(owner: string | null | undefined): BlockerOwner {
  const normalized = cleanText(owner).toLowerCase();
  if (normalized === "client") return "client";
  if (normalized === "agency") return "agency";
  return "owner";
}

function isOpenQueueStatus(status: string | null | undefined) {
  return ["queued", "ready", "in_progress"].includes(cleanText(status).toLowerCase());
}

function isOpenTaskStatus(status: string | null | undefined) {
  return ["todo", "waiting_on_client", "in_progress", "blocked"].includes(cleanText(status).toLowerCase());
}

function isTerminalProject(stage: string) {
  return ["published", "cancelled", "archived"].includes(stage);
}

function hasAccessGap(values: string[]) {
  if (values.length === 0) return true;
  return values.some((value) => /\b(missing|not\s+connected|not\s+ready|pending|requested|needed|blocked)\b/i.test(value));
}

function hasApprovedStrategy(strategyState: StrategyStateSignal | null | undefined) {
  if (!strategyState) return false;
  if (typeof strategyState.hasApprovedStrategy === "boolean") return strategyState.hasApprovedStrategy;
  const aggregate =
    (strategyState.approvedStrategyCount ?? 0) +
    (strategyState.approvedModuleCount ?? 0) +
    (strategyState.approvedArtifactCount ?? 0);
  if (aggregate > 0) return true;
  return (strategyState.strategies ?? []).some((strategy) => {
    const status = cleanText(strategy.status).toLowerCase();
    return status === "approved" || status === "locked" || Boolean(strategy.locked_at);
  });
}

function sortBlockers(blockers: ClientBlocker[]) {
  return [...blockers].sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    return a.title.localeCompare(b.title);
  });
}

function pushUnique(target: ClientBlocker[], blocker: ClientBlocker) {
  const key = `${blocker.code}:${blocker.signal_source}`;
  if (target.some((item) => `${item.code}:${item.signal_source}` === key)) return;
  target.push(blocker);
}

export function detectClientBlockers(input: BlockerDetectionInput): BlockerDetectionResult {
  const now = nowDate(input.now);
  const clientId = input.clientId ?? null;
  const blockers: ClientBlocker[] = [];

  const brainStatus = input.brainStatus ?? null;
  const missingFields = [
    ...asStringArray(brainStatus?.missingFields),
    ...asStringArray(brainStatus?.missing_fields),
  ];
  const missingCount = countFromBrainStatus(brainStatus, missingFields);
  if (brainStatus && brainStatus.usable !== true && missingCount > 0) {
    const labels = missingFields.slice(0, 5).map(formatFieldLabel);
    pushUnique(blockers, {
      code: "client_brain_incomplete",
      severity: "high",
      title: "Client brain is incomplete",
      detail: labels.length
        ? `${missingCount} required field(s) missing: ${labels.join(", ")}.`
        : `${missingCount} required client brain field(s) are missing.`,
      owner: "client",
      recommended_next_action: "Ask the client to complete the missing onboarding fields before strategy work continues.",
      deep_link: onboardingLink(clientId, "essential_intake"),
      signal_source: "get_client_brain_status",
    });
  }

  const openQueue = (input.enrichmentQueue ?? []).filter((item) => isOpenQueueStatus(item.status));
  if (openQueue.length > 0) {
    const sortedQueue = [...openQueue].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
    const top = sortedQueue[0];
    const highCount = openQueue.filter((item) => cleanText(item.priority).toLowerCase() === "high").length;
    const strategyBlockers = openQueue.filter((item) => cleanText(item.source_kind).toLowerCase() === "strategy_blocker").length;
    const owner = mapOwner(top?.owner);
    const stage = cleanText(top?.stage) || "progressive_enrichment";
    pushUnique(blockers, {
      code: "enrichment_queue_open",
      severity: highCount > 0 || strategyBlockers > 0 ? "high" : "med",
      title: "Enrichment queue has open items",
      detail: `${openQueue.length} enrichment item(s) need resolution. Top item: ${cleanText(top?.title) || "Untitled item"}.`,
      owner,
      recommended_next_action: owner === "client"
        ? "Ask the client for the missing information and mark the enrichment item resolved."
        : "Assign the highest-priority enrichment item and resolve it from the client workspace.",
      deep_link: stage === "operations_setup" || stage === "progressive_enrichment"
        ? onboardingLink(clientId, stage)
        : clientLink(clientId, "strategy", "enrichment"),
      signal_source: "client_enrichment_queue",
    });
  }

  const activeTasks = (input.executionTasks ?? []).filter((task) => isOpenTaskStatus(task.status));
  const overdueTasks = activeTasks.filter((task) => {
    const due = parseDate(task.due_at);
    return Boolean(due && due.getTime() < now.getTime());
  });
  const blockedTasks = activeTasks.filter((task) => cleanText(task.status).toLowerCase() === "blocked");
  const urgentTasks = activeTasks.filter((task) => cleanText(task.priority).toLowerCase() === "urgent");
  const taskBlockers = [...blockedTasks, ...overdueTasks, ...urgentTasks].filter((task, index, arr) => {
    const id = task.id || task.task_key || `${task.title}:${task.due_at}`;
    return arr.findIndex((candidate) => (candidate.id || candidate.task_key || `${candidate.title}:${candidate.due_at}`) === id) === index;
  });
  if (taskBlockers.length > 0) {
    const sortedTasks = [...taskBlockers].sort((a, b) => {
      const blockedDelta = Number(cleanText(b.status).toLowerCase() === "blocked") - Number(cleanText(a.status).toLowerCase() === "blocked");
      if (blockedDelta !== 0) return blockedDelta;
      return priorityRank(b.priority) - priorityRank(a.priority);
    });
    const top = sortedTasks[0];
    pushUnique(blockers, {
      code: "execution_tasks_blocked",
      severity: "high",
      title: "Execution task is blocked or overdue",
      detail: `${taskBlockers.length} execution task(s) are blocked, urgent, or past due. First item: ${cleanText(top?.title) || "Untitled task"}.`,
      owner: "agency",
      recommended_next_action: "Open the execution queue, assign an owner, and clear or reschedule the first blocked task.",
      deep_link: clientLink(clientId, "tasks", "blockers"),
      signal_source: "client_execution_tasks",
    });
  }

  const setup = input.operationsSetup ?? null;
  if (setup) {
    const access = asStringArray(setup.required_access_status);
    const missingSetup: string[] = [];
    if (!cleanText(setup.primary_contact_name)) missingSetup.push("primary contact");
    if (!cleanText(setup.main_approver_name)) missingSetup.push("main approver");
    if (hasAccessGap(access)) missingSetup.push("platform access");
    if (missingSetup.length > 0) {
      pushUnique(blockers, {
        code: "operations_setup_incomplete",
        severity: "high",
        title: "Operations setup is incomplete",
        detail: `Missing or incomplete setup item(s): ${missingSetup.join(", ")}.`,
        owner: "owner",
        recommended_next_action: "Complete the operations setup fields so delivery has contacts, approvals, and access readiness.",
        deep_link: onboardingLink(clientId, "operations_setup"),
        signal_source: "client_operations_setup",
      });
    }
  } else if (brainStatus?.usable === true) {
    pushUnique(blockers, {
      code: "operations_setup_missing",
      severity: "high",
      title: "Operations setup record is missing",
      detail: "Client brain is usable, but no operations setup record exists for delivery readiness.",
      owner: "owner",
      recommended_next_action: "Run or complete operations setup before treating the client as execution-ready.",
      deep_link: onboardingLink(clientId, "operations_setup"),
      signal_source: "client_operations_setup",
    });
  }

  const projects = input.projects ?? [];
  const stalledApprovals = projects.filter((project) => {
    const stage = normalizeStage(project);
    if (stage !== "client_review") return false;
    const reference = project.last_moved_at || project.updated_at || project.created_at;
    return elapsedMs(reference, now) > APPROVAL_SLA_HOURS * HOUR_MS;
  });
  if (stalledApprovals.length > 0) {
    const top = [...stalledApprovals].sort((a, b) => {
      const aAge = elapsedMs(a.last_moved_at || a.updated_at || a.created_at, now);
      const bAge = elapsedMs(b.last_moved_at || b.updated_at || b.created_at, now);
      return bAge - aAge;
    })[0];
    pushUnique(blockers, {
      code: "approval_stalled",
      severity: "high",
      title: "Client approval is stalled",
      detail: `${stalledApprovals.length} project(s) have been in client review for more than ${APPROVAL_SLA_HOURS} hours. Oldest: ${cleanText(top?.title) || "Untitled project"}.`,
      owner: "client",
      recommended_next_action: "Send an approval follow-up to the client approver and escalate if there is no response.",
      deep_link: clientLink(clientId, "pipeline", "client_review"),
      signal_source: "projects.client_review",
    });
  }

  const pipelineStalls = projects.filter((project) => {
    const stage = normalizeStage(project);
    if (!stage || stage === "client_review" || isTerminalProject(stage)) return false;
    const thresholdDays = PIPELINE_STAGE_THRESHOLDS_DAYS[stage] ?? 10;
    const reference = project.last_moved_at || project.updated_at || project.created_at;
    return elapsedMs(reference, now) > thresholdDays * DAY_MS;
  });
  if (pipelineStalls.length > 0) {
    const sorted = [...pipelineStalls].sort((a, b) => {
      const aStage = normalizeStage(a);
      const bStage = normalizeStage(b);
      const aAge = elapsedMs(a.last_moved_at || a.updated_at || a.created_at, now) / DAY_MS;
      const bAge = elapsedMs(b.last_moved_at || b.updated_at || b.created_at, now) / DAY_MS;
      const aThreshold = PIPELINE_STAGE_THRESHOLDS_DAYS[aStage] ?? 10;
      const bThreshold = PIPELINE_STAGE_THRESHOLDS_DAYS[bStage] ?? 10;
      return bAge / bThreshold - aAge / aThreshold;
    });
    const top = sorted[0];
    const topStage = normalizeStage(top);
    const topAgeDays = elapsedMs(top?.last_moved_at || top?.updated_at || top?.created_at, now) / DAY_MS;
    const topThreshold = PIPELINE_STAGE_THRESHOLDS_DAYS[topStage] ?? 10;
    pushUnique(blockers, {
      code: "pipeline_stalled",
      severity: topAgeDays > topThreshold * 2 ? "high" : "med",
      title: "Pipeline stage is stalled",
      detail: `${pipelineStalls.length} project(s) are stuck beyond stage thresholds. Top item: ${cleanText(top?.title) || "Untitled project"} in ${topStage.replace(/_/g, " ")}.`,
      owner: "agency",
      recommended_next_action: "Review the stalled pipeline item and move, reassign, or cancel it based on current delivery reality.",
      deep_link: clientLink(clientId, "pipeline", "stalled"),
      signal_source: "projects.pipeline",
    });
  }

  const strategyState = input.strategyState ?? null;
  if (strategyState?.onboardingComplete === true && !hasApprovedStrategy(strategyState)) {
    pushUnique(blockers, {
      code: "strategy_not_approved",
      severity: "high",
      title: "No approved strategy is available",
      detail: "Onboarding is complete, but no approved strategy module or plan artifact is available for downstream execution.",
      owner: "agency",
      recommended_next_action: "Approve or regenerate the strategy plan before creator and execution workflows continue.",
      deep_link: clientLink(clientId, "strategy", "approval"),
      signal_source: "strategies",
    });
  }

  const sorted = sortBlockers(blockers);
  const high = sorted.filter((blocker) => blocker.severity === "high").length;
  const med = sorted.filter((blocker) => blocker.severity === "med").length;
  const delivery_state: DeliveryState = high > 0 ? "blocked" : sorted.length > 0 ? "at_risk" : "on_track";

  return {
    delivery_state,
    blockers: sorted,
    counts: {
      high,
      med,
      blocked: high,
    },
  };
}
