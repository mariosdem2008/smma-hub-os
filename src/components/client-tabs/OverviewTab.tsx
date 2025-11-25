import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, 
  Globe, 
  MessageSquare, 
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  FileText,
  Mail,
  Phone,
  Building
} from "lucide-react";

interface OverviewTabProps {
  clientId: string;
  client: {
    name: string;
    logo_url: string | null;
    website: string | null;
    niche: string | null;
    tone_of_voice: string | null;
    brand_colors: string[] | null;
    notes: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    status: string | null;
  };
  onNotesUpdate: (notes: string) => void;
}

interface Stats {
  totalPosts: number;
  completedTasks: number;
  upcomingPosts: number;
}

export default function OverviewTab({ clientId, client, onNotesUpdate }: OverviewTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOwner, isAdmin, canCreateContent } = useRole();
  const [stats, setStats] = useState<Stats>({
    totalPosts: 0,
    completedTasks: 0,
    upcomingPosts: 0,
  });
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [notes, setNotes] = useState(client.notes || "");
  const [saving, setSaving] = useState(false);
  const [brandColors, setBrandColors] = useState<string[]>([]);
  
  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskStatus, setTaskStatus] = useState("pending");

  useEffect(() => {
    fetchStats();
    fetchBrandColors();
  }, [clientId]);
  
  const fetchBrandColors = async () => {
    const { data } = await supabase
      .from("client_branding")
      .select("primary_color, secondary_color, accent_color, brand_palette")
      .eq("client_id", clientId)
      .maybeSingle();
    
    if (data) {
      const colors = [];
      if (data.primary_color) colors.push(data.primary_color);
      if (data.secondary_color) colors.push(data.secondary_color);
      if (data.accent_color) colors.push(data.accent_color);
      if (data.brand_palette) colors.push(...data.brand_palette);
      setBrandColors(colors);
    }
  };

  const fetchStats = async () => {
    // Fetch scheduled content
    const { count: scheduledCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "scheduled");

    // Fetch published content
    const { count: publishedCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "published");

    // Fetch upcoming content (scheduled in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const { count: upcomingCount } = await supabase
      .from("assets")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("pipeline_stage", "scheduled")
      .gte("scheduled_time", new Date().toISOString())
      .lte("scheduled_time", sevenDaysFromNow.toISOString());

    setStats({
      totalPosts: scheduledCount || 0,
      completedTasks: publishedCount || 0,
      upcomingPosts: upcomingCount || 0,
    });
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({ notes })
      .eq("id", clientId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save notes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Notes saved successfully",
      });
      onNotesUpdate(notes);
      setIsEditNotesOpen(false);
    }
    setSaving(false);
  };

  const handleAddTask = async () => {
    // Tasks feature removed - show toast
    toast({
      title: "Feature Removed",
      description: "Tasks module has been removed from MVP",
      variant: "destructive",
    });
    setIsAddTaskOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-status-active";
      case "inactive":
        return "bg-status-inactive";
      case "paused":
        return "bg-status-paused";
      default:
        return "bg-muted";
    }
  };

  const canUploadLogo = isOwner || isAdmin || canCreateContent;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column */}
      <div className="space-y-6">
        {/* Client Details Card - Only for Owners and Admins */}
        {(isOwner || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.company && (
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Company</p>
                    <p className="text-sm text-muted-foreground">{client.company}</p>
                  </div>
                </div>
              )}

              {client.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{client.email}</p>
                  </div>
                </div>
              )}

              {client.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{client.phone}</p>
                  </div>
                </div>
              )}

              {client.status && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Status</p>
                    <Badge className={getStatusColor(client.status)}>
                      {client.status}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Brand Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {client.website && (
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Website</p>
                  <a
                    href={client.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {client.website}
                  </a>
                </div>
              </div>
            )}

            {client.niche && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Niche</p>
                  <p className="text-sm text-muted-foreground">{client.niche}</p>
                </div>
              </div>
            )}

            {client.tone_of_voice && (
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Tone of Voice</p>
                  <p className="text-sm text-muted-foreground">{client.tone_of_voice}</p>
                </div>
              </div>
            )}

            {brandColors && brandColors.length > 0 && (
              <div className="flex items-start gap-3">
                <Palette className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex flex-wrap gap-2">
                    {brandColors.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                        <div
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-mono">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Notes</CardTitle>
            <Dialog open={isEditNotesOpen} onOpenChange={setIsEditNotesOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Notes
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Client Notes</DialogTitle>
                  <DialogDescription>
                    Add or update notes about this client
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this client..."
                  rows={12}
                  className="resize-none"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditNotesOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? "Saving..." : "Save Notes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No notes added yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* Key Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Key Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Scheduled</p>
                  <p className="text-2xl font-bold">{stats.totalPosts}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-500/10 p-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Published</p>
                  <p className="text-2xl font-bold">{stats.completedTasks}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-orange-500/10 p-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming Posts (7 days)</p>
                  <p className="text-2xl font-bold">{stats.upcomingPosts}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Task</DialogTitle>
                  <DialogDescription>
                    Create a new task for this client
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Title *</Label>
                    <Input
                      id="task-title"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Task title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea
                      id="task-description"
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Task description (optional)"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-priority">Priority</Label>
                      <Select value={taskPriority} onValueChange={setTaskPriority}>
                        <SelectTrigger id="task-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="task-status">Status</Label>
                      <Select value={taskStatus} onValueChange={setTaskStatus}>
                        <SelectTrigger id="task-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddTaskOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddTask} disabled={saving}>
                    {saving ? "Creating..." : "Create Task"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => setIsEditNotesOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Notes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
