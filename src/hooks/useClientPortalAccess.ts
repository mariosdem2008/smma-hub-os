import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useClientPortalAccess(portalSlug?: string) {
  const { user, loading: authLoading } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for auth to finish loading first
      if (authLoading) {
        return;
      }
      
      if (!user || !portalSlug) {
        setLoading(false);
        setHasAccess(false);
        return;
      }

      try {
        // Get the client by portal slug
        const { data: client } = await supabase
          .from("clients")
          .select("id, portal_enabled")
          .eq("portal_slug", portalSlug)
          .single();

        if (!client || !client.portal_enabled) {
          setHasAccess(false);
          setLoading(false);
          return;
        }

        // Check access using secure function that works with RLS
        const { data: isPortalUser, error: accessError } = await supabase.rpc(
          "is_client_portal_user",
          {
            _client_id: client.id,
            _user_id: user.id,
          }
        );

        if (accessError) {
          console.error("Error checking portal access via function:", accessError);
          setHasAccess(false);
        } else if (isPortalUser) {
          setClientId(client.id);
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error checking portal access:", error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, portalSlug, authLoading]);

  return { clientId, loading, hasAccess };
}
