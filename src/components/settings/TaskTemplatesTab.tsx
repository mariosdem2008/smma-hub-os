import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash2, BookTemplate } from "lucide-react";

const PRIORITIES = ["low", "medium", "high", "urgent"];
const TASK_STATUSES = ["todo", "in_progress", "completed"];

interface Template {
  id: string;
  name: string;
  description: string | null;
  default_priority: string;
  default_status: string;
  estimated_hours: number | null;
}

export default function TaskTemplatesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    default_priority: "medium",
    default_status: "todo",
    estimated_hours: "",
  });

  useEffect(() => {
    fetchAgencyId();
  }, [user]);

  useEffect(() => {
    if (agencyId) {
      fetchTemplates();
    }
  }, [agencyId]);

  const fetchAgencyId = async () => {
    if (!user) return;

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

    setAgencyId(agencyOwner?.id || agencyMember?.agency_id || null);
  };

  const fetchTemplates = async () => {
    if (!agencyId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("agency_id", agencyId)
      .order("name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch templates",
        variant: "destructive",
      });
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const templateData = {
        agency_id: agencyId,
        name: formData.name,
        description: formData.description || null,
        default_priority: formData.default_priority,
        default_status: formData.default_status,
        estimated_hours: formData.estimated_hours ? parseInt(formData.estimated_hours) : null,
        ...(!editingTemplate && { created_by: user?.id }),
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("task_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Template updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("task_templates")
          .insert(templateData);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Template created successfully",
        });
      }

      setFormData({
        name: "",
        description: "",
        default_priority: "medium",
        default_status: "todo",
        estimated_hours: "",
      });
      setEditingTemplate(null);
      setShowDialog(false);
      fetchTemplates();
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

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      default_priority: template.default_priority,
      default_status: template.default_status,
      estimated_hours: template.estimated_hours?.toString() || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingTemplateId) return;

    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", deletingTemplateId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      fetchTemplates();
    }
    setDeletingTemplateId(null);
  };

  const handleDialogClose = () => {
    setShowDialog(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      default_priority: "medium",
      default_status: "todo",
      estimated_hours: "",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Task Templates</h2>
          <p className="text-muted-foreground">
            Create reusable task templates for common workflows
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Template" : "Create New Template"}
              </DialogTitle>
              <DialogDescription>
                Define a reusable task template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Content Review"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Template description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-priority">Default Priority</Label>
                  <Select
                    value={formData.default_priority}
                    onValueChange={(value) => setFormData({ ...formData, default_priority: value })}
                  >
                    <SelectTrigger id="template-priority">
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
                  <Label htmlFor="template-status">Default Status</Label>
                  <Select
                    value={formData.default_status}
                    onValueChange={(value) => setFormData({ ...formData, default_status: value })}
                  >
                    <SelectTrigger id="template-status">
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
                <Label htmlFor="template-hours">Estimated Hours</Label>
                <Input
                  id="template-hours"
                  type="number"
                  min="0"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateOrUpdate} disabled={submitting}>
                {submitting ? "Saving..." : editingTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookTemplate className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create templates to streamline task creation
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1 line-clamp-2">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingTemplateId(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {template.default_priority}
                  </Badge>
                  <Badge variant="outline">
                    {template.default_status.replace("_", " ")}
                  </Badge>
                  {template.estimated_hours && (
                    <Badge variant="outline">
                      {template.estimated_hours}h
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingTemplateId} onOpenChange={() => setDeletingTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
