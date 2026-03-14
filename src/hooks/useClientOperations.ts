import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientOperationsSetupRecord {
  id: string;
  agency_id: string;
  client_id: string;
  source_profile_id: string | null;
  setup_status: "draft" | "in_progress" | "ready";
  primary_contact_name: string | null;
  primary_contact_role: string | null;
  primary_contact_email: string | null;
  main_approver_name: string | null;
  main_approver_role: string | null;
  approval_sla: string | null;
  preferred_comms_channel: string | null;
  launch_window: string | null;
  required_access_status: string[];
  missing_assets: string[];
  escalation_contact: string | null;
  operating_languages: string[];
  preferred_formats: string[];
  cadence_expectation: string | null;
  response_handling: string | null;
  on_camera_availability: string | null;
  checklist_summary: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientEnrichmentQueueRecord {
  id: string;
  agency_id: string;
  client_id: string;
  strategy_id: string | null;
  source_kind: "onboarding_gap" | "strategy_open_question" | "strategy_blocker" | "drift_signal" | "manual";
  source_key: string;
  title: string;
  prompt: string;
  rationale: string | null;
  owner: "client" | "agency" | "shared" | "system";
  priority: "low" | "medium" | "high";
  stage: "essential_intake" | "operations_setup" | "progressive_enrichment" | "strategy" | null;
  status: "queued" | "ready" | "in_progress" | "resolved" | "dismissed";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface ClientOperationsChecklistItemRecord {
  id: string;
  agency_id: string;
  client_id: string;
  setup_id: string | null;
  item_key: string;
  section_key: string;
  title: string;
  description: string | null;
  owner: "client" | "agency" | "shared";
  status: "todo" | "waiting_on_client" | "in_progress" | "blocked" | "done";
  priority: "low" | "medium" | "high";
  due_at: string | null;
  resolved_at: string | null;
  source_kind: "derived" | "manual";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientExecutionTaskRecord {
  id: string;
  agency_id: string;
  client_id: string;
  checklist_item_id: string | null;
  queue_item_id: string | null;
  task_key: string;
  source_kind: "operations_checklist" | "enrichment_queue" | "manual";
  title: string;
  description: string | null;
  owner: "client" | "agency" | "shared" | "system";
  assignee_user_id: string | null;
  status: "todo" | "waiting_on_client" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgencyMemberOption {
  id: string;
  user_id: string;
  role: string;
  accepted_at: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export interface ClientOperationEventRecord {
  id: string;
  agency_id: string;
  client_id: string;
  execution_task_id: string | null;
  checklist_item_id: string | null;
  queue_item_id: string | null;
  event_kind: "task_created" | "task_updated" | "task_resolved" | "task_cancelled" | "queue_refreshed" | "drift_detected";
  actor_kind: "system" | "agency" | "client";
  payload: Record<string, unknown>;
  created_at: string;
}

export const clientOperationsKeys = {
  all: ["client-operations"] as const,
  setup: (clientId: string) => [...clientOperationsKeys.all, "setup", clientId] as const,
  checklist: (clientId: string) => [...clientOperationsKeys.all, "checklist", clientId] as const,
  queue: (clientId: string) => [...clientOperationsKeys.all, "queue", clientId] as const,
  executionTasks: (clientId: string) => [...clientOperationsKeys.all, "execution-tasks", clientId] as const,
  events: (clientId: string) => [...clientOperationsKeys.all, "events", clientId] as const,
  members: (agencyId: string) => [...clientOperationsKeys.all, "members", agencyId] as const,
};

export function useClientOperationsSetup(clientId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.setup(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return null;
      const db = supabase as any;
      const { data, error } = await db
        .from("client_operations_setup")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as ClientOperationsSetupRecord | null;
    },
    enabled: !!clientId,
  });
}

export function useClientEnrichmentQueue(clientId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.queue(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return [];
      const db = supabase as any;
      const { data, error } = await db
        .from("client_enrichment_queue")
        .select("*")
        .eq("client_id", clientId)
        .in("status", ["queued", "ready", "in_progress"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ClientEnrichmentQueueRecord[];
    },
    enabled: !!clientId,
  });
}

export function useClientOperationsChecklist(clientId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.checklist(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return [];
      const db = supabase as any;
      const { data, error } = await db
        .from("client_operations_checklist_items")
        .select("*")
        .eq("client_id", clientId)
        .order("section_key", { ascending: true })
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as ClientOperationsChecklistItemRecord[];
    },
    enabled: !!clientId,
  });
}

export function useClientExecutionTasks(clientId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.executionTasks(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return [];
      const db = supabase as any;
      const { data, error } = await db
        .from("client_execution_tasks")
        .select("*")
        .eq("client_id", clientId)
        .in("status", ["todo", "waiting_on_client", "in_progress", "blocked", "done"])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ClientExecutionTaskRecord[];
    },
    enabled: !!clientId,
  });
}

