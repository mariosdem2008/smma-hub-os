import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ExternalLink, Instagram, Facebook, Users, Calendar, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, isPast } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
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

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) {
        setLoading(false);
        return;
      }

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*, assets(count), ideas(count)")
        .eq("agency_id", agencies.id);

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
        return "default";
      case "medium":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case "published":
        return "default";
      case "scheduled":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleCreateClient = async () => {
    if (!user || !newClientName.trim()) return;

    try {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!agencies) {
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
          agency_id: agencies.id,
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
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground">Loading dashboard...</div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalClients}</div>
                <p className="text-xs text-muted-foreground">
                  Active client accounts
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Posts This Week</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.postsThisWeek}</div>
                <p className="text-xs text-muted-foreground">
                  Scheduled for this week
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasks Due This Week</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.tasksThisWeek}</div>
                <p className="text-xs text-muted-foreground">
                  Tasks to complete
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Posts */}
          {upcomingPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Posts</CardTitle>
                <CardDescription>Next 10 scheduled posts across all clients</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingPosts.map((post) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Overdue Tasks</CardTitle>
                <CardDescription>Tasks that need immediate attention</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueTasks.map((task) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </div>
  );
}
