import { supabase } from "@/integrations/supabase/client";

export type PendingAgencyInvite = {
  invite_id: string;
  agency_id: string;
  role: string;
  email: string;
  invited_by: string | null;
  token: string | null;
  created_at: string;
  expires_at: string | null;
  agency_name: string;
};

export async function getMyPendingAgencyInvites(): Promise<PendingAgencyInvite[]> {
  const { data, error } = await supabase.rpc("get_my_pending_agency_invites");
  if (error) throw error;
  return (data as any) ?? [];
}

export async function acceptAgencyInvite(inviteId: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_agency_invite", { _invite_id: inviteId });
  if (error) throw error;
  return data as any;
}

export async function declineAgencyInvite(inviteId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("decline_agency_invite", { _invite_id: inviteId });
  if (error) throw error;
  return Boolean(data);
}

