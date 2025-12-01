import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lightbulb, FileText, Link as LinkIcon } from "lucide-react";
import { AIAssistant } from "@/components/pipeline/AIAssistant";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  content_body: string | null;
  tags: string[];
  status: string;
  idea_references: any[];
  attachments: any[];
  created_at: string;
}

interface Script {
  id: string;
  title: string;
}

interface IdeaPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ideaId: string | null;
  clientId: string;
  onSave: () => void;
}

export default function IdeaPage({
  open,
  onOpenChange,
  ideaId,
  clientId,
  onSave,
}: IdeaPageProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [linkedScript, setLinkedScript] = useState<Script | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content_body: "",
    tags: "",
  });

  useEffect(() => {
    if (ideaId && open) {
      fetchIdeaDetails();
    } else {
      setIdea(null);
      setFormData({
        title: "",
        description: "",
        content_body: "",
        tags: "",
      });
    }
  }, [ideaId, open]);

  const fetchIdeaDetails = async () => {
    if (!ideaId) return;

    setLoading(true);
    try {
      const { data: ideaData, error: ideaError } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", ideaId)
        .single();

      if (ideaError) throw ideaError;

      setIdea({
        ...ideaData,
        idea_references: Array.isArray(ideaData.idea_references) ? ideaData.idea_references : [],
        attachments: Array.isArray(ideaData.attachments) ? ideaData.attachments : [],
      });
      setFormData({
        title: ideaData.title,
        description: ideaData.description || "",
        content_body: ideaData.content_body || "",
        tags: ideaData.tags?.join(", ") || "",
      });

      // Fetch linked script if any
      const { data: scriptData } = await supabase
        .from("scripts")
        .select("id, title")
        .eq("idea_id", ideaId)
        .single();

      setLinkedScript(scriptData || null);
    } catch (error) {
      console.error("Error fetching idea:", error);
      toast({
        title: "Error",
        description: "Failed to load idea details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Idea title is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const updateData = {
        title: formData.title,
        description: formData.description || null,
        content_body: formData.content_body || null,
        tags: formData.tags
          ? formData.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
          : [],
      };

      const { error } = await supabase
        .from("ideas")
        .update(updateData)
        .eq("id", ideaId);

      if (error) throw error;

      toast({
        title: "Idea Updated",
        description: "Idea has been updated successfully",
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating idea:", error);
      toast({
        title: "Error",
        description: "Failed to update idea",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !idea) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle>Idea Details</DialogTitle>
                {idea && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Created {new Date(idea.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {idea && <Badge>{idea.status}</Badge>}
            </div>
            <AIAssistant
              projectId=""
              clientId={clientId}
              onGenerateIdea={(generatedIdea) => {
                setFormData({
                  ...formData,
                  title: generatedIdea.title || formData.title,
                  description: generatedIdea.description || formData.description,
                  tags: generatedIdea.tags?.join(", ") || formData.tags,
                });
                toast({
                  title: "Idea Generated",
                  description: "AI content added to your idea fields",
                });
              }}
              onGenerateHook={() => {}}
              onGenerateScript={() => {}}
              onImproveScript={() => {}}
              onGenerateCaption={() => {}}
              onImproveCaption={() => {}}
            />
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Idea Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Morning Routine Content Series"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Brief Description</Label>
            <Textarea
              id="description"
              placeholder="Quick summary of this idea..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content_body">Detailed Content (Notion-like)</Label>
            <Textarea
              id="content_body"
              placeholder="Expand your idea here... Add detailed breakdowns, research notes, target audience insights, content angles, reference materials, etc."
              value={formData.content_body}
              onChange={(e) => setFormData({ ...formData, content_body: e.target.value })}
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use this space to fully analyze and break down your idea - no need for external docs
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="productivity, morning, health (comma separated)"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          {linkedScript && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Linked Script:</span>
                <span className="text-muted-foreground">{linkedScript.title}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Close
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
