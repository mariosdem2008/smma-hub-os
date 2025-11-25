import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Clock, User } from "lucide-react";
import { format } from "date-fns";

interface TimelineCommentsProps {
  assetId: string;
  versionId: string;
}

interface Comment {
  id: string;
  text: string;
  timestamp: number;
  user_email: string;
  created_at: string;
}

export default function TimelineComments({ assetId, versionId }: TimelineCommentsProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();

    // Subscribe to real-time comments
    const channel = supabase
      .channel('timeline-comments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'approval_tasks',
          filter: `asset_version_id=eq.${versionId}`
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [versionId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('approval_tasks')
      .select('comments, profiles:approver_id(email)')
      .eq('asset_version_id', versionId)
      .single();

    if (data && data.comments) {
      const formattedComments = (data.comments as any[]).map((c, idx) => ({
        id: `${versionId}-${idx}`,
        text: c.text,
        timestamp: c.timestamp || 0,
        user_email: (data.profiles as any)?.email || 'Unknown',
        created_at: c.created_at || new Date().toISOString()
      }));
      setComments(formattedComments);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: currentTask } = await supabase
        .from('approval_tasks')
        .select('comments')
        .eq('asset_version_id', versionId)
        .eq('approver_id', user.id)
        .single();

      const existingComments = Array.isArray(currentTask?.comments) 
        ? currentTask.comments 
        : [];
      
      const newCommentObj = {
        text: newComment,
        timestamp: currentTimestamp,
        created_at: new Date().toISOString(),
        action: 'comment'
      };

      const { error } = await supabase
        .from('approval_tasks')
        .update({
          comments: [...existingComments, newCommentObj]
        })
        .eq('asset_version_id', versionId)
        .eq('approver_id', user.id);

      if (error) throw error;

      toast({
        title: "Comment added",
        description: "Your comment has been saved"
      });

      setNewComment("");
      fetchComments();
    } catch (error: any) {
      console.error("Add comment error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold">Timeline Comments</h3>
        <Badge variant="secondary">{comments.length}</Badge>
      </div>

      {/* Existing Comments */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet
          </p>
        ) : (
          comments.map(comment => (
            <Card key={comment.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{comment.user_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {comment.timestamp > 0 && (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>{formatTimestamp(comment.timestamp)}</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm">{comment.text}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(comment.created_at), 'MMM d, yyyy HH:mm')}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add New Comment */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentTimestamp}
              onChange={(e) => setCurrentTimestamp(Number(e.target.value))}
              placeholder="Timestamp (seconds)"
              className="w-32 px-2 py-1 text-sm border rounded"
              min="0"
            />
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(currentTimestamp)}
            </span>
          </div>

          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment at this timestamp..."
            rows={2}
          />

          <Button
            onClick={handleAddComment}
            disabled={loading || !newComment.trim()}
            size="sm"
            className="w-full"
          >
            Add Comment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
