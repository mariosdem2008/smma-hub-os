import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type UserRole = "owner" | "manager" | "creator" | "viewer" | null;

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data: agencyData } = await supabase
          .from("agencies")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (agencyData) {
          // User is the agency owner
          setRole("owner");
        } else {
          // Check agency_members
          const { data: memberData } = await supabase
            .from("agency_members")
            .select("role")
            .eq("user_id", user.id)
            .single();

          if (memberData) {
            setRole(memberData.role as UserRole);
          } else {
            setRole(null);
          }
        }
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const canManageTeam = role === "owner";
  const canManageClients = role === "owner" || role === "manager";
  const canDeleteClients = role === "owner" || role === "manager";
  const canEditSettings = role === "owner" || role === "manager" || role === "creator";
  const canCreateContent = role === "owner" || role === "manager" || role === "creator";
  const canEditContent = role === "owner" || role === "manager" || role === "creator";
  const canDeleteContent = role === "owner" || role === "manager";
  const isViewer = role === "viewer";

  return {
    role,
    loading,
    canManageTeam,
    canManageClients,
    canDeleteClients,
    canEditSettings,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    isViewer,
  };
}
