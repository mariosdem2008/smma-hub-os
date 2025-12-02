import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, Globe, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ScheduledPost {
  id: string;
  platform: string;
  scheduled_for: string;
  status: string;
  error_message: string | null;
  platform_post_id: string | null;
  platform_permalink: string | null;
}

interface ProjectSchedulingTabProps {
  projectId: string;
}

export default function ProjectSchedulingTab({ projectId }: ProjectSchedulingTabProps) {
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduledPosts();
  }, [projectId]);

  const fetchScheduledPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("project_id", projectId)
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      setScheduledPosts(data || []);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "publishing":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "failed":
        return "bg-destructive/10 text-destructive";
      case "publishing":
        return "bg-primary/10 text-primary";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scheduledPosts.length === 0) {
    return (
      <div className="p-8 text-center">
        <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-semibold mb-2">No Scheduled Posts</h3>
        <p className="text-sm text-muted-foreground">
          This project hasn't been scheduled yet. Move it to "Approved" and schedule it to see posts here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Scheduled Posts</h3>
        <Badge variant="outline">
          {scheduledPosts.length} platform{scheduledPosts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid gap-3">
        {scheduledPosts.map((post) => (
          <Card key={post.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(post.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{post.platform}</span>
                      <Badge className={`text-xs ${getStatusColor(post.status)}`}>
                        {post.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(post.scheduled_for), "MMM d, yyyy")}
                      <Clock className="h-3 w-3 ml-2" />
                      {format(new Date(post.scheduled_for), "h:mm a")}
                    </div>
                  </div>
                </div>
                
                {post.platform_permalink && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(post.platform_permalink!, "_blank")}
                  >
                    <Globe className="h-3 w-3 mr-1" />
                    View Post
                  </Button>
                )}
              </div>

              {post.error_message && (
                <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                  {post.error_message}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
