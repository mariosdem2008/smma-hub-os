import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { hapticButton } from "@/lib/haptics";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientCard } from "@/components/ClientCard";
import { StatCard } from "@/components/ui/stat-card";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import {
  Plus,
  Sparkles,
  Users,
  CheckSquare,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  FileText,
  TrendingUp,
  Eye,
  Heart,
  ArrowRight,
  ClipboardList,
  ShieldAlert,
  Wand2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { format, isPast, startOfWeek, endOfWeek, addDays, differenceInHours, differenceInDays } from "date-fns";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;

// ---------- Helpers ----------
function getPriorityBadgeVariant(priority: string | null) {
  switch (priority) {
    case "urgent":
      return "destructive";
    case "high":
      return "orange";
    case "medium":
      return "purple";
    default:
      return "outline";
  }
}

function getProjectStatusBadgeVariant(stage: string | null) {
  const s = (stage || "").toLowerCase();
  if (["published"].includes(s)) return "green";
  if (["scheduled"].includes(s)) return "teal";
  if (["approved"].includes(s)) return "green";
  if (["review", "in_review", "approval_pending"].includes(s)) return "orange";
  if (["production", "in_production"].includes(s)) return "purple";
  return "outline";
}

// If your pipeline stage is stored in a different column than `status`,
// change this function only.
function getProjectStage(project: any) {
  // prefer pipeline_stage if it exists, otherwise status
  return (project?.pipeline_stage || project?.status || "").toString();
}

function calcOnboardingProxyPercent(client: any) {
  // MVP-friendly proxy until your real AI onboarding tables land.
  // Goal: give dashboard a real “AI readiness” signal today.
  // Max 100.
  let score = 0;

  // Basic identity
  if (client?.name) score += 15;
  if (client?.company) score += 15;
  if (client?.email) score += 10;
  if (client?.phone) score += 10;

  // Operational footprint
  if ((client?.assetCount || 0) > 0) score += 25;
  if ((client?.publishedVideoCount || 0) > 0) score += 25;

  return Math.min(100, score);
}

// ---------- Types (light) ----------
type ActionItem = {
  id: string;
  title: string;
  description: string;
  severity: "urgent" | "high" | "medium" | "low";
  cta: string;
  onClick: () => void;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { canManageClients, canCreateContent } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchDashboardData();
    },
  });

  const [agencyId, setAgencyId] = useState<string | null>(null);

  // dialogs
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // forms
  const [clientFormData, setClientFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
  });

  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    priority: "medium",
    status: "todo",
    assigned_to: "",
  });
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();

  // people
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // data lists
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [upcomingProjects, setUpcomingProjects] = useState<any[]>([]);
  const [reviewProjects, setReviewProjects] = useState<any[]>([]);

  // “signals” (the new dashboard’s brain)
  const [signals, setSignals] = useState({
    totalClients: 0,

    approvalsPending: 0,
    oldestApprovalAgeDays: 0,

    reviewStuck48h: 0,

    tasksDue7d: 0,
    projectsScheduled7d: 0,
    overdueTasks: 0,

    pipelineCounts: {
      idea: 0,
      production: 0,
      review: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
      other: 0,
    } as Record<string, number>,

    // keep your existing “performance” but deprioritize it
    totalImpressions30d: 0,
    totalEngagement30d: 0,
    avgEngagementRate30d: 0,

    onboardingAvg: 0,
    onboardingBelow60: 0,
  });

  // dismissals (keep your UX)
  const [dismissedProjectIds, setDismissedProjectIds] = useState<Set<string>>(new Set());
  const [dismissedOverdueTaskIds, setDismissedOverdueTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Helper: fetch team members with profiles
  const fetchTeamMembers = async (agencyId: string) => {
    try {
      const { data: members, error: membersError } = await supabase
        .from("agency_members")
        .select("user_id, role")
        .eq("agency_id", agencyId);

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const userIds = members.map((m) => m.user_id);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return members.map((member) => ({
        ...member,
        profiles: profiles?.find((p) => p.id === member.user_id) || null,
      }));
    } catch (error) {
      console.error("Error fetching team members:", error);
      return [];
    }
  };

  const getAgencyIdForUser = async (userId: string) => {
    const { data: agencyOwner } = await supabase.from("agencies").select("id").eq("user_id", userId).maybeSingle();
    const { data: agencyMember } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .maybeSingle();

    return (agencyOwner?.id || agencyMember?.agency_id || null) as string | null;
  };

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const aId = await getAgencyIdForUser(user.id);
      setAgencyId(aId);

      if (!aId) {
        setLoading(false);
        return;
      }

      // ---- Clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, email, phone, company, status, created_at, logo_url, agency_id")
        .eq("agency_id", aId);

      if (clientsError) throw clientsError;

      const baseClients = clientsData || [];
      const clientIds = baseClients.map((c) => c.id);

      // Attach counts (assets + published videos)
      const clientsWithCounts = await Promise.all(
        baseClients.map(async (client) => {
          const { count: assetCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          const { count: publishedVideoCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id)
            .eq("status", "published")
            .like("file_type", "video%");

          return {
            ...client,
            assetCount: assetCount || 0,
            publishedVideoCount: publishedVideoCount || 0,
          };
        }),
      );

      setClients(clientsWithCounts);

      // ---- Dates
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const next7d = addDays(now, 7);
      const olderThan48h = addDays(now, -2);

      // ---- Projects: scheduled next 10 (for calendar list)
      const { data: upcomingProjectsData, error: upcomingErr } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          platforms,
          scheduled_time,
          status,
          pipeline_stage,
          thumbnail_url,
          created_at,
          updated_at,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", now.toISOString())
        .order("scheduled_time", { ascending: true })
        .limit(10);

      if (upcomingErr) console.warn("upcoming projects fetch warning:", upcomingErr.message);
      setUpcomingProjects(upcomingProjectsData || []);

      // ---- Projects: approvals queue = items in Review
      // (If your pipeline uses a different value than 'review', add it to the list below.)
      const approvalStages = ["review", "in_review", "approval_pending"];
      const { data: reviewData, error: reviewErr } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          platforms,
          status,
          pipeline_stage,
          scheduled_time,
          created_at,
          updated_at,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .in("status", approvalStages) // works if you store pipeline in status
        .order("created_at", { ascending: true })
        .limit(20);

      // If the above doesn't match your schema (because stage is pipeline_stage),
      // we’ll fallback gracefully by not crashing.
      if (reviewErr) {
        console.warn("review projects fetch warning:", reviewErr.message);
        setReviewProjects([]);
      } else {
        setReviewProjects(reviewData || []);
      }

      // ---- Projects: pipeline counts (lightweight)
      const { data: pipelineData, error: pipelineErr } = await supabase
        .from("projects")
        .select("id, status, pipeline_stage, created_at, updated_at")
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (pipelineErr) console.warn("pipeline fetch warning:", pipelineErr.message);

      const pipelineCounts: Record<string, number> = {
        idea: 0,
        production: 0,
        review: 0,
        approved: 0,
        scheduled: 0,
        published: 0,
        other: 0,
      };

      const stages = (pipelineData || []).map((p) => getProjectStage(p).toLowerCase());
      for (const s of stages) {
        if (s.includes("idea")) pipelineCounts.idea += 1;
        else if (s.includes("production")) pipelineCounts.production += 1;
        else if (s.includes("review")) pipelineCounts.review += 1;
        else if (s.includes("approved")) pipelineCounts.approved += 1;
        else if (s.includes("scheduled")) pipelineCounts.scheduled += 1;
        else if (s.includes("published")) pipelineCounts.published += 1;
        else pipelineCounts.other += 1;
      }

      // ---- Projects scheduled this week + next 7d counts
      const { count: scheduledThisWeekCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", weekStart.toISOString())
        .lte("scheduled_time", weekEnd.toISOString());

      const { count: scheduledNext7dCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", now.toISOString())
        .lte("scheduled_time", next7d.toISOString());

      // ---- Tasks: overdue
      const { data: overdueTasksData, error: overdueErr } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          due_date,
          priority,
          status,
          assigned_to,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .not("due_date", "is", null)
        .lt("due_date", now.toISOString())
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      if (overdueErr) console.warn("overdue tasks fetch warning:", overdueErr.message);
      setOverdueTasks(overdueTasksData || []);

      // ---- Tasks: assigned to me
      const { data: myTasksData, error: myErr } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          due_date,
          priority,
          status,
          assigned_to,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      if (myErr) console.warn("my tasks fetch warning:", myErr.message);
      setMyTasks(myTasksData || []);

      // ---- Tasks due next 7d
      const { count: tasksNext7dCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("due_date", "is", null)
        .gte("due_date", now.toISOString())
        .lte("due_date", next7d.toISOString())
        .neq("status", "completed");

      // ---- Performance analytics (keep, but not “above the fold”)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: analyticsData, error: analyticsErr } = await supabase
        .from("social_post_metrics")
        .select("impressions, reach, likes, comments, shares, saves")
        .in("client_id", clientIds)
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      if (analyticsErr) console.warn("analytics fetch warning:", analyticsErr.message);

      const totalImpressions = analyticsData?.reduce((sum, m) => sum + (m.impressions || 0), 0) || 0;
      const totalReach = analyticsData?.reduce((sum, m) => sum + (m.reach || 0), 0) || 0;
      const totalLikes = analyticsData?.reduce((sum, m) => sum + (m.likes || 0), 0) || 0;
      const totalComments = analyticsData?.reduce((sum, m) => sum + (m.comments || 0), 0) || 0;
      const totalShares = analyticsData?.reduce((sum, m) => sum + (m.shares || 0), 0) || 0;
      const totalSaves = analyticsData?.reduce((sum, m) => sum + (m.saves || 0), 0) || 0;
      const totalEngagement = totalLikes + totalComments + totalShares + totalSaves;
      const avgEngagementRate = totalReach > 0 ? parseFloat(((totalEngagement / totalReach) * 100).toFixed(2)) : 0;

      // ---- Approvals + “stuck review > 48h”
      const reviewItems = (reviewData || []).map((p: any) => ({
        ...p,
        stage: getProjectStage(p),
      }));

      const approvalsPending = reviewItems.length;

      const oldestApprovalAgeDays =
        approvalsPending > 0
          ? Math.max(
              0,
              differenceInDays(
                now,
                new Date(reviewItems[0]?.created_at || reviewItems[0]?.updated_at || now.toISOString()),
              ),
            )
          : 0;

      const reviewStuck48h = reviewItems.filter((p: any) => {
        const ref = new Date(p?.updated_at || p?.created_at || now.toISOString());
        return differenceInHours(now, ref) >= 48;
      }).length;

      // ---- AI onboarding proxy signals
      const onboardingPercents = clientsWithCounts.map((c) => calcOnboardingProxyPercent(c));
      const onboardingAvg =
        onboardingPercents.length > 0
          ? Math.round(onboardingPercents.reduce((a, b) => a + b, 0) / onboardingPercents.length)
          : 0;
      const onboardingBelow60 = onboardingPercents.filter((p) => p < 60).length;

      // ---- Team members (task assignment)
      const teamMembersData = await fetchTeamMembers(aId);
      setTeamMembers(teamMembersData);

      setSignals({
        totalClients: clientsWithCounts.length,

        approvalsPending,
        oldestApprovalAgeDays,

        reviewStuck48h,

        tasksDue7d: tasksNext7dCount || 0,
        projectsScheduled7d: scheduledNext7dCount || 0,
        overdueTasks: (overdueTasksData || []).length,

        pipelineCounts,

        totalImpressions30d: totalImpressions,
        totalEngagement30d: totalEngagement,
        avgEngagementRate30d: avgEngagementRate,

        onboardingAvg,
        onboardingBelow60,
      });
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Dashboard error",
        description: error?.message || "Failed to load dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismissProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedProjectIds((prev) => new Set(prev).add(id));
  };

  const handleDismissOverdueTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedOverdueTaskIds((prev) => new Set(prev).add(id));
  };

  const visibleUpcomingProjects = upcomingProjects.filter((p) => !dismissedProjectIds.has(p.id));
  const visibleOverdueTasks = overdueTasks.filter((t) => !dismissedOverdueTaskIds.has(t.id));

  // ---------- Action Stack (Now zone) ----------
  const actionStack: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = [];

    // 1) Approvals pending
    if (signals.approvalsPending > 0) {
      const oldest = signals.oldestApprovalAgeDays;
      const first = reviewProjects?.[0];
      items.push({
        id: "approvals",
        title: `${signals.approvalsPending} approvals waiting`,
        description: `Oldest pending: ${oldest}d`,
        severity: oldest >= 3 ? "urgent" : "high",
        cta: "Open approvals",
        onClick: () => {
          if (first?.client?.id) navigate(`/clients/${first.client.id}`);
          else navigate(`/clients`);
        },
      });
    }

    // 2) Review stuck > 48h
    if (signals.reviewStuck48h > 0) {
      const first = reviewProjects?.find((p: any) => {
        const ref = new Date(p?.updated_at || p?.created_at);
        return differenceInHours(new Date(), ref) >= 48;
      });
      items.push({
        id: "review_stuck",
        title: `${signals.reviewStuck48h} items stuck in Review`,
        description: `More than 48h without progress`,
        severity: "high",
        cta: "Jump to stuck item",
        onClick: () => {
          if (first?.client?.id) navigate(`/clients/${first.client.id}`);
          else navigate(`/clients`);
        },
      });
    }

    // 3) Overdue tasks
    if (signals.overdueTasks > 0) {
      const first = visibleOverdueTasks?.[0];
      items.push({
        id: "overdue_tasks",
        title: `${signals.overdueTasks} overdue tasks`,
        description: `Fix these before they become client issues`,
        severity: "urgent",
        cta: "Open overdue",
        onClick: () => {
          if (first?.client?.id) navigate(`/clients/${first.client.id}?tab=tasks`);
          else navigate(`/tasks`);
        },
      });
    }

    // 4) AI onboarding below 60% (proxy)
    if (signals.onboardingBelow60 > 0) {
      const first = clients.find((c) => calcOnboardingProxyPercent(c) < 60);
      items.push({
        id: "onboarding",
        title: `${signals.onboardingBelow60} clients not AI-ready`,
        description: `Below 60% onboarding context`,
        severity: "medium",
        cta: "Fix onboarding",
        onClick: () => {
          if (first?.id) navigate(`/clients/${first.id}?tab=onboarding`);
          else navigate(`/clients`);
        },
      });
    }

    // 5) Due next 7 days (workload)
    const due = signals.tasksDue7d + signals.projectsScheduled7d;
    if (due > 0) {
      items.push({
        id: "due7d",
        title: `${due} items due in 7 days`,
        description: `${signals.projectsScheduled7d} posts + ${signals.tasksDue7d} tasks`,
        severity: "low",
        cta: "Plan week",
        onClick: () => navigate(`/calendar`),
      });
    }

    // Always keep max 7
    const orderScore = (s: ActionItem["severity"]) => (s === "urgent" ? 4 : s === "high" ? 3 : s === "medium" ? 2 : 1);

    return items.sort((a, b) => orderScore(b.severity) - orderScore(a.severity)).slice(0, 7);
  }, [signals, reviewProjects, clients, navigate, visibleOverdueTasks]);

  // ---------- Create Task ----------
  const handleCreateTask = async () => {
    if (!taskFormData.title || !taskFormData.client_id) {
      toast({
        title: "Validation Error",
        description: "Task title and client are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const aId = agencyId || (await getAgencyIdForUser(user!.id));
      if (!aId) throw new Error("Agency not found");

      const { error } = await supabase.from("tasks").insert({
        client_id: taskFormData.client_id,
        agency_id: aId,
        title: taskFormData.title,
        description: taskFormData.description || null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        due_date: taskDueDate ? taskDueDate.toISOString() : null,
        assigned_to: taskFormData.assigned_to || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Task created successfully" });

      setTaskFormData({
        title: "",
        description: "",
        client_id: "",
        priority: "medium",
        status: "todo",
        assigned_to: "",
      });
      setTaskDueDate(undefined);
      setShowTaskDialog(false);
      fetchDashboardData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Create Client ----------
  const handleCreateClient = async () => {
    if (!user || !clientFormData.name.trim()) {
      toast({
        title: "Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const aId = agencyId || (await getAgencyIdForUser(user.id));
      if (!aId) throw new Error("Agency not found");

      const clientId = crypto.randomUUID();

      const clientData = [
        {
          id: clientId,
          agency_id: aId,
          name: clientFormData.name.trim(),
          email: clientFormData.email.trim() || null,
          phone: clientFormData.phone.trim() || null,
          company: clientFormData.company.trim() || null,
          status: clientFormData.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const { data: client, error } = await supabase.from("clients").insert(clientData).select().single();
      if (error) throw error;

      toast({ title: "Success", description: "Client created successfully" });

      setShowNewClientDialog(false);
      setClientFormData({ name: "", email: "", phone: "", company: "", status: "active" });

      fetchDashboardData();
      navigate(`/clients/${client.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------
  return (
    <div
      className="space-y-6 md:space-y-8 relative"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Subtle background */}
      <div className="absolute top-10 right-8 w-20 h-20 bg-accent-purple/5 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-20 left-6 w-16 h-16 bg-accent-teal/5 rounded-full blur-lg animate-pulse delay-1000" />

      {/* Pull-to-refresh indicator */}
      {isMobile && pullDistance > 0 && (
        <div className="flex justify-center">
          <div
            className={`text-sm text-muted-foreground transition-opacity ${pullDistance > 60 ? "opacity-100" : "opacity-50"}`}
          >
            {isRefreshing ? "Refreshing..." : pullDistance > 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      {/* Header + quick actions */}
      <div className="bg-gradient-to-r from-primary/5 to-muted/10 rounded-3xl p-6 border border-primary/5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              3 priorities: approvals, pipeline flow, next 7 days.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            {canManageClients && (
              <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
                    style={{ minHeight: isMobile ? "44px" : undefined }}
                    onClick={() => hapticButton()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Client
                  </Button>
                </DialogTrigger>

                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Client</DialogTitle>
                    <DialogDescription>Create a new client workspace</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Client Name *</Label>
                      <Input
                        id="name"
                        value={clientFormData.name}
                        onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                        placeholder="Enter client name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={clientFormData.email}
                        onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={clientFormData.phone}
                        onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                        placeholder="+357 ..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={clientFormData.company}
                        onChange={(e) => setClientFormData({ ...clientFormData, company: e.target.value })}
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={clientFormData.status}
                        onValueChange={(value) => setClientFormData({ ...clientFormData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewClientDialog(false)} disabled={submitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateClient} disabled={submitting}>
                      {submitting ? "Creating..." : "Create Client"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {canCreateContent && (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowTaskDialog(true)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                New Task
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {/* “Above the fold” signals (5 cards) */}
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard
              title="Approvals Pending"
              value={signals.approvalsPending}
              icon={ClipboardList}
              description={`Oldest: ${signals.oldestApprovalAgeDays}d`}
              variant={signals.approvalsPending > 0 ? "orange" : "default"}
            />
            <StatCard
              title="Stuck in Review"
              value={signals.reviewStuck48h}
              icon={ShieldAlert}
              description="> 48h without progress"
              variant={signals.reviewStuck48h > 0 ? "orange" : "default"}
            />
            <StatCard
              title="Stuck in Review"
              value={signals.reviewStuck48h}
              icon={ShieldAlert}
              description="> 48h without progress"
              variant={signals.reviewStuck48h > 0 ? "orange" : "default"}
              className={signals.reviewStuck48h > 0 ? "border border-destructive/30" : ""}
            />

            <StatCard
              title="Due Next 7 Days"
              value={signals.tasksDue7d + signals.projectsScheduled7d}
              icon={CalendarIcon}
              description={`${signals.projectsScheduled7d} posts + ${signals.tasksDue7d} tasks`}
              variant="teal"
            />
            <StatCard
              title="AI Readiness"
              value={`${signals.onboardingAvg}%`}
              icon={Wand2}
              description={`${signals.onboardingBelow60} clients < 60%`}
              variant="purple"
            />
          </div>

          {/* 3-column dashboard */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Column A: NOW */}
            <div className="space-y-6">
              {/* Action Stack */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    <CardTitle>Action Stack</CardTitle>
                  </div>
                  <CardDescription>Top 7 actions that protect delivery + retention</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {actionStack.length === 0 ? (
                    <div className="text-sm text-muted-foreground">0 urgent actions. Keep the pipeline moving.</div>
                  ) : (
                    actionStack.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{a.title}</p>
                            <Badge
                              variant={
                                a.severity === "urgent"
                                  ? "destructive"
                                  : a.severity === "high"
                                    ? "orange"
                                    : a.severity === "medium"
                                      ? "purple"
                                      : "outline"
                              }
                              className="text-xs"
                            >
                              {a.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{a.description}</p>
                        </div>
                        <Button size="sm" onClick={a.onClick} className="shrink-0">
                          {a.cta} <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Approvals Queue */}
              <Card
                className={cn(
                  "shadow-sm hover:shadow-md transition-shadow",
                  signals.approvalsPending > 0 && "border-l-4 border-l-orange-500",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-orange-500" />
                    <CardTitle>Approvals Queue</CardTitle>
                  </div>
                  <CardDescription>Items in Review = waiting for client approval</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {reviewProjects.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reviewProjects.slice(0, 8).map((p: any) => {
                          const ref = new Date(p?.created_at || p?.updated_at);
                          const ageDays = Math.max(0, differenceInDays(new Date(), ref));
                          const stage = getProjectStage(p);
                          return (
                            <TableRow
                              key={p.id}
                              className="cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => navigate(`/clients/${p.client?.id}`)}
                            >
                              <TableCell className="font-medium">{p.title || "Untitled"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {p.client?.name || "Unknown"}
                              </TableCell>
                              <TableCell>
                                <span className={cn(ageDays >= 3 && "text-destructive font-medium")}>{ageDays}d</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={getProjectStatusBadgeVariant(stage)}>{stage || "review"}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 bg-orange-500/5 rounded-full flex items-center justify-center mb-3 border border-orange-500/10">
                        <ClipboardList className="h-6 w-6 text-orange-500" />
                      </div>
                      <p className="text-muted-foreground font-medium">0 approvals pending</p>
                      <p className="text-sm text-muted-foreground">Your Review stage is clear.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* This week overview */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-accent-teal" />
                    <CardTitle>This Week</CardTitle>
                  </div>
                  <CardDescription>Next 7 days delivery snapshot</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/10">
                    <p className="text-xs text-muted-foreground">Posts scheduled</p>
                    <p className="text-2xl font-bold">{signals.projectsScheduled7d}</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-muted/10">
                    <p className="text-xs text-muted-foreground">Tasks due</p>
                    <p className="text-2xl font-bold">{signals.tasksDue7d}</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-muted/10 col-span-2">
                    <p className="text-xs text-muted-foreground">Rule</p>
                    <p className="text-sm">If approvals &gt; 0, nothing else matters. Clear approvals first.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Column B: PIPELINE */}
            <div className="space-y-6">
              {/* Pipeline health */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <CardTitle>Pipeline Health</CardTitle>
                  </div>
                  <CardDescription>Work in motion (counts by stage)</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {(["idea", "production", "review", "approved", "scheduled", "published"] as const).map((k) => (
                    <div key={k} className="p-3 rounded-xl border bg-muted/10">
                      <p className="text-xs text-muted-foreground capitalize">{k}</p>
                      <p className="text-2xl font-bold">{signals.pipelineCounts[k] || 0}</p>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl border bg-muted/10 col-span-2">
                    <p className="text-xs text-muted-foreground">Warning signal</p>
                    <p className="text-sm">
                      Review aging:{" "}
                      <span className={cn(signals.reviewStuck48h > 0 && "text-destructive font-medium")}>
                        {signals.reviewStuck48h}
                      </span>{" "}
                      items &gt; 48h.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* My tasks (creator/manager relevance) */}
              {myTasks.length > 0 && (
                <Card className="border-l-4 border-l-accent-teal shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-accent-teal" />
                      <CardTitle>My Work</CardTitle>
                    </div>
                    <CardDescription>Tasks assigned to you</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead>Priority</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myTasks.map((t: any) => (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => navigate(`/clients/${t.client?.id}?tab=tasks`)}
                          >
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.client?.name || "Unknown"}
                            </TableCell>
                            <TableCell>
                              {t.due_date ? (
                                <span className={cn(isPast(new Date(t.due_date)) && "text-destructive font-medium")}>
                                  {format(new Date(t.due_date), "MMM d")}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getPriorityBadgeVariant(t.priority)}>{t.priority || "medium"}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Overdue tasks (operational risk) */}
              <Card
                className={cn(
                  "shadow-sm hover:shadow-md transition-shadow",
                  visibleOverdueTasks.length > 0 && "border-l-4 border-l-destructive/80",
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <CardTitle>Overdue Tasks</CardTitle>
                  </div>
                  <CardDescription>These create missed deadlines and churn</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {visibleOverdueTasks.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Due</TableHead>
                          <TableHead className="w-[50px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleOverdueTasks.map((t: any) => (
                          <TableRow
                            key={t.id}
                            className="cursor-pointer hover:bg-muted/30 transition-colors group"
                            onClick={() => navigate(`/clients/${t.client?.id}?tab=tasks`)}
                          >
                            <TableCell className="font-medium">{t.client?.name || "Unknown"}</TableCell>
                            <TableCell>{t.title}</TableCell>
                            <TableCell className="text-destructive font-medium">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {t.due_date ? format(new Date(t.due_date), "MMM d") : "-"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-muted rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDismissOverdueTask(t.id, e)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 bg-green-500/5 rounded-full flex items-center justify-center mb-3 border border-green-500/10">
                        <CheckSquare className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="text-muted-foreground font-medium">0 overdue tasks</p>
                      <p className="text-sm text-muted-foreground">Keep it this way.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Column C: CALENDAR + AI */}
            <div className="space-y-6">
              {/* Calendar + upcoming */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-accent-purple" />
                    <CardTitle>Schedule</CardTitle>
                  </div>
                  <CardDescription>Next 10 scheduled items</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CalendarComponent
                    mode="single"
                    selected={new Date()}
                    onSelect={() => {}}
                    className="rounded-xl border"
                  />
                  <div className="space-y-2">
                    {visibleUpcomingProjects.length > 0 ? (
                      visibleUpcomingProjects.slice(0, 6).map((p: any) => {
                        const stage = getProjectStage(p);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer group"
                            onClick={() => navigate(`/clients/${p.client?.id}`)}
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {p.title || "Untitled"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.client?.name || "Unknown"} •{" "}
                                {p.scheduled_time ? format(new Date(p.scheduled_time), "MMM d") : "No date"}
                              </p>
                            </div>
                            <Badge variant={getProjectStatusBadgeVariant(stage)} className="shrink-0">
                              {stage || "scheduled"}
                            </Badge>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-16 h-16 bg-accent-purple/5 rounded-full flex items-center justify-center mb-3 border border-accent-purple/10">
                          <FileText className="h-6 w-6 text-accent-purple" />
                        </div>
                        <p className="text-muted-foreground font-medium">0 scheduled items</p>
                        <p className="text-sm text-muted-foreground">Plan the next 7 days to reduce churn.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI onboarding (proxy) + shortcuts */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-primary" />
                    <CardTitle>AI Control Panel</CardTitle>
                  </div>
                  <CardDescription>AI quality depends on client context</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded-xl border bg-muted/10">
                    <p className="text-xs text-muted-foreground">Average readiness</p>
                    <p className="text-2xl font-bold">{signals.onboardingAvg}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {signals.onboardingBelow60} clients below 60% context.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => navigate("/clients")}>
                      Fix context
                    </Button>
                    <Button onClick={() => navigate("/ai")} className="bg-gradient-to-r from-primary to-primary/90">
                      Ask AI
                    </Button>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Rule: below 60% readiness → AI outputs are “guessy”. Above 80% → reliable.
                  </div>
                </CardContent>
              </Card>

              {/* Performance (kept, but not priority) */}
              <Card className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Performance (30d)</CardTitle>
                  </div>
                  <CardDescription>Useful, but not your MVP heartbeat</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/10">
                    <p className="text-xs text-muted-foreground">Impressions</p>
                    <p className="text-xl font-bold">{signals.totalImpressions30d.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-muted/10">
                    <p className="text-xs text-muted-foreground">Engagement</p>
                    <p className="text-xl font-bold">{signals.totalEngagement30d.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl border bg-muted/10 col-span-2">
                    <p className="text-xs text-muted-foreground">Avg engagement rate</p>
                    <p className="text-xl font-bold">{signals.avgEngagementRate30d}%</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Clients grid (still needed) */}
          {clients.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <div className="w-20 h-20 bg-gradient-to-br from-primary/5 to-accent-purple/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <p className="mb-4 text-muted-foreground font-medium">0 clients</p>
                <Button
                  onClick={() => setShowNewClientDialog(true)}
                  className="bg-gradient-to-r from-primary to-primary/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create first client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Clients
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <ClientCard key={client.id} client={client} onClick={() => navigate(`/clients/${client.id}`)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Button (keep your working UX) */}
      {(canManageClients || canCreateContent) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 z-40 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary group"
            >
              <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-xl">
            {canManageClients && (
              <DropdownMenuItem
                onClick={() => setShowNewClientDialog(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <Users className="h-4 w-4 text-accent-purple" />
                New Client
              </DropdownMenuItem>
            )}
            {canCreateContent && (
              <DropdownMenuItem
                onClick={() => setShowTaskDialog(true)}
                className="cursor-pointer flex items-center gap-2"
              >
                <CheckSquare className="h-4 w-4 text-accent-teal" />
                New Task
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New Task Dialog (kept) */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-accent-teal" />
              Create New Task
            </DialogTitle>
            <DialogDescription>Add a new task for a client</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={taskFormData.client_id}
                onValueChange={(value) => setTaskFormData({ ...taskFormData, client_id: value })}
              >
                <SelectTrigger id="task-client" className="shadow-sm">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="Enter task title"
                className="shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="Enter task description"
                rows={3}
                className="shadow-sm resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal shadow-sm",
                      !taskDueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskDueDate ? format(taskDueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 shadow-xl" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={taskDueDate}
                    onSelect={setTaskDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={taskFormData.priority}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}
                >
                  <SelectTrigger id="task-priority" className="shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={taskFormData.status}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value })}
                >
                  <SelectTrigger id="task-status" className="shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-assigned">Assign To</Label>
              <Select
                value={taskFormData.assigned_to}
                onValueChange={(value) => setTaskFormData({ ...taskFormData, assigned_to: value })}
              >
                <SelectTrigger id="task-assigned" className="shadow-sm">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || m.profiles?.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={submitting}
              className="bg-gradient-to-r from-accent-teal to-accent-teal/90 hover:from-accent-teal/90 hover:to-accent-teal"
            >
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
