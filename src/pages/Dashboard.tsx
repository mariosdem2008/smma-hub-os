import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  ExternalLink,
  Instagram,
  Facebook,
  Users,
  Calendar,
  CheckCircle2,
  CalendarIcon,
  FileText,
  CheckSquare,
  X,
  Video,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
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
import { format, startOfWeek, endOfWeek, isPast, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["todo", "in_progress", "completed"];

export default function Dashboard() {
  const { user } = useAuth();
  const { canManageClients, canCreateContent } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pull-to-refresh for mobile
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      await fetchDashboardData();
    },
  });
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [clientFormData, setClientFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
  });
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    postsThisWeek: 0,
    tasksThisWeek: 0,
  });
  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    priority: "medium",
    status: "todo",
    assigned_to: "",
  });
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [dismissedPosts, setDismissedPosts] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const [dismissedPostsSection, setDismissedPostsSection] = useState(false);
  const [dismissedTasksSection, setDismissedTasksSection] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get agency IDs for the current user (either as owner or team member)
      const { data: agencyOwner } = await supabase.from("agencies").select("id").eq("user_id", user.id).maybeSingle();

      const { data: agencyMember } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const agencyId = agencyOwner?.id || agencyMember?.agency_id;

      if (!agencyId) {
        setLoading(false);
        return;
      }

      // Fetch clients with counts
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name, email, phone, company, status, created_at, logo_url, agency_id")
        .eq("agency_id", agencyId);

      // Get asset counts and published video counts for each client
      const clientsWithCounts = await Promise.all(
        (clientsData || []).map(async (client) => {
          // Total assets count
          const { count: assetCount } = await supabase
            .from("assets")
            .select("*", { count: "exact", head: true })
            .eq("client_id", client.id);

          // Published videos count
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

      // Calculate metrics
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get client IDs for filtering
      const clientIds = clientsData?.map((c) => c.id) || [];

      // Projects scheduled this week
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id")
        .in("client_id", clientIds)
        .eq("pipeline_stage", "scheduled")
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", weekStart.toISOString())
        .lte("scheduled_time", weekEnd.toISOString());

      setMetrics({
        totalClients: clientsData?.length || 0,
        postsThisWeek: projectsData?.length || 0,
        tasksThisWeek: 0,
      });

      // Fetch upcoming scheduled projects (next 10)
      const { data: upcomingProjectsData } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          platforms,
          scheduled_time,
          pipeline_stage,
          thumbnail_url,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .eq("pipeline_stage", "scheduled")
        .not("scheduled_time", "is", null)
        .gte("scheduled_time", now.toISOString())
        .order("scheduled_time", { ascending: true })
        .limit(10);

      setUpcomingPosts(upcomingProjectsData || []);

      // Fetch overdue tasks
      const { data: overdueTasksData } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          due_date,
          priority,
          status,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .not("due_date", "is", null)
        .lt("due_date", now.toISOString())
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      setOverdueTasks(overdueTasksData || []);

      // Fetch tasks assigned to current user
      const { data: myTasksData } = await supabase
        .from("tasks")
        .select(
          `
          id,
          title,
          due_date,
          priority,
          status,
          client:clients(id, name)
        `,
        )
        .in("client_id", clientIds)
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10);

      setMyTasks(myTasksData || []);

      // Count tasks due this week
      const { count: tasksThisWeekCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientIds)
        .not("due_date", "is", null)
        .gte("due_date", weekStart.toISOString())
        .lte("due_date", weekEnd.toISOString())
        .neq("status", "completed");

      setMetrics({
        totalClients: clientsData?.length || 0,
        postsThisWeek: projectsData?.length || 0,
        tasksThisWeek: tasksThisWeekCount || 0,
      });

      // Fetch team members for task assignment
      const { data: teamMembersData } = await supabase
        .from("agency_members")
        .select(
          `
          user_id,
          role,
          profiles:user_id (
            full_name,
            email
          )
        `,
        )
        .eq("agency_id", agencyId);

      setTeamMembers(teamMembersData || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadgeVariant = (priority: string | null) => {
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
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "published":
        return "green";
      case "scheduled":
        return "teal";
      default:
        return "outline";
    }
  };

  const getPlatformColor = (platform: string | null) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm";
      case "facebook":
        return "bg-blue-600 text-white shadow-sm";
      case "tiktok":
        return "bg-gradient-to-r from-gray-900 to-teal-500 text-white shadow-sm";
      case "linkedin":
        return "bg-blue-700 text-white shadow-sm";
      case "youtube":
        return "bg-red-600 text-white shadow-sm";
      default:
        return "bg-muted text-muted-foreground shadow-sm";
    }
  };

  const getUrgencyColor = (dueDate: string) => {
    const daysUntilDue = differenceInDays(new Date(dueDate), new Date());
    if (daysUntilDue < 0) return "text-destructive";
    if (daysUntilDue <= 1) return "text-orange-500";
    if (daysUntilDue <= 3) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const handleDismissPost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedPosts((prev) => new Set(prev).add(postId));
  };

  const handleDismissTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedTasks((prev) => new Set(prev).add(taskId));
  };

  const visibleUpcomingPosts = upcomingPosts.filter((post) => !dismissedPosts.has(post.id));
  const visibleOverdueTasks = overdueTasks.filter((task) => !dismissedTasks.has(task.id));

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
      // Get agency ID
      const { data: agencyOwner } = await supabase.from("agencies").select("id").eq("user_id", user!.id).maybeSingle();

      const { data: agencyMember } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      const agencyId = agencyOwner?.id || agencyMember?.agency_id;

      const { error } = await supabase.from("tasks").insert({
        client_id: taskFormData.client_id,
        agency_id: agencyId,
        title: taskFormData.title,
        description: taskFormData.description || null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        due_date: taskDueDate ? taskDueDate.toISOString() : null,
        assigned_to: taskFormData.assigned_to || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task created successfully",
      });
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

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
      // Get agency ID for the current user (either as owner or team member)
      const { data: agencyOwner } = await supabase.from("agencies").select("id").eq("user_id", user.id).maybeSingle();

      const { data: agencyMember } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const agencyId = agencyOwner?.id || agencyMember?.agency_id;

      if (!agencyId) {
        toast({
          title: "Error",
          description: "Agency not found. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          agency_id: agencyId,
          name: clientFormData.name,
          email: clientFormData.email || null,
          phone: clientFormData.phone || null,
          company: clientFormData.company || null,
          status: clientFormData.status,
        } as any)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client created successfully",
      });

      setShowNewClientDialog(false);
      setClientFormData({ name: "", email: "", phone: "", company: "", status: "active" });
      fetchDashboardData();
      navigate(`/clients/${client.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-6 md:space-y-8"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
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

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/5 to-muted/30 rounded-2xl p-6 border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Welcome, {user?.user_metadata?.full_name || "User"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Here's what's happening with your clients today
            </p>
          </div>
          {canManageClients && (
            <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
              <DialogTrigger asChild>
                <Button
                  className="w-full md:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
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
                  <DialogDescription>Create a new client workspace for your agency</DialogDescription>
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
                      placeholder="+1 234 567 8900"
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
        </div>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          Loading dashboard...
        </div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Clients"
              value={metrics.totalClients}
              icon={Users}
              description="Active client accounts"
              variant="purple"
              trend="up"
            />
            <StatCard
              title="Posts This Week"
              value={metrics.postsThisWeek}
              icon={Calendar}
              description="Scheduled for this week"
              variant="teal"
              trend="neutral"
            />
            <StatCard
              title="Tasks Due This Week"
              value={metrics.tasksThisWeek}
              icon={CheckCircle2}
              description="Tasks to complete"
              variant="orange"
              trend="up"
            />
          </div>

          {/* My Tasks */}
          {myTasks.length > 0 && (
            <Card className="shadow-lg border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  My Assigned Tasks
                </CardTitle>
                <CardDescription>Tasks assigned to you across all clients</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => navigate(`/clients/${task.client?.id}?tab=tasks`)}
                      >
                        <TableCell>
                          <p className="font-medium group-hover:text-primary transition-colors">{task.title}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{task.client?.name || "Unknown"}</span>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className={cn("text-sm font-medium", getUrgencyColor(task.due_date))}>
                                {format(new Date(task.due_date), "MMM d, yyyy")}
                              </span>
                              {isPast(new Date(task.due_date)) && task.status !== "completed" && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(task.priority)} className="animate-in fade-in-50">
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={task.status === "in_progress" ? "secondary" : "outline"}
                            className={cn(
                              task.status === "completed" && "bg-green-100 text-green-800 hover:bg-green-200",
                            )}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Upcoming Posts */}
          {!dismissedPostsSection && visibleUpcomingPosts.length > 0 && (
            <Card className="shadow-lg border-l-4 border-l-teal-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-teal-600" />
                    <div>
                      <CardTitle>Upcoming Posts</CardTitle>
                      <CardDescription>Next 10 scheduled posts across all clients</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-muted transition-colors"
                    onClick={() => setDismissedPostsSection(true)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Platforms</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleUpcomingPosts.map((post) => (
                      <TableRow
                        key={post.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => navigate(`/clients/${post.client.id}`)}
                      >
                        <TableCell className="font-medium flex items-center gap-3">
                          {post.thumbnail_url ? (
                            <img
                              src={post.thumbnail_url}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shadow-sm group-hover:shadow-md transition-shadow"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center shadow-sm">
                              <FileText className="h-5 w-5 text-teal-700" />
                            </div>
                          )}
                          <span className="group-hover:text-teal-700 transition-colors">
                            {post.title || "Untitled Project"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{post.client.name}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {post.platforms?.map((platform: string) => (
                              <Badge
                                key={platform}
                                className={cn(
                                  "font-medium text-xs transition-transform hover:scale-105",
                                  getPlatformColor(platform),
                                )}
                              >
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={getUrgencyColor(post.scheduled_time)}>
                              {post.scheduled_time ? format(new Date(post.scheduled_time), "MMM d, yyyy") : "-"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(post.pipeline_stage)} className="animate-in fade-in-50">
                            {post.pipeline_stage || "scheduled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-muted transition-colors"
                            onClick={(e) => handleDismissPost(post.id, e)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Overdue Tasks */}
          {!dismissedTasksSection && visibleOverdueTasks.length > 0 && (
            <Card className="shadow-lg border-l-4 border-l-red-500 bg-red-50/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <CardTitle className="text-red-900">Overdue Tasks</CardTitle>
                      <CardDescription className="text-red-700">Tasks that need immediate attention</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-red-100 transition-colors"
                    onClick={() => setDismissedTasksSection(true)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleOverdueTasks.map((task) => (
                      <TableRow
                        key={task.id}
                        className="cursor-pointer hover:bg-red-100/50 transition-colors group"
                        onClick={() => navigate(`/clients/${task.client.id}`)}
                      >
                        <TableCell className="font-medium">{task.client.name}</TableCell>
                        <TableCell>
                          <span className="group-hover:text-red-700 transition-colors">{task.title}</span>
                        </TableCell>
                        <TableCell className="text-destructive font-semibold animate-pulse">
                          {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(task.priority)} className="animate-in fade-in-50">
                            {task.priority || "medium"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-white">
                            {task.status?.replace("_", " ") || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-200 transition-colors"
                            onClick={(e) => handleDismissTask(task.id, e)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Clients Grid */}
          {clients.length === 0 ? (
            <Card className="text-center py-12 shadow-lg">
              <CardContent>
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <p className="mb-4 text-muted-foreground">No clients yet</p>
                <Button
                  onClick={() => setShowNewClientDialog(true)}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Your Clients
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <Card
                    key={client.id}
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border hover:border-primary/30"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        {client.logo_url ? (
                          <img
                            src={client.logo_url}
                            alt={client.name}
                            className="h-12 w-12 rounded-xl object-cover shadow-sm group-hover:shadow-md transition-shadow"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 text-lg font-bold text-primary group-hover:scale-105 transition-transform">
                            {client.name.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="truncate group-hover:text-primary transition-colors">
                            {client.name}
                          </CardTitle>
                          {client.company && <CardDescription className="truncate">{client.company}</CardDescription>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          <span>{client.assetCount} assets</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          <span>{client.publishedVideoCount} published</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Action Button */}
      {(canManageClients || canCreateContent) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary z-40 transition-all duration-300 hover:scale-110"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 shadow-xl">
            {canManageClients && (
              <DropdownMenuItem
                onClick={() => setShowNewClientDialog(true)}
                className="cursor-pointer transition-colors"
              >
                <Users className="mr-2 h-4 w-4" />
                New Client
              </DropdownMenuItem>
            )}
            {canCreateContent && (
              <DropdownMenuItem onClick={() => setShowTaskDialog(true)} className="cursor-pointer transition-colors">
                <CheckSquare className="mr-2 h-4 w-4" />
                New Task
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
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
                <SelectTrigger id="task-client" className="transition-colors">
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
                className="transition-colors"
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
                className="transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal transition-colors",
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
                  <SelectTrigger id="task-priority" className="transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
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
                  <SelectTrigger id="task-status" className="transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ").charAt(0).toUpperCase() + status.replace("_", " ").slice(1)}
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
                <SelectTrigger id="task-assigned" className="transition-colors">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTaskDialog(false)}
              disabled={submitting}
              className="transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={submitting}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all"
            >
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
