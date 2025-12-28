import { ToolType, TOOL_REGISTRY } from "../../../src/ai/toolSchemas.ts";
import type { ToolSchema } from "../../../src/ai/toolSchemas.ts";
import { fetchAgencyBrain, upsertAgencyBrain } from "./ai-context.ts";

type ToolExecutionResult = {
  success: boolean;
  result?: any;
  error?: string;
};

type ExecuteToolOptions = {
  tool: { type: string; payload: Record<string, unknown> };
  supabase: any;
  agencyId: string;
  userId: string;
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export async function executeToolAction(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const toolType = opts.tool.type as ToolType;
  const schema = TOOL_REGISTRY[toolType];

  if (!schema) {
    return { success: false, error: `Unknown tool: ${opts.tool.type}` };
  }

  if (!opts.supabase) {
    return { success: false, error: "Supabase client not available" };
  }

  const validationError = validateToolPayload(opts.tool.payload, schema);
  if (validationError) {
    return { success: false, error: validationError };
  }

  switch (toolType) {
    case ToolType.CREATE_CLIENT:
      return await executeCreateClient(opts);
    case ToolType.DRAFT_OFFER:
      return await executeDraftOffer(opts);
    case ToolType.UPDATE_BRAIN:
      return await executeUpdateBrain(opts);
    case ToolType.SCHEDULE_TASK:
      return await executeScheduleTask(opts);
    case ToolType.CREATE_PROJECT:
      return await executeCreateProject(opts);
    case ToolType.UPDATE_PROJECT_STATUS:
      return await executeUpdateProjectStatus(opts);
    case ToolType.ASSIGN_PROJECT_ASSET:
      return await executeAssignProjectAsset(opts);
    case ToolType.SCHEDULE_POST:
      return await executeSchedulePost(opts);
    case ToolType.UPDATE_TASK_STATUS:
      return await executeUpdateTaskStatus(opts);
    case ToolType.UPDATE_TASK_PRIORITY:
      return await executeUpdateTaskPriority(opts);
    case ToolType.REQUEST_APPROVAL:
      return await executeRequestApproval(opts);
    case ToolType.SEND_MESSAGE:
      return await executeSendMessage(opts);
    default:
      return { success: false, error: "Not implemented" };
  }
}

function validateToolPayload(payload: Record<string, unknown>, schema: ToolSchema): string | null {
  if (!isPlainObject(payload)) {
    return "Tool payload must be an object";
  }

  for (const [key, definition] of Object.entries(schema.parameters)) {
    const value = payload[key];
    const isPresent = value !== undefined && value !== null;

    if (definition.required && !isPresent) {
      return `Missing required parameter: ${key}`;
    }

    if (!isPresent) continue;

    if (definition.type === "string") {
      if (typeof value !== "string") {
        return `Parameter ${key} must be a string`;
      }
      if (definition.required && !value.trim()) {
        return `Parameter ${key} must be a non-empty string`;
      }
    }
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function setDeepValue(target: Record<string, unknown>, path: string, value: unknown): boolean {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return false;

  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (FORBIDDEN_KEYS.has(key)) return false;

    const existing = cursor[key];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const lastKey = segments[segments.length - 1];
  if (FORBIDDEN_KEYS.has(lastKey)) return false;
  cursor[lastKey] = value;
  return true;
}

async function executeCreateClient(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const name = String(opts.tool.payload.name ?? "").trim();
  const website = typeof opts.tool.payload.website === "string" ? opts.tool.payload.website.trim() : "";
  const niche = typeof opts.tool.payload.niche === "string" ? opts.tool.payload.niche.trim() : "";

  if (!name) {
    return { success: false, error: "Client name is required" };
  }

  try {
    const { data: existing, error: existingError } = await opts.supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", opts.agencyId)
      .ilike("name", name)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message ?? "Failed to check existing clients" };
    }

    if (existing?.id) {
      return { success: true, result: { client_id: existing.id, name: existing.name ?? name, existing: true } };
    }

    const { data, error } = await opts.supabase
      .from("clients")
      .insert({
        agency_id: opts.agencyId,
        name,
        website: website || null,
        niche: niche || null,
      })
      .select("id, name")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to create client" };
    }

    return { success: true, result: { client_id: data?.id ?? null, name: data?.name ?? name, existing: false } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeDraftOffer(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const serviceType = String(opts.tool.payload.service_type ?? "").trim();
  const pricingRange = typeof opts.tool.payload.pricing_range === "string" ? opts.tool.payload.pricing_range.trim() : "";

  if (!serviceType) {
    return { success: false, error: "service_type is required" };
  }

  const offerText = [
    `Service Offer: ${serviceType}`,
    pricingRange ? `Pricing: ${pricingRange}` : "Pricing: Custom quote after discovery",
    "Scope: Strategy, execution, reporting, and optimization.",
    "Timeline: 2-4 weeks to launch after kickoff.",
    "Next steps: confirm goals, access, and kickoff date.",
  ].join("\n");

  return {
    success: true,
    result: {
      offer_text: offerText,
      service_type: serviceType,
      pricing_range: pricingRange || null,
    },
  };
}

async function executeUpdateBrain(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const field = String(opts.tool.payload.field ?? "").trim();
  const value = opts.tool.payload.value;

  if (!field) {
    return { success: false, error: "field is required" };
  }

  if (FORBIDDEN_KEYS.has(field)) {
    return { success: false, error: "field path is not allowed" };
  }

  try {
    const brainRes = await fetchAgencyBrain(opts.supabase, opts.agencyId);
    const brainId = (brainRes?.id ?? null) as string | null;
    const brain = (brainRes?.brain ?? {}) as Record<string, unknown>;
    const nextBrain = cloneRecord(brain);

    if (!setDeepValue(nextBrain, field, value)) {
      return { success: false, error: "field path is invalid" };
    }

    if (JSON.stringify(nextBrain) === JSON.stringify(brain)) {
      return { success: true, result: { brain_id: brainId, field, updated: false } };
    }

    const updatedId = await upsertAgencyBrain(opts.supabase, opts.agencyId, brainId, nextBrain);
    return { success: true, result: { brain_id: updatedId, field, updated: true } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function resolveDefaultClientId(opts: ExecuteToolOptions) {
  const { data, error } = await opts.supabase
    .from("clients")
    .select("id, name")
    .eq("agency_id", opts.agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { clientId: null as string | null, clientName: null as string | null, error: error.message ?? "Failed to load clients" };
  }

  return { clientId: data?.id ?? null, clientName: data?.name ?? null, error: null as string | null };
}

async function executeScheduleTask(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const title = String(opts.tool.payload.title ?? "").trim();
  const dueDateInput = String(opts.tool.payload.due_date ?? "").trim();
  const notes = typeof opts.tool.payload.notes === "string" ? opts.tool.payload.notes.trim() : "";
  const payloadClientId = typeof opts.tool.payload.client_id === "string" ? opts.tool.payload.client_id.trim() : "";

  if (!title) {
    return { success: false, error: "title is required" };
  }

  const dueDate = new Date(dueDateInput);
  if (!dueDateInput || Number.isNaN(dueDate.getTime())) {
    return { success: false, error: "due_date must be a valid ISO date string" };
  }

  let clientId = payloadClientId || null;
  let clientName: string | null = null;
  let defaultedClient = false;

  if (!clientId) {
    const resolved = await resolveDefaultClientId(opts);
    if (resolved.error) {
      return { success: false, error: resolved.error };
    }
    if (!resolved.clientId) {
      return { success: false, error: "No clients found for agency. Create a client first." };
    }
    clientId = resolved.clientId;
    clientName = resolved.clientName ?? null;
    defaultedClient = true;
  }

  const dueDateIso = dueDate.toISOString();

  try {
    const { data: existing, error: existingError } = await opts.supabase
      .from("tasks")
      .select("id")
      .eq("agency_id", opts.agencyId)
      .eq("client_id", clientId)
      .eq("title", title)
      .eq("due_date", dueDateIso)
      .eq("assigned_to", opts.userId)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message ?? "Failed to check existing tasks" };
    }

    if (existing?.id) {
      return {
        success: true,
        result: {
          task_id: existing.id,
          title,
          due_date: dueDateIso,
          client_id: clientId,
          client_name: clientName,
          existing: true,
          defaulted_client: defaultedClient,
        },
      };
    }

    const { data, error } = await opts.supabase
      .from("tasks")
      .insert({
        agency_id: opts.agencyId,
        client_id: clientId,
        title,
        description: notes || null,
        due_date: dueDateIso,
        status: "todo",
        priority: "medium",
        assigned_to: opts.userId,
        created_by: opts.userId,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to create task" };
    }

    return {
      success: true,
      result: {
        task_id: data?.id ?? null,
        title,
        due_date: dueDateIso,
        client_id: clientId,
        client_name: clientName,
        existing: false,
        defaulted_client: defaultedClient,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeCreateProject(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const title = String(opts.tool.payload.title ?? "").trim();
  const clientId = String(opts.tool.payload.client_id ?? "").trim();
  const description = String(opts.tool.payload.description ?? "").trim();
  const platformsStr = String(opts.tool.payload.platforms ?? "").trim();

  if (!title) {
    return { success: false, error: "Project title is required" };
  }
  if (!clientId) {
    return { success: false, error: "client_id is required" };
  }

  try {
    // Verify client belongs to agency
    const { data: client, error: clientError } = await opts.supabase
      .from("clients")
      .select("id, agency_id, name")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return { success: false, error: "Client not found" };
    }

    if (client.agency_id !== opts.agencyId) {
      return { success: false, error: "Client not found or unauthorized" };
    }

    // Parse platforms
    const platforms = platformsStr
      ? platformsStr.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    // Check for existing project (idempotency)
    const { data: existing, error: existingError } = await opts.supabase
      .from("projects")
      .select("id")
      .eq("client_id", clientId)
      .ilike("title", title)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message ?? "Failed to check existing project" };
    }

    if (existing?.id) {
      return {
        success: true,
        result: {
          project_id: existing.id,
          title,
          client_id: clientId,
          existing: true,
        },
      };
    }

    // Create project
    const { data, error } = await opts.supabase
      .from("projects")
      .insert({
        client_id: clientId,
        agency_id: opts.agencyId,
        title,
        description: description || null,
        status: "idea",
        platforms: platforms.length > 0 ? platforms : null,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to create project" };
    }

    return {
      success: true,
      result: {
        project_id: data?.id ?? null,
        title,
        client_id: clientId,
        platforms,
        existing: false,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeUpdateProjectStatus(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const projectId = String(opts.tool.payload.project_id ?? "").trim();
  const status = String(opts.tool.payload.status ?? "").trim();

  if (!projectId) {
    return { success: false, error: "project_id is required" };
  }
  if (!status) {
    return { success: false, error: "status is required" };
  }

  const VALID_STATUSES = [
    "idea",
    "scripting",
    "production",
    "internal_review",
    "client_review",
    "approved",
    "scheduled",
    "published",
  ];

  if (!VALID_STATUSES.includes(status)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    };
  }

  try {
    // Verify project belongs to agency
    const { data: project, error: projectError } = await opts.supabase
      .from("projects")
      .select("id, status, agency_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    if (project.agency_id !== opts.agencyId) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    // Idempotency: already in target status
    if (project.status === status) {
      return {
        success: true,
        result: {
          project_id: projectId,
          status,
          changed: false,
        },
      };
    }

    // Update status
    const { error } = await opts.supabase
      .from("projects")
      .update({ status })
      .eq("id", projectId);

    if (error) {
      return { success: false, error: error.message ?? "Failed to update project status" };
    }

    return {
      success: true,
      result: {
        project_id: projectId,
        status,
        previous_status: project.status,
        changed: true,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeAssignProjectAsset(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const projectId = String(opts.tool.payload.project_id ?? "").trim();
  const assetId = String(opts.tool.payload.asset_id ?? "").trim();
  const isFinalStr = String(opts.tool.payload.is_final_content ?? "false").trim().toLowerCase();

  if (!projectId) {
    return { success: false, error: "project_id is required" };
  }
  if (!assetId) {
    return { success: false, error: "asset_id is required" };
  }

  const isFinal = isFinalStr === "true";

  try {
    // Verify project belongs to agency
    const { data: project, error: projectError } = await opts.supabase
      .from("projects")
      .select("id, agency_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    if (project.agency_id !== opts.agencyId) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    // Verify asset belongs to agency (via client)
    const { data: asset, error: assetError } = await opts.supabase
      .from("assets")
      .select("id, client_id, clients!inner(agency_id)")
      .eq("id", assetId)
      .single();

    if (assetError || !asset || asset.clients?.agency_id !== opts.agencyId) {
      return { success: false, error: "Asset not found or unauthorized" };
    }

    // Upsert project_assets (handles idempotency via unique constraint)
    const { data, error } = await opts.supabase
      .from("project_assets")
      .upsert(
        {
          project_id: projectId,
          asset_id: assetId,
          is_final_content: isFinal,
        },
        { onConflict: "project_id,asset_id" }
      )
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to assign asset to project" };
    }

    return {
      success: true,
      result: {
        project_asset_id: data?.id ?? null,
        project_id: projectId,
        asset_id: assetId,
        is_final_content: isFinal,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeSchedulePost(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const projectId = String(opts.tool.payload.project_id ?? "").trim();
  const platform = String(opts.tool.payload.platform ?? "").trim();
  const scheduledForInput = String(opts.tool.payload.scheduled_for ?? "").trim();
  const caption = String(opts.tool.payload.caption ?? "").trim();
  const hashtags = String(opts.tool.payload.hashtags ?? "").trim();

  if (!projectId) {
    return { success: false, error: "project_id is required" };
  }
  if (!platform) {
    return { success: false, error: "platform is required" };
  }

  const VALID_PLATFORMS = ["instagram", "facebook", "linkedin", "tiktok", "youtube"];

  if (!VALID_PLATFORMS.includes(platform)) {
    return {
      success: false,
      error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(", ")}`,
    };
  }

  const scheduledFor = new Date(scheduledForInput);
  if (!scheduledForInput || Number.isNaN(scheduledFor.getTime())) {
    return { success: false, error: "scheduled_for must be a valid ISO date string" };
  }

  const scheduledForIso = scheduledFor.toISOString();

  try {
    // Verify project belongs to agency
    const { data: project, error: projectError } = await opts.supabase
      .from("projects")
      .select("id, agency_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "Project not found" };
    }

    if (project.agency_id !== opts.agencyId) {
      return { success: false, error: "Project not found or unauthorized" };
    }

    // Check for existing scheduled post (idempotency within 1 minute window)
    const scheduledForDate = new Date(scheduledForIso);
    const windowStart = new Date(scheduledForDate.getTime() - 60000).toISOString();
    const windowEnd = new Date(scheduledForDate.getTime() + 60000).toISOString();

    const { data: existing, error: existingError } = await opts.supabase
      .from("scheduled_posts")
      .select("id")
      .eq("project_id", projectId)
      .eq("platform", platform)
      .gte("scheduled_for", windowStart)
      .lte("scheduled_for", windowEnd)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message ?? "Failed to check existing scheduled post" };
    }

    if (existing?.id) {
      return {
        success: true,
        result: {
          scheduled_post_id: existing.id,
          project_id: projectId,
          platform,
          scheduled_for: scheduledForIso,
          existing: true,
        },
      };
    }

    // Create scheduled post
    const { data, error } = await opts.supabase
      .from("scheduled_posts")
      .insert({
        project_id: projectId,
        platform,
        scheduled_for: scheduledForIso,
        caption: caption || null,
        hashtags: hashtags || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to schedule post" };
    }

    return {
      success: true,
      result: {
        scheduled_post_id: data?.id ?? null,
        project_id: projectId,
        platform,
        scheduled_for: scheduledForIso,
        existing: false,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeUpdateTaskStatus(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const taskId = String(opts.tool.payload.task_id ?? "").trim();
  const status = String(opts.tool.payload.status ?? "").trim();

  if (!taskId) {
    return { success: false, error: "task_id is required" };
  }
  if (!status) {
    return { success: false, error: "status is required" };
  }

  const VALID_STATUSES = ["todo", "in_progress", "completed", "cancelled"];

  if (!VALID_STATUSES.includes(status)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    };
  }

  try {
    // Verify task belongs to agency (via client relationship)
    const { data: task, error: taskError } = await opts.supabase
      .from("tasks")
      .select("id, status, agency_id")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    if (task.agency_id !== opts.agencyId) {
      return { success: false, error: "Task not found or unauthorized" };
    }

    // Idempotency: already in target status
    if (task.status === status) {
      return {
        success: true,
        result: {
          task_id: taskId,
          status,
          changed: false,
        },
      };
    }

    // Update status
    const { error } = await opts.supabase
      .from("tasks")
      .update({ status })
      .eq("id", taskId);

    if (error) {
      return { success: false, error: error.message ?? "Failed to update task status" };
    }

    return {
      success: true,
      result: {
        task_id: taskId,
        status,
        previous_status: task.status,
        changed: true,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeUpdateTaskPriority(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const taskId = String(opts.tool.payload.task_id ?? "").trim();
  const priority = String(opts.tool.payload.priority ?? "").trim();

  if (!taskId) {
    return { success: false, error: "task_id is required" };
  }
  if (!priority) {
    return { success: false, error: "priority is required" };
  }

  const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

  if (!VALID_PRIORITIES.includes(priority)) {
    return {
      success: false,
      error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`,
    };
  }

  try {
    // Verify task belongs to agency
    const { data: task, error: taskError } = await opts.supabase
      .from("tasks")
      .select("id, priority, agency_id")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return { success: false, error: "Task not found" };
    }

    if (task.agency_id !== opts.agencyId) {
      return { success: false, error: "Task not found or unauthorized" };
    }

    // Idempotency: already at target priority
    if (task.priority === priority) {
      return {
        success: true,
        result: {
          task_id: taskId,
          priority,
          changed: false,
        },
      };
    }

    // Update priority
    const { error } = await opts.supabase
      .from("tasks")
      .update({ priority })
      .eq("id", taskId);

    if (error) {
      return { success: false, error: error.message ?? "Failed to update task priority" };
    }

    return {
      success: true,
      result: {
        task_id: taskId,
        priority,
        previous_priority: task.priority,
        changed: true,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeRequestApproval(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const assetVersionId = String(opts.tool.payload.asset_version_id ?? "").trim();
  const approverId = String(opts.tool.payload.approver_id ?? "").trim();
  const comments = String(opts.tool.payload.comments ?? "").trim();

  if (!assetVersionId) {
    return { success: false, error: "asset_version_id is required" };
  }
  if (!approverId) {
    return { success: false, error: "approver_id is required" };
  }

  try {
    // Verify asset_version belongs to agency via asset → client → agency chain
    const { data: assetVersion, error: assetVersionError } = await opts.supabase
      .from("asset_versions")
      .select("id, asset_id, assets!inner(id, client_id, clients!inner(agency_id))")
      .eq("id", assetVersionId)
      .single();

    if (assetVersionError || !assetVersion || assetVersion.assets?.clients?.agency_id !== opts.agencyId) {
      return { success: false, error: "Asset version not found or unauthorized" };
    }

    // Check for existing approval request (idempotency)
    const { data: existing, error: existingError } = await opts.supabase
      .from("approval_tasks")
      .select("id")
      .eq("asset_version_id", assetVersionId)
      .eq("approver_id", approverId)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: existingError.message ?? "Failed to check existing approval" };
    }

    if (existing?.id) {
      return {
        success: true,
        result: {
          approval_task_id: existing.id,
          asset_version_id: assetVersionId,
          approver_id: approverId,
          existing: true,
        },
      };
    }

    // Create approval request
    const { data, error } = await opts.supabase
      .from("approval_tasks")
      .insert({
        asset_version_id: assetVersionId,
        approver_id: approverId,
        comments: comments || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to create approval request" };
    }

    return {
      success: true,
      result: {
        approval_task_id: data?.id ?? null,
        asset_version_id: assetVersionId,
        approver_id: approverId,
        existing: false,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeSendMessage(opts: ExecuteToolOptions): Promise<ToolExecutionResult> {
  const conversationId = String(opts.tool.payload.conversation_id ?? "").trim();
  const body = String(opts.tool.payload.body ?? "").trim();
  const relatedProjectId = String(opts.tool.payload.related_project_id ?? "").trim();

  if (!conversationId) {
    return { success: false, error: "conversation_id is required" };
  }
  if (!body) {
    return { success: false, error: "body is required" };
  }

  try {
    // Verify conversation exists
    const { data: conversation, error: conversationError } = await opts.supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      return { success: false, error: "Conversation not found" };
    }

    // Verify user is a participant in the conversation
    const { data: participant, error: participantError } = await opts.supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", opts.userId)
      .maybeSingle();

    if (participantError || !participant) {
      return { success: false, error: "User not authorized for this conversation" };
    }

    // Insert message (no idempotency - append-only)
    const { data, error } = await opts.supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: opts.userId,
        sender_type: "agency_member",
        body,
        related_project_id: relatedProjectId || null,
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message ?? "Failed to send message" };
    }

    return {
      success: true,
      result: {
        message_id: data?.id ?? null,
        conversation_id: conversationId,
        body,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
