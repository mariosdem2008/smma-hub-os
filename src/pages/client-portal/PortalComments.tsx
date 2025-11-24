import { useOutletContext } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Comment {
  id: string;
  action: string;
  comment: string | null;
  content_type: string;
  content_id: string;
  created_at: string;
  actor: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

interface Post {
  id: string;
  title: string;
}

export default function PortalComments() {
  const { clientId } = useOutletContext<{ clientId: string }>();
  const [comments, setComments] = useState<Comment[]>([]);
  const [posts, setPosts] = useState<Record<string, Post>>({});
  const [loading, setLoading] = useState(true);
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    fetchComments();
    subscribeToComments();
  }, [clientId, contentTypeFilter, actionFilter]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("content_activities")
        .select(`
          id,
          action,
          comment,
          content_type,
          content_id,
          created_at,
          actor:actor_id (
            id,
            full_name,
            email
          )
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (contentTypeFilter !== "all") {
        query = query.eq("content_type", contentTypeFilter);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data } = await query;

      if (data) {
        setComments(data as any);

        // Fetch related posts
        const postIds = data
          .filter((item) => item.content_type === "post")
          .map((item) => item.content_id);

        if (postIds.length > 0) {
          const { data: postsData } = await supabase
            .from("posts")
            .select("id, title")
            .in("id", postIds);

          if (postsData) {
            const postsMap: Record<string, Post> = {};
            postsData.forEach((post) => {
              postsMap[post.id] = post;
            });
            setPosts(postsMap);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel("content_activities_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_activities",
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, any> = {
      approved: "default",
      rejected: "destructive",
      submitted: "secondary",
      created: "outline",
      updated: "outline",
    };
    return variants[action] || "outline";
  };

  const getAuthorRole = (actor: Comment["actor"]) => {
    // Simple heuristic - can be improved with actual role checking
    return actor.email?.includes("client") ? "Client" : "Agency";
  };

  const handleOpenRelatedContent = (comment: Comment) => {
    if (comment.content_type === "post") {
      window.location.href = `/client-portal/${window.location.pathname.split("/")[2]}/content-calendar`;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Comments</h1>
        <p className="text-muted-foreground mt-1">
          All activity and feedback on your content
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by content" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="idea">Ideas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="submitted">In Review</SelectItem>
                <SelectItem value="created">Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No comments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <Card key={comment.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {comment.actor.full_name?.[0] || comment.actor.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <p className="font-semibold">
                              {comment.actor.full_name || comment.actor.email}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {getAuthorRole(comment.actor)}
                              </Badge>
                              <Badge variant={getActionBadge(comment.action)}>
                                {comment.action}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenRelatedContent(comment)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                        {comment.comment && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {comment.comment}
                          </p>
                        )}
                        {comment.content_type === "post" && posts[comment.content_id] && (
                          <p className="text-sm mt-2">
                            Related to: <span className="font-medium">{posts[comment.content_id].title}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
