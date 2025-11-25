import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ExternalLink, Instagram, Facebook, Users, Calendar, CheckCircle2, CalendarIcon, FileText, CheckSquare, X, Video } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["pending", "in_progress", "completed"];

export default function Dashboard() {
  console.log("Dashboard component rendering");
  const { user } = useAuth();
  console.log("Dashboard user:", user);
  const { canManageClients, canCreateContent } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    priority: "medium",
    status: "pending",
  });
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [dismissedPosts, setDismissedPosts] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const [dismissedPostsSection, setDismissedPostsSection] = useState(false);
  const [dismissedTasksSection, setDismissedTasksSection] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    console.log("fetchDashboardData called, user:", user);
    if (!user) return;

    setLoading(true);
    try {
      console.log("Fetching agency data...");
      // Get agency IDs for the current user (either as owner or team member)
      const { data: agencyOwner } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: agencyMember } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const agencyId = agencyOwner?.id || agencyMember?.agency_id;
      console.log("Agency ID:", agencyId);

      if (!agencyId) {
        console.log("No agency found for user");
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
        })
      );

      setClients(clientsWithCounts);

      // Calculate metrics
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get client IDs for filtering
      const clientIds = clientsData?.map((c) => c.id) || [];

      // Assets scheduled this week (in scheduled or published stage)
      const { data: assetsData } = await supabase
        .from("assets")
        .select("id")
        .in("client_id", clientIds)
        .in("pipeline_stage", ["scheduled", "published"])
        .gte("scheduled_time", weekStart.toISOString())
        .lte("scheduled_time", weekEnd.toISOString());

      setMetrics({
        totalClients: clientsData?.length || 0,
        postsThisWeek: assetsData?.length || 0,
        tasksThisWeek: 0,
      });

      // Fetch upcoming assets (next 10 scheduled/published)
      const { data: upcomingAssetsData } = await supabase
        .from("assets")
        .select(`
          id,
          filename,
          platforms,
          scheduled_time,
          pipeline_stage,
          final_caption,
          client:clients(id, name)
        `)
        .in("client_id", clientIds)
        .in("pipeline_stage", ["scheduled", "published"])
        .gte("scheduled_time", now.toISOString())
        .order("scheduled_time", { ascending: true })
        .limit(10);

      setUpcomingPosts(upcomingAssetsData || []);
      setOverdueTasks([]);
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
        return "bg-gradient-to-r from-accent-purple to-accent-pink text-white";
      case "facebook":
        return "bg-accent-teal text-white";
      case "tiktok":
        return "bg-gradient-to-r from-gray-900 to-accent-teal text-white";
      case "linkedin":
        return "bg-accent-teal text-white";
      case "youtube":
        return "bg-destructive text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleDismissPost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedPosts(prev => new Set(prev).add(postId));
  };

  const handleDismissTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedTasks(prev => new Set(prev).add(taskId));
  };

  const visibleUpcomingPosts = upcomingPosts.filter(post => !dismissedPosts.has(post.id));
  const visibleOverdueTasks = overdueTasks.filter(task => !dismissedTasks.has(task.id));

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
    const error = null; // Tasks feature removed

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      setTaskFormData({
        title: "",
        description: "",
        client_id: "",
        priority: "medium",
        status: "pending",
      });
      setTaskDueDate(undefined);
      setShowTaskDialog(false);
      fetchDashboardData();
    }
    setSubmitting(false);
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
      const { data: agencyOwner } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

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
        })
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user?.user_metadata?.full_name || "User"}</h1>
          <p className="text-muted-foreground">Manage your clients and their projects</p>
        </div>
        {canManageClients && (
          <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Client
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>
                Create a new client workspace for your agency
              </DialogDescription>
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
                <Select value={clientFormData.status} onValueChange={(value) => setClientFormData({ ...clientFormData, status: value })}>
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

      {loading ? (
        <div className="text-center text-muted-foreground">Loading dashboard...</div>
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

          {/* Upcoming Posts */}
          {!dismissedPostsSection && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Upcoming Posts</CardTitle>
                    <CardDescription>Next 10 scheduled posts across all clients</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={() => setDismissedPostsSection(true)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
            <CardContent>
              {visibleUpcomingPosts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Filename</TableHead>
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
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/clients/${post.client.id}`)}
                      >
                         <TableCell className="font-medium">{post.client.name}</TableCell>
                        <TableCell>{post.filename}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {post.platforms?.map((platform: string) => (
                              <Badge key={platform} className={cn("font-medium text-xs", getPlatformColor(platform))}>
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {post.scheduled_time
                            ? format(new Date(post.scheduled_time), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(post.pipeline_stage)}>
                            {post.pipeline_stage || "scheduled"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted"
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No upcoming posts scheduled</p>
                  <p className="text-sm text-muted-foreground">Schedule posts in your client workspaces</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Overdue Tasks */}
          {!dismissedTasksSection && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Overdue Tasks</CardTitle>
                    <CardDescription>Tasks that need immediate attention</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={() => setDismissedTasksSection(true)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
            <CardContent>
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
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/clients/${task.client.id}`)}
                      >
                        <TableCell className="font-medium">{task.client.name}</TableCell>
                        <TableCell>{task.title}</TableCell>
                        <TableCell className="text-destructive">
                          {task.due_date
                            ? format(new Date(task.due_date), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(task.priority)}>
                            {task.priority || "medium"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {task.status?.replace("_", " ") || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted"
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No overdue tasks</p>
                  <p className="text-sm text-muted-foreground">Great job staying on top of everything!</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Clients Grid */}
          {clients.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="mb-4 text-muted-foreground">No clients yet</p>
                <Button onClick={() => setShowNewClientDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <h2 className="text-2xl font-bold mb-4">Your Clients</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card 
              key={client.id} 
              className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt={client.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                      {client.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{client.name}</CardTitle>
                    {client.company && <CardDescription className="truncate">{client.company}</CardDescription>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canManageClients && (
              <DropdownMenuItem onClick={() => setShowNewClientDialog(true)}>
                <Users className="mr-2 h-4 w-4" />
                New Client
              </DropdownMenuItem>
            )}
            {canCreateContent && (
              <DropdownMenuItem onClick={() => setShowTaskDialog(true)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                New Task
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* New Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task for a client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={taskFormData.client_id}
                onValueChange={(value) =>
                  setTaskFormData({ ...taskFormData, client_id: value })
                }
              >
                <SelectTrigger id="task-client">
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
                onChange={(e) =>
                  setTaskFormData({ ...taskFormData, title: e.target.value })
                }
                placeholder="Enter task title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskFormData.description}
                onChange={(e) =>
                  setTaskFormData({ ...taskFormData, description: e.target.value })
                }
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !taskDueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskDueDate ? format(taskDueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
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
                  onValueChange={(value) =>
                    setTaskFormData({ ...taskFormData, priority: value })
                  }
                >
                  <SelectTrigger id="task-priority">
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
                  onValueChange={(value) =>
                    setTaskFormData({ ...taskFormData, status: value })
                  }
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ").charAt(0).toUpperCase() +
                          status.replace("_", " ").slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTaskDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={submitting}>
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
