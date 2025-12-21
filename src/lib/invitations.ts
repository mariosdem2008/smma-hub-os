import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface SendTeamInviteParams {
  inviteToken: string;
  resend?: boolean;
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
  const accessToken = await getAccessToken();

  const { data, error } = await supabase.functions.invoke("send-portal-invite", {
    body: params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  try {
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const ctx = (error as any)?.context;
        let bodyText = "";
        let bodyObj: any = null;
        try {
          if (ctx?.body) bodyText = await new Response(ctx.body).text();
          if (bodyText) bodyObj = JSON.parse(bodyText);
        } catch (_) {
          // ignore parse errors
        }

        console.error("Error sending portal invite email:", {
          message: (error as any)?.message,
          status: ctx?.status,
          bodyText,
          bodyObj,
        });

        if (bodyObj?.code && bodyObj?.error) {
          throw new Error(`${bodyObj.code}: ${bodyObj.error}`);
        }
      } else {
        console.error("Error sending portal invite email (non-http):", error);
      }
      throw error;
    }
    return { success: true, data };
  } catch (err) {
    console.error("Error sending portal invite email:", err);
    return { success: false, error: err };
  }
}
