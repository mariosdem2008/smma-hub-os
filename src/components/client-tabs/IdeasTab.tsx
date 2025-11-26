import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ApprovalReviewModal from "@/components/ApprovalReviewModal";
import IdeaPage from "@/components/ideas/IdeaPage";
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
import { 
  Lightbulb, 
  Plus, 
  Trash2,
  Maximize2
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { format } from "date-fns";

interface IdeasTabProps {
  clientId: string;
}

interface Idea {
  id: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  status: string;
  review_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

type IdeaStatus = "draft" | "in_review" | "approved" | "rejected";

const STATUS_COLUMNS: { id: IdeaStatus; label: string; color: string }[] = [
  { id: "draft", label: "Draft", color: "bg-slate-100 dark:bg-slate-900" },
  { id: "in_review", label: "In Review", color: "bg-yellow-100 dark:bg-yellow-900" },
  { id: "approved", label: "Approved", color: "bg-green-100 dark:bg-green-900" },
  { id: "rejected", label: "Rejected", color: "bg-red-100 dark:bg-red-900" },
];

export default function IdeasBoard({ clientId }: IdeasTabProps) {
  const { toast } = useToast();
  const { canCreateContent, isViewer, role, loading: roleLoading } = useRole();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({
    title: "",
    description: "",
    tags: "",
  });
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewIdeaId, setReviewIdeaId] = useState<string>('');
  const [reviewIdeaTitle, setReviewIdeaTitle] = useState<string>('');
  const [ideaPageOpen, setIdeaPageOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  useEffect(() => {
    fetchIdeas();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`ideas-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ideas',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchIdeas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchIdeas = async () => {
    const { data, error } = await supabase
      .from("ideas")
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
      .from("ideas")
      .insert({
        client_id: clientId,
        title: newIdea.title.trim(),
        description: newIdea.description.trim() || null,
        tags: newIdea.tags.trim() ? newIdea.tags.split(',').map(t => t.trim()) : null,
        status: "draft",
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
      setNewIdea({ title: "", description: "", tags: "" });
      setDialogOpen(false);
      toast({
        title: "Success",
        description: "Idea created successfully",
      });
    }
  };

  const updateIdeaStatus = async (ideaId: string, newStatus: IdeaStatus, sendNotification = false) => {
    const idea = ideas.find(i => i.id === ideaId);
    
    const { error } = await supabase
      .from("ideas")
      .update({ status: newStatus })
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update idea status",
        variant: "destructive",
      });
      return;
    }

    // Send email notification if needed
    if (sendNotification && idea && newStatus === 'in_review') {
      await supabase.functions.invoke("send-approval-notification", {
        body: {
          contentType: 'idea',
          contentId: ideaId,
          contentTitle: idea.title,
          clientId: clientId,
          action: 'submitted',
        }
      });
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    const { error } = await supabase
      .from("ideas")
      .delete()
      .eq("id", ideaId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete idea",
        variant: "destructive",
      });
    } else {
      setIdeas((prevIdeas) => prevIdeas.filter((i) => i.id !== ideaId));
      toast({
        title: "Success",
        description: "Idea deleted",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const idea = ideas.find(i => i.id === draggableId);
    if (!idea) return;

    const fromStatus = source.droppableId as IdeaStatus;
    const toStatus = destination.droppableId as IdeaStatus;

    // Validate workflow transition based on role
    if (isViewer) {
      toast({
        title: "Permission Denied",
        description: "You don't have permission to move ideas",
        variant: "destructive",
      });
      return;
    }

    const canApprove = role === 'owner' || role === 'admin' || role === 'manager';
    
    // Creators can only submit (draft → in_review)
    if (!canApprove) {
      if (!(fromStatus === 'draft' && toStatus === 'in_review')) {
        toast({
          title: "Permission Denied",
          description: "You can only submit drafts for review",
          variant: "destructive",
        });
        return;
      }
    }
    
    // For approve/reject actions, use modal for comment collection
    if (toStatus === 'approved' || toStatus === 'rejected') {
      setReviewIdeaId(draggableId);
      setReviewIdeaTitle(idea.title);
      setReviewAction(toStatus === 'approved' ? 'approve' : 'reject');
      setReviewModalOpen(true);
      return;
    }

    await updateIdeaStatus(draggableId, toStatus, toStatus === 'in_review');

    // Show helpful message based on status
    const messages = {
      draft: "Moved back to Draft",
      in_review: "Submitted for Review - Client will be notified",
    };

    toast({
      title: "Status Updated",
      description: messages[toStatus] || "Idea status updated",
    });
  };

  const handleReviewSubmit = async (comment: string) => {
    const newStatus = reviewAction === 'approve' ? 'approved' : 'rejected';
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('ideas')
      .update({ 
        status: newStatus,
        review_comment: comment || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', reviewIdeaId);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to ${reviewAction} idea`,
        variant: "destructive",
      });
      console.error(error);
      return;
    }

    // Send email notification
    await supabase.functions.invoke("send-approval-notification", {
      body: {
        contentType: 'idea',
        contentId: reviewIdeaId,
        contentTitle: reviewIdeaTitle,
        clientId: clientId,
        action: reviewAction === 'approve' ? 'approved' : 'rejected',
        comment: comment || undefined,
      }
    });

    toast({
      title: "Success",
      description: `Idea ${reviewAction}d - Agency will be notified`,
    });
    fetchIdeas();
  };

  const openReviewModal = (ideaId: string, ideaTitle: string, action: 'approve' | 'reject') => {
    setReviewIdeaId(ideaId);
    setReviewIdeaTitle(ideaTitle);
    setReviewAction(action);
    setReviewModalOpen(true);
  };

  const getIdeasByStatus = (status: IdeaStatus) => {
    return ideas.filter((idea) => idea.status === status);
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading ideas...</div>
      </div>
    );
  }

  const canSubmit = canCreateContent && !isViewer;
  const canApprove = role === 'owner' || role === 'admin' || role === 'manager';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Content Ideas Board</h2>
        </div>
        {canSubmit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={newIdea.tags}
                    onChange={(e) =>
                      setNewIdea({ ...newIdea, tags: e.target.value })
                    }
                    placeholder="e.g. social, campaign, video"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddIdea}>Create Idea</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.id} className="flex flex-col">
              <div className={`p-4 rounded-lg ${column.color} mb-2`}>
                <h3 className="font-semibold text-sm">{column.label}</h3>
                <span className="text-xs opacity-70">
                  {getIdeasByStatus(column.id).length} ideas
                </span>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 rounded-lg border-2 border-dashed min-h-[200px] ${
                      snapshot.isDraggingOver 
                        ? "bg-primary/10 border-primary" 
                        : "border-border/50"
                    }`}
                  >
                    <div className="space-y-2">
                      {getIdeasByStatus(column.id).map((idea, index) => (
                        <Draggable
                          key={idea.id}
                          draggableId={idea.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-3 cursor-move ${
                                snapshot.isDragging ? "shadow-lg" : ""
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-medium text-sm line-clamp-2 flex-1">
                                    {idea.title}
                                  </h4>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedIdeaId(idea.id);
                                      setIdeaPageOpen(true);
                                    }}
                                  >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {idea.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {idea.description}
                                  </p>
                                )}
                                {idea.tags && idea.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {idea.tags.map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(idea.created_at), "MMM d, yyyy")}
                                </p>

                                {idea.review_comment && (
                                  <div className={`text-xs p-2 rounded border ${
                                    idea.status === 'approved' 
                                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                                      : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                                  }`}>
                                    <p className="font-medium">
                                      {idea.status === 'approved' ? 'Approval Note:' : 'Rejection Reason:'}
                                    </p>
                                    <p className="mt-1">{idea.review_comment}</p>
                                  </div>
                                )}

                                <div className="flex gap-2 mt-3 flex-wrap">
                                  {idea.status === 'draft' && canSubmit && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateIdeaStatus(idea.id, 'in_review', true)}
                                    >
                                      Submit for Review
                                    </Button>
                                  )}
                                  {idea.status === 'in_review' && canApprove && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => openReviewModal(idea.id, idea.title, 'approve')}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => openReviewModal(idea.id, idea.title, 'reject')}
                                        variant="destructive"
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  {idea.status === 'rejected' && canApprove && (
                                    <Button
                                      size="sm"
                                      onClick={() => updateIdeaStatus(idea.id, 'draft')}
                                      variant="outline"
                                    >
                                      Revert to Draft
                                    </Button>
                                  )}
                                  {canApprove && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeleteIdea(idea.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>

                    {getIdeasByStatus(column.id).length === 0 && (
                      <div className="text-center p-8 text-muted-foreground text-sm">
                        No {column.label.toLowerCase()}
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <ApprovalReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        contentType="idea"
        contentTitle={reviewIdeaTitle}
        action={reviewAction}
        onSubmit={handleReviewSubmit}
      />

      <IdeaPage
        open={ideaPageOpen}
        onOpenChange={setIdeaPageOpen}
        ideaId={selectedIdeaId}
        clientId={clientId}
        onSave={fetchIdeas}
      />
    </div>
  );
}
