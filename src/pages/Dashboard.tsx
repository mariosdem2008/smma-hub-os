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
  Sparkles,
  TrendingUp,
  Clock,
  AlertTriangle,
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
import { format, startOfWeek, endOfWeek, isPast } from "date-fns";
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
        return "bg-gradient-to-r from-accent-purple to-accent-pink text-white shadow-sm";
      case "facebook":
        return "bg-accent-teal text-white shadow-sm";
      case "tiktok":
        return "bg-gradient-to-r from-gray-900 to-accent-teal text-white shadow-sm";
      case "linkedin":
        return "bg-accent-teal text-white shadow-sm";
      case "youtube":
        return "bg-destructive text-white shadow-sm";
      default:
        return "bg-muted text-muted-foreground shadow-sm";
    }
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
      className="space-y-6 md:space-y-8 relative"
      style={{
        transform: isMobile ? `translateY(${pullDistance}px)` : undefined,
        transition: isRefreshing ? "transform 0.3s ease-out" : "none",
      }}
    >
      {/* Subtle animated background elements */}
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

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/5 to-muted/10 rounded-3xl p-6 border border-primary/5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Welcome back, {user?.user_metadata?.full_name || "User"}!
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Here's what's happening with your clients today
            </p>
          </div>
          {canManageClients && (
            <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
              <DialogTrigger asChild>
                <Button
                  className="w-full md:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 group relative overflow-hidden"
                  style={{ minHeight: isMobile ? "44px" : undefined }}
                  onClick={() => hapticButton()}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
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
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
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
            />
            <StatCard
              title="Posts This Week"
              value={metrics.postsThisWeek}
              icon={Calendar}
              description="Scheduled for this week"
              variant="teal"
            />
            <StatCard
              title="Tasks Due This Week"
              value={metrics.tasksThisWeek}
              icon={CheckCircle2}
              description="Tasks to complete"
              variant="orange"
            />
          </div>

          {/* My Tasks */}
          {myTasks.length > 0 && (
            <Card className="border-l-4 border-l-accent-teal shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-accent-teal" />
                  <CardTitle>My Assigned Tasks</CardTitle>
                </div>
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
                        className="cursor-pointer hover:bg-muted/30 transition-colors group"
                        onClick={() => navigate(`/clients/${task.client?.id}?tab=tasks`)}
                      >
                        <TableCell>
                          <p className="font-medium group-hover:text-primary transition-colors">{task.title}</p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{task.client?.name || "Unknown"}</span>
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span
                                className={cn(
                                  isPast(new Date(task.due_date)) &&
                                    task.status !== "completed" &&
                                    "text-destructive font-medium",
                                )}
                              >
                                {format(new Date(task.due_date), "MMM d, yyyy")}
                              </span>
                              {isPast(new Date(task.due_date)) && task.status !== "completed" && (
                                <Badge variant="destructive" className="text-xs">
                                  Overdue
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(task.priority)} className="shadow-sm">
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={task.status === "in_progress" ? "secondary" : "outline"}
                            className="shadow-sm"
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
          {!dismissedPostsSection && (
            <Card className="border-l-4 border-l-accent-purple shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-accent-purple" />
                    <div>
                      <CardTitle>Upcoming Posts</CardTitle>
                      <CardDescription>Next 10 scheduled posts across all clients</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-muted rounded-full"
                    onClick={() => setDismissedPostsSection(true)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {visibleUpcomingPosts.length > 0 ? (
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
                          className="cursor-pointer hover:bg-muted/30 transition-colors group"
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
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-purple/10 to-accent-pink/10 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-accent-purple" />
                              </div>
                            )}
                            <span className="group-hover:text-primary transition-colors">
                              {post.title || "Untitled Project"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{post.client.name}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {post.platforms?.map((platform: string) => (
                                <Badge
                                  key={platform}
                                  className={cn("font-medium text-xs shadow-sm", getPlatformColor(platform))}
                                >
                                  {platform}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                              {post.scheduled_time ? format(new Date(post.scheduled_time), "MMM d, yyyy") : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(post.pipeline_stage)} className="shadow-sm">
                              {post.pipeline_stage || "scheduled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-muted rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleDismissPost(post.id, e)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-accent-purple/5 to-accent-pink/5 rounded-full flex items-center justify-center mb-4 border border-accent-purple/10">
                      <FileText className="h-6 w-6 text-accent-purple" />
                    </div>
                    <p className="text-muted-foreground mb-2 font-medium">No upcoming posts scheduled</p>
                    <p className="text-sm text-muted-foreground">Schedule posts in your client workspaces</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Overdue Tasks */}
          {!dismissedTasksSection && (
            <Card className="border-l-4 border-l-destructive/80 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <CardTitle>Overdue Tasks</CardTitle>
                      <CardDescription>Tasks that need immediate attention</CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-muted rounded-full"
                    onClick={() => setDismissedTasksSection(true)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {visibleOverdueTasks.length > 0 ? (
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
                          className="cursor-pointer hover:bg-muted/30 transition-colors group"
                          onClick={() => navigate(`/clients/${task.client.id}`)}
                        >
                          <TableCell className="font-medium group-hover:text-primary transition-colors">
                            {task.client.name}
                          </TableCell>
                          <TableCell>{task.title}</TableCell>
                          <TableCell className="text-destructive font-medium">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getPriorityBadgeVariant(task.priority)} className="shadow-sm">
                              {task.priority || "medium"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="shadow-sm">
                              {task.status?.replace("_", " ") || "pending"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-muted rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => handleDismissTask(task.id, e)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-50 to-green-50 rounded-full flex items-center justify-center mb-4 border border-green-100">
                      <CheckSquare className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-muted-foreground mb-2 font-medium">No overdue tasks</p>
                    <p className="text-sm text-muted-foreground">Great job staying on top of everything!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Clients Grid */}
          {clients.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent>
                <div className="w-20 h-20 bg-gradient-to-br from-primary/5 to-accent-purple/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <p className="mb-4 text-muted-foreground font-medium">No clients yet</p>
                <Button
                  onClick={() => setShowNewClientDialog(true)}
                  className="bg-gradient-to-r from-primary to-primary/90"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Your Clients
                </h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                  <Card
                    key={client.id}
                    className="overflow-hidden hover:border-primary/50 transition-all duration-300 cursor-pointer group hover:shadow-lg border"
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
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/5 to-accent-purple/5 text-lg font-bold text-primary group-hover:scale-105 transition-transform">
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
                        <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
                          <FileText className="h-3 w-3" />
                          <span>{client.assetCount} assets</span>
                        </div>
                        <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-lg">
                          <Video className="h-3 w-3" />
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

      {/* New Task Dialog */}
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
                  <SelectTrigger id="task-status" className="shadow-sm">
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
                <SelectTrigger id="task-assigned" className="shadow-sm">
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
