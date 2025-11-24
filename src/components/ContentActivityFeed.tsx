import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Send, FileEdit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  content_type: string;
  content_id: string;
  action: string;
  comment: string | null;
  created_at: string;
  actor: {
    full_name: string | null;
    email: string;
  };
}

interface ContentActivityFeedProps {
  clientId: string;
  contentType?: 'post' | 'idea' | 'all';
  limit?: number;
}

export default function ContentActivityFeed({ 
  clientId, 
  contentType = 'all',
  limit = 20 
}: ContentActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      let query = supabase
        .from("content_activities")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (contentType !== 'all') {
        query = query.eq("content_type", contentType);
      }

      const { data: activitiesData, error } = await query;

      if (error) throw error;

      // Fetch actor profiles separately
      const actorIds = [...new Set(activitiesData?.map(a => a.actor_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", actorIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const activitiesWithActors = activitiesData?.map(activity => ({
        ...activity,
        actor: profilesMap.get(activity.actor_id) || { full_name: null, email: "Unknown" }
      })) || [];

      setActivities(activitiesWithActors as any);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`activities-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_activities',
          filter: `client_id=eq.${clientId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, contentType]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'submitted':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileEdit className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'submitted':
        return 'default';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading activities...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Feed</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-1">{getActionIcon(activity.action)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {activity.actor.full_name || activity.actor.email}
                      </span>
                      <Badge variant={getActionColor(activity.action) as any}>
                        {activity.action}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {activity.content_type}
                      </Badge>
                    </div>
                    {activity.comment && (
                      <p className="text-sm text-muted-foreground">
                        "{activity.comment}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
