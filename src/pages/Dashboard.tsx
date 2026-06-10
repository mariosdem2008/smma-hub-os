import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, subDays } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckSquare,
  ClipboardList,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { useToast } from "@/hooks/use-toast";
import { useAgencyPulse, type AgencyPulseAttentionItem, type AgencyPulseSeverity } from "@/hooks/useAgencyPulse";
import { supabase } from "@/integrations/supabase/client";
import { getActiveAgencyId } from "@/lib/active-agency";
import { PostCreateAgencyCta } from "@/components/PostCreateAgencyCta";
import { ClientPickerDialog } from "@/components/ClientPickerDialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "executive" | "operations";
type PeriodKey = "7d" | "30d" | "90d";
type Trend = "up" | "down" | "flat";

type ClientRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string | null;
  assetCount: number;
  publishedVideoCount: number;
};

type ProjectRecord = {
  id: string;
  title: string;
  status: string | null;
  pipeline_stage: string | null;
  scheduled_time: string | null;
  created_at: string | null;
  updated_at: string | null;
  client?: { id?: string; name?: string } | null;
};

type TeamMember = {
  user_id: string;
  role: string | null;
  profiles: { id: string; full_name: string | null; email: string | null } | null;
};

type PipelineCounts = {
  idea: number;
  production: number;
  review: number;
  approved: number;
  scheduled: number;
  published: number;
  other: number;
};

