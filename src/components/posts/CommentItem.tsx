import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Reply, Loader2 } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  author_id: string;
  parent_id: string | null;
  created_at: string;
  author_name?: string;
  author_role?: string;
  replies?: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  postId: string;
  agencyId: string;
  onReplyAdded?: () => void;
  isReply?: boolean;
}

export default function CommentItem({ 
  comment, 
  postId, 
  agencyId, 
  onReplyAdded,
  isReply = false 
}: CommentItemProps) {
  const { toast } = useToast();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          agency_id: agencyId,
          author_id: user.id,
          content: replyContent.trim(),
          parent_id: comment.id,
        });

      if (error) throw error;

      setReplyContent("");
      setShowReplyForm(false);
      onReplyAdded?.();
      
      toast({
        title: "Reply added",
        description: "Your reply has been posted",
      });
    } catch (error: any) {
      console.error('Error adding reply:', error);
      toast({
        title: "Error",
        description: "Failed to add reply",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={isReply ? "ml-12" : ""}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {getInitials(comment.author_name || 'U')}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{comment.author_name}</span>
            <Badge variant="outline" className="text-xs">
              {comment.author_role}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          
          {!isReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="h-7 text-xs"
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          )}

          {showReplyForm && (
            <form onSubmit={handleReply} className="mt-2 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                disabled={submitting}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  size="sm" 
                  disabled={submitting || !replyContent.trim()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    'Post Reply'
                  )}
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              agencyId={agencyId}
              onReplyAdded={onReplyAdded}
              isReply={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