export function useClientOperationEvents(clientId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.events(clientId ?? ""),
    queryFn: async () => {
      if (!clientId) return [];
      const db = supabase as any;
      const { data, error } = await db
        .from("client_operation_events")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) throw error;
      return (data ?? []) as ClientOperationEventRecord[];
    },
    enabled: !!clientId,
  });
}

export function useAgencyMemberOptions(agencyId: string | undefined) {
  return useQuery({
    queryKey: clientOperationsKeys.members(agencyId ?? ""),
    queryFn: async () => {
      if (!agencyId) return [];
      const db = supabase as any;
      const { data: members, error: membersError } = await db
        .from("agency_members")
        .select("id, user_id, role, accepted_at, created_at")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: true });

      if (membersError) throw membersError;

      const userIds = (members ?? []).map((member: any) => member.user_id).filter(Boolean);
      const { data: profiles, error: profilesError } = userIds.length
        ? await db
            .from("profiles")
            .select("id, full_name, email")
            .in("id", userIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
      return (members ?? []).map((member: any) => ({
        ...member,
        profile: profileMap.get(member.user_id) ?? null,
      })) as AgencyMemberOption[];
    },
    enabled: !!agencyId,
  });
}

export function useRefreshClientEnrichmentQueue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, reason }: { clientId: string; reason?: string }) => {
      const db = supabase as any;
      const { data, error } = await db.rpc("refresh_client_enrichment_queue", {
        p_client_id: clientId,
        p_reason: reason ?? "manual_refresh",
      });
      if (error) throw error;
      await db.rpc("refresh_client_execution_tasks", {
        p_client_id: clientId,
        p_reason: reason ?? "manual_refresh",
      });
      return data as { ok: boolean; active_items: number; attempted_inserts: number };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.queue(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.setup(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.executionTasks(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.events(variables.clientId) });
    },
  });
}

export function useUpdateClientOperationsChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      clientId,
      status,
      owner,
      dueAt,
    }: {
      itemId: string;
      clientId: string;
      status: ClientOperationsChecklistItemRecord["status"];
      owner?: ClientOperationsChecklistItemRecord["owner"];
      dueAt?: string | null;
    }) => {
      const db = supabase as any;
      const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
        resolved_at: status === "done" ? new Date().toISOString() : null,
      };
      if (owner !== undefined) updates.owner = owner;
      if (dueAt !== undefined) updates.due_at = dueAt;

      const { data, error } = await db
        .from("client_operations_checklist_items")
        .update(updates)
        .eq("id", itemId)
        .select("*")
        .single();

      if (error) throw error;
      await db.rpc("refresh_client_execution_tasks", {
        p_client_id: clientId,
        p_reason: "checklist_update",
      });
      return data as ClientOperationsChecklistItemRecord;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.checklist(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.setup(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.executionTasks(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.events(variables.clientId) });
    },
  });
}

export function useUpdateClientExecutionTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      clientId,
      status,
      owner,
      dueAt,
      assigneeUserId,
      clearAssignee,
      resolutionNote,
    }: {
      taskId: string;
      clientId: string;
      status?: ClientExecutionTaskRecord["status"];
      owner?: ClientExecutionTaskRecord["owner"];
      dueAt?: string | null;
      assigneeUserId?: string | null;
      clearAssignee?: boolean;
      resolutionNote?: string | null;
    }) => {
      const db = supabase as any;
      const { data, error } = await db.rpc("update_client_execution_task", {
        p_task_id: taskId,
        p_status: status ?? null,
        p_owner: owner ?? null,
        p_due_at: dueAt === undefined || dueAt === null ? null : dueAt,
        p_clear_due_at: dueAt === null,
        p_assignee_user_id: assigneeUserId === undefined || assigneeUserId === null ? null : assigneeUserId,
        p_clear_assignee: clearAssignee === true,
        p_resolution_note: resolutionNote ?? null,
      });
      if (error) throw error;
      await db.rpc("refresh_client_execution_tasks", {
        p_client_id: clientId,
        p_reason: "task_update",
      });
      return data as ClientExecutionTaskRecord;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.executionTasks(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.checklist(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.queue(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.setup(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: clientOperationsKeys.events(variables.clientId) });
    },
  });
}
