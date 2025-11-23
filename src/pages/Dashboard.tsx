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
import { Plus, ExternalLink, Instagram, Facebook, Users, Calendar, CheckCircle2, CalendarIcon, FileText, CheckSquare, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";

const PLATFORMS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "YouTube"];
const STATUSES = ["draft", "scheduled", "published"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["pending", "in_progress", "completed"];

export default function Dashboard() {
  const { user } = useAuth();
  const { canManageClients, canCreateContent } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    postsThisWeek: 0,
    tasksThisWeek: 0,
  });
  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    client_id: "",
    priority: "medium",
    status: "pending",
  });
  const [postFormData, setPostFormData] = useState({
    title: "",
    client_id: "",
    platform: "",
    status: "draft",
  });
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();
  const [postScheduledDate, setPostScheduledDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [dismissedPosts, setDismissedPosts] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
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

      if (!agencyId) {
        setLoading(false);
        return;
      }

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*, assets(count), ideas(count)")
        .eq("agency_id", agencyId);

      setClients(clientsData || []);

      // Calculate metrics
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get client IDs for filtering
      const clientIds = clientsData?.map((c) => c.id) || [];

      // Posts scheduled this week
      const { data: postsData } = await supabase
        .from("posts")
        .select("id")
        .in("client_id", clientIds)
        .gte("scheduled_for", weekStart.toISOString())
        .lte("scheduled_for", weekEnd.toISOString());

      // Tasks due this week
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("id")
        .in("client_id", clientIds)
        .gte("due_date", weekStart.toISOString())
        .lte("due_date", weekEnd.toISOString())
        .neq("status", "completed");

      setMetrics({
        totalClients: clientsData?.length || 0,
        postsThisWeek: postsData?.length || 0,
        tasksThisWeek: tasksData?.length || 0,
      });

      // Fetch upcoming posts (next 10)
      const { data: upcomingPostsData } = await supabase
        .from("posts")
        .select(`
          id,
          title,
          platform,
          scheduled_for,
          status,
          client:clients(id, name)
        `)
        .in("client_id", clientIds)
        .gte("scheduled_for", now.toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(10);

      setUpcomingPosts(upcomingPostsData || []);

      // Fetch overdue tasks
      const { data: overdueTasksData } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          priority,
          status,
          client:clients(id, name)
        `)
        .in("client_id", clientIds)
        .lt("due_date", now.toISOString())
        .neq("status", "completed")
        .order("due_date", { ascending: true });

      setOverdueTasks(overdueTasksData || []);
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
    const { error } = await supabase.from("tasks").insert({
      title: taskFormData.title,
      description: taskFormData.description || null,
      client_id: taskFormData.client_id,
      due_date: taskDueDate?.toISOString() || null,
      priority: taskFormData.priority,
      status: taskFormData.status,
    });

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

  const handleCreatePost = async () => {
    if (!postFormData.title || !postFormData.client_id || !postFormData.platform) {
      toast({
        title: "Validation Error",
        description: "Title, client, and platform are required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      title: postFormData.title,
      client_id: postFormData.client_id,
      platform: postFormData.platform,
      scheduled_for: postScheduledDate?.toISOString() || null,
      status: postFormData.status,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Post created successfully",
      });
      setPostFormData({
        title: "",
        client_id: "",
        platform: "",
        status: "draft",
      });
      setPostScheduledDate(undefined);
      setShowPostDialog(false);
      fetchDashboardData();
    }
    setSubmitting(false);
  };

  const handleCreateClient = async () => {
    if (!user || !newClientName.trim()) return;

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
          name: newClientName,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Client created",
        description: "Your new client has been added successfully.",
      });

      setShowNewClientDialog(false);
      setNewClientName("");
      fetchDashboardData();
      navigate(`/clients/${client.id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
              <Button onClick={handleCreateClient} className="w-full">
                Create Client
              </Button>
            </div>
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
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Posts</CardTitle>
              <CardDescription>Next 10 scheduled posts across all clients</CardDescription>
            </CardHeader>
            <CardContent>
              {visibleUpcomingPosts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
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
                        <TableCell>{post.title}</TableCell>
                        <TableCell>{post.platform || "-"}</TableCell>
                        <TableCell>
                          {post.scheduled_for
                            ? format(new Date(post.scheduled_for), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(post.status)}>
                            {post.status || "draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => handleDismissPost(post.id, e)}
                          >
                            <X className="h-4 w-4" />
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

          {/* Overdue Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Overdue Tasks</CardTitle>
              <CardDescription>Tasks that need immediate attention</CardDescription>
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
                            className="h-8 w-8"
                            onClick={(e) => handleDismissTask(task.id, e)}
                          >
                            <X className="h-4 w-4" />
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
            <Card key={client.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
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
                </div>
                <CardTitle className="mt-3">{client.name}</CardTitle>
                {client.company && <CardDescription>{client.company}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  {client.instagram_url && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.instagram_url} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {client.facebook_url && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.facebook_url} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {client.website && (
                    <Button size="icon" variant="outline" asChild>
                      <a href={client.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{client.assets?.[0]?.count || 0} Assets</span>
                  <span>{client.ideas?.[0]?.count || 0} Ideas</span>
                </div>
                <Button className="w-full" onClick={() => navigate(`/clients/${client.id}`)}>
                  View Workspace
                </Button>
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
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
            {canManageClients && (
              <DropdownMenuItem onClick={() => setShowNewClientDialog(true)}>
                <Users className="mr-2 h-4 w-4" />
                New Client
              </DropdownMenuItem>
            )}
            {canCreateContent && (
              <>
                <DropdownMenuItem onClick={() => setShowTaskDialog(true)}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  New Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowPostDialog(true)}>
                  <FileText className="mr-2 h-4 w-4" />
                  New Post
                </DropdownMenuItem>
              </>
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

      {/* New Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
            <DialogDescription>Schedule a new post for a client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-client">
                Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={postFormData.client_id}
                onValueChange={(value) =>
                  setPostFormData({ ...postFormData, client_id: value })
                }
              >
                <SelectTrigger id="post-client">
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
              <Label htmlFor="post-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="post-title"
                value={postFormData.title}
                onChange={(e) =>
                  setPostFormData({ ...postFormData, title: e.target.value })
                }
                placeholder="Enter post title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-platform">
                Platform <span className="text-destructive">*</span>
              </Label>
              <Select
                value={postFormData.platform}
                onValueChange={(value) =>
                  setPostFormData({ ...postFormData, platform: value })
                }
              >
                <SelectTrigger id="post-platform">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platform}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !postScheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {postScheduledDate ? (
                      format(postScheduledDate, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={postScheduledDate}
                    onSelect={setPostScheduledDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-status">Status</Label>
              <Select
                value={postFormData.status}
                onValueChange={(value) =>
                  setPostFormData({ ...postFormData, status: value })
                }
              >
                <SelectTrigger id="post-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPostDialog(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCreatePost} disabled={submitting}>
              {submitting ? "Creating..." : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
