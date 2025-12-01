import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, Clock, User } from "lucide-react";
import { format } from "date-fns";

interface Activity {
  id: string;
  actor_type: string;
  actor_id: string;
  action: string;
  payload: any;
  created_at: string;
  actor_name?: string;
  actor_email?: string;
}

interface ProjectActivityHistoryProps {
  projectId: string;
}

export default function ProjectActivityHistory({
  projectId,
}: ProjectActivityHistoryProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`project-activities-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_activities",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("project_activities")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch actor details
      const activitiesWithActors = await Promise.all(
        (data || []).map(async (activity) => {
          let actorName = "Unknown";
          let actorEmail = "";

          if (activity.actor_type === "agency") {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", activity.actor_id)
              .single();

            if (profile) {
              actorName = profile.full_name || profile.email;
              actorEmail = profile.email;
            }
          } else if (activity.actor_type === "client") {
            const { data: clientUser } = await supabase
              .from("client_users")
              .select("full_name, email")
              .eq("id", activity.actor_id)
              .single();

            if (clientUser) {
              actorName = clientUser.full_name || clientUser.email;
              actorEmail = clientUser.email;
            }
          }

          return {
            ...activity,
            actor_name: actorName,
            actor_email: actorEmail,
          };
        })
      );

      setActivities(activitiesWithActors);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "changes_requested":
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case "created":
      case "scheduled":
      case "published":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "approved":
        return "Approved";
      case "changes_requested":
        return "Changes Requested";
      case "created":
        return "Created";
      case "status_changed":
        return "Status Changed";
      case "scheduled":
        return "Scheduled";
      case "published":
        return "Published";
      case "failed":
        return "Failed";
      default:
        return action;
    }
  };

  const getActorTypeBadge = (actorType: string) => {
    switch (actorType) {
      case "client":
        return (
          <Badge variant="outline" className="text-xs">
            Client
          </Badge>
        );
      case "agency":
        return (
          <Badge variant="secondary" className="text-xs">
            Team
          </Badge>
        );
      case "system":
        return (
          <Badge variant="secondary" className="text-xs">
            System
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={activity.id}>
              <div className="flex items-start gap-3">
                <div className="mt-1">{getActionIcon(activity.action)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {getActionLabel(activity.action)}
                    </span>
                    {getActorTypeBadge(activity.actor_type)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{activity.actor_name}</span>
                    <span>•</span>
                    <Clock className="h-3 w-3" />
                    <span>
                      {format(new Date(activity.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  {activity.payload?.comment && (
                    <div className="mt-2 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <p className="whitespace-pre-wrap">
                        {activity.payload.comment}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {index < activities.length - 1 && <Separator className="my-4" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
