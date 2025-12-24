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
import { Textarea } from "@/components/ui/textarea";
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
import { ClientPickerDialog } from "@/components/ClientPickerDialog";
import { cn } from "@/lib/utils";

import {
  Plus,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  ClipboardList,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  CheckSquare,
  Wand2,
} from "lucide-react";

import { differenceInDays, differenceInHours, endOfWeek, format, startOfWeek } from "date-fns";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TASK_STATUSES = ["todo", "in_progress", "completed"] as const;

// If your pipeline stage is stored in a different column than `status`,
// change this function only.
function getProjectStage(project: any) {
  // prefer pipeline_stage if it exists, otherwise status
  return (project?.pipeline_stage || project?.status || "").toString();
}

function getReadinessSignals(client: any) {
  const hasContact = Boolean(client?.email) || Boolean(client?.phone);
  const hasAssets = (client?.assetCount || 0) > 0;
  const hasPublished = (client?.publishedVideoCount || 0) > 0;
  const trueCount = Number(hasContact) + Number(hasAssets) + Number(hasPublished);

  if (trueCount === 0) {
    return { status: "NOT_STARTED", hasContact, hasAssets, hasPublished, trueCount };
  }
  if (trueCount === 1) {
    return { status: "IN_PROGRESS", hasContact, hasAssets, hasPublished, trueCount };
  }
  return { status: "COMPLETE", hasContact, hasAssets, hasPublished, trueCount };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { canManageClients, canCreateContent } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);

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
    onboardingMode: "agency",
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
  const [reviewProjects, setReviewProjects] = useState<any[]>([]);
  const [overdueProjects, setOverdueProjects] = useState<any[]>([]);

  // GÇ£signalsGÇ¥ (the new dashboardGÇÖs brain)
  const [signals, setSignals] = useState({
    totalClients: 0,

    approvalsPending: 0,
    oldestApprovalAgeDays: 0,

    reviewStuck48h: 0,
    overdueContent: 0,

    tasksDue7d: 0,
    projectsScheduled7d: 0,

    pipelineCounts: {
      idea: 0,
      production: 0,
      review: 0,
      approved: 0,
      scheduled: 0,
      published: 0,
      other: 0,
    } as Record<string, number>,
    pipelineTotal: 0,
  });

  useEffect(() => {
    fetchDashboardData();
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
    setDataUnavailable(false);
    try {
      const aId = await getAgencyIdForUser(user.id);
      setAgencyId(aId);

      if (!aId) {
        setDataUnavailable(true);
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

      if (clientIds.length === 0) {
        setReviewProjects([]);
        setOverdueProjects([]);
        setTeamMembers([]);
        setSignals({
          totalClients: 0,
          approvalsPending: 0,
          oldestApprovalAgeDays: 0,
          reviewStuck48h: 0,
          overdueContent: 0,
          tasksDue7d: 0,
          projectsScheduled7d: 0,
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
        });
        setLoading(false);
        return;
      }

      const { data: countsData, error: countsError } = await supabase
        .from("client_asset_counts")
        .select("client_id, asset_count, published_video_count")
        .in("client_id", clientIds);

      if (countsError) {
        console.warn("client asset counts warning:", countsError.message);
        setDataUnavailable(true);
      }

      const countsByClientId = new Map(
        (countsData || []).map((row: any) => [
          row.client_id,
          {
            assetCount: row.asset_count || 0,
            publishedVideoCount: row.published_video_count || 0,
          },
        ]),
      );

      const clientsWithCounts = baseClients.map((client) => ({
        ...client,
        assetCount: countsByClientId.get(client.id)?.assetCount || 0,
        publishedVideoCount: countsByClientId.get(client.id)?.publishedVideoCount || 0,
      }));

      setClients(clientsWithCounts);

      // ---- Dates
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

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
      // weGÇÖll fallback gracefully by not crashing.
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

      // ---- Projects scheduled this week
      const { count: scheduledThisWeekCount } = await supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", weekStart.toISOString())
        .lte("scheduled_time", weekEnd.toISOString());

      // ---- Overdue content (scheduled in the past, not published)
      const { data: overdueProjectsData, error: overdueProjectsErr } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          scheduled_time,
          status,
          pipeline_stage,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .not("scheduled_time", "is", null)
        .lt("scheduled_time", now.toISOString())
        .neq("status", "published")
        .order("scheduled_time", { ascending: true })
        .limit(10);

      if (overdueProjectsErr) console.warn("overdue projects fetch warning:", overdueProjectsErr.message);
      setOverdueProjects(overdueProjectsData || []);

      // ---- Tasks due this week
      const { count: tasksThisWeekCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("due_date", "is", null)
        .gte("due_date", weekStart.toISOString())
        .lte("due_date", weekEnd.toISOString())
        .neq("status", "completed");

      // ---- Approvals + GÇ£stuck review > 48hGÇ¥
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

      // ---- Team members (task assignment)
      const teamMembersData = await fetchTeamMembers(aId);
      setTeamMembers(teamMembersData);

      setSignals({
        totalClients: clientsWithCounts.length,

        approvalsPending,
        oldestApprovalAgeDays,

        reviewStuck48h,
        overdueContent: (overdueProjectsData || []).length,

        tasksDue7d: tasksThisWeekCount || 0,
        projectsScheduled7d: scheduledThisWeekCount || 0,

        pipelineCounts,
        pipelineTotal: (pipelineData || []).length,
      });
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      setDataUnavailable(true);
      toast({
        title: "Dashboard error",
        description: error?.message || "Failed to load dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    if (!clientFormData.company.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
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
          company: clientFormData.company.trim(),
          status: clientFormData.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const { data: client, error } = await supabase.from("clients").insert(clientData).select().single();
      if (error) throw error;

      toast({ title: "Success", description: "Client created successfully" });

      setShowNewClientDialog(false);
      setClientFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "active",
        onboardingMode: "agency",
      });

      fetchDashboardData();
      if (clientFormData.onboardingMode === "agency") {
        navigate(`/onboarding/ai/client/${client.id}`);
      } else {
        navigate(`/clients/${client.id}?tab=portal`);
      }
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

  const readinessCandidates = useMemo(
    () =>
      clients
        .map((client) => ({
          ...client,
          readiness: getReadinessSignals(client),
        }))
        .sort((a, b) => a.readiness.trueCount - b.readiness.trueCount),
    [clients],
  );

  const readinessSummary = useMemo(() => {
    const summary = { NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETE: 0 };
    readinessCandidates.forEach((client) => {
      summary[client.readiness.status] += 1;
    });
    return summary;
  }, [readinessCandidates]);

  const readinessTargets = readinessCandidates
    .filter((client) => client.readiness.status !== "COMPLETE")
    .slice(0, 5);
  const itemsDueThisWeek = signals.tasksDue7d + signals.projectsScheduled7d;

  const approvalsTarget = reviewProjects[0];
  const stuckReviewTarget = reviewProjects.find((project) => {
    const ref = new Date(project?.updated_at || project?.created_at || new Date().toISOString());
    return differenceInHours(new Date(), ref) >= 48;
  });
  const overdueContentTarget = overdueProjects[0];

  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [pendingAiAction, setPendingAiAction] = useState<"strategy" | "hooks" | "captions" | null>(null);

  const runAiAction = (clientId: string, action: "strategy" | "hooks" | "captions") => {
    navigate(`/clients/${clientId}?tab=strategy&action=${action}`);
    toast({
      title: "AI action ready",
      description: "AI action ready (client selected).",
    });
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

  const handleReadinessCta = (client: any) => {
    const { hasContact, hasAssets, hasPublished } = client.readiness;
    if (!hasContact) {
      navigate(`/onboarding/ai/client/${client.id}`);
      return;
    }
    if (!hasAssets) {
      navigate(`/clients/${client.id}?tab=library&focus=assets`);
      return;
    }
    if (!hasPublished) {
      navigate(`/clients/${client.id}?tab=pipeline&focus=publish`);
      return;
    }
    navigate(`/clients/${client.id}`);
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
      <div className="absolute top-10 right-8 w-20 h-20 bg-primary/10 rounded-full blur-xl animate-pulse" />
      <div className="absolute bottom-20 left-6 w-16 h-16 bg-accent/10 rounded-full blur-lg animate-pulse delay-1000" />

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
      <div className="rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Employee Command Center
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Focus today: approvals, stalled production, and what AI can ship next.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            {canManageClients && (
              <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent shadow-lg hover:shadow-xl transition-all duration-200"
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
                      <Label htmlFor="company">Company *</Label>
                      <Input
                        id="company"
                        value={clientFormData.company}
                        onChange={(e) => setClientFormData({ ...clientFormData, company: e.target.value })}
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="onboardingMode">Onboarding Owner</Label>
                      <Select
                        value={clientFormData.onboardingMode}
                        onValueChange={(value) => setClientFormData({ ...clientFormData, onboardingMode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select onboarding owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agency">Agency completes onboarding</SelectItem>
                          <SelectItem value="client">Let client complete onboarding</SelectItem>
                        </SelectContent>
                      </Select>
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
            <p className="text-muted-foreground">Loading command center...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            {/* Block A ? Action Center */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  <CardTitle>Action Center</CardTitle>
                </div>
                <CardDescription>What needs attention before revenue is at risk.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-card/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Approvals Pending
                  </div>
                  <div className="text-3xl font-semibold">
                    {dataUnavailable ? "--" : signals.approvalsPending}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dataUnavailable
                      ? "Data unavailable. Try refreshing."
                      : `Oldest pending: ${signals.oldestApprovalAgeDays} days.`}
                  </p>
                  <Button
                    size="sm"
                    onClick={() =>
                      approvalsTarget?.client?.id
                        ? navigate(`/clients/${approvalsTarget.client.id}?tab=pipeline&focus=approvals`)
                        : navigate("/clients")
                    }
                    disabled={dataUnavailable || signals.approvalsPending === 0}
                  >
                    Review approvals
                  </Button>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-accent" />
                    Stuck &gt; 48h
                  </div>
                  <div className="text-3xl font-semibold">
                    {dataUnavailable ? "--" : signals.reviewStuck48h}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dataUnavailable
                      ? "Data unavailable. Try refreshing."
                      : "Items stalled in review for 48+ hours."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      stuckReviewTarget?.client?.id
                        ? navigate(`/clients/${stuckReviewTarget.client.id}?tab=pipeline&focus=review`)
                        : navigate("/clients")
                    }
                    disabled={dataUnavailable || signals.reviewStuck48h === 0}
                  >
                    Escalate review
                  </Button>
                </div>

                <div className="rounded-xl border border-border/70 bg-card/40 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 text-destructive" />
                    Overdue Content
                  </div>
                  <div className="text-3xl font-semibold">
                    {dataUnavailable ? "--" : signals.overdueContent}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {dataUnavailable
                      ? "Data unavailable. Try refreshing."
                      : "Scheduled content that missed its publish date."}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      overdueContentTarget?.client?.id
                        ? navigate(`/clients/${overdueContentTarget.client.id}?tab=calendar&focus=overdue`)
                        : navigate("/clients")
                    }
                    disabled={dataUnavailable || signals.overdueContent === 0}
                  >
                    Resolve content
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Block D ? AI Employee Panel */}
            <Card className="ai-surface ai-glow">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-primary" />
                  <CardTitle>AI Employee</CardTitle>
                </div>
                <CardDescription>Next best actions that save your team hours.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => handleAiActionClick("strategy")}>
                  Generate Strategy
                </Button>
                <Button className="w-full" variant="outline" onClick={() => handleAiActionClick("hooks")}>
                  Generate 10 Hooks
                </Button>
                <Button className="w-full" variant="outline" onClick={() => handleAiActionClick("captions")}>
                  Draft Captions
                </Button>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    Safety: UNKNOWN
                  </div>
                  Escalate to agency support before publishing sensitive claims.
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Block B ? Client Readiness */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle>Client Readiness</CardTitle>
                </div>
                <CardDescription>Top clients missing usable AI context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataUnavailable ? (
                  <div className="rounded-lg border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
                    Data unavailable. TODO: verify onboarding data sources.
                  </div>
                ) : clients.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">No clients yet.</p>
                    <Button onClick={() => setShowNewClientDialog(true)}>Add your first client</Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg border border-border/70 bg-card/40 p-3">
                        <p className="text-xs text-muted-foreground">NOT_STARTED</p>
                        <p className="text-lg font-semibold">{readinessSummary.NOT_STARTED}</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-card/40 p-3">
                        <p className="text-xs text-muted-foreground">IN_PROGRESS</p>
                        <p className="text-lg font-semibold">{readinessSummary.IN_PROGRESS}</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-card/40 p-3">
                        <p className="text-xs text-muted-foreground">COMPLETE</p>
                        <p className="text-lg font-semibold">{readinessSummary.COMPLETE}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {readinessTargets.length === 0 ? (
                        <div className="rounded-lg border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
                          All clients are onboarding-complete.
                        </div>
                      ) : (
                        readinessTargets.map((client) => (
                          <div
                            key={client.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/40 p-3"
                          >
                            <div>
                              <p className="font-medium">{client.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">Signals: {client.readiness.trueCount} / 3</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{client.readiness.status}</Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReadinessCta(client)}
                              >
                                {!client.readiness.hasContact
                                  ? "Complete onboarding"
                                  : !client.readiness.hasAssets
                                    ? "Add assets"
                                    : !client.readiness.hasPublished
                                      ? "Publish first post"
                                      : "View"}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Block C ? Production Health */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle>Production Health</CardTitle>
                </div>
                <CardDescription>Pipeline throughput and weekly delivery load.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dataUnavailable ? (
                  <div className="rounded-lg border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
                    Data unavailable. TODO: verify project pipeline queries.
                  </div>
                ) : signals.pipelineTotal === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-card/40 p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">No content activity yet.</p>
                    <Button onClick={() => navigate("/clients")}>Create first content item</Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Ideas", value: signals.pipelineCounts.idea },
                        { label: "Production", value: signals.pipelineCounts.production },
                        { label: "Review", value: signals.pipelineCounts.review },
                        { label: "Approved", value: signals.pipelineCounts.approved },
                        { label: "Scheduled", value: signals.pipelineCounts.scheduled },
                        { label: "Published", value: signals.pipelineCounts.published },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border border-border/70 bg-card/40 p-3">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-lg font-semibold">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/40 p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Items due this week</p>
                        <p className="text-xs text-muted-foreground">
                          {signals.projectsScheduled7d} scheduled posts + {signals.tasksDue7d} tasks
                        </p>
                      </div>
                      <div className="text-2xl font-semibold">{itemsDueThisWeek}</div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ClientPickerDialog
        open={clientPickerOpen}
        onOpenChange={(open) => {
          setClientPickerOpen(open);
          if (!open) {
            setPendingAiAction(null);
          }
        }}
        clients={clients}
        onSelect={(clientId) => {
          if (pendingAiAction) {
            runAiAction(clientId, pendingAiAction);
          }
          setPendingAiAction(null);
        }}
      />

      {/* New Task Dialog (kept) */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-accent" />
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
              className="bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent"
            >
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
