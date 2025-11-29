import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/hooks/useRole";
import { Plus, Pencil, Trash2, CalendarIcon, Clock, Filter, ArrowUpDown, BookTemplate } from "lucide-react";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["todo", "in_progress", "completed"];

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  created_by: string | null;
}

interface TasksTabProps {
  clientId: string;
  agencyId: string;
}

export default function TasksTab({ clientId, agencyId }: TasksTabProps) {
  const { user } = useAuth();
  const { canCreateContent } = useRole();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Filter & Sort state
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterAssigned, setFilterAssigned] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("due_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "todo",
    assigned_to: "unassigned",
  });
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();

  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();
    fetchTemplates();
  }, [clientId]);

  const fetchTeamMembers = async () => {
    const { data } = await supabase
      .from("agency_members")
      .select(`
        user_id,
        role,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq("agency_id", agencyId);

    setTeamMembers(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .eq("agency_id", agencyId)
      .order("name");

    setTemplates(data || []);
  };

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  const applyTemplate = (template: any) => {
    setTaskFormData({
      ...taskFormData,
      title: template.name,
      description: template.description || "",
      priority: template.default_priority,
      status: template.default_status,
    });
    setShowTemplateDialog(false);
  };

  const handleCreateOrUpdateTask = async () => {
    if (!taskFormData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const taskData = {
        client_id: clientId,
        agency_id: agencyId,
        title: taskFormData.title,
        description: taskFormData.description || null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        due_date: taskDueDate ? taskDueDate.toISOString() : null,
        assigned_to: taskFormData.assigned_to === "unassigned" ? null : taskFormData.assigned_to,
        ...(editingTask ? {} : { created_by: user?.id }),
      };

      if (editingTask) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingTask.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert(taskData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Task created successfully",
        });
      }

      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        assigned_to: "unassigned",
      });
      setTaskDueDate(undefined);
      setEditingTask(null);
      setShowTaskDialog(false);
      fetchTasks();
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

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      assigned_to: task.assigned_to || "unassigned",
    });
    setTaskDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setShowTaskDialog(true);
  };

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", deletingTaskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
      fetchTasks();
    }
    setDeletingTaskId(null);
  };

  const handleDialogChange = (open: boolean) => {
    setShowTaskDialog(open);
    if (!open) {
      setEditingTask(null);
      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        assigned_to: "unassigned",
      });
      setTaskDueDate(undefined);
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  const isTaskOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return isPast(new Date(dueDate));
  };

  const getAssignedMemberName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.profiles?.full_name || member?.profiles?.email || "Unknown";
  };

  // Apply filters and sorting
  const filteredAndSortedTasks = tasks
    .filter(task => {
      if (filterStatus !== "all" && task.status !== filterStatus) return false;
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;
      if (filterAssigned !== "all") {
        if (filterAssigned === "unassigned" && task.assigned_to !== null) return false;
        if (filterAssigned !== "unassigned" && task.assigned_to !== filterAssigned) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case "due_date":
          aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          break;
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Tasks</CardTitle>
          {canCreateContent && (
            <div className="flex gap-2">
              <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <BookTemplate className="mr-2 h-4 w-4" />
                    Templates
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Task Templates</DialogTitle>
                    <DialogDescription>
                      Select a template to quickly create tasks
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {templates.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No templates available. Create templates in Settings.
                      </p>
                    ) : (
                      templates.map((template) => (
                        <Card
                          key={template.id}
                          className="p-3 cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => applyTemplate(template)}
                        >
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {template.default_priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {template.default_status}
                            </Badge>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showTaskDialog} onOpenChange={handleDialogChange}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTask ? "Edit Task" : "Create New Task"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingTask ? "Update task details" : "Add a new task for this client"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="task-assigned">Assign To</Label>
                      <Select
                        value={taskFormData.assigned_to}
                        onValueChange={(value) =>
                          setTaskFormData({ ...taskFormData, assigned_to: value })
                        }
                      >
                        <SelectTrigger id="task-assigned">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
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
                      onClick={() => handleDialogChange(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateOrUpdateTask} disabled={submitting}>
                      {submitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Filters and Sorting */}
          <div className="mb-4 flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ").charAt(0).toUpperCase() + status.replace("_", " ").slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAssigned} onValueChange={setFilterAssigned}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.full_name || member.profiles?.email || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>

          {filteredAndSortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No tasks found</p>
              <p className="text-sm text-muted-foreground">
                {tasks.length === 0 ? "Create a task to get started" : "Try adjusting your filters"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getAssignedMemberName(task.assigned_to)}</span>
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className="flex items-center gap-2">
                          <span className={cn(isTaskOverdue(task.due_date) && "text-destructive")}>
                            {format(new Date(task.due_date), "MMM d, yyyy")}
                          </span>
                          {isTaskOverdue(task.due_date) && (
                            <Badge variant="destructive" className="text-xs">Overdue</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityBadgeVariant(task.priority)}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(task.status)}>
                        {task.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {canCreateContent && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTask(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingTaskId(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingTaskId} onOpenChange={() => setDeletingTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
