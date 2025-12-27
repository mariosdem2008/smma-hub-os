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
