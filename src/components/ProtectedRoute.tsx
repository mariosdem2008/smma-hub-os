import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [checkingMembership, setCheckingMembership] = useState(true);
  const [hasMembership, setHasMembership] = useState(false);

  useEffect(() => {
    const checkMembership = async () => {
      if (!user) {
        setCheckingMembership(false);
        return;
      }

      const { data: membership } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasMembership(!!membership);
      setCheckingMembership(false);
    };

    checkMembership();
  }, [user, location.pathname]); // Re-check membership when route changes

  if (loading || checkingMembership) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user has no membership and is not on onboarding page, redirect to onboarding
  if (!hasMembership && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has membership and is on onboarding page, redirect to dashboard
  if (hasMembership && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
