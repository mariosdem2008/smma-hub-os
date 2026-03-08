import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getActiveAgencyId } from "@/lib/active-agency";

type UserRole = "owner" | "admin" | "manager" | "member" | null;

const ROLE_CACHE_TTL_MS = 2 * 60 * 1000;
const rolePromiseCache = new Map<string, Promise<UserRole>>();

function isTransientNetworkError(error: unknown) {
  const message = String((error as { message?: string })?.message ?? "");
  return (
    message.includes("TypeError: Failed to fetch") ||
    message.includes("ERR_ABORTED") ||
    message.includes("Failed to send a request to the Edge Function")
  );
}

function readRoleCache(cacheKey: string): UserRole | undefined {
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { at?: number; role?: UserRole };
    if (!parsed || typeof parsed.at !== "number") return undefined;
    if (Date.now() - parsed.at > ROLE_CACHE_TTL_MS) return undefined;
    return parsed.role ?? null;
  } catch {
    return undefined;
  }
}

function writeRoleCache(cacheKey: string, role: UserRole) {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), role }));
  } catch {
    // best-effort cache
  }
}

export function useRole() {
  const { user } = useAuth();
  const activeAgencyId = getActiveAgencyId();
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
        if (!activeAgencyId) {
          setRole(null);
          setLoading(false);
          return;
        }

        const cacheKey = `role:${user.id}:${activeAgencyId}`;
        const cachedRole = readRoleCache(cacheKey);
        if (cachedRole !== undefined) {
          setRole(cachedRole);
          return;
        }

        const requestKey = `${user.id}:${activeAgencyId}`;
        const existingPromise = rolePromiseCache.get(requestKey);
        if (existingPromise) {
          const resolved = await existingPromise;
          setRole(resolved);
          return;
        }

        const fetchPromise = (async () => {
          const { data: memberData, error: memberErr } = await supabase
            .from("agency_members")
            .select("role")
            .eq("agency_id", activeAgencyId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (memberErr) throw memberErr;

          if (memberData?.role) {
            return memberData.role as UserRole;
          }

          const { data: agencyData, error: ownerErr } = await supabase
            .from("agencies")
            .select("id")
            .eq("id", activeAgencyId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (ownerErr) throw ownerErr;

          return agencyData ? "owner" : null;
        })();

        rolePromiseCache.set(
          requestKey,
          fetchPromise.finally(() => {
            rolePromiseCache.delete(requestKey);
          })
        );
        const resolvedRole = await fetchPromise;
        writeRoleCache(cacheKey, resolvedRole);
        setRole(resolvedRole);
      } catch (error) {
        if (!isTransientNetworkError(error)) {
          console.error("Error fetching role:", error);
        }
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [user, activeAgencyId]);

  const isOwner = role === "owner";
  const isAdmin = role === "admin" || role === "owner";
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
  const canEditContent = isOwner || isAdmin;
  const canDeleteContent = isOwner || isAdmin || isManager;
  const canApproveContent = isOwner || isAdmin;
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
