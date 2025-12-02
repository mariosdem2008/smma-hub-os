import { supabase } from "@/integrations/supabase/client";

type ActionType = 
  | 'stage_changed'
  | 'assigned_to_changed'
  | 'rejection_added'
  | 'rejection_cleared'
  | 'comment_added'
  | 'final_asset_uploaded'
  | 'scheduled_time_set'
  | 'auto_published_success'
  | 'auto_published_failed'
  | 'client_approved'
  | 'client_rejected'
  | 'file_uploaded';

interface LogActivityParams {
  projectId: string;
  actionType: ActionType;
  details?: Record<string, any>;
  actorAgencyMember?: string;
  actorClientUser?: string;
}

export async function logActivity({
  projectId,
  actionType,
  details = {},
  actorAgencyMember,
  actorClientUser
}: LogActivityParams) {
  try {
    // If no actor specified, try to get current agency member
    if (!actorAgencyMember && !actorClientUser) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: member } = await supabase
          .from('agency_members')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          actorAgencyMember = member.id;
        }
      }
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        project_id: projectId,
        actor_agency_member: actorAgencyMember || null,
        actor_client_user: actorClientUser || null,
        action_type: actionType,
        details
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
}

export function useActivityLog() {
  return { logActivity };
}