type DashboardSignals = {
  totalClients: number;
  approvalsPending: number;
  oldestApprovalAgeDays: number;
  reviewStuck48h: number;
  overdueContent: number;
  tasksDuePeriod: number;
  projectsScheduledPeriod: number;
  pipelineCounts: PipelineCounts;
  pipelineTotal: number;
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;
const AI_SETUP_CORE_MODULES = ["bootstrap", "rep_policy", "quality_bar"] as const;
const DASHBOARD_PREFS_KEY = "dashboard:command-center:prefs";

const initialSignals: DashboardSignals = {
  totalClients: 0,
  approvalsPending: 0,
  oldestApprovalAgeDays: 0,
  reviewStuck48h: 0,
  overdueContent: 0,
  tasksDuePeriod: 0,
  projectsScheduledPeriod: 0,
  pipelineCounts: {
    idea: 0,
    production: 0,
    review: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    other: 0,
  },
  pipelineTotal: 0,
};

function getProjectStage(project: Pick<ProjectRecord, "pipeline_stage" | "status">) {
  return (project.pipeline_stage || project.status || "").toLowerCase();
}

function getPeriodDays(period: PeriodKey) {
  if (period === "7d") return 7;
  if (period === "30d") return 30;
  return 90;
}

function calcTrend(nowValue: number, baseline: number): Trend {
  if (nowValue > baseline) return "up";
  if (nowValue < baseline) return "down";
  return "flat";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatOwner(owner: string) {
  if (owner === "client") return "Client";
  if (owner === "agency") return "Agency";
  return "Owner";
}

function badgeVariantForPulseSeverity(severity: AgencyPulseSeverity) {
  if (severity === "high") return "destructive" as const;
  if (severity === "med") return "orange" as const;
  return "outline" as const;
}

function formatPulseSeverity(severity: AgencyPulseSeverity) {
  if (severity === "med") return "medium";
  return severity;
}

function formatResponsibleAgent(agent: AgencyPulseAttentionItem["responsible_agent"]) {
  if (agent === "grading") return "Grading";
  if (agent === "blocker") return "Blocker";
  if (agent === "strategy") return "Strategy";
  return "Reporting";
}

function formatSignalType(type: AgencyPulseAttentionItem["signal_type"]) {
  return type.replace(/_/g, " ");
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>("executive");
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataUnavailable, setDataUnavailable] = useState(false);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [reviewProjects, setReviewProjects] = useState<ProjectRecord[]>([]);
  const [overdueProjects, setOverdueProjects] = useState<ProjectRecord[]>([]);
  const [teamOpenTasks, setTeamOpenTasks] = useState<Record<string, number>>({});
  const [signals, setSignals] = useState<DashboardSignals>(initialSignals);
  const {
    data: agencyPulse,
    isLoading: pulseLoading,
    isFetching: pulseFetching,
    error: pulseError,
    refetch: refetchAgencyPulse,
  } = useAgencyPulse(agencyId || undefined);

  const [aiSetupComplete, setAiSetupComplete] = useState<boolean | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string>("");

  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [pendingAiAction, setPendingAiAction] = useState<"strategy" | "hooks" | "captions" | null>(null);

  const [clientFormData, setClientFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
    onboardingMode: "agency",
  });

  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    priority: "medium",
    status: "todo",
    assigned_to: "",
    due_date: "",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { viewMode?: ViewMode; period?: PeriodKey };
      if (parsed.viewMode) setViewMode(parsed.viewMode);
      if (parsed.period) setPeriod(parsed.period);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify({ viewMode, period }));
  }, [viewMode, period]);

  useEffect(() => {
    void fetchDashboardData(false);
  }, [user?.id, period]);

  useEffect(() => {
    if (!user?.id || !isAdmin || !agencyId) {
      setAiSetupComplete(null);
      return;
    }

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from("brain_documents")
          .select("module")
          .eq("agency_id", agencyId)
          .in("module", [...AI_SETUP_CORE_MODULES])
          .eq("status", "approved");
        if (error) throw error;

        const approvedModules = new Set((data ?? []).map((row: any) => row?.module).filter(Boolean));
        setAiSetupComplete(AI_SETUP_CORE_MODULES.every((module) => approvedModules.has(module)));
      } catch {
        setAiSetupComplete(false);
      }
    };

    void run();
  }, [agencyId, isAdmin, user?.id]);

  const fetchTeamMembers = async (activeAgencyId: string): Promise<TeamMember[]> => {
    const { data: members, error: membersError } = await supabase
      .from("agency_members")
      .select("user_id, role")
      .eq("agency_id", activeAgencyId);

    if (membersError || !members || members.length === 0) return [];

    const userIds = members.map((m: any) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);

    return members.map((member: any) => ({
      user_id: member.user_id,
      role: member.role,
      profiles: profiles?.find((p: any) => p.id === member.user_id) ?? null,
    }));
  };

  const fetchDashboardData = async (silentRefresh: boolean) => {
    if (!user?.id) return;

    if (silentRefresh) setRefreshing(true);
    else setLoading(true);
    setDataUnavailable(false);

    try {
      const activeAgencyId = getActiveAgencyId();
      setAgencyId(activeAgencyId);

      if (!activeAgencyId) {
        setDataUnavailable(true);
        return;
      }

      const periodDays = getPeriodDays(period);
      const now = new Date();
      const periodStart = startOfDay(subDays(now, periodDays));

      const { data: clientRows, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, email, phone, company, status")
        .eq("agency_id", activeAgencyId);
      if (clientsError) throw clientsError;

      const baseClients = (clientRows ?? []) as Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        company: string | null;
        status: string | null;
      }>;

      if (baseClients.length === 0) {
        setClients([]);
        setTeamMembers([]);
        setReviewProjects([]);
        setOverdueProjects([]);
        setTeamOpenTasks({});
        setSignals(initialSignals);
        setExecutiveSummary("");
        return;
      }

      const clientIds = baseClients.map((c) => c.id);

      const [countsRes, reviewRes, pipelineRes, scheduledRes, overdueRes, tasksRes, teamRes] = await Promise.all([
        supabase
          .from("client_asset_counts")
          .select("client_id, asset_count, published_video_count")
          .in("client_id", clientIds),
        supabase
          .from("projects")
          .select("id, title, status, pipeline_stage, scheduled_time, created_at, updated_at, client:clients(id, name)")
          .in("client_id", clientIds)
          .in("status", ["review", "in_review", "approval_pending"])
          .order("created_at", { ascending: true })
          .limit(50),
        supabase
          .from("projects")
          .select("id, status, pipeline_stage, created_at, updated_at")
          .in("client_id", clientIds)
          .gte("created_at", periodStart.toISOString())
          .order("updated_at", { ascending: false })
          .limit(1000),
        supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .in("client_id", clientIds)
          .not("scheduled_time", "is", null)
          .gte("scheduled_time", periodStart.toISOString())
          .lte("scheduled_time", now.toISOString()),
        supabase
          .from("projects")
          .select("id, title, status, pipeline_stage, scheduled_time, client:clients(id, name)")
          .in("client_id", clientIds)
          .not("scheduled_time", "is", null)
          .lt("scheduled_time", now.toISOString())
          .neq("status", "published")
          .order("scheduled_time", { ascending: true })
          .limit(20),
        supabase
          .from("tasks")
          .select("id, status, priority, due_date, assigned_to", { count: "exact" })
          .eq("agency_id", activeAgencyId)
          .neq("status", "completed")
          .gte("due_date", periodStart.toISOString())
          .lte("due_date", now.toISOString()),
        fetchTeamMembers(activeAgencyId),
      ]);

      if (countsRes.error || reviewRes.error || pipelineRes.error || overdueRes.error || tasksRes.error) {
        setDataUnavailable(true);
      }

      const countsByClientId = new Map<string, { assetCount: number; publishedVideoCount: number }>(
        (countsRes.data ?? []).map((row: any) => [
          row.client_id,
          { assetCount: row.asset_count ?? 0, publishedVideoCount: row.published_video_count ?? 0 },
        ]),
      );

      const clientsWithCounts: ClientRecord[] = baseClients.map((client) => ({
        ...client,
        assetCount: countsByClientId.get(client.id)?.assetCount ?? 0,
        publishedVideoCount: countsByClientId.get(client.id)?.publishedVideoCount ?? 0,
      }));

      const reviewData = (reviewRes.data ?? []) as ProjectRecord[];
      const overdueData = (overdueRes.data ?? []) as ProjectRecord[];
      const pipelineData = (pipelineRes.data ?? []) as Array<Pick<ProjectRecord, "status" | "pipeline_stage">>;
      const openTasksRows = (tasksRes.data ?? []) as Array<{ assigned_to: string | null }>;

      const pipelineCounts: PipelineCounts = {
        idea: 0,
        production: 0,
        review: 0,
        approved: 0,
        scheduled: 0,
        published: 0,
        other: 0,
      };
      for (const project of pipelineData) {
        const stage = getProjectStage(project);
        if (stage.includes("idea")) pipelineCounts.idea += 1;
        else if (stage.includes("production")) pipelineCounts.production += 1;
        else if (stage.includes("review")) pipelineCounts.review += 1;
        else if (stage.includes("approved")) pipelineCounts.approved += 1;
        else if (stage.includes("scheduled")) pipelineCounts.scheduled += 1;
        else if (stage.includes("published")) pipelineCounts.published += 1;
        else pipelineCounts.other += 1;
      }

      const oldestApprovalAgeDays = reviewData.length
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(reviewData[0].created_at ?? reviewData[0].updated_at ?? now.toISOString()).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : 0;

      const reviewStuck48h = reviewData.filter((item) => {
        const ref = new Date(item.updated_at ?? item.created_at ?? now.toISOString());
        return Date.now() - ref.getTime() >= 48 * 60 * 60 * 1000;
      }).length;

      const openTasksByAssignee: Record<string, number> = {};
      openTasksRows.forEach((task) => {
        if (!task.assigned_to) return;
        openTasksByAssignee[task.assigned_to] = (openTasksByAssignee[task.assigned_to] ?? 0) + 1;
      });

      const nextSignals: DashboardSignals = {
        totalClients: clientsWithCounts.length,
        approvalsPending: reviewData.length,
        oldestApprovalAgeDays,
        reviewStuck48h,
        overdueContent: overdueData.length,
        tasksDuePeriod: tasksRes.count ?? 0,
        projectsScheduledPeriod: scheduledRes.count ?? 0,
        pipelineCounts,
        pipelineTotal: pipelineData.length,
      };

      const capacityBaseline = Math.max(1, teamRes.length) * 14;
      const workload = nextSignals.tasksDuePeriod + nextSignals.approvalsPending + nextSignals.overdueContent;
      const utilization = clamp(Math.round((workload / capacityBaseline) * 100), 0, 100);
      const qualityValue = nextSignals.pipelineTotal
        ? clamp(
            Math.round(((nextSignals.pipelineCounts.published + nextSignals.pipelineCounts.approved) / nextSignals.pipelineTotal) * 100),
            0,
            100,
          )
        : 0;

      const summary = [
        `In the last ${periodDays} days, ${nextSignals.totalClients} clients generated ${nextSignals.pipelineTotal} pipeline items.`,
        `${nextSignals.approvalsPending} approvals are pending and ${nextSignals.overdueContent} content items are overdue.`,
        `Operational load is estimated at ${utilization}% utilization with a quality score of ${qualityValue}%.`,
      ].join(" ");

      setClients(clientsWithCounts);
      setReviewProjects(reviewData);
      setOverdueProjects(overdueData);
      setTeamMembers(teamRes);
      setTeamOpenTasks(openTasksByAssignee);
      setSignals(nextSignals);
      setExecutiveSummary(summary);
    } catch (error: any) {
      setDataUnavailable(true);
      toast({
        title: "Dashboard error",
        description: error?.message || "Failed to load dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const readinessSummary = useMemo(() => {
    const summary = { notStarted: 0, inProgress: 0, complete: 0 };
    clients.forEach((client) => {
      const hasContact = Boolean(client.email || client.phone);
      const hasAssets = client.assetCount > 0;
      const hasPublished = client.publishedVideoCount > 0;
      const count = Number(hasContact) + Number(hasAssets) + Number(hasPublished);
      if (count === 0) summary.notStarted += 1;
      else if (count === 1) summary.inProgress += 1;
      else summary.complete += 1;
    });
    return summary;
  }, [clients]);

  const clientHealthScores = useMemo(() => {
    return clients
      .map((client) => {
        const hasContact = Boolean(client.email || client.phone);
        const readinessPoints = (Number(hasContact) + Number(client.assetCount > 0) + Number(client.publishedVideoCount > 0)) * 22;
        const overduePenalty = overdueProjects.some((project) => project.client?.id === client.id) ? 18 : 0;
        const reviewPenalty = reviewProjects.some((project) => project.client?.id === client.id) ? 12 : 0;
        const score = clamp(40 + readinessPoints - overduePenalty - reviewPenalty, 0, 100);
        const trend = calcTrend(score, 70);
        return { id: client.id, name: client.name, score, trend };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [clients, overdueProjects, reviewProjects]);

  const pulseSummary = agencyPulse?.summary ?? {
    clients_total: signals.totalClients,
    on_track: signals.totalClients,
    at_risk: 0,
    blocked: 0,
  };
  const attentionItems = agencyPulse?.attention.slice(0, 8) ?? [];
  const pulseRiskCount = pulseSummary.at_risk + pulseSummary.blocked;

  const capacityUtilization = useMemo(() => {
    const baseline = Math.max(1, teamMembers.length) * 14;
    const load = signals.tasksDuePeriod + signals.approvalsPending + signals.overdueContent;
    return clamp(Math.round((load / baseline) * 100), 0, 100);
  }, [signals, teamMembers.length]);

  const hoursSavedThisPeriod = useMemo(() => {
    return Math.round(signals.pipelineCounts.published * 1.2 + signals.pipelineCounts.approved * 0.7 + signals.tasksDuePeriod * 0.35);
  }, [signals]);

  const automationRate = useMemo(() => {
    if (!signals.pipelineTotal) return 0;
    return clamp(
      Math.round(((signals.pipelineCounts.scheduled + signals.pipelineCounts.published) / signals.pipelineTotal) * 100),
      0,
      100,
    );
  }, [signals]);

  const qualityScore = useMemo(() => {
    if (!signals.pipelineTotal) return 0;
    return clamp(
      Math.round(((signals.pipelineCounts.published + signals.pipelineCounts.approved) / signals.pipelineTotal) * 100),
      0,
      100,
    );
  }, [signals]);

  const pulseExecutiveSummary = useMemo(() => {
    if (!agencyPulse) return executiveSummary;
    if (agencyPulse.briefing) return agencyPulse.briefing;
    const top = agencyPulse.attention[0];
    if (!top) {
      return `${agencyPulse.summary.on_track} of ${agencyPulse.summary.clients_total} active client(s) are on track. No immediate agency pulse actions are queued.`;
    }
    return `${agencyPulse.summary.blocked} blocked and ${agencyPulse.summary.at_risk} at-risk client(s). Next action: ${top.client_name} - ${top.recommended_action}`;
  }, [agencyPulse, executiveSummary]);

  const runAiAction = (clientId: string, action: "strategy" | "hooks" | "captions") => {
    navigate(`/clients/${clientId}?tab=strategy&action=${action}`);
    toast({ title: "AI action started", description: "Client context loaded for AI action." });
  };

  const handleAiActionClick = (action: "strategy" | "hooks" | "captions") => {
    const lastClientId = localStorage.getItem("smmahub:lastClientId");
    const validClient = clients.find((client) => client.id === lastClientId);
    if (validClient) {
      runAiAction(validClient.id, action);
      return;
    }
    setPendingAiAction(action);
    setClientPickerOpen(true);
  };

  const handleCreateClient = async () => {
    if (!user?.id || !agencyId) return;
    if (!clientFormData.name.trim() || !clientFormData.company.trim()) {
      toast({ title: "Validation error", description: "Client name and company are required.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const clientId = crypto.randomUUID();
      const payload = {
        id: clientId,
        agency_id: agencyId,
        name: clientFormData.name.trim(),
        email: clientFormData.email.trim() || null,
        phone: clientFormData.phone.trim() || null,
        company: clientFormData.company.trim(),
        status: clientFormData.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from("clients").insert([payload]).select().single();
      if (error) throw error;

      toast({ title: "Client created", description: "Client workspace is ready." });
      setShowNewClientDialog(false);
      setClientFormData({ name: "", email: "", phone: "", company: "", status: "active", onboardingMode: "agency" });
      await fetchDashboardData(true);

      if (clientFormData.onboardingMode === "agency") navigate(`/onboarding/client/${data.id}`);
      else navigate(`/clients/${data.id}?tab=portal`);
    } catch (error: any) {
      toast({ title: "Failed to create client", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!user?.id || !agencyId) return;
    if (!taskFormData.title.trim() || !taskFormData.client_id) {
      toast({ title: "Validation error", description: "Task title and client are required.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("tasks").insert({
        agency_id: agencyId,
        client_id: taskFormData.client_id,
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        assigned_to: taskFormData.assigned_to || null,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        created_by: user.id,
      });

      if (error) throw error;

      toast({ title: "Task created", description: "Task added to operations queue." });
      setShowTaskDialog(false);
      setTaskFormData({ title: "", description: "", client_id: "", priority: "medium", status: "todo", assigned_to: "", due_date: "" });
      await fetchDashboardData(true);
    } catch (error: any) {
      toast({ title: "Failed to create task", description: error?.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copyExecutiveSummary = async () => {
    if (!pulseExecutiveSummary) return;
    try {
      await navigator.clipboard.writeText(pulseExecutiveSummary);
      toast({ title: "Summary copied", description: "Executive summary copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy summary.", variant: "destructive" });
    }
  };

  const handleRefreshPulse = async () => {
    if (!agencyId) return;
    try {
      const result = await refetchAgencyPulse();
      if (result.error) throw result.error;
      const refresh = result.data?.refresh;
      toast({
        title: "Agency pulse refreshed",
        description: refresh
          ? `${refresh.refreshed} blocker snapshot(s) refreshed${refresh.failed ? `, ${refresh.failed} failed` : ""}.`
          : "Latest attention queue loaded.",
        variant: refresh?.failed ? "destructive" : undefined,
      });
    } catch (error: any) {
      toast({
        title: "Pulse refresh failed",
        description: error?.message ?? "Could not refresh agency pulse.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="app-page">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-72 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-4 h-8 w-20" />
              <Skeleton className="mt-5 h-3 w-32" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-16 w-full" />
            <Skeleton className="mt-3 h-16 w-full" />
          </Card>
          <Card className="p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-32 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border/70 p-5">
          <div>
            <div className="page-eyebrow">Operator home</div>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Agency command center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Live portfolio control for {pulseSummary.clients_total} clients, {teamMembers.length} team members, and the
              work that needs approval before it reaches a client.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(value: PeriodKey) => setPeriod(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="30d">Last 30d</SelectItem>
                <SelectItem value="90d">Last 90d</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                void fetchDashboardData(true);
                void refetchAgencyPulse();
              }}
              disabled={!agencyId || refreshing || pulseFetching}
              loading={refreshing || pulseFetching}
            >
              {!refreshing && !pulseFetching ? <RefreshCw className="h-4 w-4" /> : null}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-0 divide-y divide-border/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On track</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="metric-number text-3xl font-bold text-foreground">{pulseLoading ? "..." : pulseSummary.on_track}</span>
              <span className="text-sm text-muted-foreground">clients</span>
            </div>
          </div>
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">At risk</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="metric-number text-3xl font-bold text-foreground">{pulseLoading ? "..." : pulseSummary.at_risk}</span>
              <span className="text-sm text-muted-foreground">clients</span>
            </div>
          </div>
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="metric-number text-3xl font-bold text-foreground">{pulseLoading ? "..." : pulseSummary.blocked}</span>
              <span className="text-sm text-muted-foreground">clients</span>
            </div>
          </div>
        </div>
      </Card>

      {dataUnavailable ? (
        <Card className="border-warning/30 bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Partial data available
            </CardTitle>
            <CardDescription>
              Some widgets may be incomplete due to data source warnings. Core actions remain available.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <PostCreateAgencyCta isAdmin={isAdmin} aiSetupComplete={aiSetupComplete} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {[
          { label: "Capacity utilization", value: `${capacityUtilization}%`, sub: "Team load", icon: Briefcase },
          { label: "AI hours saved", value: `${hoursSavedThisPeriod}h`, sub: `${period.toUpperCase()} period`, icon: Sparkles },
          { label: "Quality score", value: `${qualityScore}%`, sub: "Approved + published", icon: Target },
          { label: "Automation rate", value: `${automationRate}%`, sub: "Scheduled + published", icon: Wand2 },
          {
            label: "Revenue risk",
            value: pulseLoading ? "..." : `${pulseRiskCount}`,
            sub: "Agency pulse",
            icon: AlertTriangle,
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardDescription>{kpi.label}</CardDescription>
                <div className="rounded-md border border-border/70 bg-muted/50 p-2 text-muted-foreground">
                  <kpi.icon className="h-4 w-4" />
                </div>
              </div>
              <CardTitle className="metric-number text-3xl">{kpi.value}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              <span>{kpi.sub}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Action queue</CardTitle>
                <CardDescription>
                  Unified agent signals prioritized across blockers, grading, strategy, and reporting.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRefreshPulse()}
                disabled={!agencyId || pulseFetching}
                loading={pulseFetching}
              >
                {!pulseFetching ? <RefreshCw className="h-3.5 w-3.5" /> : null}
                Refresh pulse
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pulseLoading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : pulseError ? (
              <EmptyState
                icon={AlertTriangle}
                title="Agency pulse unavailable"
                description={pulseError instanceof Error ? pulseError.message : "The unified attention queue could not be loaded."}
                action={{ label: "Retry", onClick: () => void refetchAgencyPulse() }}
              />
            ) : attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <div key={`${item.client_id}:${item.signal_type}:${item.title}`} className="rounded-lg border border-border/80 bg-surface/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badgeVariantForPulseSeverity(item.severity)}>{formatPulseSeverity(item.severity)}</Badge>
                        <Badge variant="secondary">{formatResponsibleAgent(item.responsible_agent)}</Badge>
                        <Badge variant="outline">{formatOwner(item.owner)}</Badge>
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {formatSignalType(item.signal_type)}
                        </span>
                      </div>
                      <h3 className="mt-3 font-medium text-foreground">{item.client_name}: {item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                      <p className="mt-2 text-sm text-foreground">
                        <span className="text-muted-foreground">Recommended:</span> {item.recommended_action}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(item.deep_link || `/clients/${item.client_id}`)}>
                      Open
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={CheckSquare}
                title="No attention needed"
                description="All active clients are clear across blocker, grading, strategy, and reporting signals."
                action={{ label: "Open clients", onClick: () => navigate("/clients") }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Executive summary</CardTitle>
            <CardDescription>Generated from live KPI and agency pulse signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">{pulseExecutiveSummary || "No data available yet."}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copyExecutiveSummary}>
                Copy summary
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void fetchDashboardData(true);
                  void refetchAgencyPulse();
                }}
                disabled={!agencyId || refreshing || pulseFetching}
                loading={refreshing || pulseFetching}
              >
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === "executive" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Client portfolio health</CardTitle>
              <CardDescription>Top clients ranked by operational health score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {clientHealthScores.map((client) => (
                <div key={client.id} className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-foreground">{client.name}</div>
                    <div className="text-xs text-muted-foreground">Health driver: readiness + delivery stability</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={client.score >= 80 ? "secondary" : client.score >= 60 ? "default" : "destructive"}>{client.score}</Badge>
                    <Badge variant="outline">
                      {client.trend === "up" ? "Improving" : client.trend === "down" ? "Declining" : "Stable"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/clients/${client.id}`)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
              {clientHealthScores.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No clients yet"
                  description="Add your first client workspace to begin tracking readiness, approvals, and delivery health."
                  action={{ label: "Add client", onClick: () => setShowNewClientDialog(true) }}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Forecast and risk</CardTitle>
              <CardDescription>Current load indicators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Capacity pressure</span>
                  <span>{capacityUtilization}%</span>
                </div>
                <Progress value={capacityUtilization} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Approval bottleneck</span>
                  <span>{signals.approvalsPending}</span>
                </div>
                <Progress value={clamp(signals.approvalsPending * 10, 0, 100)} className="h-2" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Overdue risk</span>
                  <span>{signals.overdueContent}</span>
                </div>
                <Progress value={clamp(signals.overdueContent * 15, 0, 100)} className="h-2" />
              </div>

              <div className="rounded-lg border border-border/80 bg-surface/40 p-3">
                <div className="text-sm font-medium text-foreground">Scenario planner</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  With current load, adding 5 new clients would move utilization to ~
                  {clamp(capacityUtilization + Math.round((5 / Math.max(1, teamMembers.length)) * 12), 0, 100)}%.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Operations control</CardTitle>
              <CardDescription>Live queue for approvals and overdue items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approvals</div>
                <div className="space-y-2">
                  {reviewProjects.slice(0, 5).map((project) => (
                    <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface/40 px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{project.title}</div>
                        <div className="text-xs text-muted-foreground">{project.client?.name ?? "Unknown client"}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => project.client?.id && navigate(`/clients/${project.client.id}?tab=pipeline&focus=review`)}>Review</Button>
                    </div>
                  ))}
                  {reviewProjects.length === 0 ? <p className="text-sm text-muted-foreground">No approvals pending.</p> : null}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue content</div>
                <div className="space-y-2">
                  {overdueProjects.slice(0, 5).map((project) => (
                    <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface/40 px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{project.title}</div>
                        <div className="text-xs text-muted-foreground">{project.client?.name ?? "Unknown client"} - {project.scheduled_time ? format(new Date(project.scheduled_time), "MMM d") : "No date"}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => project.client?.id && navigate(`/clients/${project.client.id}?tab=pipeline&focus=publish`)}>Reschedule</Button>
                    </div>
                  ))}
                  {overdueProjects.length === 0 ? <p className="text-sm text-muted-foreground">No overdue content.</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team load</CardTitle>
              <CardDescription>Open tasks by assignee.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.slice(0, 8).map((member) => {
                const openCount = teamOpenTasks[member.user_id] ?? 0;
                const utilization = clamp(openCount * 18, 0, 100);
                return (
                  <div key={member.user_id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{member.profiles?.full_name || member.profiles?.email || "Unknown"}</span>
                      <span>{openCount} open</span>
                    </div>
                    <Progress value={utilization} className="h-2" />
                  </div>
                );
              })}
              {teamMembers.length === 0 ? <p className="text-sm text-muted-foreground">No team members found.</p> : null}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>AI performance and ROI</CardTitle>
            <CardDescription>Throughput, quality, and value tracking.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border/80 bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours saved</div>
                <div className="metric-number mt-2 text-2xl font-semibold text-foreground">{hoursSavedThisPeriod}h</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automation rate</div>
                <div className="metric-number mt-2 text-2xl font-semibold text-foreground">{automationRate}%</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-surface/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quality score</div>
                <div className="metric-number mt-2 text-2xl font-semibold text-foreground">{qualityScore}%</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => handleAiActionClick("strategy")}>Generate strategy</Button>
              <Button variant="outline" onClick={() => handleAiActionClick("hooks")}>Generate hooks</Button>
              <Button variant="outline" onClick={() => handleAiActionClick("captions")}>Draft captions</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>High-frequency operations shortcuts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" onClick={() => setShowNewClientDialog(true)}><Plus className="h-4 w-4" />Add client</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setShowTaskDialog(true)}><CheckSquare className="h-4 w-4" />Create task</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/clients")}><Users className="h-4 w-4" />Open clients</Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/team")}><ClipboardList className="h-4 w-4" />Open team queue</Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>Create a new client workspace and start onboarding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="client_name">Client name</Label><Input id="client_name" value={clientFormData.name} onChange={(e) => setClientFormData((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label htmlFor="client_company">Company</Label><Input id="client_company" value={clientFormData.company} onChange={(e) => setClientFormData((prev) => ({ ...prev, company: e.target.value }))} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="client_email">Email</Label><Input id="client_email" value={clientFormData.email} onChange={(e) => setClientFormData((prev) => ({ ...prev, email: e.target.value }))} /></div>
              <div><Label htmlFor="client_phone">Phone</Label><Input id="client_phone" value={clientFormData.phone} onChange={(e) => setClientFormData((prev) => ({ ...prev, phone: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Onboarding path</Label>
              <Select value={clientFormData.onboardingMode} onValueChange={(value) => setClientFormData((prev) => ({ ...prev, onboardingMode: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Agency-led onboarding</SelectItem>
                  <SelectItem value="client">Client portal onboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClientDialog(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateClient} loading={submitting}>Create client</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Create a task in the agency operations queue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="task_title">Title</Label><Input id="task_title" value={taskFormData.title} onChange={(e) => setTaskFormData((prev) => ({ ...prev, title: e.target.value }))} /></div>
            <div><Label htmlFor="task_description">Description</Label><Textarea id="task_description" value={taskFormData.description} onChange={(e) => setTaskFormData((prev) => ({ ...prev, description: e.target.value }))} /></div>
            <div>
              <Label>Client</Label>
              <Select value={taskFormData.client_id} onValueChange={(value) => setTaskFormData((prev) => ({ ...prev, client_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map((client) => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Priority</Label>
                <Select value={taskFormData.priority} onValueChange={(value) => setTaskFormData((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((priority) => (<SelectItem key={priority} value={priority}>{priority}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={taskFormData.status} onValueChange={(value) => setTaskFormData((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map((status) => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="task_due">Due date</Label><Input id="task_due" type="date" value={taskFormData.due_date} onChange={(e) => setTaskFormData((prev) => ({ ...prev, due_date: e.target.value }))} /></div>
              <div>
                <Label>Assignee</Label>
                <Select value={taskFormData.assigned_to || "unassigned"} onValueChange={(value) => setTaskFormData((prev) => ({ ...prev, assigned_to: value === "unassigned" ? "" : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member) => (<SelectItem key={member.user_id} value={member.user_id}>{member.profiles?.full_name || member.profiles?.email || member.user_id}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreateTask} loading={submitting}>Create task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientPickerDialog
        open={clientPickerOpen}
        onOpenChange={(open) => {
          setClientPickerOpen(open);
          if (!open) setPendingAiAction(null);
        }}
        clients={clients}
        onSelect={(clientId) => {
          if (pendingAiAction) runAiAction(clientId, pendingAiAction);
          setPendingAiAction(null);
        }}
      />
    </div>
  );
}
