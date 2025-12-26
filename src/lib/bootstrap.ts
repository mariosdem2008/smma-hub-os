import { supabase } from "@/integrations/supabase/client";

export type BootstrapMembership = {
  agency_id: string;
  role: string;
  agency_name: string | null;
  is_owner: boolean;
};

export type BootstrapPendingInvite = {
  invite_id: string;
  agency_id: string;
  role: string;
  email: string;
  expires_at: string;
  agency_name: string | null;
};

export type UserAgencyBootstrap = {
  memberships: BootstrapMembership[];
  pending_invites: BootstrapPendingInvite[];
  last_agency_id: string | null;
};

export async function getUserAgencyBootstrap(): Promise<UserAgencyBootstrap> {
  const { data, error } = await supabase.rpc("get_user_agency_bootstrap");
  if (error) throw error;
  return data as any;
}
