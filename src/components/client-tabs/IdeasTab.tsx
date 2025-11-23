import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { Lightbulb, Plus, Calendar } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";

interface IdeasTabProps {
  clientId: string;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  status: string;
  created_at: string;
}

type IdeaStatus = "idea" | "approved" | "rejected" | "used";

const STATUS_COLUMNS: { id: IdeaStatus; label: string; color: string }[] = [
  { id: "idea", label: "Idea", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  { id: "approved", label: "Approved", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  { id: "rejected", label: "Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
  { id: "used", label: "Used", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
];

export default function IdeasTab({ clientId }: IdeasTabProps) {
  const { toast } = useToast();
  const { canCreateContent, isViewer } = useRole();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewIdeaOpen, setIsNewIdeaOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({
    title: "",
    description: "",
    tag: "",
  });

  useEffect(() => {
    fetchIdeas();
  }, [clientId]);

  const fetchIdeas = async () => {
    const { data, error } = await supabase
      .from("client_ideas")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching ideas:", error);
      toast({
        title: "Error",
        description: "Failed to fetch ideas",
        variant: "destructive",
      });
    } else {
      setIdeas(data || []);
    }
    setLoading(false);
  };

  const handleAddIdea = async () => {
    if (!newIdea.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("client_ideas")
      .insert({
        client_id: clientId,
        title: newIdea.title.trim(),
        description: newIdea.description.trim() || null,
        tag: newIdea.tag.trim() || null,
        status: "idea",
      })
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create idea",
        variant: "destructive",
      });
    } else {
      setIdeas([data, ...ideas]);
      setNewIdea({ title: "", description: "", tag: "" });
      setIsNewIdeaOpen(false);
      toast({
        title: "Success",
        description: "Idea created successfully",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const newStatus = destination.droppableId as IdeaStatus;
    const ideaId = draggableId;

    // Optimistic update
    setIdeas((prevIdeas) =>
      prevIdeas.map((idea) =>
        idea.id === ideaId ? { ...idea, status: newStatus } : idea
      )
    );

    // Update in database
    const { error } = await supabase
      .from("client_ideas")
      .update({ status: newStatus })
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update idea status",
        variant: "destructive",
      });
      // Revert on error
      fetchIdeas();
    } else {
      toast({
        title: "Success",
        description: "Idea status updated",
      });
    }
  };

  const getIdeasByStatus = (status: IdeaStatus) => {
    return ideas.filter((idea) => idea.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading ideas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Content Ideas Board</h2>
        </div>
        {canCreateContent && !isViewer && (
          <Dialog open={isNewIdeaOpen} onOpenChange={setIsNewIdeaOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Idea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Idea</DialogTitle>
              <DialogDescription>
                Create a new content idea for this client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newIdea.title}
                  onChange={(e) =>
                    setNewIdea({ ...newIdea, title: e.target.value })
                  }
                  placeholder="Enter idea title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newIdea.description}
                  onChange={(e) =>
                    setNewIdea({ ...newIdea, description: e.target.value })
                  }
                  placeholder="Describe the idea..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Input
                  id="tag"
                  value={newIdea.tag}
                  onChange={(e) =>
                    setNewIdea({ ...newIdea, tag: e.target.value })
                  }
                  placeholder="e.g., Educational, Promotional, Behind-the-scenes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsNewIdeaOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddIdea}>Create Idea</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* Kanban Board */}
      {isViewer && (
        <Card className="border-yellow-500/50 bg-yellow-500/10 mb-4">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              You have read-only access. You cannot move or create ideas.
            </p>
          </CardContent>
        </Card>
      )}
      <DragDropContext onDragEnd={canCreateContent && !isViewer ? handleDragEnd : () => {}}>
        <div className="flex flex-col gap-4 lg:grid lg:gap-4 lg:grid-cols-4">
          {STATUS_COLUMNS.map((column) => {
            const columnIdeas = getIdeasByStatus(column.id);
            return (
              <Card key={column.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>{column.label}</span>
                    <Badge variant="secondary" className="ml-2">
                      {columnIdeas.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-2 min-h-[200px] rounded-md p-2 transition-colors ${
                          snapshot.isDraggingOver
                            ? "bg-muted/50"
                            : ""
                        }`}
                      >
                        {columnIdeas.map((idea, index) => (
                          <Draggable
                            key={idea.id}
                            draggableId={idea.id}
                            index={index}
                            isDragDisabled={isViewer || !canCreateContent}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-move transition-shadow ${
                                  snapshot.isDragging
                                    ? "shadow-lg"
                                    : ""
                                }`}
                              >
                                <CardContent className="p-3 space-y-2">
                                  <h4 className="font-medium text-sm line-clamp-2">
                                    {idea.title}
                                  </h4>
                                  {idea.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                      {idea.description}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between pt-2">
                                    {idea.tag ? (
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {idea.tag}
                                      </Badge>
                                    ) : (
                                      <div />
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {format(
                                        new Date(idea.created_at),
                                        "MMM d"
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnIdeas.length === 0 && (
                          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                            No ideas yet
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
