import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveAgencyId } from "@/lib/active-agency";

type UserRole = "owner" | "admin" | "manager" | "member" | null;

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
        const activeAgencyId = getActiveAgencyId();
        if (!activeAgencyId) {
          setRole(null);
          return;
        }

        const { data: memberData, error: memberErr } = await supabase
          .from("agency_members")
          .select("role")
          .eq("agency_id", activeAgencyId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (memberErr) throw memberErr;

        if (memberData?.role) {
          setRole(memberData.role as UserRole);
          return;
        }

        const { data: agencyData, error: ownerErr } = await supabase
          .from("agencies")
          .select("id")
          .eq("id", activeAgencyId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ownerErr) throw ownerErr;

        setRole(agencyData ? "owner" : null);
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user]);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isMember = role === "member";

  // Back-compat flags (older UI checked creator/viewer)
  const isCreator = false;
  const isViewer = isMember;
  
  const canManageTeam = isOwner || isAdmin;
  const canManageClients = isOwner || isAdmin || isManager;
  const canDeleteClients = isOwner || isAdmin || isManager;
  const canEditSettings = isOwner || isAdmin || isManager;
  const canCreateContent = isOwner || isAdmin || isManager;
  const canEditContent = isOwner || isAdmin || isManager;
  const canDeleteContent = isOwner || isAdmin || isManager;
  const canApproveContent = isOwner || isAdmin || isManager;
  const canChangeRoles = isOwner || isAdmin;
  const canRemoveTeamMembers = isOwner || isAdmin;

  return {
    role,
    loading,
    isOwner,
    isAdmin,
    isManager,
    isMember,
    isCreator,
    isViewer,
    canManageTeam,
    canManageClients,
    canDeleteClients,
    canEditSettings,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    canApproveContent,
    canChangeRoles,
    canRemoveTeamMembers,
  };
}
