export enum ToolType {
  CREATE_CLIENT = "create_client",
  DRAFT_OFFER = "draft_offer",
  UPDATE_BRAIN = "update_brain",
  SCHEDULE_TASK = "schedule_task",
  CREATE_PROJECT = "create_project",
  UPDATE_PROJECT_STATUS = "update_project_status",
  ASSIGN_PROJECT_ASSET = "assign_project_asset",
  SCHEDULE_POST = "schedule_post",
  UPDATE_TASK_STATUS = "update_task_status",
  UPDATE_TASK_PRIORITY = "update_task_priority",
  REQUEST_APPROVAL = "request_approval",
  SEND_MESSAGE = "send_message",
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
  [ToolType.CREATE_PROJECT]: {
    type: ToolType.CREATE_PROJECT,
    description: "Create a new content project for a client",
    parameters: {
      title: { type: "string", description: "Project title", required: true },
      client_id: { type: "string", description: "Client ID (UUID)", required: true },
      description: { type: "string", description: "Project description", required: false },
      platforms: { type: "string", description: "Comma-separated platforms (instagram,facebook,linkedin,tiktok,youtube)", required: false },
    },
    returns: "project_id",
  },
  [ToolType.UPDATE_PROJECT_STATUS]: {
    type: ToolType.UPDATE_PROJECT_STATUS,
    description: "Update project pipeline status",
    parameters: {
      project_id: { type: "string", description: "Project ID (UUID)", required: true },
      status: { type: "string", description: "New status (idea|scripting|production|internal_review|client_review|approved|scheduled|published)", required: true },
    },
    returns: "project_id",
  },
  [ToolType.ASSIGN_PROJECT_ASSET]: {
    type: ToolType.ASSIGN_PROJECT_ASSET,
    description: "Link an asset to a project",
    parameters: {
      project_id: { type: "string", description: "Project ID (UUID)", required: true },
      asset_id: { type: "string", description: "Asset ID (UUID)", required: true },
      is_final_content: { type: "string", description: "Mark as final content (true/false)", required: false },
    },
    returns: "project_asset_id",
  },
  [ToolType.SCHEDULE_POST]: {
    type: ToolType.SCHEDULE_POST,
    description: "Schedule a project for publishing to a platform",
    parameters: {
      project_id: { type: "string", description: "Project ID (UUID)", required: true },
      platform: { type: "string", description: "Platform (instagram|facebook|linkedin|tiktok|youtube)", required: true },
      scheduled_for: { type: "string", description: "Scheduled datetime (ISO 8601)", required: true },
      caption: { type: "string", description: "Post caption", required: false },
      hashtags: { type: "string", description: "Hashtags (space-separated)", required: false },
    },
    returns: "scheduled_post_id",
  },
  [ToolType.UPDATE_TASK_STATUS]: {
    type: ToolType.UPDATE_TASK_STATUS,
    description: "Update task status",
    parameters: {
      task_id: { type: "string", description: "Task ID (UUID)", required: true },
      status: { type: "string", description: "New status (todo|in_progress|completed|cancelled)", required: true },
    },
    returns: "task_id",
  },
  [ToolType.UPDATE_TASK_PRIORITY]: {
    type: ToolType.UPDATE_TASK_PRIORITY,
    description: "Update task priority level",
    parameters: {
      task_id: { type: "string", description: "Task ID (UUID)", required: true },
      priority: { type: "string", description: "Priority (low|medium|high|urgent)", required: true },
    },
    returns: "task_id",
  },
  [ToolType.REQUEST_APPROVAL]: {
    type: ToolType.REQUEST_APPROVAL,
    description: "Create an approval request for an asset version",
    parameters: {
      asset_version_id: { type: "string", description: "Asset version ID (UUID)", required: true },
      approver_id: { type: "string", description: "User ID of approver (UUID)", required: true },
      comments: { type: "string", description: "Optional comment", required: false },
    },
    returns: "approval_task_id",
  },
  [ToolType.SEND_MESSAGE]: {
    type: ToolType.SEND_MESSAGE,
    description: "Send a message in a conversation",
    parameters: {
      conversation_id: { type: "string", description: "Conversation ID (UUID)", required: true },
      body: { type: "string", description: "Message body", required: true },
      related_project_id: { type: "string", description: "Related project ID (UUID)", required: false },
    },
    returns: "message_id",
  },
};
