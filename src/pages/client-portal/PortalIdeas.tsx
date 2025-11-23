import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { Plus, Lightbulb } from "lucide-react";

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tag: string | null;
  created_at: string;
}

interface OutletContext {
  clientId: string;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  idea: "outline",
  approved: "default",
  rejected: "destructive",
  used: "secondary",
};

const statusLabels: Record<string, string> = {
  idea: "Idea",
  approved: "Approved",
  rejected: "Rejected",
  used: "Used in Content",
};

export function PortalIdeas() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    fetchIdeas();
  }, [clientId]);

  const fetchIdeas = async () => {
    const { data } = await supabase
      .from("client_ideas")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    setIdeas(data || []);
    setLoading(false);
  };

  const handleAddIdea = async () => {
    if (!newTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your idea.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("client_ideas").insert({
        client_id: clientId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        tag: newTag.trim() || null,
        status: "idea",
      });

      if (error) throw error;

      toast({
        title: "Idea Added",
        description: "Your idea has been shared with your agency.",
      });

      setNewTitle("");
      setNewDescription("");
      setNewTag("");
      setDialogOpen(false);
      fetchIdeas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Group ideas by status
  const ideasByStatus = {
    idea: ideas.filter(i => i.status === "idea"),
    approved: ideas.filter(i => i.status === "approved"),
    rejected: ideas.filter(i => i.status === "rejected"),
    used: ideas.filter(i => i.status === "used"),
  };

  if (loading) {
    return <div>Loading ideas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ideas</h1>
          <p className="text-muted-foreground">
            Share your content ideas and track their progress
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Idea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Idea</DialogTitle>
              <DialogDescription>
                Share a content idea with your agency team
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Your idea title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your idea..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Tag (optional)</Label>
                <Input
                  id="tag"
                  placeholder="e.g., Product Launch, Behind the Scenes..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddIdea}>Submit Idea</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ideas Grid by Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.entries(ideasByStatus).map(([status, statusIdeas]) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                {statusLabels[status]} ({statusIdeas.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusIdeas.length > 0 ? (
                statusIdeas.map((idea) => (
                  <Card key={idea.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm line-clamp-2">
                        {idea.title}
                      </h4>
                      <Badge variant={statusColors[idea.status]} className="shrink-0 text-xs">
                        {statusLabels[idea.status]}
                      </Badge>
                    </div>
                    {idea.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {idea.description}
                      </p>
                    )}
                    {idea.tag && (
                      <Badge variant="outline" className="text-xs">
                        {idea.tag}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(idea.created_at).toLocaleDateString()}
                    </p>
                  </Card>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No {statusLabels[status].toLowerCase()} ideas yet
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {ideas.length === 0 && (
        <Card className="p-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Ideas Yet</h3>
          <p className="text-muted-foreground mb-4">
            Start sharing your content ideas with your agency team.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Idea
          </Button>
        </Card>
      )}
    </div>
  );
}
