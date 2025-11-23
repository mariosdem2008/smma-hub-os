import { supabase } from "@/integrations/supabase/client";

interface SendTeamInviteParams {
  email: string;
  inviteToken: string;
  agencyName: string;
  role: string;
  inviterName: string;
}

interface SendPortalInviteParams {
  email: string;
  clientName: string;
  portalUrl: string;
  agencyName: string;
  inviterName: string;
  temporaryPassword?: string;
}

export async function sendTeamInviteEmail(params: SendTeamInviteParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-team-invite', {
      body: params
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    return { success: false, error };
  }
}

export async function sendPortalInviteEmail(params: SendPortalInviteParams) {
  try {
    const { data, error } = await supabase.functions.invoke('send-portal-invite', {
      body: params
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error sending portal invite email:', error);
    return { success: false, error };
  }
}
