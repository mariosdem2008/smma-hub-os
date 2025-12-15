import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading } = useAuth();

  const [membershipLoading, setMembershipLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const checkMembership = async () => {
      // 1) If not logged in, no membership
      if (!user) {
        setHasMembership(false);
        setMembershipLoading(false);
        return;
      }

      setMembershipLoading(true);

      const { data, error } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setHasMembership(!error && !!data);
      setMembershipLoading(false);
    };

    checkMembership();

    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname]); // pathname ensures it re-checks after invite/onboarding flows

  // 2) Don’t redirect while auth is unresolved
  if (loading || membershipLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // 3) HARD RULE: not logged in => always /auth
  if (!user) {
    if (location.pathname !== "/auth") {
      sessionStorage.setItem("redirectUrl", location.pathname);
    }
    return <Navigate to="/auth" replace />;
  }

  // 4) Membership routing rules
  if (!hasMembership && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  if (hasMembership && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
