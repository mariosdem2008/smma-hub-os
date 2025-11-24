import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import CommentItem from "./CommentItem";

interface CommentSectionProps {
  postId: string;
  onCommentAdded?: () => void;
}

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

export default function CommentSection({ postId, onCommentAdded }: CommentSectionProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    loadComments();
    loadPostDetails();
    setupRealtime();
  }, [postId]);

  const loadPostDetails = async () => {
    const { data: post } = await supabase
      .from('posts')
      .select('client_id, clients(agency_id)')
      .eq('id', postId)
      .single();

    if (post) {
      setClientId(post.client_id);
      setAgencyId((post.clients as any)?.agency_id);
    }
  };

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get all author details
      const authorIds = [...new Set(data?.map(c => c.author_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', authorIds);

      // Check which authors are agency members
      const { data: agencyMembers } = await supabase
        .from('agency_members')
        .select('user_id, role')
        .in('user_id', authorIds);

      // Check which authors are client portal users
      const { data: clientUsers } = await supabase
        .from('client_portal_users')
        .select('user_id, role')
        .in('user_id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]));
      const agencyMap = new Map(agencyMembers?.map(m => [m.user_id, m.role]));
      const clientMap = new Map(clientUsers?.map(u => [u.user_id, u.role]));

      // Build threaded comments
      const commentsWithDetails = data?.map(comment => ({
        ...comment,
        author_name: profileMap.get(comment.author_id)?.full_name || 
                     profileMap.get(comment.author_id)?.email || 
                     'Unknown User',
        author_role: clientMap.has(comment.author_id) 
          ? `Client ${clientMap.get(comment.author_id)}` 
          : agencyMap.has(comment.author_id)
            ? agencyMap.get(comment.author_id)
            : 'Member',
      })) || [];

      // Organize into threads
      const topLevel = commentsWithDetails.filter(c => !c.parent_id);
      const threaded = topLevel.map(comment => ({
        ...comment,
        replies: commentsWithDetails.filter(c => c.parent_id === comment.id),
      }));

      setComments(threaded);
    } catch (error: any) {
      console.error('Error loading comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: comment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          agency_id: agencyId,
          author_id: user.id,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification
      await supabase.functions.invoke('send-comment-notification', {
        body: {
          commentId: comment.id,
          postId,
          clientId,
        },
      });

      setNewComment("");
      onCommentAdded?.();
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted",
      });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map(comment => (
            <CommentItem 
              key={comment.id} 
              comment={comment}
              postId={postId}
              agencyId={agencyId}
              onReplyAdded={loadComments}
            />
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Post Comment
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
