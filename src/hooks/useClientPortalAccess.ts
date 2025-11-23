import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useClientPortalAccess(portalSlug?: string) {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !portalSlug) {
        setLoading(false);
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

        // Check if user has accessed this portal before
        const { data: portalUser } = await supabase
          .from("client_portal_users")
          .select("client_id")
          .eq("user_id", user.id)
          .eq("client_id", client.id)
          .maybeSingle();

        if (portalUser) {
          setClientId(portalUser.client_id);
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
  }, [user, portalSlug]);

  return { clientId, loading, hasAccess };
}
