import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Loader2, 
  ArrowRight, 
  UserCheck, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare, 
  Upload, 
  Calendar, 
  Globe, 
  XCircle,
  ThumbsUp,
  ThumbsDown,
  File
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityLog {
  id: string;
  project_id: string;
  actor_agency_member: string | null;
  actor_client_user: string | null;
  action_type: string;
  details: Record<string, any>;
  created_at: string;
  actor_name?: string;
  actor_type?: 'agency' | 'client' | 'system';
}

interface ProjectActivityLogProps {
  projectId: string;
}

const REJECTION_CATEGORY_LABELS: Record<string, string> = {
  wrong_tone: "Wrong Tone",
  wrong_branding: "Wrong Branding",
  incorrect_dimensions: "Incorrect Dimensions",
  typo_or_mistake: "Typo or Mistake",
  request_change: "Request Change",
  want_different_style: "Want Different Style",
  need_different_clip: "Need Different Clip",
};

const ACTION_CONFIG: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
  stage_changed: { icon: ArrowRight, label: 'Stage Changed', color: 'text-blue-500' },
  assigned_to_changed: { icon: UserCheck, label: 'Assignment Changed', color: 'text-purple-500' },
  rejection_added: { icon: AlertCircle, label: 'Rejection Added', color: 'text-amber-500' },
  rejection_cleared: { icon: CheckCircle, label: 'Rejection Cleared', color: 'text-green-500' },
  comment_added: { icon: MessageSquare, label: 'Comment Added', color: 'text-blue-400' },
  final_asset_uploaded: { icon: Upload, label: 'Final Asset Uploaded', color: 'text-indigo-500' },
  scheduled_time_set: { icon: Calendar, label: 'Scheduled', color: 'text-cyan-500' },
  auto_published_success: { icon: Globe, label: 'Published', color: 'text-green-500' },
  auto_published_failed: { icon: XCircle, label: 'Publish Failed', color: 'text-destructive' },
  client_approved: { icon: ThumbsUp, label: 'Client Approved', color: 'text-green-500' },
  client_rejected: { icon: ThumbsDown, label: 'Client Requested Changes', color: 'text-amber-500' },
  file_uploaded: { icon: File, label: 'File Uploaded', color: 'text-muted-foreground' },
  status_changed: { icon: ArrowRight, label: 'Status Changed', color: 'text-blue-500' },
  changes_requested: { icon: ThumbsDown, label: 'Changes Requested', color: 'text-amber-500' },
  approved: { icon: ThumbsUp, label: 'Approved', color: 'text-green-500' },
};

export default function ProjectActivityLog({ projectId }: ProjectActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();

    // Realtime subscription
    const channel = supabase
      .channel(`activity-logs-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          filter: `project_id=eq.${projectId}`
        },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      // Fetch from both activity_logs and project_activities
      const [activityLogsResult, projectActivitiesResult] = await Promise.all([
        supabase
          .from('activity_logs')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('project_activities')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const activityLogs = activityLogsResult.data || [];
      const projectActivities = projectActivitiesResult.data || [];

      // Get unique member and client IDs
      const memberIds = [...new Set([
        ...activityLogs.map(a => a.actor_agency_member).filter(Boolean),
        ...projectActivities.filter(a => a.actor_type === 'agency').map(a => a.actor_id)
      ])];
      const clientUserIds = [...new Set([
        ...activityLogs.map(a => a.actor_client_user).filter(Boolean),
        ...projectActivities.filter(a => a.actor_type === 'client').map(a => a.actor_id)
      ])];

      // Fetch profiles
      let memberProfiles: Record<string, string> = {};
      let clientProfiles: Record<string, string> = {};

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
                memberProfiles[member.id] = profile.full_name || profile.email;
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
            clientProfiles[cu.id] = cu.full_name || cu.email;
          });
        }
      }

      // Merge and enrich activities
      const enrichedActivityLogs: ActivityLog[] = activityLogs.map(log => ({
        ...log,
        details: (log.details as Record<string, any>) || {},
        actor_name: log.actor_agency_member 
          ? memberProfiles[log.actor_agency_member] || 'Team Member'
          : log.actor_client_user 
            ? clientProfiles[log.actor_client_user] || 'Client'
            : 'System',
        actor_type: log.actor_agency_member ? 'agency' : log.actor_client_user ? 'client' : 'system'
      }));

      const enrichedProjectActivities: ActivityLog[] = projectActivities.map(act => ({
        id: act.id,
        project_id: act.project_id,
        actor_agency_member: act.actor_type === 'agency' ? act.actor_id : null,
        actor_client_user: act.actor_type === 'client' ? act.actor_id : null,
        action_type: act.action,
        details: (act.payload as Record<string, any>) || {},
        created_at: act.created_at,
        actor_name: act.actor_type === 'agency' 
          ? memberProfiles[act.actor_id] || 'Team Member'
          : act.actor_type === 'client'
            ? clientProfiles[act.actor_id] || 'Client'
            : 'System',
        actor_type: act.actor_type as 'agency' | 'client' | 'system'
      }));

      // Combine and sort by date
      const allActivities = [...enrichedActivityLogs, ...enrichedProjectActivities]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDetails = (action: string, details: Record<string, any>) => {
    switch (action) {
      case 'stage_changed':
      case 'status_changed':
        return `${details.old_status || details.old_stage || '?'} → ${details.new_status || details.new_stage || '?'}`;
      case 'assigned_to_changed':
        return details.new_assignee || 'Unassigned';
      case 'rejection_added':
        return details.reason || details.rejection_reason || 'Feedback provided';
      case 'comment_added':
        return details.is_internal ? 'Internal note' : 'Client-visible comment';
      case 'scheduled_time_set':
        return details.scheduled_time ? new Date(details.scheduled_time).toLocaleString() : 'Time set';
      case 'auto_published_success':
        return details.platform || 'Published successfully';
      case 'auto_published_failed':
        return details.error || 'Publishing failed';
      case 'client_rejected':
      case 'changes_requested':
        const categoryLabel = details.rejection_category 
          ? REJECTION_CATEGORY_LABELS[details.rejection_category] || details.rejection_category
          : null;
        const reason = details.rejection_reason || details.comment;
        return categoryLabel 
          ? reason ? `${categoryLabel}: ${reason}` : categoryLabel
          : reason || 'Changes requested';
      case 'client_approved':
      case 'approved':
        return details.comment || 'Approved';
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 p-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity recorded yet.
          </p>
        ) : (
          activities.map((activity, index) => {
            const config = ACTION_CONFIG[activity.action_type] || {
              icon: ArrowRight,
              label: activity.action_type,
              color: 'text-muted-foreground'
            };
            const Icon = config.icon;
            const detailText = formatDetails(activity.action_type, activity.details);

            return (
              <div key={activity.id} className="flex gap-3 relative">
                {/* Timeline line */}
                {index < activities.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                )}
                
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted ${config.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{config.label}</span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        activity.actor_type === 'client' 
                          ? 'border-secondary text-secondary-foreground' 
                          : activity.actor_type === 'system'
                            ? 'border-muted text-muted-foreground'
                            : ''
                      }`}
                    >
                      {activity.actor_name}
                    </Badge>
                  </div>
                  
                  {detailText && (
                    <p className="text-sm text-muted-foreground">{detailText}</p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ScrollArea>
  );
}
