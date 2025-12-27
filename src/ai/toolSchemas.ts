export enum ToolType {
  CREATE_CLIENT = "create_client",
  DRAFT_OFFER = "draft_offer",
  UPDATE_BRAIN = "update_brain",
  SCHEDULE_TASK = "schedule_task",
}

export type ToolSchema = {
  type: ToolType;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
  returns?: string;
};

export const TOOL_REGISTRY: Record<ToolType, ToolSchema> = {
  [ToolType.CREATE_CLIENT]: {
    type: ToolType.CREATE_CLIENT,
    description: "Create a new client record in the CRM",
    parameters: {
      name: { type: "string", description: "Client company name", required: true },
      website: { type: "string", description: "Client website URL", required: false },
      niche: { type: "string", description: "Client industry/niche", required: false },
    },
    returns: "client_id",
  },
  [ToolType.DRAFT_OFFER]: {
    type: ToolType.DRAFT_OFFER,
    description: "Generate a service offer draft",
    parameters: {
      service_type: { type: "string", description: "Type of service", required: true },
      pricing_range: { type: "string", description: "Price range", required: false },
    },
    returns: "offer_text",
  },
  [ToolType.UPDATE_BRAIN]: {
    type: ToolType.UPDATE_BRAIN,
    description: "Update a field in the agency brain",
    parameters: {
      field: { type: "string", description: "Dot path to update (e.g., setup_profile_v1.agency.niche)", required: true },
      value: { type: "string", description: "New value to store", required: true },
    },
    returns: "brain_id",
  },
  [ToolType.SCHEDULE_TASK]: {
    type: ToolType.SCHEDULE_TASK,
    description: "Create a task reminder",
    parameters: {
      title: { type: "string", description: "Task title", required: true },
      due_date: { type: "string", description: "Due date (ISO 8601)", required: true },
      notes: { type: "string", description: "Additional notes", required: false },
      client_id: { type: "string", description: "Client ID (defaults to most recent if omitted)", required: false },
    },
    returns: "task_id",
  },
};
