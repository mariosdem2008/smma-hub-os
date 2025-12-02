import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Trash2, Lock, Users, Paperclip, X, FileIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  project_id: string;
  author_agency_member: string | null;
  author_client_user: string | null;
  body: string;
  is_internal: boolean;
  attachments: { name: string; url: string; type: string }[];
  created_at: string;
  author_name?: string;
  author_email?: string;
}

interface ProjectCommentsTabProps {
  projectId: string;
  clientId: string;
}

export default function ProjectCommentsTab({ projectId, clientId }: ProjectCommentsTabProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
    fetchCurrentMember();

    // Realtime subscription
    const channel = supabase
      .channel(`pipeline-comments-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pipeline_comments',
          filter: `project_id=eq.${projectId}`
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchCurrentMember = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('agency_members')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setCurrentMemberId(data.id);
      }
    } catch (error) {
      console.error('Error fetching current member:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('pipeline_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch author info
      const memberIds = [...new Set((commentsData || []).map(c => c.author_agency_member).filter(Boolean))];
      const clientUserIds = [...new Set((commentsData || []).map(c => c.author_client_user).filter(Boolean))];

      let memberProfiles: Record<string, { name: string; email: string }> = {};
      let clientProfiles: Record<string, { name: string; email: string }> = {};

      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from('agency_members')
          .select('id, user_id')
          .in('id', memberIds);

        if (members) {
          const userIds = members.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          if (profiles) {
            members.forEach(member => {
              const profile = profiles.find(p => p.id === member.user_id);
              if (profile) {
                memberProfiles[member.id] = {
                  name: profile.full_name || profile.email,
                  email: profile.email
                };
              }
            });
          }
        }
      }

      if (clientUserIds.length > 0) {
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('id, full_name, email')
          .in('id', clientUserIds);

        if (clientUsers) {
          clientUsers.forEach(cu => {
            clientProfiles[cu.id] = {
              name: cu.full_name || cu.email,
              email: cu.email
            };
          });
        }
      }

      const enrichedComments = (commentsData || []).map(comment => {
        let authorInfo = { name: 'Unknown', email: '' };
        
        if (comment.author_agency_member && memberProfiles[comment.author_agency_member]) {
          authorInfo = memberProfiles[comment.author_agency_member];
        } else if (comment.author_client_user && clientProfiles[comment.author_client_user]) {
          authorInfo = clientProfiles[comment.author_client_user];
        }

        return {
          ...comment,
          attachments: (comment.attachments as any) || [],
          author_name: authorInfo.name,
          author_email: authorInfo.email
        };
      });

      setComments(enrichedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<{ name: string; url: string; type: string }[]> => {
    const uploadedFiles: { name: string; url: string; type: string }[] = [];
    
    for (const file of attachments) {
      const fileExt = file.name.split('.').pop();
      const filePath = `${projectId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('assets')
        .upload(filePath, file);

      if (error) {
        console.error('Upload error:', error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      uploadedFiles.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type
      });
    }

    return uploadedFiles;
  };

  const handleSubmit = async () => {
    if (!newComment.trim() && attachments.length === 0) return;
    if (!currentMemberId) {
      toast({
        title: "Error",
        description: "Could not identify current user",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      let uploadedAttachments: { name: string; url: string; type: string }[] = [];
      
      if (attachments.length > 0) {
        setUploading(true);
        uploadedAttachments = await uploadAttachments();
        setUploading(false);
      }

      const { error } = await supabase
        .from('pipeline_comments')
        .insert({
          project_id: projectId,
          author_agency_member: currentMemberId,
          body: newComment.trim(),
          is_internal: isInternal,
          attachments: uploadedAttachments
        });

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        project_id: projectId,
        actor_agency_member: currentMemberId,
        action_type: 'comment_added',
        details: { 
          is_internal: isInternal,
          has_attachments: uploadedAttachments.length > 0
        }
      });

      // Send notification for external comments
      if (!isInternal) {
        try {
          await supabase.functions.invoke('notify-assigned-editor', {
            body: {
              notification_type: 'comment_added',
              project_id: projectId,
              comment_preview: newComment.trim().substring(0, 100)
            }
          });
        } catch (notifError) {
          console.error('Notification error:', notifError);
        }
      }

      setNewComment("");
      setAttachments([]);
      toast({
        title: "Comment added",
        description: isInternal ? "Internal comment posted" : "Client comment posted"
      });
    } catch (error: any) {
      console.error('Error posting comment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to post comment",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('pipeline_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({ title: "Comment deleted" });
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive"
      });
    }
  };

  const internalComments = comments.filter(c => c.is_internal);
  const clientComments = comments.filter(c => !c.is_internal);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const CommentList = ({ items, emptyMessage }: { items: Comment[]; emptyMessage: string }) => (
    <ScrollArea className="h-[300px]">
      <div className="space-y-4 p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
        ) : (
          items.map(comment => (
            <div key={comment.id} className="flex gap-3 group">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className={comment.author_client_user ? 'bg-secondary' : 'bg-primary text-primary-foreground'}>
                  {getInitials(comment.author_name || 'U')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comment.author_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.is_internal && (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Internal
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{comment.body}</p>
                
                {/* Attachments */}
                {comment.attachments && comment.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comment.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                      >
                        {att.type?.startsWith('image/') ? (
                          <img src={att.url} alt={att.name} className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <FileIcon className="h-3 w-3" />
                        )}
                        <span className="max-w-[100px] truncate">{att.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Delete button for own comments */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(comment.id)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <Tabs defaultValue="internal" onValueChange={(v) => setIsInternal(v === 'internal')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="internal" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Internal ({internalComments.length})
          </TabsTrigger>
          <TabsTrigger value="client" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Client ({clientComments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal">
          <CommentList 
            items={internalComments} 
            emptyMessage="No internal comments yet. Start the discussion!" 
          />
        </TabsContent>

        <TabsContent value="client">
          <CommentList 
            items={clientComments} 
            emptyMessage="No client comments yet. Both agency and client can comment here." 
          />
        </TabsContent>
      </Tabs>

      {/* Comment Input */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={isInternal ? "default" : "secondary"}>
            {isInternal ? (
              <><Lock className="h-3 w-3 mr-1" /> Internal</>
            ) : (
              <><Users className="h-3 w-3 mr-1" /> Client Visible</>
            )}
          </Badge>
        </div>
        
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                <FileIcon className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={() => removeAttachment(idx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={isInternal ? "Add an internal note..." : "Add a comment visible to client..."}
            className="flex-1 min-h-[80px]"
          />
        </div>
        
        <div className="flex items-center justify-between mt-2">
          <div>
            <input
              type="file"
              id="comment-attachment"
              className="hidden"
              multiple
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('comment-attachment')?.click()}
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Attach
            </Button>
          </div>
          
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading || (!newComment.trim() && attachments.length === 0)}
          >
            {submitting || uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {uploading ? 'Uploading...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
