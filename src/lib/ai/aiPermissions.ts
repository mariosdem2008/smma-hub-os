/**
 * AI Permissions Types and Utilities
 *
 * Defines the permission scopes for AI access and provides
 * utilities for checking and managing permissions.
 */

/**
 * Permission categories
 */
export type PermissionCategory = "read" | "write" | "safety";

/**
 * Permission scope definition
 */
export interface PermissionScope {
  /** Unique scope identifier */
  scope: string;
  /** Category this scope belongs to */
  category: PermissionCategory;
  /** Human-readable label */
  label: string;
  /** Description of what this permission allows */
  description: string;
  /** Default enabled state */
  defaultEnabled: boolean;
  /** Whether this is a critical safety permission */
  isCritical?: boolean;
}

/**
 * AI permission record from database
 */
export interface AiPermission {
  id: string;
  agency_id: string;
  scope: string;
  category: PermissionCategory;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * All available permission scopes
 */
export const PERMISSION_SCOPES: PermissionScope[] = [
  // Read permissions
  {
    scope: "read_client_summary",
    category: "read",
    label: "Client Summary",
    description: "Access basic client information, brand details, and project status",
    defaultEnabled: true,
  },
  {
    scope: "read_pipeline",
    category: "read",
    label: "Pipeline Data",
    description: "View content pipeline, scheduled posts, and workflow states",
    defaultEnabled: true,
  },
  {
    scope: "read_calendar",
    category: "read",
    label: "Content Calendar",
    description: "Access content calendar events and scheduling information",
    defaultEnabled: true,
  },
  {
    scope: "read_analytics",
    category: "read",
    label: "Analytics Data",
    description: "View performance metrics, engagement stats, and reporting data",
    defaultEnabled: false,
  },
  {
    scope: "read_messages",
    category: "read",
    label: "Message History",
    description: "Access past conversations and message threads",
    defaultEnabled: false,
  },

  // Write permissions
  {
    scope: "write_drafts",
    category: "write",
    label: "Create Drafts",
    description: "Generate and save content drafts for review",
    defaultEnabled: true,
  },
  {
    scope: "write_brain_proposals",
    category: "write",
    label: "Propose Brain Updates",
    description: "Suggest updates to agency brain configuration",
    defaultEnabled: true,
  },
  {
    scope: "write_calendar_events",
    category: "write",
    label: "Create Calendar Events",
    description: "Add events to the content calendar",
    defaultEnabled: false,
  },
  {
    scope: "write_client_notes",
    category: "write",
    label: "Add Client Notes",
    description: "Create and update notes on client records",
    defaultEnabled: false,
  },

  // Safety permissions
  {
    scope: "safety_external_confirm",
    category: "safety",
    label: "Confirm External Actions",
    description: "Require human confirmation before external integrations",
    defaultEnabled: true,
    isCritical: true,
  },
  {
    scope: "safety_no_guarantees",
    category: "safety",
    label: "No Guarantees Policy",
    description: "Prevent AI from making promises or guarantees to clients",
    defaultEnabled: true,
    isCritical: true,
  },
  {
    scope: "safety_no_pricing",
    category: "safety",
    label: "No Pricing Discussions",
    description: "Prevent AI from discussing specific pricing or discounts",
    defaultEnabled: true,
    isCritical: true,
  },
  {
    scope: "safety_escalation",
    category: "safety",
    label: "Auto-Escalation",
    description: "Automatically escalate sensitive topics to human team members",
    defaultEnabled: true,
    isCritical: true,
  },
];

/**
 * Get all scopes in a category
 */
export function getScopesByCategory(category: PermissionCategory): PermissionScope[] {
  return PERMISSION_SCOPES.filter((s) => s.category === category);
}

/**
 * Get a scope definition by its ID
 */
export function getScopeDefinition(scope: string): PermissionScope | undefined {
  return PERMISSION_SCOPES.find((s) => s.scope === scope);
}

/**
 * Get default permissions for a new agency
 */
export function getDefaultPermissions(): Array<{ scope: string; category: PermissionCategory; enabled: boolean }> {
  return PERMISSION_SCOPES.map((s) => ({
    scope: s.scope,
    category: s.category,
    enabled: s.defaultEnabled,
  }));
}

/**
 * Check if a permission is enabled
 */
export function isPermissionEnabled(
  permissions: AiPermission[],
  scope: string
): boolean {
  const permission = permissions.find((p) => p.scope === scope);
  if (permission) {
    return permission.enabled;
  }
  // Fall back to default
  const scopeDef = getScopeDefinition(scope);
  return scopeDef?.defaultEnabled ?? false;
}

/**
 * Get all enabled scopes for an agency
 */
export function getEnabledScopes(permissions: AiPermission[]): string[] {
  const enabledFromDb = permissions.filter((p) => p.enabled).map((p) => p.scope);

  // Add defaults for missing scopes
  const existingScopes = new Set(permissions.map((p) => p.scope));
  const defaultEnabled = PERMISSION_SCOPES
    .filter((s) => s.defaultEnabled && !existingScopes.has(s.scope))
    .map((s) => s.scope);

  return [...enabledFromDb, ...defaultEnabled];
}

/**
 * Check if any critical safety permission is disabled
 */
export function hasCriticalSafetyDisabled(permissions: AiPermission[]): boolean {
  const criticalScopes = PERMISSION_SCOPES.filter((s) => s.isCritical);

  for (const scope of criticalScopes) {
    if (!isPermissionEnabled(permissions, scope.scope)) {
      return true;
    }
  }

  return false;
}

/**
 * Permission content for brain document storage
 */
export interface AiPermissionsContent {
  /** Version of the permissions schema */
  schema_version: number;
  /** Enabled read scopes */
  read_scopes: string[];
  /** Enabled write scopes */
  write_scopes: string[];
  /** Enabled safety scopes */
  safety_scopes: string[];
  /** Custom restrictions */
  custom_restrictions?: string[];
  /** Last updated timestamp */
  updated_at: string;
}

/**
 * Convert permissions array to content format
 */
export function permissionsToContent(permissions: AiPermission[]): AiPermissionsContent {
  const enabledScopes = permissions.filter((p) => p.enabled);

  return {
    schema_version: 1,
    read_scopes: enabledScopes.filter((p) => p.category === "read").map((p) => p.scope),
    write_scopes: enabledScopes.filter((p) => p.category === "write").map((p) => p.scope),
    safety_scopes: enabledScopes.filter((p) => p.category === "safety").map((p) => p.scope),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert content format to permissions array
 */
export function contentToPermissions(content: AiPermissionsContent): Array<{ scope: string; category: PermissionCategory; enabled: boolean }> {
  const allScopes = [
    ...content.read_scopes.map((s) => ({ scope: s, category: "read" as const, enabled: true })),
    ...content.write_scopes.map((s) => ({ scope: s, category: "write" as const, enabled: true })),
    ...content.safety_scopes.map((s) => ({ scope: s, category: "safety" as const, enabled: true })),
  ];

  // Add disabled scopes
  const enabledSet = new Set(allScopes.map((s) => s.scope));
  for (const scopeDef of PERMISSION_SCOPES) {
    if (!enabledSet.has(scopeDef.scope)) {
      allScopes.push({
        scope: scopeDef.scope,
        category: scopeDef.category,
        enabled: false,
      });
    }
  }

  return allScopes;
}

/**
 * Category labels and icons for UI
 */
export const CATEGORY_INFO: Record<PermissionCategory, { label: string; description: string }> = {
  read: {
    label: "Read Access",
    description: "What information can the AI access and use for context",
  },
  write: {
    label: "Write Access",
    description: "What actions can the AI take that modify data",
  },
  safety: {
    label: "Safety Policies",
    description: "Guardrails and restrictions for AI behavior",
  },
};
