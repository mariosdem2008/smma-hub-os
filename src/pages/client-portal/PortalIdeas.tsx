import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useHasSupabaseSession } from "@/hooks/useHasSupabaseSession";
import { Card } from "@/components/ui/card";
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
import ApprovalReviewModal from "@/components/ApprovalReviewModal";
import { format } from "date-fns";
import { PremiumInlineEmpty, PremiumLoading, PremiumPage } from "@/components/shared/PremiumPage";

type IdeaStatus = "draft" | "in_review" | "approved" | "rejected";

const statusColors: Record<IdeaStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  in_review: "border-warning/30 bg-warning/10 text-warning",
  approved: "border-success/30 bg-success/10 text-success",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

const statusLabels: Record<IdeaStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  rejected: "Rejected",
};

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[] | null;
  review_comment: string | null;
  created_at: string;
}

interface OutletContext {
  clientId: string;
}

export function PortalIdeas() {
  const { clientId } = useOutletContext<OutletContext>();
  const { toast } = useToast();
  const { hasSession, loading: sessionLoading } = useHasSupabaseSession();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewIdeaId, setReviewIdeaId] = useState<string>('');
  const [reviewIdeaTitle, setReviewIdeaTitle] = useState<string>('');

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasSession) {
      setIdeas([]);
      setLoading(false);
      return;
    }
    fetchIdeas();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`portal-ideas-${clientId}`)
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
  }, [clientId, hasSession, sessionLoading]);

  const fetchIdeas = async () => {
    const { data } = await supabase
      .from("ideas")
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
      const { error } = await supabase.from("ideas").insert({
        client_id: clientId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        tags: newTags.trim() ? newTags.split(',').map(t => t.trim()) : null,
        status: "draft",
      });

      if (error) throw error;

      toast({
        title: "Idea Added",
        description: "Your idea has been shared with your agency.",
      });

      setNewTitle("");
      setNewDescription("");
      setNewTags("");
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

  const handleStatusChange = async (ideaId: string, newStatus: IdeaStatus) => {
    if (newStatus === 'in_review') {
      const { error } = await supabase
        .from('ideas')
        .update({ status: newStatus })
        .eq('id', ideaId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to submit idea",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Idea submitted for review - Agency will be notified",
      });
      fetchIdeas();
    }
  };

  const handleReview = async (comment: string) => {
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
      return;
    }

    toast({
      title: "Success",
      description: `Idea ${reviewAction}d - Agency will be notified`,
    });
    fetchIdeas();
  };

  const ideasByStatus = {
    draft: ideas.filter((i) => i.status === "draft"),
    in_review: ideas.filter((i) => i.status === "in_review"),
    approved: ideas.filter((i) => i.status === "approved"),
    rejected: ideas.filter((i) => i.status === "rejected"),
  };

  if (loading) {
    return <PremiumLoading rows={4} />;
  }

  return (
    <PremiumPage
      eyebrow="Collaboration"
      title="Ideas"
      description="Share content ideas with your agency team and track review progress."
      actions={
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
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g. social, campaign, video"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
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
      }
    >

      {/* Ideas Grid by Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(Object.keys(ideasByStatus) as IdeaStatus[]).map((status) => (
          <div key={status} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg capitalize">{statusLabels[status]}</h3>
              <Badge variant="secondary">{ideasByStatus[status].length}</Badge>
            </div>

            <div className="space-y-3">
              {ideasByStatus[status].map((idea) => (
                <Card key={idea.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium line-clamp-2">{idea.title}</h4>
                      <Badge variant="outline" className={statusColors[idea.status as IdeaStatus]}>
                        {statusLabels[idea.status as IdeaStatus]}
                      </Badge>
                    </div>

                    {idea.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {idea.description}
                      </p>
                    )}

                    {idea.tags && idea.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {idea.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(idea.created_at), "MMM d, yyyy")}</span>
                    </div>

                    {idea.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(idea.id, "in_review")}
                        className="w-full"
                      >
                        Submit for Review
                      </Button>
                    )}

                    {idea.status === "in_review" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewIdeaId(idea.id);
                            setReviewIdeaTitle(idea.title);
                            setReviewAction('approve');
                            setReviewModalOpen(true);
                          }}
                          className="flex-1"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewIdeaId(idea.id);
                            setReviewIdeaTitle(idea.title);
                            setReviewAction('reject');
                            setReviewModalOpen(true);
                          }}
                          variant="destructive"
                          className="flex-1"
                        >
                          Reject
                        </Button>
                      </div>
                    )}

                    {idea.status === "approved" && idea.review_comment && (
                      <div className="rounded border border-success/25 bg-success/10 p-2 text-xs">
                        <p className="font-medium text-success">
                          Approval Note:
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {idea.review_comment}
                        </p>
                      </div>
                    )}

                    {idea.status === "rejected" && idea.review_comment && (
                      <div className="rounded border border-destructive/25 bg-destructive/10 p-2 text-xs">
                        <p className="font-medium text-destructive">
                          Rejection Reason:
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {idea.review_comment}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}

              {ideasByStatus[status].length === 0 && (
                <PremiumInlineEmpty
                  icon={Lightbulb}
                  title={`No ${statusLabels[status].toLowerCase()} ideas`}
                  className="py-8"
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {ideas.length === 0 && (
        <div className="space-y-4">
          <PremiumInlineEmpty
            icon={Lightbulb}
            title="No ideas yet"
            description="Start sharing your content ideas with your agency team."
          />
          <Button onClick={() => setDialogOpen(true)} className="mx-auto flex">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Idea
          </Button>
        </div>
      )}

      <ApprovalReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        contentType="idea"
        contentTitle={reviewIdeaTitle}
        action={reviewAction}
        onSubmit={handleReview}
      />
    </PremiumPage>
  );
}
