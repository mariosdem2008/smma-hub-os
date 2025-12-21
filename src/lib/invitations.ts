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
  portalBaseUrl: string;
  agencyName: string;
  inviterName: string;
  agencyId: string;
  clientId: string;
  fullName?: string;
  role?: "client" | "approver" | "viewer";
  inviteToken?: string;
  portalUrl?: string;
  temporaryPassword?: string;
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  const token = session?.access_token;
  if (!token) throw new Error("No active session");

  return token;
}

export async function sendTeamInviteEmail(params: SendTeamInviteParams) {
  try {
    const accessToken = await getAccessToken();
    const { data, error } = await supabase.functions.invoke('send-team-invite', {
      body: params,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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
    const accessToken = await getAccessToken();
    const { data, error } = await supabase.functions.invoke('send-portal-invite', {
      body: params,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error sending portal invite email:', error);
    return { success: false, error };
  }
}
